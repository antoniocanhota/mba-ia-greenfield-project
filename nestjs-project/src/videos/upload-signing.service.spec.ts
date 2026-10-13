import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { StorageService } from '../storage/storage.service';
import type { SignUploadRequestDto } from './dto/sign-upload-request.dto';
import { VideoProcessingStatus } from './entities/video-enums';
import { Video } from './entities/video.entity';
import {
  InvalidUploadKeyException,
  InvalidVideoStateException,
  UnsupportedUploadOperationException,
} from './exceptions/video.exceptions';
import { UploadSigningService } from './upload-signing.service';

const PUBLIC_ID = 'abcDEF12345';
const KEY = `videos/${PUBLIC_ID}/original`;
const TTL = 1234;

function makeVideo(status = VideoProcessingStatus.AWAITING_UPLOAD): Video {
  return Object.assign(new Video(), {
    public_id: PUBLIC_ID,
    processing_status: status,
  });
}

describe('UploadSigningService', () => {
  let service: UploadSigningService;
  let storage: {
    bucket: string;
    presign: jest.Mock;
    listMultipartUploads: jest.Mock;
    abortMultipartUpload: jest.Mock;
  };

  beforeEach(() => {
    storage = {
      bucket: 'bucket',
      presign: jest.fn().mockResolvedValue('https://signed.example/url'),
      listMultipartUploads: jest.fn().mockResolvedValue([]),
      abortMultipartUpload: jest.fn().mockResolvedValue(undefined),
    };
    service = new UploadSigningService(
      storage as unknown as StorageService,
      { uploadSignTtlSeconds: TTL } as never,
    );
  });

  const signedCommand = (): { input: Record<string, unknown> } => {
    const [command] = storage.presign.mock.calls[0] as [
      { input: Record<string, unknown> },
    ];
    return command;
  };

  describe('mapping table', () => {
    it('should sign CreateMultipartUpload on the server key, ignoring the proposed one', async () => {
      const dto: SignUploadRequestDto = { method: 'POST', key: 'qualquer' };

      const result = await service.sign(makeVideo(), dto);

      expect(result).toEqual({ url: 'https://signed.example/url', key: KEY });
      const command = signedCommand();
      expect(command).toBeInstanceOf(CreateMultipartUploadCommand);
      expect(command.input).toEqual({
        Bucket: 'bucket',
        Key: KEY,
        ContentType: 'application/octet-stream',
      });
      expect(storage.presign).toHaveBeenCalledWith(command, TTL);
    });

    it('should sign UploadPart for PUT with uploadId and partNumber', async () => {
      const result = await service.sign(makeVideo(), {
        method: 'PUT',
        key: KEY,
        uploadId: 'u-1',
        partNumber: 3,
      });

      expect(result).toEqual({ url: 'https://signed.example/url' });
      const command = signedCommand();
      expect(command).toBeInstanceOf(UploadPartCommand);
      expect(command.input).toEqual({
        Bucket: 'bucket',
        Key: KEY,
        UploadId: 'u-1',
        PartNumber: 3,
      });
    });

    it.each([
      ['GET', ListPartsCommand],
      ['POST', CompleteMultipartUploadCommand],
      ['DELETE', AbortMultipartUploadCommand],
    ] as const)(
      'should sign the matching command for %s with an uploadId',
      async (method, commandClass) => {
        await service.sign(makeVideo(), { method, key: KEY, uploadId: 'u-1' });

        const command = signedCommand();
        expect(command).toBeInstanceOf(commandClass);
        expect(command.input).toEqual({
          Bucket: 'bucket',
          Key: KEY,
          UploadId: 'u-1',
        });
        expect(storage.listMultipartUploads).not.toHaveBeenCalled();
      },
    );
  });

  describe('CreateMultipartUpload cleanup', () => {
    it('should abort every in-flight multipart of the key before signing', async () => {
      storage.listMultipartUploads.mockResolvedValue([
        { Key: KEY, UploadId: 'old-1' },
        { Key: KEY, UploadId: 'old-2' },
      ]);

      await service.sign(makeVideo(), { method: 'POST', key: 'x' });

      expect(storage.listMultipartUploads).toHaveBeenCalledWith(KEY);
      expect(storage.abortMultipartUpload).toHaveBeenCalledTimes(2);
      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(KEY, 'old-1');
      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(KEY, 'old-2');
      const abortOrder = storage.abortMultipartUpload.mock.invocationCallOrder;
      expect(Math.max(...abortOrder)).toBeLessThan(
        storage.presign.mock.invocationCallOrder[0],
      );
    });

    it('should not abort uploads of other keys that merely share the prefix', async () => {
      storage.listMultipartUploads.mockResolvedValue([
        { Key: `${KEY}-other`, UploadId: 'other' },
      ]);

      await service.sign(makeVideo(), { method: 'POST', key: 'x' });

      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
    });
  });

  describe('rejections', () => {
    it('should throw INVALID_UPLOAD_KEY when the key differs from the draft key', async () => {
      await expect(
        service.sign(makeVideo(), {
          method: 'PUT',
          key: 'videos/outro/original',
          uploadId: 'u-1',
          partNumber: 1,
        }),
      ).rejects.toBeInstanceOf(InvalidUploadKeyException);
      expect(storage.presign).not.toHaveBeenCalled();
    });

    it.each<SignUploadRequestDto>([
      { method: 'PUT', key: KEY },
      { method: 'GET', key: KEY },
      { method: 'DELETE', key: KEY },
      { method: 'POST', key: KEY, partNumber: 1 },
      { method: 'PUT', key: KEY, uploadId: 'u-1' },
      { method: 'GET', key: KEY, uploadId: 'u-1', partNumber: 1 },
      { method: 'POST', key: KEY, uploadId: 'u-1', partNumber: 1 },
      { method: 'DELETE', key: KEY, uploadId: 'u-1', partNumber: 1 },
    ])('should throw UNSUPPORTED_UPLOAD_OPERATION for %j', async (dto) => {
      await expect(service.sign(makeVideo(), dto)).rejects.toBeInstanceOf(
        UnsupportedUploadOperationException,
      );
      expect(storage.presign).not.toHaveBeenCalled();
      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
    });

    it.each([
      VideoProcessingStatus.UPLOADED,
      VideoProcessingStatus.PROCESSING,
      VideoProcessingStatus.READY,
      VideoProcessingStatus.FAILED,
    ])(
      'should throw INVALID_VIDEO_STATE when the video is %s',
      async (status) => {
        await expect(
          service.sign(makeVideo(status), { method: 'POST', key: 'x' }),
        ).rejects.toBeInstanceOf(InvalidVideoStateException);
        expect(storage.listMultipartUploads).not.toHaveBeenCalled();
      },
    );
  });
});
