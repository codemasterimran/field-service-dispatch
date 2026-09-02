import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { writeEvent } from '../services/timeline.service';

const router = Router();

// All job routes require auth
router.use(authenticate);

// ─── POST /jobs — create (dispatcher only) ───────────────────────────────────
router.post('/', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const {
      customerName, siteAddress, description, priority,
      scheduledDate, startTime, estimatedDurationMinutes,
    } = req.body;

    if (!customerName || !siteAddress || !description || !scheduledDate || !startTime || !estimatedDurationMinutes) {
      res.status(400).json({ error: 'customerName, siteAddress, description, scheduledDate, startTime, estimatedDurationMinutes are required' });
      return;
    }

    const job = await prisma.job.create({
      data: {
        customerName,
        siteAddress,
        description,
        priority: Number(priority) || 2,
        scheduledDate: new Date(scheduledDate),
        startTime,
        estimatedDurationMinutes: Number(estimatedDurationMinutes),
        status: 'UNASSIGNED',
      },
    });

    await writeEvent({
      jobId: job.id,
      type: 'STATUS_CHANGE',
      oldValue: null,
      newValue: 'UNASSIGNED',
      actorId: req.user!.id as string,
    });

    res.status(201).json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /jobs — list with filters (dispatcher sees all, tech sees own) ───────
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search, status, technicianId, date,
      sortBy = 'scheduledDate', sortDir = 'asc',
      page = '1', pageSize = '20',
      archived = 'false',
    } = req.query as Record<string, string>;

    const user = req.user!;
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    // Build WHERE clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Technicians can only see their own jobs — enforced in query, not just UI
    if (user.role === 'TECHNICIAN') {
      where.assignments = {
        some: {
          technicianId: user.id as string,
          unassignedAt: null,
        },
      };
    }

    // Archived filter
    if (archived === 'true') {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    // Search: customerName or siteAddress (case-insensitive)
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { siteAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status) where.status = status;

    // Technician filter (dispatcher only)
    if (technicianId && user.role === 'DISPATCHER') {
      where.assignments = {
        some: { technicianId, unassignedAt: null },
      };
    }

    // Date filter
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.scheduledDate = { gte: d, lt: next };
    }

    // Sort
    const validSortFields = ['scheduledDate', 'priority', 'status', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'scheduledDate';
    const orderDir = sortDir === 'desc' ? 'desc' : 'asc';

    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take,
        orderBy: { [orderField]: orderDir },
        include: {
          assignments: {
            where: { unassignedAt: null },
            include: { technician: { select: { id: true, name: true, email: true, role: true } } },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ data: jobs, totalCount, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /jobs/:id — full detail ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const job = await prisma.job.findUnique({
      where: { id: req.params.id as string },
      include: {
        assignments: {
          include: { technician: { select: { id: true, name: true, email: true, role: true } } },
        },
        partsUsed: {
          include: { recordedBy: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Technician can only access jobs assigned to them
    if (user.role === 'TECHNICIAN') {
      const isAssigned = job.assignments.some(
        a => a.technicianId === user.id && !a.unassignedAt
      );
      if (!isAssigned) {
        res.status(403).json({ error: 'You are not assigned to this job' });
        return;
      }
    }

    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /jobs/:id/timeline — audit trail ─────────────────────────────────────
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const jobId = req.params.id as string;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

    // Technicians can only access timelines for their own assigned jobs
    if (user.role === 'TECHNICIAN') {
      const isAssigned = job.assignments.some(
        a => a.technicianId === (user.id as string) && !a.unassignedAt
      );
      if (!isAssigned) {
        res.status(403).json({ error: 'You are not assigned to this job' });
        return;
      }
    }

    const events = await prisma.jobEvent.findMany({
      where: { jobId },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ events, count: events.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /jobs/:id — edit details (dispatcher only, NOT assignments) ────────
router.patch('/:id', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const allowed = [
      'customerName', 'siteAddress', 'description',
      'priority', 'scheduledDate', 'startTime', 'estimatedDurationMinutes',
    ];

    // Strip any fields not in the allowed list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = key === 'scheduledDate'
          ? new Date(req.body[key])
          : key === 'priority' || key === 'estimatedDurationMinutes'
            ? Number(req.body[key])
            : req.body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const existing = await prisma.job.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data,
    });

    await writeEvent({
      jobId: job.id,
      type: 'NOTE',
      oldValue: null,
      newValue: `Job details updated by ${req.user!.name}`,
      actorId: req.user!.id as string,
    });

    res.json({ job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /jobs/:id/archive ──────────────────────────────────────────────────
router.patch('/:id/archive', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id as string } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (job.archivedAt) { res.status(400).json({ error: 'Job is already archived' }); return; }

    const updated = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { archivedAt: new Date() },
    });

    await writeEvent({
      jobId: job.id, type: 'NOTE',
      oldValue: null, newValue: 'Job archived',
      actorId: req.user!.id as string,
    });

    res.json({ job: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /jobs/:id/restore ──────────────────────────────────────────────────
router.patch('/:id/restore', requireRole('DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id as string } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    if (!job.archivedAt) { res.status(400).json({ error: 'Job is not archived' }); return; }

    const updated = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { archivedAt: null },
    });

    await writeEvent({
      jobId: job.id, type: 'NOTE',
      oldValue: null, newValue: 'Job restored from archive',
      actorId: req.user!.id as string,
    });

    res.json({ job: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
