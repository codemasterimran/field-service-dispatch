import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma';

const router = Router();

// ── Rate limiter: 10 login attempts per 15 minutes per IP ─────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — please try again in 15 minutes' },
});

// ── POST /auth/register ───────────────────────────────────────────────────────
// Self-registration is TECHNICIAN only. DISPATCHERs must be created via seed/admin.
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Role is always TECHNICIAN — no privilege escalation possible
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'TECHNICIAN' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: '8h' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Re-read role from DB (not from a stale token) so role changes take effect immediately
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: '8h' }   // reduced from 7d — limits stale-role window
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// Always re-fetches role from DB — handles mid-session role changes
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ── GET /auth/technicians ─────────────────────────────────────────────────────
router.get('/technicians', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { role: string };
    if (payload.role !== 'DISPATCHER') {
      res.status(403).json({ error: 'Dispatcher only' });
      return;
    }

    const users = await prisma.user.findMany({
      where: { role: 'TECHNICIAN' },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
