import AwsS3 from "@uppy/aws-s3";
import Uppy from "@uppy/core";

import type { SignUploadResponse } from "@/lib/api/contracts";

export const MAX_VIDEO_BYTES = 10 * 2 ** 30;
// S3 rejects multipart parts under 5 MiB (except the last) and allows 10000 parts at most.
export const MIN_PART_BYTES = 5 * 2 ** 20;
export const MAX_PARTS = 10_000;

export const getChunkSize = (file: { size: number }) =>
  Math.max(MIN_PART_BYTES, Math.ceil(file.size / MAX_PARTS));

interface CreateUppyOptions {
  // Resolved at sign time: the draft (publicId) only exists after the file was picked.
  getPublicId: () => string | undefined;
}

interface SignRequest {
  method: string;
  key: string;
  uploadId?: string;
  partNumber?: number;
}

/**
 * Headless Uppy instance for the multipart upload straight to presigned S3 URLs. Uppy does
 * every S3 call itself; the BFF only signs them (one route per operation), so the video
 * bytes never cross Next or Nest.
 */
export function createUppy({ getPublicId }: CreateUppyOptions): Uppy {
  const uppy = new Uppy({
    autoProceed: false,
    restrictions: {
      maxNumberOfFiles: 1,
      maxFileSize: MAX_VIDEO_BYTES,
      allowedFileTypes: ["video/*"],
    },
  });

  uppy.use(AwsS3, {
    shouldUseMultipart: true,
    getChunkSize,
    limit: 6,
    async signRequest({ method, key, uploadId, partNumber }: SignRequest) {
      const publicId = getPublicId();
      if (!publicId) {
        throw new Error(
          "Cannot sign an upload request before the video draft exists",
        );
      }

      const response = await fetch(
        `/api/videos/${encodeURIComponent(publicId)}/upload-signatures`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, key, uploadId, partNumber }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Upload signature failed with status ${response.status}`,
        );
      }
      return (await response.json()) as SignUploadResponse;
    },
  });

  return uppy;
}
