import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes — added per phase
import authRoutes from './routes/auth.routes';
import jobRoutes from './routes/jobs.routes';
import assignmentRoutes from './routes/assignments.routes';
import statusRoutes from './routes/status.routes';
import partsRoutes from './routes/parts.routes';
import alertsRoutes from './routes/alerts.routes';

app.use('/auth', authRoutes);
app.use('/jobs', jobRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/status', statusRoutes);
app.use('/parts', partsRoutes);
app.use('/alerts', alertsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
