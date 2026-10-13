import { Module } from '@nestjs/common';
import { StorageBucketInitializer } from './storage-bucket.initializer';
import { StorageModule } from './storage.module';

// API-only: provisions the bucket on boot. The worker imports StorageModule alone.
@Module({
  imports: [StorageModule],
  providers: [StorageBucketInitializer],
})
export class StorageBucketModule {}
