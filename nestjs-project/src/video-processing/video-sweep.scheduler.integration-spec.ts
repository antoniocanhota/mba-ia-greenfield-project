import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import queueConfig from '../config/queue.config';
import {
  SWEEP_INTERVAL_MS,
  SWEEP_SCHEDULER_ID,
  SWEEP_VIDEOS_JOB,
} from '../queue/queue.constants';
import { VideoSweepScheduler } from './video-sweep.scheduler';

describe('VideoSweepScheduler (integration)', () => {
  let queue: Queue;

  beforeAll(() => {
    const { host, port } = queueConfig();
    queue = new Queue(`videos-test-${randomBytes(4).toString('hex')}`, {
      connection: { host, port },
    });
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('should keep exactly one sweep-videos scheduler across repeated bootstraps', async () => {
    await new VideoSweepScheduler(queue).onApplicationBootstrap();
    await new VideoSweepScheduler(queue).onApplicationBootstrap();

    const schedulers = await queue.getJobSchedulers();

    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]).toMatchObject({
      key: SWEEP_SCHEDULER_ID,
      name: SWEEP_VIDEOS_JOB,
      every: SWEEP_INTERVAL_MS,
    });
  });
});
