import type { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';
import { extractMetadata, needsTranscode } from './probe-metadata';

const video = (extra: Record<string, unknown> = {}): FfprobeStream =>
  ({
    codec_type: 'video',
    codec_name: 'h264',
    width: 1920,
    height: 1080,
    ...extra,
  }) as unknown as FfprobeStream;

const audio = (codec = 'aac'): FfprobeStream =>
  ({ codec_type: 'audio', codec_name: codec }) as unknown as FfprobeStream;

const probe = (
  streams: FfprobeStream[],
  duration: string | number = '10.000000',
): FfprobeData => ({ streams, format: { duration } }) as unknown as FfprobeData;

describe('extractMetadata', () => {
  it('should convert a fractional duration to integer milliseconds', () => {
    const metadata = extractMetadata(probe([video()], '596.458000'));

    expect(metadata.durationMs).toBe(596458);
    expect(Number.isInteger(metadata.durationMs)).toBe(true);
  });

  it('should round sub-millisecond precision', () => {
    expect(extractMetadata(probe([video()], '1.0006')).durationMs).toBe(1001);
  });

  it('should return null duration when the format has none', () => {
    expect(extractMetadata(probe([video()], 'N/A')).durationMs).toBeNull();
  });

  it.each([
    ['no rotation', {}, 1920, 1080],
    ['flat rotation -90', { rotation: -90 }, 1080, 1920],
    ['flat rotation 90', { rotation: 90 }, 1080, 1920],
    ['flat rotation 180', { rotation: 180 }, 1920, 1080],
    ['side data 90', { side_data_list: [{ rotation: -90 }] }, 1080, 1920],
    ['side data 270', { side_data_list: [{ rotation: 90 }] }, 1080, 1920],
    ['side data 180', { side_data_list: [{ rotation: 180 }] }, 1920, 1080],
    ['legacy tag 90', { tags: { rotate: '90' } }, 1080, 1920],
    ['legacy tag 270', { tags: { rotate: '270' } }, 1080, 1920],
    ['legacy tag 0', { tags: { rotate: '0' } }, 1920, 1080],
  ])('should apply rotation: %s', (_label, extra, width, height) => {
    const metadata = extractMetadata(probe([video(extra)]));

    expect(metadata).toMatchObject({ width, height, hasVideoStream: true });
  });

  it('should report hasVideoStream false for audio-only files', () => {
    expect(extractMetadata(probe([audio()]))).toEqual({
      durationMs: 10000,
      width: null,
      height: null,
      hasVideoStream: false,
    });
  });

  it('should not treat attached cover art as a video stream', () => {
    const cover = video({ disposition: { attached_pic: 1 } });

    expect(extractMetadata(probe([cover, audio('mp3')])).hasVideoStream).toBe(
      false,
    );
  });
});

describe('needsTranscode', () => {
  it('should not transcode H.264 with AAC', () => {
    expect(needsTranscode(probe([video(), audio('aac')]))).toBe(false);
  });

  it('should not transcode H.264 without audio', () => {
    expect(needsTranscode(probe([video()]))).toBe(false);
  });

  it('should transcode H.264 with non-AAC audio', () => {
    expect(needsTranscode(probe([video(), audio('mp3')]))).toBe(true);
  });

  it('should transcode HEVC', () => {
    expect(
      needsTranscode(probe([video({ codec_name: 'hevc' }), audio()])),
    ).toBe(true);
  });

  it('should transcode VP9', () => {
    expect(
      needsTranscode(probe([video({ codec_name: 'vp9' }), audio('opus')])),
    ).toBe(true);
  });
});
