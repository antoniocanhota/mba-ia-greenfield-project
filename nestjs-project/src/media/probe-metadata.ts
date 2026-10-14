import type { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';

export interface VideoMetadata {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasVideoStream: boolean;
}

// ffprobe reports cover art (mp3 album art) as a video stream; it is not a video.
const findVideoStream = (probe: FfprobeData): FfprobeStream | undefined =>
  probe.streams.find(
    (stream) =>
      stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1,
  );

// fluent-ffmpeg flattens the displaymatrix side data into the stream (`rotation`), which
// ffmpeg >= 5 emits; `side_data_list` (JSON probes) and the legacy `rotate` tag are kept
// as fallbacks. Sign differs between sources, so it is normalized to 0/90/180/270.
interface RotatableStream {
  rotation?: number | string;
  side_data_list?: { rotation?: number | string }[];
  tags?: { rotate?: string };
}

const readRotation = (stream: FfprobeStream): number => {
  const { rotation, side_data_list, tags } = stream as FfprobeStream &
    RotatableStream;
  const raw =
    rotation ??
    side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ??
    tags?.rotate;
  const degrees = Number(raw);
  if (!Number.isFinite(degrees)) return 0;
  return ((Math.round(degrees) % 360) + 360) % 360;
};

export const extractMetadata = (probe: FfprobeData): VideoMetadata => {
  const seconds = Number(probe.format?.duration);
  const durationMs = Number.isFinite(seconds)
    ? Math.round(seconds * 1000)
    : null;
  const video = findVideoStream(probe);
  if (!video) {
    return { durationMs, width: null, height: null, hasVideoStream: false };
  }

  const swap = [90, 270].includes(readRotation(video));
  const width = video.width ?? null;
  const height = video.height ?? null;
  return {
    durationMs,
    width: swap ? height : width,
    height: swap ? width : height,
    hasVideoStream: true,
  };
};

// Remux (-c copy) is only safe for H.264 video with AAC or no audio; anything else is
// transcoded to H.264/AAC so every ready video plays in a plain <video> tag.
export const needsTranscode = (probe: FfprobeData): boolean => {
  const video = findVideoStream(probe);
  if (video?.codec_name !== 'h264') return true;
  return probe.streams
    .filter((stream) => stream.codec_type === 'audio')
    .some((stream) => stream.codec_name !== 'aac');
};
