import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import storageConfig from '../src/config/storage.config';
import { S3_INTERNAL_CLIENT } from '../src/storage/storage.constants';
import { StorageService } from '../src/storage/storage.service';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { createLoggedInUser } from '../src/test/e2e-users';
import { fetchViaInternalEndpoint } from '../src/test/storage-test-config';
import { VideoProcessingStatus } from '../src/videos/entities/video-enums';
import { Video } from '../src/videos/entities/video.entity';

interface ErrorBody {
  error: string;
}
interface MediaUrlsBody {
  streamUrl: string;
  downloadUrl: string;
  expiresAt: string;
}

describe('videos-media-urls (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let throttlerStorage: ThrottlerStorageService;
  let storageService: StorageService;
  let s3: S3Client;
  let ownerToken: string;
  let otherToken: string;
  let publicId: string;
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();

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

    publicId = await createDraft('My Trip.mov');
    key = `videos/${publicId}/video.mp4`;
    await dataSource
      .getRepository(Video)
      .update(
        { public_id: publicId },
        { processing_status: VideoProcessingStatus.READY },
      );
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: Buffer.alloc(4096, 7),
        ContentType: 'video/mp4',
      }),
    );
  });

  afterEach(async () => {
    await storageService.deleteObject(key);
  });

  async function createDraft(filename: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ filename, sizeBytes: 4096, contentType: 'video/mp4' })
      .expect(201);
    return (res.body as { publicId: string }).publicId;
  }

  const getMediaUrls = (id: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/videos/${id}/media-urls`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  // 1. Emitir URLs de streaming e download

  it('video-ready-200-com-urls', async () => {
    const before = Date.now();

    const res = await getMediaUrls(publicId, ownerToken).expect(200);

    const body = res.body as MediaUrlsBody;
    expect(new URL(body.streamUrl).pathname).toContain(key);
    expect(new URL(body.downloadUrl).pathname).toContain(key);
    expect(body.streamUrl).toContain('X-Amz-Signature');
    expect(body.downloadUrl).toContain('X-Amz-Signature');
    expect(new Date(body.expiresAt).toISOString()).toBe(body.expiresAt);
    const expected = before + 4 * 60 * 60 * 1000;
    expect(
      Math.abs(new Date(body.expiresAt).getTime() - expected),
    ).toBeLessThan(60_000);
  });

  it('stream-url-atende-range-206', async () => {
    const res = await getMediaUrls(publicId, ownerToken).expect(200);

    const streamed = await fetchViaInternalEndpoint(
      (res.body as MediaUrlsBody).streamUrl,
      config,
      { headers: { range: 'bytes=0-1023' } },
    );

    expect(streamed.status).toBe(206);
    expect(streamed.headers['content-range']).toMatch(/^bytes 0-1023\//);
    expect(streamed.text).toHaveLength(1024);
  });

  it('download-url-attachment-mp4', async () => {
    const res = await getMediaUrls(publicId, ownerToken).expect(200);

    const downloaded = await fetchViaInternalEndpoint(
      (res.body as MediaUrlsBody).downloadUrl,
      config,
    );

    expect(downloaded.status).toBe(200);
    const disposition = downloaded.headers['content-disposition'];
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('filename="My Trip.mp4"');
  });

  it('video-fora-de-ready-409', async () => {
    await dataSource
      .getRepository(Video)
      .update(
        { public_id: publicId },
        { processing_status: VideoProcessingStatus.PROCESSING },
      );

    const processing = await getMediaUrls(publicId, ownerToken).expect(409);
    expect((processing.body as ErrorBody).error).toBe('VIDEO_NOT_READY');

    const draftId = await createDraft('draft.mp4');
    const draft = await getMediaUrls(draftId, ownerToken).expect(409);
    expect((draft.body as ErrorBody).error).toBe('VIDEO_NOT_READY');
  });

  // 2. Ownership e autenticação

  it('nao-dono-404-sem-autorizacao-401', async () => {
    const foreign = await getMediaUrls(publicId, otherToken).expect(404);
    expect((foreign.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');

    await getMediaUrls(publicId).expect(401);
  });
});
