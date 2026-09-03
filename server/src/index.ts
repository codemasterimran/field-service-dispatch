import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — explicit allowlist only ───────────────────────────────────────────
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

// ── Body parsing with size cap ────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import jobRoutes from './routes/jobs.routes';
import assignmentRoutes from './routes/assignments.routes';
import statusRoutes from './routes/status.routes';
import partsRoutes from './routes/parts.routes';
import alertsRoutes from './routes/alerts.routes';
import dashboardRoutes from './routes/dashboard.routes';

app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/status', statusRoutes);
app.use('/parts', partsRoutes);
app.use('/alerts', alertsRoutes);
app.use('/dashboard', dashboardRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
