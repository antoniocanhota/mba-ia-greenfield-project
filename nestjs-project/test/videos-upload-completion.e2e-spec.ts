import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import storageConfig from '../src/config/storage.config';
import { PROCESS_VIDEO_JOB, VIDEOS_QUEUE } from '../src/queue/queue.constants';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { createLoggedInUser } from '../src/test/e2e-users';
import {
  VideoFailureReason,
  VideoProcessingStatus,
} from '../src/videos/entities/video-enums';
import { Video } from '../src/videos/entities/video.entity';

interface ErrorBody {
  error: string;
}
interface VideoBody {
  processingStatus: string;
  sizeBytes: number | null;
}

describe('videos-upload-completion (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let throttlerStorage: ThrottlerStorageService;
  let storageService: StorageService;
  let s3: S3Client;
  let queue: Queue;
  let ownerToken: string;
  let otherToken: string;
  let publicId: string;
  let videoId: string;
  let key: string;
  const config = storageConfig();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    storageService = moduleFixture.get(StorageService);
    s3 = moduleFixture.get<S3Client>(S3_INTERNAL_CLIENT);
    queue = moduleFixture.get<Queue>(getQueueToken(VIDEOS_QUEUE));
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await app.close();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await queue.obliterate({ force: true });

    ({ accessToken: ownerToken } = await createLoggedInUser(
      app,
      dataSource,
      'owner@example.com',
      'owner',
    ));
    ({ accessToken: otherToken } = await createLoggedInUser(
      app,
      dataSource,
      'other@example.com',
      'other',
    ));
    throttlerStorage.storage.clear();

    const created = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename: 'clip.mp4', sizeBytes: 2048, contentType: 'video/mp4' })
      .expect(201);
    publicId = (created.body as { publicId: string }).publicId;
    key = `videos/${publicId}/original`;
    videoId = (
      await dataSource
        .getRepository(Video)
        .findOneByOrFail({ public_id: publicId })
    ).id;
  });

  afterEach(async () => {
    // Objects written by a scenario; deleting a missing key is a no-op in S3.
    await storageService.deleteObject(key);
  });

  const putOriginal = (size: number) =>
    s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: Buffer.alloc(size, 1),
      }),
    );

  const complete = (token: string | undefined = ownerToken) => {
    const req = request(app.getHttpServer()).post(
      `/videos/${publicId}/upload-completion`,
    );
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const storedVideo = () =>
    dataSource.getRepository(Video).findOneByOrFail({ public_id: publicId });

  // 1. Concluir o upload e enfileirar o processamento

  it('objeto-presente-200-e-job-enfileirado', async () => {
    await putOriginal(2048);

    const res = await complete().expect(200);

    const body = res.body as VideoBody;
    expect(body.processingStatus).toBe('uploaded');
    expect(body.sizeBytes).toBe(2048);
    const jobs = await queue.getJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe(PROCESS_VIDEO_JOB);
    expect(jobs[0].id).toBe(videoId);
    expect(jobs[0].data).toEqual({ videoId });
    const stored = await storedVideo();
    expect(stored.processing_status).toBe('uploaded');
    expect(stored.size_bytes).toBe(2048);
  });

  it('chamada-repetida-idempotente', async () => {
    await putOriginal(2048);

    const first = await complete().expect(200);
    const second = await complete().expect(200);

    expect((first.body as VideoBody).processingStatus).toBe('uploaded');
    expect((second.body as VideoBody).processingStatus).toBe('uploaded');
    expect(await queue.getJobs()).toHaveLength(1);
  });

  it('objeto-ausente-409-upload-incomplete', async () => {
    const res = await complete().expect(409);

    expect((res.body as ErrorBody).error).toBe('UPLOAD_INCOMPLETE');
    expect((await storedVideo()).processing_status).toBe('awaiting_upload');
    expect(await queue.getJobs()).toHaveLength(0);
  });

  it('objeto-acima-de-10gib-422', async () => {
    await putOriginal(2048);
    const realHead = await storageService.headObject(key);
    jest
      .spyOn(storageService, 'headObject')
      .mockResolvedValueOnce({ ...realHead, ContentLength: 10737418241 });

    const res = await complete().expect(422);

    expect((res.body as ErrorBody).error).toBe('FILE_TOO_LARGE');
    await expect(storageService.headObject(key)).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
    expect((await storedVideo()).processing_status).toBe('awaiting_upload');
    expect(await queue.getJobs()).toHaveLength(0);
  });

  it('video-failed-409-invalid-state', async () => {
    await dataSource.getRepository(Video).update(
      { public_id: publicId },
      {
        processing_status: VideoProcessingStatus.FAILED,
        failure_reason: VideoFailureReason.UPLOAD_ABANDONED,
      },
    );

    const res = await complete().expect(409);

    expect((res.body as ErrorBody).error).toBe('INVALID_VIDEO_STATE');
    expect(await queue.getJobs()).toHaveLength(0);
  });

  // 2. Ownership e autenticação

  it('nao-dono-404-sem-autorizacao-401', async () => {
    await putOriginal(2048);

    const foreign = await complete(otherToken).expect(404);

    expect((foreign.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
    expect((await storedVideo()).processing_status).toBe('awaiting_upload');
    expect(await queue.getJobs()).toHaveLength(0);

    await complete('').expect(401);
  });
});
