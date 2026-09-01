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
    const { jobId } = req.params;
    const { technicianId } = req.body;

    if (!technicianId) {
      res.status(400).json({ error: 'technicianId is required' });
      return;
    }

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.archivedAt) { res.status(400).json({ error: 'Cannot assign to an archived job' }); return; }
    if (job.status === 'COMPLETED') { res.status(400).json({ error: 'Cannot assign to a completed job' }); return; }

    // Verify technician exists and is a technician
    const tech = await prisma.user.findUnique({ where: { id: technicianId } });
    if (!tech || tech.role !== 'TECHNICIAN') {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    // Check already assigned
    const alreadyAssigned = await prisma.jobAssignment.findFirst({
      where: { jobId, technicianId, unassignedAt: null },
    });
    if (alreadyAssigned) {
      res.status(409).json({ error: `${tech.name} is already assigned to this job` });
      return;
    }

    // Overlap check
    const existingWindows = await getTechnicianWindows(technicianId, jobId);
    const conflict = findOverlap(existingWindows, {
      scheduledDate: job.scheduledDate,
      startTime: job.startTime,
      estimatedDurationMinutes: job.estimatedDurationMinutes,
    });

    if (conflict) {
      res.status(409).json({
        error: `Scheduling conflict: ${tech.name} is already assigned to "${(conflict as { customerName?: string }).customerName ?? 'another job'}" which overlaps this window (${job.startTime}, ${job.estimatedDurationMinutes} min)`,
      });
      return;
    }

    // Create assignment + update job status if UNASSIGNED
    const [assignment] = await prisma.$transaction([
      prisma.jobAssignment.create({ data: { jobId, technicianId } }),
      ...(job.status === 'UNASSIGNED'
        ? [prisma.job.update({ where: { id: jobId }, data: { status: 'ASSIGNED' } })]
        : []),
    ]);

    // Log events
    await writeEvent({ jobId, type: 'ASSIGNED', oldValue: null, newValue: tech.name, actorId: req.user!.id });
    if (job.status === 'UNASSIGNED') {
      await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED', actorId: req.user!.id });
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
    const { jobId, technicianId } = req.params;

    const assignment = await prisma.jobAssignment.findFirst({
      where: { jobId, technicianId, unassignedAt: null },
      include: { technician: true },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Mark as unassigned (soft delete — preserves history)
    await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: { unassignedAt: new Date() },
    });

    // If no more active assignments, move job back to UNASSIGNED
    const remainingAssignments = await prisma.jobAssignment.count({
      where: { jobId, unassignedAt: null },
    });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (remainingAssignments === 0 && job?.status === 'ASSIGNED') {
      await prisma.job.update({ where: { id: jobId }, data: { status: 'UNASSIGNED' } });
      await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'UNASSIGNED', actorId: req.user!.id });
    }

    await writeEvent({
      jobId, type: 'UNASSIGNED',
      oldValue: assignment.technician.name,
      newValue: null,
      actorId: req.user!.id,
    });

    res.json({ message: `${assignment.technician.name} unassigned successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /assignments/bulk-assign ───────────────────────────────────────────
// Body: { technicianId: string, jobIds: string[] }
// Returns per-job result — never fails the whole batch for one conflict
router.post('/bulk-assign', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const { technicianId, jobIds } = req.body;

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

    // Process each job independently
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

        // Overlap check — include all assignments including ones added in this batch
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

        // Assign
        await prisma.$transaction([
          prisma.jobAssignment.create({ data: { jobId, technicianId } }),
          ...(job.status === 'UNASSIGNED'
            ? [prisma.job.update({ where: { id: jobId }, data: { status: 'ASSIGNED' } })]
            : []),
        ]);

        await writeEvent({ jobId, type: 'ASSIGNED', oldValue: null, newValue: tech.name, actorId: req.user!.id });
        if (job.status === 'UNASSIGNED') {
          await writeEvent({ jobId, type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED', actorId: req.user!.id });
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
