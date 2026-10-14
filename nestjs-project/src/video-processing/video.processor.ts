import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PROCESS_VIDEO_JOB, VIDEOS_QUEUE } from '../queue/queue.constants';
import { VideoProcessingService } from './video-processing.service';

@Processor(VIDEOS_QUEUE)
export class VideoProcessor extends WorkerHost {
  constructor(private readonly videoProcessing: VideoProcessingService) {
    super();
  }

  async process(job: Job<{ videoId: string }>): Promise<void> {
    if (job.name !== PROCESS_VIDEO_JOB) {
      // Other job kinds (sweep) are routed here by later SIs.
      return;
    }
    await this.videoProcessing.process(job.data.videoId, {
      isFinalAttempt: job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
      onProgress: (percent) => job.updateProgress(percent),
    });
  }
}
