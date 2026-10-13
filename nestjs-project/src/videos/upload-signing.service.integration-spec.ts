import {
  CreateBucketCommand,
  CreateMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT } from '../storage/storage.constants';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import {
  buildTestStorageConfig,
  deleteTestBucket,
  fetchViaInternalEndpoint,
} from '../test/storage-test-config';
import { Video } from './entities/video.entity';
import { UploadSigningService } from './upload-signing.service';

const PUBLIC_ID = 'abcDEF12345';
const KEY = `videos/${PUBLIC_ID}/original`;
const FIVE_MIB = 5 * 2 ** 20;

describe('UploadSigningService (integration, real storage)', () => {
  const config = buildTestStorageConfig();
  const video = Object.assign(new Video(), {
    public_id: PUBLIC_ID,
    processing_status: 'awaiting_upload',
  });
  let service: UploadSigningService;
  let storageService: StorageService;
  let client: S3Client;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
      ],
      providers: [UploadSigningService],
    })
      .overrideProvider(storageConfig.KEY)
      .useValue(config)
      .compile();
    service = module.get(UploadSigningService);
    storageService = module.get(StorageService);
    client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    closeModule = () => module.close();
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  });

  afterAll(async () => {
    await deleteTestBucket(config);
    await closeModule();
  });

  it('should abort a pre-existing multipart of the same key when signing a new one', async () => {
    await client.send(
      new CreateMultipartUploadCommand({ Bucket: config.bucket, Key: KEY }),
    );
    expect(await storageService.listMultipartUploads(KEY)).toHaveLength(1);

    await service.sign(video, { method: 'POST', key: 'qualquer' });

    expect(await storageService.listMultipartUploads(KEY)).toHaveLength(0);
  });

  it('should produce URLs that run create -> upload part -> list parts -> complete', async () => {
    const created = await service.sign(video, { method: 'POST', key: 'x' });
    expect(created.key).toBe(KEY);
    const createResponse = await fetchViaInternalEndpoint(created.url, config, {
      method: 'POST',
    });
    expect(createResponse.status).toBe(200);
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(
      createResponse.text,
    )?.[1] as string;
    expect(uploadId).toBeTruthy();

    const part = await service.sign(video, {
      method: 'PUT',
      key: KEY,
      uploadId,
      partNumber: 1,
    });
    expect(part.key).toBeUndefined();
    // A baked-in checksum of an empty body would make the browser upload fail (BadDigest).
    expect(new URL(part.url).searchParams.has('x-amz-checksum-crc32')).toBe(
      false,
    );
    const partResponse = await fetchViaInternalEndpoint(part.url, config, {
      method: 'PUT',
      body: Buffer.alloc(FIVE_MIB, 1),
    });
    expect(partResponse.status).toBe(200);
    const etag = partResponse.headers.etag as string;
    expect(etag).toBeTruthy();

    const listed = await service.sign(video, {
      method: 'GET',
      key: KEY,
      uploadId,
    });
    const listResponse = await fetchViaInternalEndpoint(listed.url, config);
    expect(listResponse.status).toBe(200);
    expect(listResponse.text).toContain('<PartNumber>1</PartNumber>');

    const complete = await service.sign(video, {
      method: 'POST',
      key: KEY,
      uploadId,
    });
    const completeResponse = await fetchViaInternalEndpoint(
      complete.url,
      config,
      {
        method: 'POST',
        body: `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${etag}</ETag></Part></CompleteMultipartUpload>`,
      },
    );
    expect(completeResponse.status).toBe(200);
    const head = await storageService.headObject(KEY);
    expect(head.ContentLength).toBe(FIVE_MIB);
  });

  it('should produce an abort URL that discards the multipart', async () => {
    const created = await service.sign(video, { method: 'POST', key: 'x' });
    const createResponse = await fetchViaInternalEndpoint(created.url, config, {
      method: 'POST',
    });
    const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(
      createResponse.text,
    )?.[1] as string;

    const abort = await service.sign(video, {
      method: 'DELETE',
      key: KEY,
      uploadId,
    });
    const abortResponse = await fetchViaInternalEndpoint(abort.url, config, {
      method: 'DELETE',
    });

    expect(abortResponse.status).toBe(204);
    expect(await storageService.listMultipartUploads(KEY)).toHaveLength(0);
  });
});
