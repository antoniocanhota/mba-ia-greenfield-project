import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import type { FfprobeData } from 'fluent-ffmpeg';
import { MediaProbeError, UnsupportedMediaError } from './media.errors';

export interface NormalizeOptions {
  transcode: boolean;
}

// The only place that touches fluent-ffmpeg. stderr goes to the log, never to errors.
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  probe(path: string): Promise<FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(path, (err: Error | null, data) => {
        if (err) {
          this.logger.warn(`ffprobe failed for ${path}: ${err.message}`);
          reject(
            new MediaProbeError('Could not read media file', { cause: err }),
          );
          return;
        }
        resolve(data);
      });
    });
  }

  normalize(
    input: string,
    output: string,
    { transcode }: NormalizeOptions,
  ): Promise<void> {
    const outputOptions = transcode
      ? [
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
        ]
      : ['-c', 'copy', '-movflags', '+faststart'];

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .outputOptions(outputOptions)
        .format('mp4')
        .on('error', (err: Error, _stdout: string, stderr: string) => {
          this.logger.error(
            `ffmpeg normalize failed: ${stderr || err.message}`,
          );
          reject(
            transcode
              ? new UnsupportedMediaError('Media could not be transcoded', {
                  cause: err,
                })
              : err,
          );
        })
        .on('end', () => resolve())
        .save(output);
    });
  }

  thumbnail(input: string, folder: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .on('error', (err: Error, _stdout: string, stderr: string) => {
          this.logger.error(
            `ffmpeg thumbnail failed: ${stderr || err.message}`,
          );
          reject(err);
        })
        .on('end', () => resolve())
        .screenshots({
          timestamps: ['10%'],
          filename,
          folder,
          size: '1280x?',
        });
    });
  }
}
