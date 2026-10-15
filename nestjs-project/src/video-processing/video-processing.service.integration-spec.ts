import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { Channel } from '../channels/entities/channel.entity';
import storageConfig from '../config/storage.config';
import { FfmpegService } from '../media/ffmpeg.service';
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
import { VideoProcessingService } from './video-processing.service';

const run = promisify(execFile);
const ALL_ENTITIES = [User, Channel, RefreshToken, VerificationToken, Video];
const PUBLIC_ID = 'abcdefghijk';

describe('VideoProcessingService (integration)', () => {
  const bucketConfig = buildTestStorageConfig();
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let storage: StorageService;
  let s3: S3Client;
  let closeStorageModule: () => Promise<void>;
  let service: VideoProcessingService;
  let fixtureDir: string;
  let validMp4: Buffer;
  let video: Video;

  const putOriginal = (body: Buffer) =>
    s3.send(
      new PutObjectCommand({
        Bucket: bucketConfig.bucket,
        Key: `videos/${PUBLIC_ID}/original`,
        Body: body,
      }),
    );

  const exists = (key: string) =>
    storage.headObject(key).then(
      () => true,
      () => false,
    );

  const reload = () => videoRepository.findOneByOrFail({ id: video.id });

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'processing-spec-'));
    const mp4 = join(fixtureDir, 'source.mp4');
    await run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=320x240:rate=15',
      '-f',
      'lavfi',
      '-i',
      'sine=duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      mp4,
    ]);
    validMp4 = await readFile(mp4);

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

    service = new VideoProcessingService(
      videoRepository,
      new FfmpegService(),
      storage,
    );
  }, 60000);

  afterAll(async () => {
    await deleteTestBucket(bucketConfig);
    await closeStorageModule();
    await dataSource.destroy();
    await rm(fixtureDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await Promise.all(
      [
        `videos/${PUBLIC_ID}/original`,
        `videos/${PUBLIC_ID}/video.mp4`,
        `thumbnails/${PUBLIC_ID}.jpg`,
      ].map((key) => storage.deleteObject(key)),
    );
    await cleanAllTables(dataSource);
    const user = await dataSource
      .getRepository(User)
      .save({ email: 'owner@example.com', password: 'hashed' });
    const channel = await dataSource
      .getRepository(Channel)
      .save({ name: 'owner', nickname: 'owner', user_id: user.id });
    video = await videoRepository.save({
      public_id: PUBLIC_ID,
      channel_id: channel.id,
      original_filename: 'clip.mp4',
      title: 'clip',
      processing_status: VideoProcessingStatus.UPLOADED,
    });
  });

  it('should take an uploaded video to ready with metadata, thumbnail and normalized MP4', async () => {
    await putOriginal(validMp4);

    await service.process(video.id, { isFinalAttempt: false });

    const processed = await reload();
    expect(processed).toMatchObject({
      processing_status: VideoProcessingStatus.READY,
      failure_reason: null,
      width: 320,
      height: 240,
    });
    expect(processed.duration_ms).toBeGreaterThan(1500);
    expect(processed.size_bytes).toBeGreaterThan(0);
    expect(await exists(`thumbnails/${PUBLIC_ID}.jpg`)).toBe(true);
    expect(await exists(`videos/${PUBLIC_ID}/video.mp4`)).toBe(true);
    expect(await exists(`videos/${PUBLIC_ID}/original`)).toBe(false);
    const head = await storage.headObject(`videos/${PUBLIC_ID}/video.mp4`);
    expect(head.ContentType).toBe('video/mp4');
    expect(head.ContentLength).toBe(processed.size_bytes);
  }, 60000);

  it('should fail a text file as unreadable_file without retry and delete the original', async () => {
    await putOriginal(Buffer.from('this is not a video'));

    await expect(
      service.process(video.id, { isFinalAttempt: false }),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(await reload()).toMatchObject({
      processing_status: VideoProcessingStatus.FAILED,
      failure_reason: VideoFailureReason.UNREADABLE_FILE,
    });
    expect(await exists(`videos/${PUBLIC_ID}/original`)).toBe(false);
    expect(await exists(`videos/${PUBLIC_ID}/video.mp4`)).toBe(false);
  }, 60000);

  it('should not alter a ready video nor its objects when the job is redelivered', async () => {
    await putOriginal(validMp4);
    await service.process(video.id, { isFinalAttempt: false });
    const before = await reload();
    const etagBefore = (
      await storage.headObject(`videos/${PUBLIC_ID}/video.mp4`)
    ).ETag;

    await service.process(video.id, { isFinalAttempt: false });

    const after = await reload();
    expect(after.updated_at).toEqual(before.updated_at);
    expect(after.processing_status).toBe(VideoProcessingStatus.READY);
    expect(
      (await storage.headObject(`videos/${PUBLIC_ID}/video.mp4`)).ETag,
    ).toBe(etagBefore);
  }, 60000);

  it('should fail a missing original as processing_error only on the last attempt', async () => {
    await expect(
      service.process(video.id, { isFinalAttempt: false }),
    ).rejects.toThrow();
    expect((await reload()).processing_status).toBe(
      VideoProcessingStatus.PROCESSING,
    );

    await expect(
      service.process(video.id, { isFinalAttempt: true }),
    ).rejects.toThrow();
    expect(await reload()).toMatchObject({
      processing_status: VideoProcessingStatus.FAILED,
      failure_reason: VideoFailureReason.PROCESSING_ERROR,
    });
  }, 60000);
});
