import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { candidateRouter } from './routes/candidate.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { startEvaluationWorker } from './workers/evaluation.worker.js';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/candidate', candidateRouter);
app.use('/api/admin', adminRouter);
app.use('/api/events', eventsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Exception]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start background worker
startEvaluationWorker();

// Start HTTP server
app.listen(env.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TCS NQT English Assessment Server`);
  console.log(`📡 Listening on http://localhost:${env.PORT}`);
  console.log(`⚙️  Environment: ${env.NODE_ENV}`);
  console.log(`=======================================================`);
});

