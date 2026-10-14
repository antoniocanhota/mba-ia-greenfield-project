import type {
  VideoFailureReason,
  VideoProcessingStatus,
} from "@/lib/api/contracts";

const EMPTY_LABEL = "—";

/** `m:ss` below one hour, `h:mm:ss` from one hour up; `null` renders as "—". */
export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return EMPTY_LABEL;

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * Quality label derived from the shorter side, so landscape and portrait
 * versions of the same video get the same label.
 */
export function qualityLabel(
  width: number | null,
  height: number | null,
): string {
  if (width === null || height === null) return EMPTY_LABEL;

  const shorterSide = Math.min(width, height);
  if (shorterSide >= 2160) return "4K";
  if (shorterSide >= 1440) return "1440p";
  if (shorterSide >= 1080) return "1080p HD";
  if (shorterSide >= 720) return "720p HD";
  return `${shorterSide}p`;
}

const PROCESSING_STATUS_COPY: Record<VideoProcessingStatus, string> = {
  awaiting_upload: "Waiting for the upload to finish",
  uploaded: "Upload complete. Waiting to be processed...",
  processing: "Processing your video...",
  ready: "Processing complete. Your video is ready.",
  failed: "We couldn't process this video.",
};

export function processingStatusCopy(status: VideoProcessingStatus): string {
  return PROCESSING_STATUS_COPY[status];
}

const FAILURE_REASON_COPY: Record<VideoFailureReason, string> = {
  not_a_video: "This file is not a video. Choose a video file and try again.",
  unreadable_file:
    "We couldn't read this file. It may be corrupted; try uploading it again.",
  unsupported_media:
    "This video format isn't supported. Try converting it to MP4 and upload again.",
  processing_error:
    "Something went wrong while processing your video. Try uploading it again.",
  upload_abandoned:
    "The upload was interrupted before it finished. Start a new upload.",
};

export function failureReasonCopy(reason: VideoFailureReason): string {
  return FAILURE_REASON_COPY[reason];
}

export function publicVideoUrl(origin: string, publicId: string): string {
  return `${origin}/v/${publicId}`;
}
