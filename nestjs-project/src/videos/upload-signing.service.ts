import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { originalKey } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import type { SignUploadRequestDto } from './dto/sign-upload-request.dto';
import type { SignUploadResponseDto } from './dto/sign-upload-response.dto';
import { VideoProcessingStatus } from './entities/video-enums';
import type { Video } from './entities/video.entity';
import {
  InvalidUploadKeyException,
  InvalidVideoStateException,
  UnsupportedUploadOperationException,
} from './exceptions/video.exceptions';

// Presigns the S3 multipart operations Uppy asks for through `signRequest`. The object
// key is always the server's; the client never chooses where bytes land.
@Injectable()
export class UploadSigningService {
  constructor(
    private readonly storageService: StorageService,
    @Inject(storageConfig.KEY)
    private readonly storage: ConfigType<typeof storageConfig>,
  ) {}

  async sign(
    video: Video,
    dto: SignUploadRequestDto,
  ): Promise<SignUploadResponseDto> {
    if (video.processing_status !== VideoProcessingStatus.AWAITING_UPLOAD) {
      throw new InvalidVideoStateException();
    }
    const key = originalKey(video.public_id);
    const { method, uploadId, partNumber } = dto;

    if (!uploadId) {
      if (method === 'POST' && partNumber === undefined) {
        return this.createMultipartUpload(key);
      }
      throw new UnsupportedUploadOperationException();
    }

    if (dto.key !== key) {
      throw new InvalidUploadKeyException();
    }
    const base = { Bucket: this.storageService.bucket, Key: key };

    if (method === 'PUT' && partNumber !== undefined) {
      return this.presigned(
        new UploadPartCommand({
          ...base,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
      );
    }
    if (partNumber === undefined) {
      if (method === 'GET') {
        return this.presigned(
          new ListPartsCommand({ ...base, UploadId: uploadId }),
        );
      }
      if (method === 'POST') {
        return this.presigned(
          new CompleteMultipartUploadCommand({ ...base, UploadId: uploadId }),
        );
      }
      if (method === 'DELETE') {
        return this.presigned(
          new AbortMultipartUploadCommand({ ...base, UploadId: uploadId }),
        );
      }
    }
    throw new UnsupportedUploadOperationException();
  }

  // A fresh multipart replaces any in-flight one for the same key, so abandoned sessions
  // never pile up and no uploadId needs to be persisted.
  private async createMultipartUpload(
    key: string,
  ): Promise<SignUploadResponseDto> {
    const inFlight = await this.storageService.listMultipartUploads(key);
    for (const upload of inFlight) {
      if (upload.Key === key && upload.UploadId) {
        await this.storageService.abortMultipartUpload(key, upload.UploadId);
      }
    }
    const { url } = await this.presigned(
      new CreateMultipartUploadCommand({
        Bucket: this.storageService.bucket,
        Key: key,
        ContentType: 'application/octet-stream',
      }),
    );
    return { url, key };
  }

  private async presigned(
    command: Parameters<StorageService['presign']>[0],
  ): Promise<SignUploadResponseDto> {
    return {
      url: await this.storageService.presign(
        command,
        this.storage.uploadSignTtlSeconds,
      ),
    };
  }
}
