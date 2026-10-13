import {
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import storageConfig from '../config/storage.config';
import {
  buildTestStorageConfig,
  deleteTestBucket,
  fetchViaInternalEndpoint,
} from '../test/storage-test-config';
import { originalKey } from './storage-keys';
import { S3_INTERNAL_CLIENT } from './storage.constants';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';
import type { S3Client } from '@aws-sdk/client-s3';

describe('StorageService (integration, real storage)', () => {
  const config = buildTestStorageConfig();
  let service: StorageService;
  let client: S3Client;
  let closeModule: () => Promise<void>;
  let workDir: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
    })
      .overrideProvider(storageConfig.KEY)
      .useValue(config)
      .compile();
    service = module.get(StorageService);
    client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    closeModule = () => module.close();
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    workDir = await mkdtemp(join(tmpdir(), 'storage-spec-'));
  });

  afterAll(async () => {
    await deleteTestBucket(config);
    await rm(workDir, { recursive: true, force: true });
    await closeModule();
  });

  it('should presign a PUT that accepts an upload and exposes ContentLength', async () => {
    const key = originalKey('putTest0001');
    const body = Buffer.from('hello video');

    const url = await service.presign(
      new PutObjectCommand({ Bucket: config.bucket, Key: key }),
      60,
    );
    const response = await fetchViaInternalEndpoint(url, config, {
      method: 'PUT',
      body,
    });

    expect(response.status).toBe(200);
    const head = await service.headObject(key);
    expect(head.ContentLength).toBe(body.length);
  });

  it('should presign URLs on the public endpoint host, never the internal one', async () => {
    const url = await service.presign(
      new GetObjectCommand({ Bucket: config.bucket, Key: 'anything' }),
      60,
    );

    expect(new URL(url).host).toBe(new URL(config.publicEndpoint!).host);
    expect(new URL(url).host).not.toBe(new URL(config.endpoint!).host);
  });

  it('should presign a GET that downloads the object', async () => {
    const key = originalKey('getTest0001');
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: 'payload',
      }),
    );

    const url = await service.presign(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      60,
    );

    expect((await fetchViaInternalEndpoint(url, config)).text).toBe('payload');
  });

  it('should list and abort in-flight multipart uploads', async () => {
    const key = originalKey('mpuTest0001');
    const { UploadId } = await client.send(
      new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: key }),
    );
    await client.send(
      new UploadPartCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId,
        PartNumber: 1,
        Body: Buffer.alloc(16),
      }),
    );

    const listed = await service.listMultipartUploads('videos/mpuTest0001/');
    expect(listed.map((upload) => upload.UploadId)).toContain(UploadId);

    await service.abortMultipartUpload(key, UploadId as string);

    expect(await service.listMultipartUploads('videos/mpuTest0001/')).toEqual(
      [],
    );
  });

  it('should delete an object', async () => {
    const key = originalKey('delTest0001');
    await client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: 'x' }),
    );

    await service.deleteObject(key);

    await expect(service.headObject(key)).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
  });

  it('should upload a local file and download it back to disk', async () => {
    const source = join(workDir, 'source.bin');
    const target = join(workDir, 'target.bin');
    const content = Buffer.from('roundtrip content');
    await writeFile(source, content);

    await service.uploadFile(
      'videos/roundTrip001/video.mp4',
      source,
      'video/mp4',
    );
    await service.downloadToFile('videos/roundTrip001/video.mp4', target);

    expect(await readFile(target)).toEqual(content);
    const head = await service.headObject('videos/roundTrip001/video.mp4');
    expect(head.ContentType).toBe('video/mp4');
  });

  it('should upload files above the single-PUT threshold in multiple parts', async () => {
    const source = join(workDir, 'large.bin');
    const size = 64 * 2 ** 20 + 1024;
    await writeFile(source, Buffer.alloc(size, 7));

    await service.uploadFile(
      'videos/largeUpload1/video.mp4',
      source,
      'video/mp4',
    );

    const head = await service.headObject('videos/largeUpload1/video.mp4');
    expect(head.ContentLength).toBe(size);
    expect(await service.listMultipartUploads('videos/largeUpload1/')).toEqual(
      [],
    );
  }, 60000);
});
