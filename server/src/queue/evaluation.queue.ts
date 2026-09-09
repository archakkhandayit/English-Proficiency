import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const evaluationQueue = new Queue('evaluation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function enqueueEvaluation(attemptId: string): Promise<void> {
  await evaluationQueue.add('evaluate-attempt', { attemptId }, {
    jobId: `eval-${attemptId}`,
  });
}

