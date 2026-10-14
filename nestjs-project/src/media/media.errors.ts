import { VideoFailureReason } from '../videos/entities/video-enums';

// Each media error carries the failure_reason the processor persists. ffmpeg stderr
// never goes into the message: it is logged by FfmpegService only.
export abstract class MediaError extends Error {
  abstract readonly failureReason: VideoFailureReason;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class MediaProbeError extends MediaError {
  readonly failureReason = VideoFailureReason.UNREADABLE_FILE;
}

export class NotAVideoError extends MediaError {
  readonly failureReason = VideoFailureReason.NOT_A_VIDEO;
}

export class UnsupportedMediaError extends MediaError {
  readonly failureReason = VideoFailureReason.UNSUPPORTED_MEDIA;
}
