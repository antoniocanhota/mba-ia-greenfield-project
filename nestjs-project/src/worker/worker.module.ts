import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from '../config/app.config';
import authConfig from '../config/auth.config';
import databaseConfig from '../config/database.config';
import { envValidationSchema } from '../config/env.validation';
import mailConfig from '../config/mail.config';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import swaggerConfig from '../config/swagger.config';
import { buildTypeOrmOptions } from '../database/typeorm-options';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';

// HTTP-less root of the video worker: no controllers and no StorageBucketInitializer
// (the API owns bucket setup). Processors are registered by later SIs.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        mailConfig,
        queueConfig,
        storageConfig,
        swaggerConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [databaseConfig.KEY],
      useFactory: buildTypeOrmOptions,
    }),
    QueueModule,
    StorageModule,
  ],
})
export class WorkerModule {}
