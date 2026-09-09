import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue/connection.js';
import { evaluateAttempt } from '../services/evaluation.service.js';

interface EvaluationJobData {
  attemptId: string;
}

export function startEvaluationWorker(): Worker {
  console.log('[BullMQ] Starting Evaluation Worker (concurrency: 3)...');

  const worker = new Worker<EvaluationJobData>(
    'evaluation',
    async (job: Job<EvaluationJobData>) => {
      const { attemptId } = job.data;
      console.log(`[BullMQ Job ${job.id}] Processing evaluation for attempt ${attemptId}...`);
      await evaluateAttempt(attemptId);
      console.log(`[BullMQ Job ${job.id}] Finished evaluation for attempt ${attemptId}.`);
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed:`, err);
  });

  return worker;
}

