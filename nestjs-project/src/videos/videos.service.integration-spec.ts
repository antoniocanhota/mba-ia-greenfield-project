import { CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { ChannelsService } from '../channels/channels.service';
import { Channel } from '../channels/entities/channel.entity';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import { PROCESS_VIDEO_JOB } from '../queue/queue.constants';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import {
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import {
  buildTestStorageConfig,
  deleteTestBucket,
  fetchViaInternalEndpoint,
} from '../test/storage-test-config';
import { User } from '../users/entities/user.entity';
import {
  VideoProcessingStatus,
  VideoPublicationStatus,
} from './entities/video-enums';
import { Video } from './entities/video.entity';
import {
  FileTooLargeException,
  InvalidVideoStateException,
  UploadIncompleteException,
  VideoNotFoundException,
} from './exceptions/video.exceptions';
import * as publicIdUtil from './public-id.util';
import { VideosService } from './videos.service';

const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];
const INPUT = {
  filename: 'clip.mp4',
  sizeBytes: 1024,
  contentType: 'video/mp4',
};

describe('VideosService (integration)', () => {
  const bucketConfig = buildTestStorageConfig();
  let queue: Queue;
  let s3: S3Client;
  let storageService: StorageService;
  let closeStorageModule: () => Promise<void>;
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

    const storageModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
    })
      .overrideProvider(storageConfig.KEY)
      .useValue(bucketConfig)
      .compile();
    storageService = storageModule.get(StorageService);
    s3 = storageModule.get<S3Client>(S3_INTERNAL_CLIENT);
    closeStorageModule = () => storageModule.close();
    await s3.send(new CreateBucketCommand({ Bucket: bucketConfig.bucket }));

    const { host, port } = queueConfig();
    queue = new Queue(`videos-test-${randomBytes(4).toString('hex')}`, {
      connection: { host, port },
    });

    service = new VideosService(
      videoRepository,
      new ChannelsService(dataSource),
      storageService,
      queue,
      bucketConfig,
    );
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
    await deleteTestBucket(bucketConfig);
    await closeStorageModule();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    await queue.obliterate({ force: true });
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

  describe('completeUpload', () => {
    async function putOriginal(publicId: string, size: number): Promise<void> {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketConfig.bucket,
          Key: `videos/${publicId}/original`,
          Body: Buffer.alloc(size, 1),
        }),
      );
    }

    it('should mark the video uploaded, store the size and enqueue one process-video job', async () => {
      const draft = await service.createDraft(owner.id, INPUT);
      await putOriginal(draft.public_id, 2048);

      const result = await service.completeUpload(owner.id, draft.public_id);

      expect(result.processing_status).toBe(VideoProcessingStatus.UPLOADED);
      expect(result.size_bytes).toBe(2048);
      const stored = await videoRepository.findOneByOrFail({ id: draft.id });
      expect(stored.processing_status).toBe(VideoProcessingStatus.UPLOADED);
      expect(stored.size_bytes).toBe(2048);
      const jobs = await queue.getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(draft.id);
      expect(jobs[0].name).toBe(PROCESS_VIDEO_JOB);
      expect(jobs[0].data).toEqual({ videoId: draft.id });
      expect(jobs[0].opts.attempts).toBe(3);
    });

    it('should not create a second job on a repeated call', async () => {
      const draft = await service.createDraft(owner.id, INPUT);
      await putOriginal(draft.public_id, 16);

      await service.completeUpload(owner.id, draft.public_id);
      const second = await service.completeUpload(owner.id, draft.public_id);

      expect(second.processing_status).toBe(VideoProcessingStatus.UPLOADED);
      expect(await queue.getJobs()).toHaveLength(1);
    });

    it('should enqueue once when two completions race', async () => {
      const draft = await service.createDraft(owner.id, INPUT);
      await putOriginal(draft.public_id, 16);

      const results = await Promise.all([
        service.completeUpload(owner.id, draft.public_id),
        service.completeUpload(owner.id, draft.public_id),
      ]);

      expect(
        results.every(
          (video) => video.processing_status === VideoProcessingStatus.UPLOADED,
        ),
      ).toBe(true);
      expect(await queue.getJobs()).toHaveLength(1);
    });

    it('should throw UPLOAD_INCOMPLETE when the original is missing and keep the video awaiting upload', async () => {
      const draft = await service.createDraft(owner.id, INPUT);

      await expect(
        service.completeUpload(owner.id, draft.public_id),
      ).rejects.toBeInstanceOf(UploadIncompleteException);

      const stored = await videoRepository.findOneByOrFail({ id: draft.id });
      expect(stored.processing_status).toBe(
        VideoProcessingStatus.AWAITING_UPLOAD,
      );
      expect(await queue.getJobs()).toHaveLength(0);
    });

    it('should delete an oversized original and keep the video awaiting upload', async () => {
      const draft = await service.createDraft(owner.id, INPUT);
      await putOriginal(draft.public_id, 16);
      const realHead = await storageService.headObject(
        `videos/${draft.public_id}/original`,
      );
      jest
        .spyOn(storageService, 'headObject')
        .mockResolvedValueOnce({ ...realHead, ContentLength: 10737418241 });

      await expect(
        service.completeUpload(owner.id, draft.public_id),
      ).rejects.toBeInstanceOf(FileTooLargeException);

      await expect(
        storageService.headObject(`videos/${draft.public_id}/original`),
      ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
      const stored = await videoRepository.findOneByOrFail({ id: draft.id });
      expect(stored.processing_status).toBe(
        VideoProcessingStatus.AWAITING_UPLOAD,
      );
      expect(await queue.getJobs()).toHaveLength(0);
    });

    it('should reject a failed video with INVALID_VIDEO_STATE', async () => {
      const draft = await service.createDraft(owner.id, INPUT);
      await videoRepository.update(
        { id: draft.id },
        { processing_status: VideoProcessingStatus.FAILED },
      );

      await expect(
        service.completeUpload(owner.id, draft.public_id),
      ).rejects.toBeInstanceOf(InvalidVideoStateException);
    });

    it('should hide the video of another channel behind VIDEO_NOT_FOUND', async () => {
      const draft = await service.createDraft(owner.id, INPUT);

      await expect(
        service.completeUpload(stranger.id, draft.public_id),
      ).rejects.toBeInstanceOf(VideoNotFoundException);
    });
  });

  describe('getMediaUrls', () => {
    async function readyVideoWithMp4(filename: string): Promise<Video> {
      const draft = await service.createDraft(owner.id, {
        ...INPUT,
        filename,
      });
      await videoRepository.update(
        { id: draft.id },
        { processing_status: VideoProcessingStatus.READY },
      );
      await s3.send(
        new PutObjectCommand({
          Bucket: bucketConfig.bucket,
          Key: `videos/${draft.public_id}/video.mp4`,
          Body: Buffer.alloc(4096, 7),
          ContentType: 'video/mp4',
        }),
      );
      return draft;
    }

    it('should issue a streamUrl that the storage serves with HTTP Range (206)', async () => {
      const video = await readyVideoWithMp4('My Trip.mov');

      const { streamUrl } = await service.getMediaUrls(
        owner.id,
        video.public_id,
      );
      const response = await fetchViaInternalEndpoint(streamUrl, bucketConfig, {
        headers: { range: 'bytes=0-1023' },
      });

      expect(response.status).toBe(206);
      expect(response.headers['content-range']).toMatch(/^bytes 0-1023\//);
      expect(response.text).toHaveLength(1024);
    });

    it('should issue a downloadUrl that forces an .mp4 attachment named after the original file', async () => {
      const video = await readyVideoWithMp4('My Trip.mov');

      const { downloadUrl } = await service.getMediaUrls(
        owner.id,
        video.public_id,
      );
      const response = await fetchViaInternalEndpoint(
        downloadUrl,
        bucketConfig,
      );

      expect(response.status).toBe(200);
      const disposition = response.headers['content-disposition'];
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('filename="My Trip.mp4"');
    });

    it('should expire the URLs about 4 hours from now by default', async () => {
      const video = await readyVideoWithMp4('clip.mp4');

      const { expiresAt } = await service.getMediaUrls(
        owner.id,
        video.public_id,
      );

      const expectedMs = Date.now() + 4 * 60 * 60 * 1000;
      expect(Math.abs(new Date(expiresAt).getTime() - expectedMs)).toBeLessThan(
        60_000,
      );
    });
  });
});
