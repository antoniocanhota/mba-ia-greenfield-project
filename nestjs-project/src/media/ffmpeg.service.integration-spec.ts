import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FfmpegService } from './ffmpeg.service';
import { MediaProbeError } from './media.errors';
import { extractMetadata, needsTranscode } from './probe-metadata';

const run = promisify(execFile);

// Fixtures are generated with lavfi so no binary is committed.
const generate = (output: string, args: string[]) =>
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=2:size=320x240:rate=15',
    ...args,
    output,
  ]);

// In a faststart file the moov atom precedes mdat.
const hasMoovBeforeMdat = async (path: string): Promise<boolean> => {
  const buffer = await readFile(path);
  const moov = buffer.indexOf('moov');
  const mdat = buffer.indexOf('mdat');
  return moov !== -1 && mdat !== -1 && moov < mdat;
};

describe('FfmpegService (integration)', () => {
  const service = new FfmpegService();
  let dir: string;
  let mp4: string;
  let webm: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ffmpeg-spec-'));
    mp4 = join(dir, 'source.mp4');
    webm = join(dir, 'source.webm');
    await generate(mp4, ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
    await generate(webm, ['-c:v', 'libvpx-vp9']);
  }, 60000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('should probe an H.264 MP4', async () => {
    const probe = await service.probe(mp4);

    expect(extractMetadata(probe)).toMatchObject({
      durationMs: expect.any(Number) as number,
      width: 320,
      height: 240,
      hasVideoStream: true,
    });
    expect(needsTranscode(probe)).toBe(false);
  });

  it('should report display dimensions for a video rotated by 90 degrees', async () => {
    const rotated = join(dir, 'rotated.mp4');
    await run('ffmpeg', [
      '-y',
      '-i',
      mp4,
      '-c',
      'copy',
      '-metadata:s:v',
      'rotate=90',
      rotated,
    ]);

    expect(extractMetadata(await service.probe(rotated))).toMatchObject({
      width: 240,
      height: 320,
    });
  });

  it('should flag VP9 as needing transcode', async () => {
    expect(needsTranscode(await service.probe(webm))).toBe(true);
  });

  it('should remux H.264 keeping the codec and putting moov before mdat', async () => {
    const output = join(dir, 'remux.mp4');

    await service.normalize(mp4, output, { transcode: false });

    const probe = await service.probe(output);
    expect(probe.streams[0].codec_name).toBe('h264');
    expect(await hasMoovBeforeMdat(output)).toBe(true);
  });

  it('should transcode VP9/WebM into H.264 MP4', async () => {
    const output = join(dir, 'transcoded.mp4');

    await service.normalize(webm, output, { transcode: true });

    const probe = await service.probe(output);
    expect(
      probe.streams.find((s) => s.codec_type === 'video')?.codec_name,
    ).toBe('h264');
    expect(needsTranscode(probe)).toBe(false);
    expect(await hasMoovBeforeMdat(output)).toBe(true);
  }, 60000);

  it('should create a JPEG thumbnail', async () => {
    await service.thumbnail(mp4, dir, 'thumb.jpg');

    const file = join(dir, 'thumb.jpg');
    expect((await stat(file)).size).toBeGreaterThan(0);
    expect((await readFile(file)).subarray(0, 2).toString('hex')).toBe('ffd8');
  });

  it('should report a text file as unreadable', async () => {
    const text = join(dir, 'notes.txt');
    await writeFile(text, 'not a video');

    await expect(service.probe(text)).rejects.toBeInstanceOf(MediaProbeError);
  });

  it('should report an audio-only file without a video stream', async () => {
    const audioOnly = join(dir, 'audio.m4a');
    await run('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=duration=1',
      '-c:a',
      'aac',
      audioOnly,
    ]);

    expect(extractMetadata(await service.probe(audioOnly)).hasVideoStream).toBe(
      false,
    );
  });
});
