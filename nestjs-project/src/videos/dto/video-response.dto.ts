import { ApiProperty } from '@nestjs/swagger';
import {
  VideoFailureReason,
  VideoProcessingStatus,
  VideoPublicationStatus,
} from '../entities/video-enums';
import { Video } from '../entities/video.entity';
import { thumbnailKey } from '../../storage/storage-keys';

export class VideoResponseDto {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  publicId: string;

  @ApiProperty({ example: 'holiday.mp4' })
  filename: string;

  @ApiProperty({ example: 'holiday' })
  title: string;

  @ApiProperty({
    enum: VideoProcessingStatus,
    enumName: 'VideoProcessingStatus',
  })
  processingStatus: VideoProcessingStatus;

  @ApiProperty({
    enum: VideoPublicationStatus,
    enumName: 'VideoPublicationStatus',
  })
  publicationStatus: VideoPublicationStatus;

  @ApiProperty({
    enum: VideoFailureReason,
    enumName: 'VideoFailureReason',
    nullable: true,
    required: true,
  })
  failureReason: VideoFailureReason | null;

  @ApiProperty({ type: 'integer', nullable: true, required: true })
  durationMs: number | null;

  @ApiProperty({ type: 'integer', nullable: true, required: true })
  width: number | null;

  @ApiProperty({ type: 'integer', nullable: true, required: true })
  height: number | null;

  @ApiProperty({ type: 'integer', nullable: true, required: true })
  sizeBytes: number | null;

  @ApiProperty({ type: 'string', nullable: true, required: true })
  thumbnailUrl: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt: string;
}

// The internal UUID `id` is deliberately never mapped to the wire.
export function toVideoResponse(
  video: Video,
  publicUrl: (key: string) => string,
): VideoResponseDto {
  const ready = video.processing_status === VideoProcessingStatus.READY;
  return {
    publicId: video.public_id,
    filename: video.original_filename,
    title: video.title,
    processingStatus: video.processing_status,
    publicationStatus: video.publication_status,
    failureReason: video.failure_reason,
    durationMs: video.duration_ms,
    width: video.width,
    height: video.height,
    sizeBytes: video.size_bytes,
    thumbnailUrl: ready ? publicUrl(thumbnailKey(video.public_id)) : null,
    createdAt: video.created_at.toISOString(),
  };
}
