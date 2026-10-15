import { getQueueToken } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import queueConfig from '../config/queue.config';
import { TEST_QUEUE_PREFIX } from '../test/test-queue-prefix';
import { VIDEOS_QUEUE } from './queue.constants';
import { QueueModule } from './queue.module';

describe('QueueModule', () => {
  it('should compile and expose the videos queue token', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [queueConfig] }),
        QueueModule,
      ],
    }).compile();

    const queue = module.get<Queue>(getQueueToken(VIDEOS_QUEUE));

    expect(queue).toBeDefined();
    expect(queue.name).toBe(VIDEOS_QUEUE);
    await module.close();
  }, 30000);

  it('should connect the queue to the Redis service', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [queueConfig] }),
        QueueModule,
      ],
    }).compile();
    const queue = module.get<Queue>(getQueueToken(VIDEOS_QUEUE));

    await queue.waitUntilReady();

    await expect(queue.getJobCounts()).resolves.toBeDefined();
    await module.close();
  }, 30000);

  it('should register the videos queue under the configured key prefix', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [queueConfig] }),
        QueueModule,
      ],
    }).compile();
    const queue = module.get<Queue>(getQueueToken(VIDEOS_QUEUE));

    expect(queue.opts.prefix).toBe(TEST_QUEUE_PREFIX);
    await module.close();
  }, 30000);
});
