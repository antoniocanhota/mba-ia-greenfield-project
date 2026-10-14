import { Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';

// Imported only by the worker: the API never runs ffmpeg.
@Module({
  providers: [FfmpegService],
  exports: [FfmpegService],
})
export class MediaModule {}
