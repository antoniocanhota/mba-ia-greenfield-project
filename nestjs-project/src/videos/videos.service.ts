import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { StorageService } from '../storage/storage.service';
import { VideoResponseDto, toVideoResponse } from './dto/video-response.dto';
import { Video } from './entities/video.entity';
import { VideoNotFoundException } from './exceptions/video.exceptions';
import { generatePublicId, isPublicIdFormat } from './public-id.util';

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

  toResponse(video: Video): VideoResponseDto {
    return toVideoResponse(video, (key) => this.storageService.publicUrl(key));
  }
}
