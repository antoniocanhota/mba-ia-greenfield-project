import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  PROCESS_VIDEO_JOB,
  SWEEP_VIDEOS_JOB,
  VIDEOS_QUEUE,
} from '../queue/queue.constants';
import { VideoProcessingService } from './video-processing.service';
import { VideoSweepService } from './video-sweep.service';

@Processor(VIDEOS_QUEUE)
export class VideoProcessor extends WorkerHost {
  constructor(
    private readonly videoProcessing: VideoProcessingService,
    private readonly videoSweep: VideoSweepService,
  ) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    if (job.name === SWEEP_VIDEOS_JOB) {
      const now = new Date();
      await this.videoSweep.markAbandonedUploads(now);
      await this.videoSweep.requeueStrandedUploads(now);
      return;
    }
    if (job.name !== PROCESS_VIDEO_JOB) {
      return;
    }
    await this.videoProcessing.process(job.data.videoId, {
      isFinalAttempt: job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
      onProgress: (percent) => job.updateProgress(percent),
    });
  }
}
