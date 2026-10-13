import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT, S3_SIGNER_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

const buildClient = (
  storage: ConfigType<typeof storageConfig>,
  endpoint: string | undefined,
): S3Client =>
  new S3Client({
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
      useFactory: (storage: ConfigType<typeof storageConfig>) =>
        buildClient(storage, storage.publicEndpoint),
    },
    StorageService,
  ],
  exports: [StorageService, S3_INTERNAL_CLIENT],
})
export class StorageModule {}
