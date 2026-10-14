import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { MediaModule } from '../media/media.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { Video } from '../videos/entities/video.entity';
import { VideoProcessingService } from './video-processing.service';
import { VideoSweepScheduler } from './video-sweep.scheduler';
import { VideoSweepService } from './video-sweep.service';
import { VideoProcessor } from './video.processor';

// Worker-only: importing this module in the API would make it consume the queue.
// ChannelsModule and UsersModule register the entities Video relates to (Channel, User):
// TypeORM refuses to build the metadata of a relation target that is not registered.
@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    ChannelsModule,
    UsersModule,
    MediaModule,
    StorageModule,
    QueueModule,
  ],
  providers: [
    VideoProcessingService,
    VideoSweepService,
    VideoSweepScheduler,
    VideoProcessor,
  ],
})
export class VideoProcessingModule {}
