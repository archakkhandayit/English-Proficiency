import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { attemptEvents } from '../services/events.service.js';
import { db } from '../config/db.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const eventsRouter = Router();

// GET /api/events/attempts/:id (Server-Sent Events)
eventsRouter.get('/attempts/:id', requireAuth, async (req, res) => {
  const { id: attemptId } = req.params;
  const user = req.user!;

  try {
    const [attempt] = await db
      .select({
        id: schema.attempts.id,
        candidateId: schema.attempts.candidateId,
        status: schema.attempts.status,
      })
      .from(schema.attempts)
      .where(eq(schema.attempts.id, attemptId))
      .limit(1);

    if (!attempt) {
      res.status(404).json({ error: 'Attempt not found.' });
      return;
    }

    if (user.role !== 'admin' && attempt.candidateId !== user.userId) {
      res.status(403).json({ error: 'Unauthorized to monitor this attempt.' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Send immediate initial status
    res.write(`data: ${JSON.stringify({ status: attempt.status })}\n\n`);

    if (attempt.status === 'evaluated' || attempt.status === 'evaluation_failed') {
      res.end();
      return;
    }
  } catch (err) {
    console.error('Error in SSE initialization:', err);
    res.status(500).json({ error: 'Internal SSE error' });
    return;
  }

  const listener = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.status === 'evaluated' || data.status === 'evaluation_failed') {
      attemptEvents.off(`attempt:${attemptId}`, listener);
      res.end();
    }
  };

  attemptEvents.on(`attempt:${attemptId}`, listener);

  // Heartbeat ping every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    attemptEvents.off(`attempt:${attemptId}`, listener);
  });
});

