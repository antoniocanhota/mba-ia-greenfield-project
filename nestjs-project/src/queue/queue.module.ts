import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { ConfigType } from '@nestjs/config';
import queueConfig from '../config/queue.config';
import { VIDEOS_QUEUE } from './queue.constants';

// Shared by the API (producer) and the worker (consumer). No processor lives here:
// the API never consumes jobs, only the worker entrypoint registers VideoProcessor.
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [queueConfig.KEY],
      useFactory: (queue: ConfigType<typeof queueConfig>) => ({
        connection: { host: queue.host, port: queue.port },
      }),
    }),
    BullModule.registerQueue({ name: VIDEOS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
