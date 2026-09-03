import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { findOverlap } from '../services/overlap.service';
import { writeEvent } from '../services/timeline.service';

const router = Router();
router.use(authenticate);

// ─── Helper: get a technician's active assignment windows ────────────────────
async function getTechnicianWindows(technicianId: string, excludeJobId?: string) {
  const assignments = await prisma.jobAssignment.findMany({
    where: {
      technicianId,
      unassignedAt: null,
      job: {
        status: { not: 'COMPLETED' },
        archivedAt: null,
        ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      },
    },
    include: {
      job: {
        select: {
          id: true,
          customerName: true,
          scheduledDate: true,
          startTime: true,
          estimatedDurationMinutes: true,
        },
      },
    },
  });

  return assignments.map(a => ({
    scheduledDate: a.job.scheduledDate,
    startTime: a.job.startTime,
    estimatedDurationMinutes: a.job.estimatedDurationMinutes,
    jobId: a.job.id,
    customerName: a.job.customerName,
  }));
}

// ─── POST /assignments/:jobId/assign ─────────────────────────────────────────
router.post('/:jobId/assign', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const { technicianId } = req.body as { technicianId: string };

    if (!technicianId) {
      res.status(400).json({ error: 'technicianId is required' });
      return;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.archivedAt) { res.status(400).json({ error: 'Cannot assign to an archived job' }); return; }
    if (job.status === 'COMPLETED') { res.status(400).json({ error: 'Cannot assign to a completed job' }); return; }

    const tech = await prisma.user.findUnique({ where: { id: technicianId } });
    if (!tech || tech.role !== 'TECHNICIAN') {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    // ── Advisory lock + overlap check + insert — all in ONE transaction ──────
    // pg_advisory_xact_lock(key) acquires a session-level exclusive lock keyed
    // on hashtext(technicianId). Any concurrent assign for the SAME technician
    // will block here until the first transaction commits or rolls back.
    // This closes the check-then-insert race condition entirely.
    let assignment: { id: string; jobId: string; technicianId: string; assignedAt: Date; unassignedAt: Date | null };
    let statusChanged = false;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Acquire per-technician advisory lock — held for the duration of this transaction.
        // Uses the two-argument int4 overload (namespace=1, key=hashtext(id)::int4).
        // Any concurrent assign for the SAME technicianId blocks here until we commit/rollback.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1, hashtext(${technicianId})::int4)`;

        // Re-check duplicate inside the lock
        const alreadyAssigned = await tx.jobAssignment.findFirst({
          where: { jobId, technicianId, unassignedAt: null },
        });
        if (alreadyAssigned) {
          throw Object.assign(new Error('DUPLICATE'), { code: 409, msg: `${tech.name} is already assigned to this job` });
        }

        // Re-fetch technician windows inside the lock
        const existingAssignments = await tx.jobAssignment.findMany({
          where: {
            technicianId,
            unassignedAt: null,
            job: {
              status: { not: 'COMPLETED' },
              archivedAt: null,
              id: { not: jobId },
            },
          },
          include: {
            job: {
              select: {
                id: true,
                customerName: true,
                scheduledDate: true,
                startTime: true,
                estimatedDurationMinutes: true,
              },
            },
          },
        });

        const windows = existingAssignments.map(a => ({
          scheduledDate: a.job.scheduledDate,
          startTime: a.job.startTime,
          estimatedDurationMinutes: a.job.estimatedDurationMinutes,
          jobId: a.job.id,
          customerName: a.job.customerName,
        }));

        const conflict = findOverlap(windows, {
          scheduledDate: job.scheduledDate,
          startTime: job.startTime,
          estimatedDurationMinutes: job.estimatedDurationMinutes,
        });

        if (conflict) {
          throw Object.assign(new Error('CONFLICT'), {
            code: 409,
            msg: `Scheduling conflict: ${tech.name} is already assigned to "${(conflict as { customerName?: string }).customerName ?? 'another job'}" which overlaps this window (${job.startTime}, ${job.estimatedDurationMinutes} min)`,
          });
        }

        const newAssignment = await tx.jobAssignment.create({ data: { jobId, technicianId } });

        if (job.status === 'UNASSIGNED') {
          await tx.job.update({ where: { id: jobId }, data: { status: 'ASSIGNED' } });
        }

        return newAssignment;
      });

      assignment = result;
      statusChanged = job.status === 'UNASSIGNED';
    } catch (err: unknown) {
      const e = err as { code?: number; msg?: string };
      if (e.code === 409) {
        res.status(409).json({ error: e.msg });
        return;
      }
      throw err;
    }

    await writeEvent({ jobId, type: 'ASSIGNED', oldValue: null, newValue: tech.name, actorId: req.user!.id as string });
    if (statusChanged) {
      await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED', actorId: req.user!.id as string });
    }

    res.status(201).json({ assignment, message: `${tech.name} assigned successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /assignments/:jobId/assign/:technicianId ─────────────────────────
router.delete('/:jobId/assign/:technicianId', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const technicianId = req.params.technicianId as string;

    const assignment = await prisma.jobAssignment.findFirst({
      where: { jobId, technicianId, unassignedAt: null },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const tech = await prisma.user.findUnique({ where: { id: technicianId }, select: { name: true } });
    const techName = tech?.name ?? technicianId;

    await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: { unassignedAt: new Date() },
    });

    const remainingAssignments = await prisma.jobAssignment.count({
      where: { jobId, unassignedAt: null },
    });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (remainingAssignments === 0 && job?.status === 'ASSIGNED') {
      await prisma.job.update({ where: { id: jobId }, data: { status: 'UNASSIGNED' } });
      await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'UNASSIGNED', actorId: req.user!.id as string });
    }

    await writeEvent({
      jobId, type: 'UNASSIGNED',
      oldValue: techName,
      newValue: null,
      actorId: req.user!.id as string,
    });

    res.json({ message: `${techName} unassigned successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /assignments/bulk-assign ───────────────────────────────────────────
router.post('/bulk-assign', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const { technicianId, jobIds } = req.body as { technicianId: string; jobIds: string[] };

    if (!technicianId || !Array.isArray(jobIds) || jobIds.length === 0) {
      res.status(400).json({ error: 'technicianId and jobIds[] are required' });
      return;
    }

    const tech = await prisma.user.findUnique({ where: { id: technicianId } });
    if (!tech || tech.role !== 'TECHNICIAN') {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const results: { jobId: string; success: boolean; reason?: string }[] = [];

    for (const jobId of jobIds) {
      try {
        const job = await prisma.job.findUnique({ where: { id: jobId } });

        if (!job) {
          results.push({ jobId, success: false, reason: 'Job not found' });
          continue;
        }
        if (job.archivedAt) {
          results.push({ jobId, success: false, reason: 'Job is archived' });
          continue;
        }
        if (job.status === 'COMPLETED') {
          results.push({ jobId, success: false, reason: 'Job is already completed' });
          continue;
        }

        const alreadyAssigned = await prisma.jobAssignment.findFirst({
          where: { jobId, technicianId, unassignedAt: null },
        });
        if (alreadyAssigned) {
          results.push({ jobId, success: false, reason: `${tech.name} is already assigned` });
          continue;
        }

        const existingWindows = await getTechnicianWindows(technicianId, jobId);
        const conflict = findOverlap(existingWindows, {
          scheduledDate: job.scheduledDate,
          startTime: job.startTime,
          estimatedDurationMinutes: job.estimatedDurationMinutes,
        });

        if (conflict) {
          results.push({
            jobId,
            success: false,
            reason: `Scheduling conflict: overlaps with "${(conflict as { customerName?: string }).customerName ?? 'another job'}"`,
          });
          continue;
        }

        await prisma.$transaction([
          prisma.jobAssignment.create({ data: { jobId, technicianId } }),
          ...(job.status === 'UNASSIGNED'
            ? [prisma.job.update({ where: { id: jobId }, data: { status: 'ASSIGNED' } })]
            : []),
        ]);

        await writeEvent({ jobId, type: 'ASSIGNED', oldValue: null, newValue: tech.name, actorId: req.user!.id as string });
        if (job.status === 'UNASSIGNED') {
          await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED', actorId: req.user!.id as string });
        }

        results.push({ jobId, success: true });
      } catch {
        results.push({ jobId, success: false, reason: 'Unexpected error' });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    res.json({
      results,
      summary: `${succeeded} of ${jobIds.length} assignments succeeded`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
