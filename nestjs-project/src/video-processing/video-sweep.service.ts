import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { LessThan, Repository } from 'typeorm';
import {
  PROCESS_VIDEO_JOB,
  PROCESS_VIDEO_JOB_OPTIONS,
  VIDEOS_QUEUE,
} from '../queue/queue.constants';
import { originalKey } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import {
  VideoFailureReason,
  VideoProcessingStatus,
} from '../videos/entities/video-enums';
import { Video } from '../videos/entities/video.entity';

export const ABANDONED_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;
export const STRANDED_UPLOAD_AFTER_MS = 5 * 60 * 1000;

@Injectable()
export class VideoSweepService {
  private readonly logger = new Logger(VideoSweepService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectQueue(VIDEOS_QUEUE) private readonly videosQueue: Queue,
    private readonly storage: StorageService,
  ) {}

  // Drafts never completed. The conditional UPDATE is the same transition guard that
  // upload-completion uses, so exactly one of them wins a race and a video is never
  // both `uploaded` and `upload_abandoned`.
  async markAbandonedUploads(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - ABANDONED_UPLOAD_AFTER_MS);
    const result = await this.videoRepository
      .createQueryBuilder()
      .update(Video)
      .set({
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.UPLOAD_ABANDONED,
      })
      .where('processing_status = :awaiting', {
        awaiting: VideoProcessingStatus.AWAITING_UPLOAD,
      })
      .andWhere('created_at < :cutoff', { cutoff })
      .returning(['public_id'])
      .execute();

    const abandoned = (result.raw as { public_id: string }[]).map(
      (row) => row.public_id,
    );
    for (const publicId of abandoned) {
      await this.abortMultipartUploads(publicId);
    }
    return abandoned.length;
  }

  // Closes the DB/queue dual-write gap: `uploaded` is committed before the enqueue, so a
  // lost enqueue leaves the video stranded. The jobId makes a live job ignore the re-add.
  async requeueStrandedUploads(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - STRANDED_UPLOAD_AFTER_MS);
    const stranded = await this.videoRepository.find({
      select: { id: true },
      where: {
        processing_status: VideoProcessingStatus.UPLOADED,
        updated_at: LessThan(cutoff),
      },
    });
    for (const { id } of stranded) {
      await this.videosQueue.add(
        PROCESS_VIDEO_JOB,
        { videoId: id },
        { jobId: id, ...PROCESS_VIDEO_JOB_OPTIONS },
      );
    }
    return stranded.length;
  }

  // Best-effort: the bucket lifecycle rule is the backstop, and the video is already
  // `failed`, so a storage error must not abort the sweep of the remaining videos.
  private async abortMultipartUploads(publicId: string): Promise<void> {
    const key = originalKey(publicId);
    try {
      const uploads = await this.storage.listMultipartUploads(key);
      for (const upload of uploads) {
        // The listing filters by prefix: only abort the exact key of this draft.
        if (upload.Key === key && upload.UploadId) {
          await this.storage.abortMultipartUpload(key, upload.UploadId);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not abort multipart uploads of ${publicId}: ${(error as Error).message}`,
      );
    }
  }
}
