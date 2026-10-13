import { QueryFailedError } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import { Channel } from '../channels/entities/channel.entity';
import { StorageService } from '../storage/storage.service';
import { Video } from './entities/video.entity';
import { VideoNotFoundException } from './exceptions/video.exceptions';
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
  let repository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let channelsService: { findByUserId: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<Video>) => data),
      save: jest.fn((data: Partial<Video>) => Promise.resolve(data)),
      findOne: jest.fn(),
    };
    channelsService = {
      findByUserId: jest
        .fn()
        .mockResolvedValue({ id: 'channel-id' } as Channel),
    };
    service = new VideosService(
      repository as never,
      channelsService as unknown as ChannelsService,
      { publicUrl: jest.fn() } as unknown as StorageService,
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
});
