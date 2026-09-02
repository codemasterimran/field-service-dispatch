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
    // Fetch all active, non-completed jobs scheduled in the past
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0); // start of today

    const candidates = await prisma.job.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ['COMPLETED', 'UNASSIGNED'] },
        scheduledDate: { lt: cutoff }, // only past dates — avoids false positives for today until we check time
      },
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { technician: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
      orderBy: [{ scheduledDate: 'asc' }, { priority: 'asc' }],
    });

    // Also fetch today's jobs that have gone past their window
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

    // Fetch dismissed alerts for this dispatcher
    const dismissed = await prisma.alertDismissal.findMany({
      where: { dismissedById: req.user!.id },
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

// ─── POST /alerts/:jobId/dismiss — dispatcher dismisses an alert ──────────────
router.post('/:jobId/dismiss', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    // Upsert — idempotent
    await prisma.alertDismissal.upsert({
      where: { jobId_dismissedById: { jobId, dismissedById: req.user!.id } },
      create: { jobId, dismissedById: req.user!.id },
      update: {},
    });

    res.json({ message: 'Alert dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /alerts/:jobId/dismiss — un-dismiss ───────────────────────────────
router.delete('/:jobId/dismiss', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    await prisma.alertDismissal.deleteMany({
      where: { jobId, dismissedById: req.user!.id },
    });
    res.json({ message: 'Alert restored' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
