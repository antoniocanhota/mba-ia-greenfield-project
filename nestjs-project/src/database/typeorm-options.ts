import type { ConfigType } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';

// Single definition of the connection, shared by the API and the video worker.
export const buildTypeOrmOptions = (
  dbConfig: ConfigType<typeof databaseConfig>,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.name,
  autoLoadEntities: true,
  synchronize: false,
});
