import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { UnrecoverableError } from 'bullmq';
import type { FfprobeData } from 'fluent-ffmpeg';
import { MediaProbeError, UnsupportedMediaError } from '../media/media.errors';
import {
  VideoFailureReason,
  VideoProcessingStatus,
} from '../videos/entities/video-enums';
import type { Video } from '../videos/entities/video.entity';
import { VideoProcessingService } from './video-processing.service';

const VIDEO_ID = '0b9f7a52-0000-4000-8000-000000000001';
const PUBLIC_ID = 'abcdefghijk';

const probeOf = (codec: string, audio?: string): FfprobeData =>
  ({
    format: { duration: '12.5' },
    streams: [
      { codec_type: 'video', codec_name: codec, width: 1280, height: 720 },
      ...(audio ? [{ codec_type: 'audio', codec_name: audio }] : []),
    ],
  }) as unknown as FfprobeData;

const audioOnlyProbe = {
  format: { duration: '3' },
  streams: [{ codec_type: 'audio', codec_name: 'aac' }],
} as unknown as FfprobeData;

describe('VideoProcessingService', () => {
  let repo: { findOneBy: jest.Mock; update: jest.Mock };
  let ffmpeg: { probe: jest.Mock; normalize: jest.Mock; thumbnail: jest.Mock };
  let storage: {
    downloadToFile: jest.Mock;
    uploadFile: jest.Mock;
    deleteObject: jest.Mock;
  };
  let service: VideoProcessingService;
  let workDirs: string[];

  const givenVideo = (status: VideoProcessingStatus | null) =>
    repo.findOneBy.mockResolvedValue(
      status === null
        ? null
        : ({
            id: VIDEO_ID,
            public_id: PUBLIC_ID,
            processing_status: status,
          } as Video),
    );

  const updatesWith = (patch: Record<string, unknown>) =>
    (repo.update.mock.calls as [string, Record<string, unknown>][]).filter(
      ([, changes]) =>
        Object.entries(patch).every(([key, value]) => changes[key] === value),
    );

  beforeEach(() => {
    workDirs = [];
    repo = { findOneBy: jest.fn(), update: jest.fn().mockResolvedValue({}) };
    storage = {
      downloadToFile: jest.fn().mockResolvedValue(undefined),
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    ffmpeg = {
      probe: jest.fn().mockResolvedValue(probeOf('h264', 'aac')),
      normalize: jest
        .fn()
        .mockImplementation(async (_input: string, output: string) => {
          workDirs.push(dirname(output));
          await writeFile(output, Buffer.alloc(2048));
        }),
      thumbnail: jest.fn().mockResolvedValue(undefined),
    };
    service = new VideoProcessingService(
      repo as never,
      ffmpeg as never,
      storage as never,
    );
  });

  describe.each([
    VideoProcessingStatus.AWAITING_UPLOAD,
    VideoProcessingStatus.READY,
    VideoProcessingStatus.FAILED,
  ])('idempotency guard (%s)', (status) => {
    it('should end without side effects', async () => {
      givenVideo(status);

      await service.process(VIDEO_ID, { isFinalAttempt: false });

      expect(repo.update).not.toHaveBeenCalled();
      expect(storage.downloadToFile).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });
  });

  it('should end without side effects when the video does not exist', async () => {
    givenVideo(null);

    await service.process(VIDEO_ID, { isFinalAttempt: false });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([VideoProcessingStatus.UPLOADED, VideoProcessingStatus.PROCESSING])(
    'should process a %s video until ready and discard the original',
    async (status) => {
      givenVideo(status);
      const progress: number[] = [];

      await service.process(VIDEO_ID, {
        isFinalAttempt: false,
        onProgress: (percent) => {
          progress.push(percent);
          return Promise.resolve();
        },
      });

      expect(updatesWith({ processing_status: 'processing' })).toHaveLength(1);
      expect(
        updatesWith({
          processing_status: VideoProcessingStatus.READY,
          duration_ms: 12500,
          width: 1280,
          height: 720,
          size_bytes: 2048,
        }),
      ).toHaveLength(1);
      expect(ffmpeg.normalize).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { transcode: false },
      );
      expect(storage.uploadFile).toHaveBeenCalledWith(
        `thumbnails/${PUBLIC_ID}.jpg`,
        expect.any(String),
        'image/jpeg',
      );
      expect(storage.uploadFile).toHaveBeenCalledWith(
        `videos/${PUBLIC_ID}/video.mp4`,
        expect.any(String),
        'video/mp4',
      );
      expect(storage.deleteObject).toHaveBeenCalledWith(
        `videos/${PUBLIC_ID}/original`,
      );
      expect(progress).toEqual([...progress].sort((a, b) => a - b));
      expect(progress.at(-1)).toBe(100);
    },
  );

  it('should write provisional metadata before normalizing', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    ffmpeg.normalize.mockImplementation(() => {
      expect(updatesWith({ duration_ms: 12500, width: 1280 })).toHaveLength(1);
      return Promise.reject(new Error('stop here'));
    });

    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: false }),
    ).rejects.toThrow('stop here');
  });

  it('should request a transcode for codecs that are not H.264/AAC', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    ffmpeg.probe.mockResolvedValueOnce(probeOf('vp9', 'opus'));

    await service.process(VIDEO_ID, { isFinalAttempt: false });

    expect(ffmpeg.normalize).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { transcode: true },
    );
  });

  it('should fail a file without video stream as not_a_video, with no retry', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    ffmpeg.probe.mockResolvedValue(audioOnlyProbe);

    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: false }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(
      updatesWith({
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.NOT_A_VIDEO,
      }),
    ).toHaveLength(1);
    expect(ffmpeg.normalize).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(
      `videos/${PUBLIC_ID}/original`,
    );
  });

  it.each([
    [
      'probe',
      () => ffmpeg.probe.mockRejectedValue(new MediaProbeError('unreadable')),
      VideoFailureReason.UNREADABLE_FILE,
    ],
    [
      'normalize',
      () =>
        ffmpeg.normalize.mockRejectedValue(new UnsupportedMediaError('codec')),
      VideoFailureReason.UNSUPPORTED_MEDIA,
    ],
  ])(
    'should map a media error from %s to its failure_reason as unrecoverable',
    async (_stage, arrange, failureReason) => {
      givenVideo(VideoProcessingStatus.UPLOADED);
      arrange();

      await expect(
        service.process(VIDEO_ID, { isFinalAttempt: false }),
      ).rejects.toBeInstanceOf(UnrecoverableError);

      expect(
        updatesWith({
          processing_status: VideoProcessingStatus.FAILED,
          failure_reason: failureReason,
        }),
      ).toHaveLength(1);
      expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    },
  );

  it('should rethrow a transient error without failing the video before the last attempt', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    const transient = new Error('storage down');
    storage.downloadToFile.mockRejectedValue(transient);

    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: false }),
    ).rejects.toBe(transient);

    expect(
      updatesWith({ processing_status: VideoProcessingStatus.FAILED }),
    ).toHaveLength(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('should mark processing_error and discard the original on the last attempt', async () => {
    givenVideo(VideoProcessingStatus.PROCESSING);
    const transient = new Error('storage down');
    storage.downloadToFile.mockRejectedValue(transient);

    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: true }),
    ).rejects.toBe(transient);

    expect(
      updatesWith({
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.PROCESSING_ERROR,
      }),
    ).toHaveLength(1);
    expect(storage.deleteObject).toHaveBeenCalledWith(
      `videos/${PUBLIC_ID}/original`,
    );
  });

  it('should keep the video ready when deleting the original fails', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    storage.deleteObject.mockRejectedValue(new Error('delete failed'));

    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: false }),
    ).resolves.toBeUndefined();

    expect(
      updatesWith({ processing_status: VideoProcessingStatus.READY }),
    ).toHaveLength(1);
  });

  it('should remove the temporary directory on success and on failure', async () => {
    givenVideo(VideoProcessingStatus.UPLOADED);
    await service.process(VIDEO_ID, { isFinalAttempt: false });

    givenVideo(VideoProcessingStatus.UPLOADED);
    ffmpeg.thumbnail.mockRejectedValue(new Error('boom'));
    await expect(
      service.process(VIDEO_ID, { isFinalAttempt: false }),
    ).rejects.toThrow('boom');

    expect(workDirs).toHaveLength(2);
    workDirs.forEach((dir) => expect(existsSync(dir)).toBe(false));
  });
});
