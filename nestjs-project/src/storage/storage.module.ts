import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT, S3_SIGNER_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

const buildClient = (
  storage: ConfigType<typeof storageConfig>,
  endpoint: string | undefined,
  options: Partial<S3ClientConfig> = {},
): S3Client =>
  new S3Client({
    ...options,
    endpoint,
    region: storage.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: storage.accessKeyId as string,
      secretAccessKey: storage.secretAccessKey as string,
    },
  });

@Module({
  providers: [
    {
      // Server-side calls: Compose service name.
      provide: S3_INTERNAL_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (storage: ConfigType<typeof storageConfig>) =>
        buildClient(storage, storage.endpoint),
    },
    {
      // Presign only: signing is offline, the host must be browser-reachable.
      provide: S3_SIGNER_CLIENT,
      inject: [storageConfig.KEY],
      // Default checksum calculation bakes the CRC32 of an empty body into the presigned
      // URL (x-amz-checksum-crc32), which makes every real upload fail with BadDigest.
      useFactory: (storage: ConfigType<typeof storageConfig>) =>
        buildClient(storage, storage.publicEndpoint, {
          requestChecksumCalculation: 'WHEN_REQUIRED',
        }),
    },
    StorageService,
  ],
  exports: [StorageService, S3_INTERNAL_CLIENT],
})
export class StorageModule {}
