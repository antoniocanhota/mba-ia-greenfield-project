import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import type { Queue } from 'bullmq';
import { QueryFailedError, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import storageConfig from '../config/storage.config';
import {
  PROCESS_VIDEO_JOB,
  PROCESS_VIDEO_JOB_OPTIONS,
  VIDEOS_QUEUE,
} from '../queue/queue.constants';
import { originalKey, videoKey } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import { downloadDisposition } from './download-disposition.util';
import { MediaUrlsResponseDto } from './dto/media-urls-response.dto';
import { VideoResponseDto, toVideoResponse } from './dto/video-response.dto';
import { VideoProcessingStatus } from './entities/video-enums';
import { Video } from './entities/video.entity';
import {
  FileTooLargeException,
  InvalidVideoStateException,
  UploadIncompleteException,
  VideoNotFoundException,
  VideoNotReadyException,
} from './exceptions/video.exceptions';
import { generatePublicId, isPublicIdFormat } from './public-id.util';
import { titleFromFilename } from './video-title.util';
import { MAX_VIDEO_SIZE_BYTES } from './videos.constants';

const PG_UNIQUE_VIOLATION = '23505';
const PUBLIC_ID_COLUMN = 'public_id';
const MAX_PUBLIC_ID_ATTEMPTS = 3;

export interface CreateDraftInput {
  filename: string;
  sizeBytes: number;
  contentType: string;
}

function isPublicIdCollision(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, detail } = error as QueryFailedError & {
    code?: string;
    detail?: string;
  };
  return (
    code === PG_UNIQUE_VIOLATION &&
    typeof detail === 'string' &&
    detail.includes(PUBLIC_ID_COLUMN)
  );
}

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly channelsService: ChannelsService,
    private readonly storageService: StorageService,
    @InjectQueue(VIDEOS_QUEUE) private readonly videosQueue: Queue,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  // `sizeBytes` and `contentType` only gate the request (DTO validation); neither is
  // persisted: the size is read from the stored object on completion.
  async createDraft(userId: string, input: CreateDraftInput): Promise<Video> {
    const channel = await this.channelsService.findByUserId(userId);
    if (!channel) {
      // Every user gets a channel at registration; reaching this is a data invariant breach.
      throw new Error(`Channel not found for user ${userId}`);
    }

    for (let attempt = 1; attempt <= MAX_PUBLIC_ID_ATTEMPTS; attempt++) {
      try {
        return await this.videoRepository.save(
          this.videoRepository.create({
            public_id: generatePublicId(),
            channel_id: channel.id,
            original_filename: input.filename,
            title: titleFromFilename(input.filename),
          }),
        );
      } catch (error) {
        if (!isPublicIdCollision(error) || attempt === MAX_PUBLIC_ID_ATTEMPTS) {
          throw error;
        }
      }
    }
    throw new Error('Unreachable: public id retries exhausted');
  }

  async findOwnedByPublicId(userId: string, publicId: string): Promise<Video> {
    if (!isPublicIdFormat(publicId)) {
      throw new VideoNotFoundException();
    }
    const video = await this.videoRepository.findOne({
      where: { public_id: publicId, channel: { user_id: userId } },
    });
    if (!video) {
      throw new VideoNotFoundException();
    }
    return video;
  }

  // Confirms the uploaded original and hands the video to background processing.
  // Idempotent: anything past `awaiting_upload` is returned as-is; `failed` is terminal.
  async completeUpload(userId: string, publicId: string): Promise<Video> {
    const video = await this.findOwnedByPublicId(userId, publicId);
    if (video.processing_status === VideoProcessingStatus.FAILED) {
      throw new InvalidVideoStateException();
    }
    if (video.processing_status !== VideoProcessingStatus.AWAITING_UPLOAD) {
      return video;
    }

    const sizeBytes = await this.readUploadedSize(video.public_id);

    // Conditional transition: loses cleanly against a concurrent completion or the sweep.
    const { affected } = await this.videoRepository.update(
      {
        id: video.id,
        processing_status: VideoProcessingStatus.AWAITING_UPLOAD,
      },
      {
        processing_status: VideoProcessingStatus.UPLOADED,
        size_bytes: sizeBytes,
      },
    );
    const current = await this.videoRepository.findOneByOrFail({
      id: video.id,
    });
    if (affected === 1) {
      // After the commit. A failed enqueue leaves the video `uploaded` for the sweep.
      await this.videosQueue.add(
        PROCESS_VIDEO_JOB,
        { videoId: video.id },
        { jobId: video.id, ...PROCESS_VIDEO_JOB_OPTIONS },
      );
    }
    return current;
  }

  // Presigned delivery of the normalized MP4: the bytes never go through the API.
  async getMediaUrls(
    userId: string,
    publicId: string,
  ): Promise<MediaUrlsResponseDto> {
    const video = await this.findOwnedByPublicId(userId, publicId);
    if (video.processing_status !== VideoProcessingStatus.READY) {
      throw new VideoNotReadyException();
    }
    const ttl = this.storage.videoUrlTtlSeconds;
    const base = {
      Bucket: this.storageService.bucket,
      Key: videoKey(video.public_id),
    };
    const [streamUrl, downloadUrl] = await Promise.all([
      this.storageService.presign(new GetObjectCommand(base), ttl),
      this.storageService.presign(
        new GetObjectCommand({
          ...base,
          ResponseContentDisposition: downloadDisposition(
            video.original_filename,
          ),
        }),
        ttl,
      ),
    ]);
    return {
      streamUrl,
      downloadUrl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  private async readUploadedSize(publicId: string): Promise<number> {
    const key = originalKey(publicId);
    let contentLength: number;
    try {
      const head = await this.storageService.headObject(key);
      contentLength = head.ContentLength ?? 0;
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === 404
      ) {
        throw new UploadIncompleteException();
      }
      throw error;
    }
    if (contentLength > MAX_VIDEO_SIZE_BYTES) {
      await this.storageService.deleteObject(key);
      throw new FileTooLargeException();
    }
    return contentLength;
  }

  toResponse(video: Video): VideoResponseDto {
    return toVideoResponse(video, (key) => this.storageService.publicUrl(key));
  }
}
