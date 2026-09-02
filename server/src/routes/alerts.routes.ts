import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
router.use(authenticate);

/**
 * A job is "late" when:
 *   - status is NOT COMPLETED and NOT UNASSIGNED
 *   - scheduledDate + startTime + estimatedDurationMinutes < NOW
 *   - not archived
 */
function isJobLate(job: {
  scheduledDate: Date;
  startTime: string;
  estimatedDurationMinutes: number;
}): boolean {
  const [hh, mm] = job.startTime.split(':').map(Number);
  const jobStart = new Date(job.scheduledDate);
  jobStart.setHours(hh, mm, 0, 0);
  const jobEnd = new Date(jobStart.getTime() + job.estimatedDurationMinutes * 60000);
  return jobEnd < new Date();
}

// ─── GET /alerts — late jobs (dispatcher only) ────────────────────────────────
router.get('/', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);

    const candidates = await prisma.job.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ['COMPLETED', 'UNASSIGNED'] },
        scheduledDate: { lt: cutoff },
      },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { technician: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
      orderBy: [{ scheduledDate: 'asc' }, { priority: 'asc' }],
    });

    const todayCandidates = await prisma.job.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ['COMPLETED', 'UNASSIGNED'] },
        scheduledDate: {
          gte: cutoff,
          lt: new Date(cutoff.getTime() + 86400000),
        },
      },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { technician: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    const allCandidates = [...candidates, ...todayCandidates.filter(j => isJobLate(j))];

    const dismissed = await prisma.alertDismissal.findMany({
      where: { dismissedById: req.user!.id as string },
      select: { jobId: true },
    });
    const dismissedJobIds = new Set(dismissed.map(d => d.jobId));

    const lateJobs = allCandidates.filter(j => !dismissedJobIds.has(j.id));

    res.json({
      alerts: lateJobs.map(j => ({
        ...j,
        scheduledDate: j.scheduledDate.toISOString(),
        archivedAt: j.archivedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
      })),
      count: lateJobs.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /alerts/:jobId/dismiss ─────────────────────────────────────────────
router.post('/:jobId/dismiss', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const dismissedById = req.user!.id as string;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    // Check if already dismissed first, then create
    const existing = await prisma.alertDismissal.findFirst({
      where: { jobId, dismissedById },
    });

    if (!existing) {
      await prisma.alertDismissal.create({ data: { jobId, dismissedById } });
    }

    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /alerts/:jobId/dismiss — un-dismiss ───────────────────────────────
router.delete('/:jobId/dismiss', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const dismissedById = req.user!.id as string;

    await prisma.alertDismissal.deleteMany({
      where: { jobId, dismissedById },
    });
    res.json({ message: 'Alert restored' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
