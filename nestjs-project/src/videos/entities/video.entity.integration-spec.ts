import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { VerificationToken } from '../../auth/entities/verification-token.entity';
import { Channel } from '../../channels/entities/channel.entity';
import {
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { User } from '../../users/entities/user.entity';
import { VideoProcessingStatus, VideoPublicationStatus } from './video-enums';
import { Video } from './video.entity';

const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];
const TEN_GIB = 10737418240;

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let channelRepository: Repository<Channel>;
  let channel: Channel;

  const buildVideo = (overrides: Partial<Video> = {}): Video =>
    videoRepository.create({
      public_id: 'abcDEF12345',
      channel_id: channel.id,
      original_filename: 'clip.mp4',
      title: 'clip',
      ...overrides,
    });

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    channelRepository = dataSource.getRepository(Channel);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const user = await dataSource
      .getRepository(User)
      .save({ email: 'owner@example.com', password: 'hashed' });
    channel = await channelRepository.save({
      name: 'Owner',
      nickname: 'owner',
      user_id: user.id,
    });
  });

  it('should default to awaiting_upload / draft with null metadata', async () => {
    const saved = await videoRepository.save(buildVideo());
    const found = await videoRepository.findOneByOrFail({ id: saved.id });

    expect(found.processing_status).toBe(VideoProcessingStatus.AWAITING_UPLOAD);
    expect(found.publication_status).toBe(VideoPublicationStatus.DRAFT);
    expect(found.failure_reason).toBeNull();
    expect(found.duration_ms).toBeNull();
    expect(found.width).toBeNull();
    expect(found.height).toBeNull();
    expect(found.size_bytes).toBeNull();
    expect(found.created_at).toBeInstanceOf(Date);
    expect(found.updated_at).toBeInstanceOf(Date);
  });

  it('should enforce a unique public_id', async () => {
    await videoRepository.save(buildVideo());

    await expect(videoRepository.save(buildVideo())).rejects.toThrow(
      QueryFailedError,
    );
  });

  it('should delete the videos when their channel is deleted', async () => {
    await videoRepository.save(buildVideo());

    await channelRepository.delete({ id: channel.id });

    expect(await videoRepository.count()).toBe(0);
  });

  it('should reject a video without a title', async () => {
    await expect(
      videoRepository.save(buildVideo({ title: undefined })),
    ).rejects.toThrow(QueryFailedError);
  });

  it('should read a 10 GiB size_bytes back as a number', async () => {
    const saved = await videoRepository.save(
      buildVideo({ size_bytes: TEN_GIB }),
    );
    const found = await videoRepository.findOneByOrFail({ id: saved.id });

    expect(found.size_bytes).toBe(TEN_GIB);
    expect(typeof found.size_bytes).toBe('number');
  });

  it('should expose the inverse side as channel.videos', async () => {
    await videoRepository.save(buildVideo());

    const found = await channelRepository.findOneOrFail({
      where: { id: channel.id },
      relations: ['videos'],
    });

    expect(found.videos).toHaveLength(1);
    expect(found.videos[0].public_id).toBe('abcDEF12345');
  });
});
