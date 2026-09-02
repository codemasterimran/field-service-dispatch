import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { writeEvent } from '../services/timeline.service';

const router = Router();
router.use(authenticate);

router.post('/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const { partName, quantity } = req.body as { partName?: string; quantity?: number };

    if (!partName?.trim()) {
      res.status(400).json({ error: 'partName is required' });
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty < 1) {
      res.status(400).json({ error: 'quantity must be a positive integer' });
      return;
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    const user = req.user!;
    const actorId = user.id as string;

    if (user.role === 'TECHNICIAN') {
      const assignment = await prisma.jobAssignment.findFirst({
        where: { jobId, technicianId: actorId, unassignedAt: null },
      });
      if (!assignment) {
        res.status(403).json({ error: 'You are not assigned to this job' });
        return;
      }
    }

    if (job.status === 'UNASSIGNED' || job.status === 'ASSIGNED') {
      res.status(400).json({ error: 'Parts can only be added once a technician is en-route or on-site' });
      return;
    }

    const part = await prisma.partUsed.create({
      data: {
        jobId,
        partName: partName.trim(),
        quantity: qty,
        recordedById: actorId,
      },
      include: { recordedBy: { select: { id: true, name: true, role: true } } },
    });

    await writeEvent({
      jobId,
      type: 'PART_ADDED',
      oldValue: null,
      newValue: `${qty}× ${partName.trim()}`,
      actorId,
    });

    res.status(201).json({ part });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
