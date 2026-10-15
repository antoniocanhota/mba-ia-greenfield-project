import { registerAs } from '@nestjs/config';
import { DEFAULT_QUEUE_PREFIX } from '../queue/queue.constants';

export default registerAs('queue', () => ({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  prefix: process.env.QUEUE_PREFIX || DEFAULT_QUEUE_PREFIX,
}));
