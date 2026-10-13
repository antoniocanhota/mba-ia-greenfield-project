import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { QueryFailedError } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Channel } from '../channels/entities/channel.entity';
import { StorageService } from '../storage/storage.service';
import { VideoProcessingStatus } from './entities/video-enums';
import { Video } from './entities/video.entity';
import {
  FileTooLargeException,
  InvalidVideoStateException,
  UploadIncompleteException,
  VideoNotFoundException,
  VideoNotReadyException,
} from './exceptions/video.exceptions';
import * as publicIdUtil from './public-id.util';
import { VideosService } from './videos.service';

const INPUT = {
  filename: 'clip.mp4',
  sizeBytes: 1024,
  contentType: 'video/mp4',
};

function makeCollisionError(): QueryFailedError {
  return Object.assign(new QueryFailedError('INSERT', [], new Error()), {
    code: '23505',
    detail: 'Key (public_id)=(abcDEF12345) already exists.',
  });
}

describe('VideosService', () => {
  let service: VideosService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    findOneByOrFail: jest.Mock;
  };
  let storage: {
    bucket: string;
    presign: jest.Mock;
    publicUrl: jest.Mock;
    headObject: jest.Mock;
    deleteObject: jest.Mock;
  };
  let queue: { add: jest.Mock };
  let channelsService: { findByUserId: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<Video>) => data),
      save: jest.fn((data: Partial<Video>) => Promise.resolve(data)),
      findOne: jest.fn(),
      update: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    storage = {
      bucket: 'bucket',
      presign: jest.fn(
        (command: { input: { ResponseContentDisposition?: string } }) =>
          Promise.resolve(
            command.input.ResponseContentDisposition
              ? 'signed-download'
              : 'signed-stream',
          ),
      ),
      publicUrl: jest.fn(),
      headObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    channelsService = {
      findByUserId: jest
        .fn()
        .mockResolvedValue({ id: 'channel-id' } as Channel),
    };
    service = new VideosService(
      repository as never,
      channelsService as unknown as ChannelsService,
      storage as unknown as StorageService,
      queue as never,
      { videoUrlTtlSeconds: 14400 } as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createDraft', () => {
    it('should save the draft on the channel of the user with the original filename', async () => {
      const video = await service.createDraft('user-id', INPUT);

      expect(channelsService.findByUserId).toHaveBeenCalledWith('user-id');
      expect(video).toMatchObject({
        channel_id: 'channel-id',
        original_filename: 'clip.mp4',
      });
      expect(video.public_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    });

    it('should regenerate the public id and retry on a collision', async () => {
      repository.save
        .mockRejectedValueOnce(makeCollisionError())
        .mockImplementationOnce((data: Partial<Video>) =>
          Promise.resolve(data),
        );
      const generate = jest.spyOn(publicIdUtil, 'generatePublicId');

      await service.createDraft('user-id', INPUT);

      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(generate).toHaveBeenCalledTimes(2);
    });

    it('should give up after 3 colliding attempts', async () => {
      const collision = makeCollisionError();
      repository.save.mockRejectedValue(collision);

      await expect(service.createDraft('user-id', INPUT)).rejects.toBe(
        collision,
      );
      expect(repository.save).toHaveBeenCalledTimes(3);
    });

    it('should not retry on errors other than a public_id collision', async () => {
      const failure = new Error('connection lost');
      repository.save.mockRejectedValue(failure);

      await expect(service.createDraft('user-id', INPUT)).rejects.toBe(failure);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should not treat a unique violation on another column as a collision', async () => {
      const other = Object.assign(
        new QueryFailedError('INSERT', [], new Error()),
        { code: '23505', detail: 'Key (id)=(x) already exists.' },
      );
      repository.save.mockRejectedValue(other);

      await expect(service.createDraft('user-id', INPUT)).rejects.toBe(other);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('should fail when the user has no channel', async () => {
      channelsService.findByUserId.mockResolvedValue(null);

      await expect(service.createDraft('user-id', INPUT)).rejects.toThrow(
        'Channel not found',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOwnedByPublicId', () => {
    it('should return the video when it belongs to the user', async () => {
      const video = { public_id: 'abcDEF12345' } as Video;
      repository.findOne.mockResolvedValue(video);

      await expect(
        service.findOwnedByPublicId('user-id', 'abcDEF12345'),
      ).resolves.toBe(video);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { public_id: 'abcDEF12345', channel: { user_id: 'user-id' } },
      });
    });

    it('should throw VideoNotFoundException when the video is missing or owned by another channel', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOwnedByPublicId('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('should throw VideoNotFoundException for a malformed public id without querying', async () => {
      await expect(
        service.findOwnedByPublicId('user-id', 'not-valid'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('completeUpload', () => {
    const videoIn = (status: VideoProcessingStatus): Video =>
      Object.assign(new Video(), {
        id: 'video-uuid',
        public_id: 'abcDEF12345',
        processing_status: status,
      });

    function notFoundError(): S3ServiceException {
      return new S3ServiceException({
        name: 'NotFound',
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
      });
    }

    it('should transition awaiting_upload to uploaded, store the size and enqueue the job', async () => {
      const uploaded = videoIn(VideoProcessingStatus.UPLOADED);
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockResolvedValue({ ContentLength: 2048 });
      repository.update.mockResolvedValue({ affected: 1 });
      repository.findOneByOrFail.mockResolvedValue(uploaded);

      const result = await service.completeUpload('user-id', 'abcDEF12345');

      expect(storage.headObject).toHaveBeenCalledWith(
        'videos/abcDEF12345/original',
      );
      expect(repository.update).toHaveBeenCalledWith(
        {
          id: 'video-uuid',
          processing_status: VideoProcessingStatus.AWAITING_UPLOAD,
        },
        {
          processing_status: VideoProcessingStatus.UPLOADED,
          size_bytes: 2048,
        },
      );
      expect(queue.add).toHaveBeenCalledWith(
        'process-video',
        { videoId: 'video-uuid' },
        {
          jobId: 'video-uuid',
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
      expect(result).toBe(uploaded);
    });

    it.each([
      VideoProcessingStatus.UPLOADED,
      VideoProcessingStatus.PROCESSING,
      VideoProcessingStatus.READY,
    ])(
      'should be a no-op returning the current video when %s',
      async (status) => {
        const video = videoIn(status);
        repository.findOne.mockResolvedValue(video);

        await expect(
          service.completeUpload('user-id', 'abcDEF12345'),
        ).resolves.toBe(video);
        expect(storage.headObject).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
      },
    );

    it('should reject a failed video with INVALID_VIDEO_STATE', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.FAILED),
      );

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(InvalidVideoStateException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should throw UPLOAD_INCOMPLETE when the original is not in storage', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockRejectedValue(notFoundError());

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(UploadIncompleteException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should rethrow storage errors other than not-found', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      const failure = new Error('storage down');
      storage.headObject.mockRejectedValue(failure);

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).rejects.toBe(failure);
    });

    it('should delete the object and throw FILE_TOO_LARGE above 10 GiB', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockResolvedValue({ ContentLength: 10737418241 });

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(FileTooLargeException);
      expect(storage.deleteObject).toHaveBeenCalledWith(
        'videos/abcDEF12345/original',
      );
      expect(repository.update).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should accept an object of exactly 10 GiB', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockResolvedValue({ ContentLength: 10737418240 });
      repository.update.mockResolvedValue({ affected: 1 });
      repository.findOneByOrFail.mockResolvedValue(
        videoIn(VideoProcessingStatus.UPLOADED),
      );

      await service.completeUpload('user-id', 'abcDEF12345');

      expect(storage.deleteObject).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('should not enqueue when it loses the conditional transition to a concurrent request', async () => {
      const current = videoIn(VideoProcessingStatus.UPLOADED);
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockResolvedValue({ ContentLength: 10 });
      repository.update.mockResolvedValue({ affected: 0 });
      repository.findOneByOrFail.mockResolvedValue(current);

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).resolves.toBe(current);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should propagate an enqueue failure after the transition (the sweep re-enqueues)', async () => {
      repository.findOne.mockResolvedValue(
        videoIn(VideoProcessingStatus.AWAITING_UPLOAD),
      );
      storage.headObject.mockResolvedValue({ ContentLength: 10 });
      repository.update.mockResolvedValue({ affected: 1 });
      repository.findOneByOrFail.mockResolvedValue(
        videoIn(VideoProcessingStatus.UPLOADED),
      );
      const failure = new Error('redis down');
      queue.add.mockRejectedValue(failure);

      await expect(
        service.completeUpload('user-id', 'abcDEF12345'),
      ).rejects.toBe(failure);
    });
  });

  describe('getMediaUrls', () => {
    const readyVideo = (filename = 'My Trip.mov'): Video =>
      Object.assign(new Video(), {
        id: 'video-uuid',
        public_id: 'abcDEF12345',
        original_filename: filename,
        processing_status: VideoProcessingStatus.READY,
      });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      VideoProcessingStatus.AWAITING_UPLOAD,
      VideoProcessingStatus.UPLOADED,
      VideoProcessingStatus.PROCESSING,
      VideoProcessingStatus.FAILED,
    ])('should throw VIDEO_NOT_READY while %s', async (status) => {
      repository.findOne.mockResolvedValue(
        Object.assign(new Video(), {
          public_id: 'abcDEF12345',
          processing_status: status,
        }),
      );

      await expect(
        service.getMediaUrls('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(VideoNotReadyException);
      expect(storage.presign).not.toHaveBeenCalled();
    });

    it('should presign an inline stream URL and an attachment download URL for the normalized MP4', async () => {
      repository.findOne.mockResolvedValue(readyVideo());

      const result = await service.getMediaUrls('user-id', 'abcDEF12345');

      expect(result.streamUrl).toBe('signed-stream');
      expect(result.downloadUrl).toBe('signed-download');
      const commands = storage.presign.mock.calls.map(
        ([command]) => command as GetObjectCommand,
      );
      expect(commands).toHaveLength(2);
      for (const command of commands) {
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect(command.input.Bucket).toBe('bucket');
        expect(command.input.Key).toBe('videos/abcDEF12345/video.mp4');
      }
      const [stream, download] = commands;
      expect(stream.input.ResponseContentDisposition).toBeUndefined();
      expect(download.input.ResponseContentDisposition).toContain(
        'attachment; filename="My Trip.mp4"',
      );
    });

    it('should presign both URLs with the configured TTL and report matching expiresAt', async () => {
      repository.findOne.mockResolvedValue(readyVideo());
      jest.useFakeTimers({ now: new Date('2026-10-13T12:00:00.000Z') });

      const result = await service.getMediaUrls('user-id', 'abcDEF12345');

      for (const [, expiresIn] of storage.presign.mock.calls) {
        expect(expiresIn).toBe(14400);
      }
      expect(result.expiresAt).toBe('2026-10-13T16:00:00.000Z');
    });

    it('should hide a video of another channel behind VIDEO_NOT_FOUND', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.getMediaUrls('user-id', 'abcDEF12345'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });
  });
});
