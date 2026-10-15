import type { MediaUrlsResponse, VideoResponse } from "@/lib/api/contracts";
import { E2E_STORAGE_ORIGIN } from "@/mocks/storage-origin";

const baseVideo: VideoResponse = {
  publicId: "dQw4w9WgXcQ",
  filename: "holiday.mp4",
  title: "holiday",
  processingStatus: "awaiting_upload",
  publicationStatus: "draft",
  failureReason: null,
  durationMs: null,
  width: null,
  height: null,
  sizeBytes: null,
  thumbnailUrl: null,
  createdAt: "2026-10-14T10:00:00.000Z",
};

export const buildVideo = (
  overrides: Partial<VideoResponse> = {},
): VideoResponse => ({
  ...baseVideo,
  ...overrides,
});

export const buildMediaUrls = (
  overrides: Partial<MediaUrlsResponse> = {},
): MediaUrlsResponse => ({
  streamUrl: `${E2E_STORAGE_ORIGIN}/videos/${baseVideo.publicId}/video.mp4?X-Amz-Signature=fake-stream`,
  downloadUrl: `${E2E_STORAGE_ORIGIN}/videos/${baseVideo.publicId}/video.mp4?X-Amz-Signature=fake-download&response-content-disposition=attachment`,
  expiresAt: "2026-10-14T14:00:00.000Z",
  ...overrides,
});
