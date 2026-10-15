import { Video } from '../entities/video.entity';
import {
  VideoFailureReason,
  VideoProcessingStatus,
  VideoPublicationStatus,
} from '../entities/video-enums';
import { toVideoResponse } from './video-response.dto';

const publicUrl = (key: string) => `http://localhost:9000/bucket/${key}`;

function makeVideo(overrides: Partial<Video> = {}): Video {
  return Object.assign(new Video(), {
    id: 'internal-uuid',
    public_id: 'abcDEF12345',
    channel_id: 'channel-uuid',
    original_filename: 'clip.mp4',
    title: 'clip',
    processing_status: VideoProcessingStatus.AWAITING_UPLOAD,
    publication_status: VideoPublicationStatus.DRAFT,
    failure_reason: null,
    duration_ms: null,
    width: null,
    height: null,
    size_bytes: null,
    created_at: new Date('2026-10-13T12:00:00.000Z'),
    updated_at: new Date('2026-10-13T12:00:00.000Z'),
    ...overrides,
  });
}

describe('toVideoResponse', () => {
  it('should expose the wire fields in camelCase mapped from the snake_case columns', () => {
    const response = toVideoResponse(
      makeVideo({
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.NOT_A_VIDEO,
        duration_ms: 1500,
        width: 1920,
        height: 1080,
        size_bytes: 10737418240,
      }),
      publicUrl,
    );

    expect(response).toEqual({
      publicId: 'abcDEF12345',
      filename: 'clip.mp4',
      title: 'clip',
      processingStatus: 'failed',
      publicationStatus: 'draft',
      failureReason: 'not_a_video',
      durationMs: 1500,
      width: 1920,
      height: 1080,
      sizeBytes: 10737418240,
      thumbnailUrl: null,
      createdAt: '2026-10-13T12:00:00.000Z',
    });
  });

  it('should never leak the internal id or channel id', () => {
    const response = toVideoResponse(makeVideo(), publicUrl);

    expect(response).not.toHaveProperty('id');
    expect(response).not.toHaveProperty('channel_id');
    expect(JSON.stringify(response)).not.toContain('internal-uuid');
  });

  it.each([
    VideoProcessingStatus.AWAITING_UPLOAD,
    VideoProcessingStatus.UPLOADED,
    VideoProcessingStatus.PROCESSING,
    VideoProcessingStatus.FAILED,
  ])('should return a null thumbnailUrl while %s', (status) => {
    const response = toVideoResponse(
      makeVideo({ processing_status: status }),
      publicUrl,
    );

    expect(response.thumbnailUrl).toBeNull();
  });

  it('should return the public thumbnail URL once ready', () => {
    const response = toVideoResponse(
      makeVideo({ processing_status: VideoProcessingStatus.READY }),
      publicUrl,
    );

    expect(response.thumbnailUrl).toBe(
      'http://localhost:9000/bucket/thumbnails/abcDEF12345.jpg',
    );
  });
});
