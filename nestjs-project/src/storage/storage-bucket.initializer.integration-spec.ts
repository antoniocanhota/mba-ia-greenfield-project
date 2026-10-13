import {
  GetBucketLifecycleConfigurationCommand,
  GetBucketPolicyCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import {
  buildTestStorageConfig,
  deleteTestBucket,
  fetchViaInternalEndpoint,
} from '../test/storage-test-config';
import { thumbnailKey, videoKey } from './storage-keys';
import { S3_INTERNAL_CLIENT } from './storage.constants';
import { StorageBucketInitializer } from './storage-bucket.initializer';
import { StorageBucketModule } from './storage-bucket.module';
import { StorageModule } from './storage.module';
import type { S3Client } from '@aws-sdk/client-s3';

describe('StorageBucketInitializer (integration, real storage)', () => {
  const config = buildTestStorageConfig();
  let initializer: StorageBucketInitializer;
  let client: S3Client;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
        StorageModule,
        StorageBucketModule,
      ],
    })
      .overrideProvider(storageConfig.KEY)
      .useValue(config)
      .compile();
    initializer = module.get(StorageBucketInitializer);
    client = module.get<S3Client>(S3_INTERNAL_CLIENT);
    closeModule = () => module.close();
    await initializer.onModuleInit();
  });

  afterAll(async () => {
    await deleteTestBucket(config);
    await closeModule();
  });

  const objectUrl = (key: string) =>
    `${config.publicEndpoint}/${config.bucket}/${key}`;

  it('should create the bucket', async () => {
    await expect(
      client.send(new HeadBucketCommand({ Bucket: config.bucket })),
    ).resolves.toBeDefined();
  });

  it('should abort incomplete multipart uploads after one day', async () => {
    const { Rules } = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
    );

    expect(Rules).toHaveLength(1);
    expect(Rules![0].Status).toBe('Enabled');
    expect(Rules![0].AbortIncompleteMultipartUpload?.DaysAfterInitiation).toBe(
      1,
    );
  });

  it('should make only thumbnails/* publicly readable', async () => {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: thumbnailKey('pubThumb0001'),
        Body: 'jpg',
      }),
    );
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: videoKey('pubThumb0001'),
        Body: 'mp4',
      }),
    );

    const thumbnail = await fetchViaInternalEndpoint(
      objectUrl(thumbnailKey('pubThumb0001')),
      config,
    );
    const video = await fetchViaInternalEndpoint(
      objectUrl(videoKey('pubThumb0001')),
      config,
    );

    expect(thumbnail.status).toBe(200);
    expect(video.status).toBe(403);
  });

  it('should be idempotent: a second run neither fails nor duplicates config', async () => {
    await expect(initializer.onModuleInit()).resolves.toBeUndefined();

    const { Rules } = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
    );
    expect(Rules).toHaveLength(1);

    const { Policy } = await client.send(
      new GetBucketPolicyCommand({ Bucket: config.bucket }),
    );
    const statements = (
      JSON.parse(Policy as string) as { Statement: unknown[] }
    ).Statement;
    expect(statements).toHaveLength(1);
  });
});
