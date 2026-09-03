import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
router.use(authenticate);
router.use(requireRole('DISPATCHER'));

// ─── GET /dashboard — server-side aggregated stats ───────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // 14-day window for the chart
    const fourteenDaysAgo = new Date(todayStart);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

    const [
      totalActive,
      byStatus,
      todayJobs,
      unassigned,
      completedLast14,
      techStats,
    ] = await Promise.all([
      // Total non-archived jobs
      prisma.job.count({ where: { archivedAt: null } }),

      // Count per status
      prisma.job.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: { status: true },
      }),

      // Today's jobs
      prisma.job.findMany({
        where: {
          archivedAt: null,
          scheduledDate: { gte: todayStart, lt: todayEnd },
        },
        select: { id: true, status: true },
      }),

      // Unassigned count
      prisma.job.count({ where: { archivedAt: null, status: 'UNASSIGNED' } }),

      // Completed jobs in last 14 days (for chart)
      prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          scheduledDate: { gte: fourteenDaysAgo, lt: todayEnd },
        },
        select: { scheduledDate: true },
      }),

      // Per-technician job counts
      prisma.jobAssignment.groupBy({
        by: ['technicianId'],
        where: {
          unassignedAt: null,
          job: { archivedAt: null, status: { not: 'COMPLETED' } },
        },
        _count: { technicianId: true },
      }),
    ]);

    // Build status map
    const statusMap: Record<string, number> = {};
    for (const row of byStatus) {
      statusMap[row.status] = row._count.status;
    }

    // Today stats
    const todayTotal = todayJobs.length;
    const todayCompleted = todayJobs.filter(j => j.status === 'COMPLETED').length;

    // 14-day completed-per-day chart data
    const chartData: { date: string; completed: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = completedLast14.filter(
        j => j.scheduledDate.toISOString().slice(0, 10) === dateStr
      ).length;
      chartData.push({ date: dateStr, completed: count });
    }

    // Technician workload (jobId, name)
    const techIds = techStats.map(t => t.technicianId);
    const techs = techIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: techIds } },
          select: { id: true, name: true },
        })
      : [];

    const techNameMap = Object.fromEntries(techs.map(t => [t.id, t.name]));
    const techWorkload = techStats.map(t => ({
      id: t.technicianId,
      name: techNameMap[t.technicianId] ?? 'Unknown',
      activeJobs: t._count.technicianId,
    })).sort((a, b) => b.activeJobs - a.activeJobs);

    res.json({
      totalActive,
      byStatus: statusMap,
      today: { total: todayTotal, completed: todayCompleted },
      unassigned,
      chartData,   // 14-day completion chart
      techWorkload,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /dashboard/export.csv?date=YYYY-MM-DD — dispatch sheet for one day ──
router.get('/export.csv', async (req: Request, res: Response) => {
  try {
    const dateParam = req.query.date as string | undefined;

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: '?date=YYYY-MM-DD is required' });
      return;
    }

    const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
    const dayEnd   = new Date(dayStart.getTime() + 86400000);

    if (isNaN(dayStart.getTime())) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }

    const jobs = await prisma.job.findMany({
      where: {
        archivedAt: null,
        scheduledDate: { gte: dayStart, lt: dayEnd },
      },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { technician: { select: { name: true, email: true } } },
        },
        partsUsed: { select: { partName: true, quantity: true } },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

    const rows = jobs.map(j => {
      const technicians = j.assignments.map(a => a.technician.name).join('; ');
      const parts = j.partsUsed.map(p => `${p.quantity}× ${p.partName}`).join('; ');
      const scheduledDate = j.scheduledDate.toISOString().slice(0, 10);

      // Escape fields that may contain commas or quotes
      const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

      return [
        escape(j.id),
        escape(j.customerName),
        escape(j.siteAddress),
        escape(scheduledDate),
        escape(j.startTime),
        escape(String(j.estimatedDurationMinutes)),
        escape(PRIORITY_LABEL[j.priority] ?? String(j.priority)),
        escape(j.status),
        escape(technicians),
        escape(parts),
        escape(j.completionNote ?? ''),
      ].join(',');
    });

    const header = [
      'ID', 'Customer', 'Site Address', 'Date', 'Start Time',
      'Duration (min)', 'Priority', 'Status', 'Technicians', 'Parts Used', 'Completion Note',
    ].map(h => `"${h}"`).join(',');

    const csv = [header, ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dispatch-${dateParam}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
