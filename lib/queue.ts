import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    queue = new Queue('message-queue', { connection });
  }
  return queue;
}

export const messageQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue().add(...args),
};
