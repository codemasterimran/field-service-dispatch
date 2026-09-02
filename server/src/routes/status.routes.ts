import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { writeEvent } from '../services/timeline.service';
import { JobStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ─── Valid transitions by current status ─────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  UNASSIGNED: [],                       // must be assigned first
  ASSIGNED:   ['EN_ROUTE'],
  EN_ROUTE:   ['ON_SITE'],
  ON_SITE:    ['COMPLETED'],
  COMPLETED:  [],                       // terminal state
};

// ─── PATCH /status/:jobId — technician advances status ───────────────────────
router.patch('/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { status, completionNote } = req.body as {
      status: JobStatus;
      completionNote?: string;
    };

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.archivedAt) { res.status(400).json({ error: 'Cannot update status of archived job' }); return; }

    // Role check — technicians can only update their own jobs
    const user = req.user!;
    if (user.role === 'TECHNICIAN') {
      const assignment = await prisma.jobAssignment.findFirst({
        where: { jobId, technicianId: user.id, unassignedAt: null },
      });
      if (!assignment) {
        res.status(403).json({ error: 'You are not assigned to this job' });
        return;
      }
    }

    // State machine validation
    const allowed = ALLOWED_TRANSITIONS[job.status];
    if (!allowed.includes(status)) {
      res.status(422).json({
        error: `Cannot transition from ${job.status} to ${status}. Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`,
      });
      return;
    }

    // Completion requires a note
    if (status === 'COMPLETED' && !completionNote?.trim()) {
      res.status(400).json({ error: 'completionNote is required when marking a job as COMPLETED' });
      return;
    }

    const updateData: { status: JobStatus; completionNote?: string } = { status };
    if (status === 'COMPLETED') updateData.completionNote = completionNote!.trim();

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });

    // Record timeline event
    await writeEvent({
      jobId,
      type: status === 'COMPLETED' ? 'COMPLETION' : 'STATUS_CHANGE',
      oldValue: job.status,
      newValue: status,
      actorId: user.id,
    });

    if (status === 'COMPLETED' && completionNote?.trim()) {
      await writeEvent({
        jobId,
        type: 'NOTE',
        oldValue: null,
        newValue: completionNote.trim(),
        actorId: user.id,
      });
    }

    res.json({ job: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
