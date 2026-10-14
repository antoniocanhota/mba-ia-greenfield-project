import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  SWEEP_INTERVAL_MS,
  SWEEP_SCHEDULER_ID,
  SWEEP_VIDEOS_JOB,
  VIDEOS_QUEUE,
} from '../queue/queue.constants';

// Upsert by scheduler ID: restarting the worker (or running several) keeps one schedule.
@Injectable()
export class VideoSweepScheduler implements OnApplicationBootstrap {
  constructor(@InjectQueue(VIDEOS_QUEUE) private readonly videosQueue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.videosQueue.upsertJobScheduler(
      SWEEP_SCHEDULER_ID,
      { every: SWEEP_INTERVAL_MS },
      { name: SWEEP_VIDEOS_JOB },
    );
  }
}
