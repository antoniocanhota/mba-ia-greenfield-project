import {
  CreateBucketCommand,
  CreateMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
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
} from '../test/storage-test-config';
import { User } from '../users/entities/user.entity';
import {
  VideoFailureReason,
  VideoProcessingStatus,
} from '../videos/entities/video-enums';
import { Video } from '../videos/entities/video.entity';
import { VideoSweepService } from './video-sweep.service';

const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe('VideoSweepService (integration)', () => {
  const bucketConfig = buildTestStorageConfig();
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let storage: StorageService;
  let s3: S3Client;
  let closeStorageModule: () => Promise<void>;
  let queue: Queue;
  let service: VideoSweepService;
  let channel: Channel;

  async function createVideo(
    publicId: string,
    status: VideoProcessingStatus,
    ageMs: number,
  ): Promise<Video> {
    const video = await videoRepository.save({
      public_id: publicId,
      channel_id: channel.id,
      original_filename: 'clip.mp4',
      title: 'clip',
      processing_status: status,
    });
    const at = new Date(Date.now() - ageMs);
    // Raw SQL: created_at/updated_at are managed columns TypeORM would overwrite.
    await dataSource.query(
      'UPDATE videos SET created_at = $1, updated_at = $1 WHERE id = $2',
      [at, video.id],
    );
    return video;
  }

  const reload = (video: Video) =>
    videoRepository.findOneByOrFail({ id: video.id });

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
    storage = storageModule.get(StorageService);
    s3 = storageModule.get<S3Client>(S3_INTERNAL_CLIENT);
    closeStorageModule = () => storageModule.close();
    await s3.send(new CreateBucketCommand({ Bucket: bucketConfig.bucket }));

    const { host, port } = queueConfig();
    queue = new Queue(`videos-test-${randomBytes(4).toString('hex')}`, {
      connection: { host, port },
    });
    service = new VideoSweepService(videoRepository, queue, storage);
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
    const user = await dataSource
      .getRepository(User)
      .save({ email: 'owner@example.com', password: 'hashed' });
    channel = await dataSource
      .getRepository(Channel)
      .save({ name: 'owner', nickname: 'owner', user_id: user.id });
  });

  describe('markAbandonedUploads', () => {
    it('should fail drafts older than 24h as upload_abandoned and keep recent ones', async () => {
      const old = await createVideo(
        'oldoldoldol',
        VideoProcessingStatus.AWAITING_UPLOAD,
        25 * HOUR,
      );
      const recent = await createVideo(
        'recentrecen',
        VideoProcessingStatus.AWAITING_UPLOAD,
        1 * HOUR,
      );

      const count = await service.markAbandonedUploads(new Date());

      expect(count).toBe(1);
      expect(await reload(old)).toMatchObject({
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.UPLOAD_ABANDONED,
      });
      expect(await reload(recent)).toMatchObject({
        processing_status: VideoProcessingStatus.AWAITING_UPLOAD,
        failure_reason: null,
      });
    });

    it('should never abandon a video that already left awaiting_upload', async () => {
      const completed = await createVideo(
        'completedvd',
        VideoProcessingStatus.UPLOADED,
        30 * HOUR,
      );

      expect(await service.markAbandonedUploads(new Date())).toBe(0);

      expect(await reload(completed)).toMatchObject({
        processing_status: VideoProcessingStatus.UPLOADED,
        failure_reason: null,
      });
    });

    it('should abort the dangling multipart of an abandoned draft only', async () => {
      const old = await createVideo(
        'abandonedvd',
        VideoProcessingStatus.AWAITING_UPLOAD,
        25 * HOUR,
      );
      const key = `videos/${old.public_id}/original`;
      const siblingKey = `${key}-other`;
      await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketConfig.bucket,
          Key: key,
        }),
      );
      await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucketConfig.bucket,
          Key: siblingKey,
        }),
      );

      await service.markAbandonedUploads(new Date());

      const remaining = await storage.listMultipartUploads('videos/');
      expect(remaining.map((upload) => upload.Key)).toEqual([siblingKey]);
    });

    it('should still fail the video when the multipart abort cannot run', async () => {
      const old = await createVideo(
        'noabortvide',
        VideoProcessingStatus.AWAITING_UPLOAD,
        25 * HOUR,
      );
      jest
        .spyOn(storage, 'listMultipartUploads')
        .mockRejectedValueOnce(new Error('storage down'));

      await expect(service.markAbandonedUploads(new Date())).resolves.toBe(1);

      expect((await reload(old)).processing_status).toBe(
        VideoProcessingStatus.FAILED,
      );
    });
  });

  describe('requeueStrandedUploads', () => {
    it('should enqueue process-video for uploaded videos idle for more than 5 minutes', async () => {
      const stranded = await createVideo(
        'strandedvid',
        VideoProcessingStatus.UPLOADED,
        10 * MINUTE,
      );
      const fresh = await createVideo(
        'freshvideo1',
        VideoProcessingStatus.UPLOADED,
        1 * MINUTE,
      );

      const count = await service.requeueStrandedUploads(new Date());

      expect(count).toBe(1);
      const job = await queue.getJob(stranded.id);
      expect(job?.name).toBe(PROCESS_VIDEO_JOB);
      expect(job?.data).toEqual({ videoId: stranded.id });
      expect(job?.opts.attempts).toBe(3);
      expect(await queue.getJob(fresh.id)).toBeUndefined();
    });

    it('should not enqueue videos in other states', async () => {
      await createVideo(
        'processingv',
        VideoProcessingStatus.PROCESSING,
        10 * MINUTE,
      );
      await createVideo(
        'readyvideo1',
        VideoProcessingStatus.READY,
        10 * MINUTE,
      );
      await createVideo(
        'awaitingvid',
        VideoProcessingStatus.AWAITING_UPLOAD,
        10 * MINUTE,
      );

      expect(await service.requeueStrandedUploads(new Date())).toBe(0);
      expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 0 });
    });

    it('should be idempotent: a second sweep does not duplicate the job', async () => {
      await createVideo(
        'idempotentv',
        VideoProcessingStatus.UPLOADED,
        10 * MINUTE,
      );

      await service.requeueStrandedUploads(new Date());
      await service.requeueStrandedUploads(new Date());

      expect(await queue.getJobCounts('waiting')).toEqual({ waiting: 1 });
    });
  });
});
