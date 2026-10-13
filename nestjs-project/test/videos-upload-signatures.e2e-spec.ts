import {
  CreateMultipartUploadCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
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
  statusCode: number;
  error: string;
  message: string | string[];
}
interface SignBody {
  url: string;
  key?: string;
}

const FIVE_MIB = 5 * 2 ** 20;

describe('videos-upload-signatures (e2e)', () => {
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

  async function abortAllMultipartUploads(): Promise<void> {
    for (const upload of await storageService.listMultipartUploads('videos/')) {
      await storageService.abortMultipartUpload(
        upload.Key as string,
        upload.UploadId as string,
      );
    }
  }

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
    await abortAllMultipartUploads();
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
    await abortAllMultipartUploads();

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
      .send({
        filename: 'big.mp4',
        sizeBytes: FIVE_MIB,
        contentType: 'video/mp4',
      })
      .expect(201);
    publicId = (created.body as { publicId: string }).publicId;
    key = `videos/${publicId}/original`;
  });

  const sign = (body: object, token: string | undefined = ownerToken) => {
    const req = request(app.getHttpServer()).post(
      `/videos/${publicId}/upload-signatures`,
    );
    return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(
      body,
    );
  };

  // Signs and executes a CreateMultipartUpload, returning the UploadId the storage issued.
  async function startMultipart(): Promise<string> {
    const signed = await sign({ method: 'POST', key: 'qualquer' }).expect(201);
    const response = await fetchViaInternalEndpoint(
      (signed.body as SignBody).url,
      config,
      { method: 'POST' },
    );
    expect(response.status).toBe(200);
    return /<UploadId>([^<]+)<\/UploadId>/.exec(response.text)?.[1] as string;
  }

  // 1. Assinar operações do upload multipart

  it('create-multipart-key-do-servidor', async () => {
    const res = await sign({ method: 'POST', key: 'qualquer' }).expect(201);

    const body = res.body as SignBody;
    expect(body.key).toBe(key);
    expect(body.url).toContain('X-Amz-Signature');
    expect(new URL(body.url).pathname).toContain(key);

    const created = await fetchViaInternalEndpoint(body.url, config, {
      method: 'POST',
    });
    expect(created.status).toBe(200);
    expect(created.text).toMatch(/<UploadId>[^<]+<\/UploadId>/);
  });

  it('create-multipart-aborta-anteriores', async () => {
    const { UploadId: previous } = await s3.send(
      new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: key }),
    );
    const before = await storageService.listMultipartUploads(key);
    expect(before.map((upload) => upload.UploadId)).toEqual([previous]);

    await sign({ method: 'POST', key: 'qualquer' }).expect(201);

    const after = await storageService.listMultipartUploads(key);
    expect(after.map((upload) => upload.UploadId)).not.toContain(previous);
  });

  it('upload-part-utilizavel', async () => {
    const uploadId = await startMultipart();
    expect(uploadId).toBeTruthy();

    const part = await sign({
      method: 'PUT',
      key,
      uploadId,
      partNumber: 1,
    }).expect(201);
    expect(part.body).not.toHaveProperty('key');

    const uploaded = await fetchViaInternalEndpoint(
      (part.body as SignBody).url,
      config,
      { method: 'PUT', body: Buffer.alloc(FIVE_MIB, 1) },
    );
    expect(uploaded.status).toBe(200);
    expect(uploaded.headers.etag).toBeTruthy();

    const listing = await sign({ method: 'GET', key, uploadId }).expect(201);
    const listed = await fetchViaInternalEndpoint(
      (listing.body as SignBody).url,
      config,
    );
    expect(listed.status).toBe(200);
    expect(listed.text).toContain('<PartNumber>1</PartNumber>');
  });

  it('key-divergente-400', async () => {
    const res = await sign({
      method: 'PUT',
      key: 'videos/outro/original',
      uploadId: 'u-1',
      partNumber: 1,
    }).expect(400);

    expect((res.body as ErrorBody).error).toBe('INVALID_UPLOAD_KEY');
  });

  it('operacao-nao-suportada-400', async () => {
    const unsupported = await sign({ method: 'PUT', key }).expect(400);
    expect((unsupported.body as ErrorBody).error).toBe(
      'UNSUPPORTED_UPLOAD_OPERATION',
    );

    const invalid = await sign({ method: 'PATCH', key: 'x' }).expect(400);
    expect((invalid.body as ErrorBody).error).toBe('VALIDATION_ERROR');
  });

  it('video-fora-de-awaiting-upload-409', async () => {
    await dataSource
      .getRepository(Video)
      .update(
        { public_id: publicId },
        { processing_status: VideoProcessingStatus.UPLOADED },
      );

    const res = await sign({ method: 'POST', key: 'qualquer' }).expect(409);

    expect((res.body as ErrorBody).error).toBe('INVALID_VIDEO_STATE');
  });

  // 2. Ownership e autenticação

  it('nao-dono-404-sem-autorizacao-401', async () => {
    const { UploadId: existing } = await s3.send(
      new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: key }),
    );

    const foreign = await sign(
      { method: 'POST', key: 'qualquer' },
      otherToken,
    ).expect(404);
    expect((foreign.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');

    const untouched = await storageService.listMultipartUploads(key);
    expect(untouched.map((upload) => upload.UploadId)).toEqual([existing]);

    await sign({ method: 'POST', key: 'qualquer' }, '').expect(401);
  });
});
