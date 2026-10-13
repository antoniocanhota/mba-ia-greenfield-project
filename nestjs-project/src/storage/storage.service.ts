import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  PutObjectCommand,
  UploadPartCommand,
  type CompletedPart,
  type HeadObjectCommandOutput,
  type MultipartUpload,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'fs';
import { open, stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import storageConfig from '../config/storage.config';
import {
  MULTIPART_PART_BYTES,
  S3_INTERNAL_CLIENT,
  S3_SIGNER_CLIENT,
  SINGLE_PUT_MAX_BYTES,
} from './storage.constants';
import { publicObjectUrl } from './storage-keys';

// `getSignedUrl` accepts any S3 command; keep the parameter type derived from it.
type PresignableCommand = Parameters<typeof getSignedUrl>[1];

@Injectable()
export class StorageService {
  constructor(
    @Inject(S3_INTERNAL_CLIENT) private readonly internal: S3Client,
    @Inject(S3_SIGNER_CLIENT) private readonly signer: S3Client,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  get bucket(): string {
    return this.storage.bucket as string;
  }

  publicUrl(key: string): string {
    return publicObjectUrl(
      this.storage.publicEndpoint as string,
      this.bucket,
      key,
    );
  }

  async presign(
    command: PresignableCommand,
    expiresIn: number,
  ): Promise<string> {
    return getSignedUrl(this.signer, command, { expiresIn });
  }

  async headObject(key: string): Promise<HeadObjectCommandOutput> {
    return this.internal.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.internal.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async listMultipartUploads(prefix: string): Promise<MultipartUpload[]> {
    const output = await this.internal.send(
      new ListMultipartUploadsCommand({ Bucket: this.bucket, Prefix: prefix }),
    );
    return output.Uploads ?? [];
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.internal.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async downloadToFile(key: string, path: string): Promise<void> {
    const { Body } = await this.internal.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!(Body instanceof Readable)) {
      throw new Error(`Object ${key} has no readable body`);
    }
    await pipeline(Body, createWriteStream(path));
  }

  async uploadFile(
    key: string,
    path: string,
    contentType: string,
  ): Promise<void> {
    const { size } = await stat(path);
    if (size <= SINGLE_PUT_MAX_BYTES) {
      await this.internal.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: createReadStream(path),
          ContentLength: size,
          ContentType: contentType,
        }),
      );
      return;
    }
    await this.uploadFileMultipart(key, path, size, contentType);
  }

  // PutObject caps at 5 GiB and videos go up to 10 GiB, so large files go in parts.
  private async uploadFileMultipart(
    key: string,
    path: string,
    size: number,
    contentType: string,
  ): Promise<void> {
    const { UploadId } = await this.internal.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    const handle = await open(path, 'r');
    try {
      const parts: CompletedPart[] = [];
      for (
        let offset = 0, partNumber = 1;
        offset < size;
        offset += MULTIPART_PART_BYTES, partNumber++
      ) {
        const length = Math.min(MULTIPART_PART_BYTES, size - offset);
        const chunk = Buffer.alloc(length);
        await handle.read(chunk, 0, length, offset);
        const { ETag } = await this.internal.send(
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId,
            PartNumber: partNumber,
            Body: chunk,
          }),
        );
        parts.push({ ETag, PartNumber: partNumber });
      }
      await this.internal.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
    } catch (error) {
      await this.abortMultipartUpload(key, UploadId as string);
      throw error;
    } finally {
      await handle.close();
    }
  }
}
