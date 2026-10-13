import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { Video } from './entities/video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Video]), QueueModule],
  exports: [TypeOrmModule],
})
export class VideosModule {}
