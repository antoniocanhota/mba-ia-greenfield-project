import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { ChannelsService } from '../channels/channels.service';
import { Channel } from '../channels/entities/channel.entity';
import { StorageService } from '../storage/storage.service';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { User } from '../users/entities/user.entity';
import {
  VideoProcessingStatus,
  VideoPublicationStatus,
} from './entities/video-enums';
import { Video } from './entities/video.entity';
import { VideoNotFoundException } from './exceptions/video.exceptions';
import * as publicIdUtil from './public-id.util';
import { VideosService } from './videos.service';

const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];
const INPUT = {
  filename: 'clip.mp4',
  sizeBytes: 1024,
  contentType: 'video/mp4',
};

describe('VideosService (integration)', () => {
  let dataSource: DataSource;
  let service: VideosService;
  let videoRepository: Repository<Video>;
  let owner: User;
  let ownerChannel: Channel;
  let stranger: User;

  async function createUserWithChannel(
    email: string,
    nickname: string,
  ): Promise<{ user: User; channel: Channel }> {
    const user = await dataSource
      .getRepository(User)
      .save({ email, password: 'hashed' });
    const channel = await dataSource
      .getRepository(Channel)
      .save({ name: nickname, nickname, user_id: user.id });
    return { user, channel };
  }

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    service = new VideosService(
      videoRepository,
      new ChannelsService(dataSource),
      { publicUrl: (key: string) => `http://public/${key}` } as StorageService,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    ({ user: owner, channel: ownerChannel } = await createUserWithChannel(
      'owner@example.com',
      'owner',
    ));
    ({ user: stranger } = await createUserWithChannel(
      'stranger@example.com',
      'stranger',
    ));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createDraft', () => {
    it('should persist a draft on the channel of the user with the default statuses', async () => {
      const video = await service.createDraft(owner.id, INPUT);

      const stored = await videoRepository.findOneByOrFail({ id: video.id });
      expect(stored.channel_id).toBe(ownerChannel.id);
      expect(stored.original_filename).toBe('clip.mp4');
      expect(stored.processing_status).toBe(
        VideoProcessingStatus.AWAITING_UPLOAD,
      );
      expect(stored.publication_status).toBe(VideoPublicationStatus.DRAFT);
      expect(stored.public_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    });

    it('should save with another public id when the first one collides', async () => {
      await videoRepository.save({
        public_id: 'AAAAAAAAAAA',
        channel_id: ownerChannel.id,
        original_filename: 'existing.mp4',
      });
      jest
        .spyOn(publicIdUtil, 'generatePublicId')
        .mockReturnValueOnce('AAAAAAAAAAA')
        .mockReturnValueOnce('BBBBBBBBBBB');

      const video = await service.createDraft(owner.id, INPUT);

      expect(video.public_id).toBe('BBBBBBBBBBB');
      expect(await videoRepository.count()).toBe(2);
    });
  });

  describe('findOwnedByPublicId', () => {
    it('should return the video to its owner', async () => {
      const created = await service.createDraft(owner.id, INPUT);

      const found = await service.findOwnedByPublicId(
        owner.id,
        created.public_id,
      );

      expect(found.id).toBe(created.id);
    });

    it('should throw VideoNotFoundException for a video of another channel', async () => {
      const created = await service.createDraft(owner.id, INPUT);

      await expect(
        service.findOwnedByPublicId(stranger.id, created.public_id),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('should throw VideoNotFoundException for an unknown public id', async () => {
      await expect(
        service.findOwnedByPublicId(owner.id, 'ZZZZZZZZZZZ'),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });
  });
});
