import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  S3ServiceException,
  type S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT } from './storage.constants';
import { THUMBNAILS_PREFIX } from './storage-keys';

// Idempotent bucket setup, applied on API boot only (the worker never imports this).
@Injectable()
export class StorageBucketInitializer implements OnModuleInit {
  constructor(
    @Inject(S3_INTERNAL_CLIENT) private readonly client: S3Client,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
    await this.applyLifecycle();
    await this.applyPublicThumbnailsPolicy();
  }

  private get bucket(): string {
    return this.storage.bucket as string;
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (
        !(error instanceof S3ServiceException) ||
        error.$metadata.httpStatusCode !== 404
      ) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  private async applyLifecycle(): Promise<void> {
    await this.client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'abort-incomplete-multipart-uploads',
              Status: 'Enabled',
              Filter: { Prefix: '' },
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
            },
          ],
        },
      }),
    );
  }

  private async applyPublicThumbnailsPolicy(): Promise<void> {
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadThumbnails',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/${THUMBNAILS_PREFIX}*`],
            },
          ],
        }),
      }),
    );
  }
}
