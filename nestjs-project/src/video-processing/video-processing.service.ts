import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UnrecoverableError } from 'bullmq';
import { Repository } from 'typeorm';
import { FfmpegService } from '../media/ffmpeg.service';
import { MediaError, NotAVideoError } from '../media/media.errors';
import { extractMetadata, needsTranscode } from '../media/probe-metadata';
import { originalKey, thumbnailKey, videoKey } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import {
  VideoFailureReason,
  VideoProcessingStatus,
} from '../videos/entities/video-enums';
import { Video } from '../videos/entities/video.entity';

export interface ProcessVideoOptions {
  isFinalAttempt: boolean;
  onProgress?: (percent: number) => Promise<void>;
}

const PROCESSABLE_STATUSES = [
  VideoProcessingStatus.UPLOADED,
  VideoProcessingStatus.PROCESSING,
];

const THUMBNAIL_FILENAME = 'thumbnail.jpg';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly ffmpeg: FfmpegService,
    private readonly storage: StorageService,
  ) {}

  async process(
    videoId: string,
    { isFinalAttempt, onProgress }: ProcessVideoOptions,
  ): Promise<void> {
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video || !PROCESSABLE_STATUSES.includes(video.processing_status)) {
      // Redelivery or duplicate of a job that already reached a terminal state.
      return;
    }

    const report = async (percent: number) => onProgress?.(percent);
    const workDir = await mkdtemp(join(tmpdir(), 'video-processing-'));
    try {
      await this.run(video, workDir, report);
    } catch (error) {
      await this.fail(video, error, isFinalAttempt);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async run(
    video: Video,
    workDir: string,
    report: (percent: number) => Promise<void>,
  ): Promise<void> {
    const { id, public_id: publicId } = video;
    await this.videoRepository.update(id, {
      processing_status: VideoProcessingStatus.PROCESSING,
    });
    await report(5);

    const original = join(workDir, 'original');
    await this.storage.downloadToFile(originalKey(publicId), original);
    await report(20);

    // Probe 1: provisional metadata so the UI has a duration while processing.
    const sourceProbe = await this.ffmpeg.probe(original);
    const provisional = extractMetadata(sourceProbe);
    if (!provisional.hasVideoStream) {
      throw new NotAVideoError('File has no video stream');
    }
    await this.videoRepository.update(id, {
      duration_ms: provisional.durationMs,
      width: provisional.width,
      height: provisional.height,
    });
    await report(35);

    const normalized = join(workDir, 'video.mp4');
    await this.ffmpeg.normalize(original, normalized, {
      transcode: needsTranscode(sourceProbe),
    });
    await report(60);

    await this.ffmpeg.thumbnail(normalized, workDir, THUMBNAIL_FILENAME);
    await this.storage.uploadFile(
      thumbnailKey(publicId),
      join(workDir, THUMBNAIL_FILENAME),
      'image/jpeg',
    );
    await report(70);

    await this.storage.uploadFile(videoKey(publicId), normalized, 'video/mp4');
    await report(85);

    // Probe 2: the normalized file is the authoritative source of metadata.
    const final = extractMetadata(await this.ffmpeg.probe(normalized));
    const { size } = await stat(normalized);
    await this.videoRepository.update(id, {
      duration_ms: final.durationMs,
      width: final.width,
      height: final.height,
      size_bytes: size,
      processing_status: VideoProcessingStatus.READY,
    });
    await this.discardOriginal(publicId);
    await report(100);
  }

  private async fail(
    video: Video,
    error: unknown,
    isFinalAttempt: boolean,
  ): Promise<never> {
    if (error instanceof MediaError) {
      await this.markFailed(video, error.failureReason);
      throw new UnrecoverableError(error.message);
    }
    if (isFinalAttempt) {
      await this.markFailed(video, VideoFailureReason.PROCESSING_ERROR);
    }
    // Transient: BullMQ retries with backoff; the status stays `processing`.
    throw error;
  }

  private async markFailed(
    video: Video,
    failureReason: VideoFailureReason,
  ): Promise<void> {
    await this.videoRepository.update(video.id, {
      processing_status: VideoProcessingStatus.FAILED,
      failure_reason: failureReason,
    });
    await this.discardOriginal(video.public_id);
  }

  // Cleanup after the terminal status is already persisted: a storage hiccup here must
  // not turn a finished video into a retried job, so it is logged instead of thrown.
  private async discardOriginal(publicId: string): Promise<void> {
    try {
      await this.storage.deleteObject(originalKey(publicId));
    } catch (error) {
      this.logger.warn(
        `Could not delete original of ${publicId}: ${(error as Error).message}`,
      );
    }
  }
}
