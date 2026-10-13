import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { User } from '../users/entities/user.entity';

export const E2E_PASSWORD = 'password123';

export interface E2eUser {
  user: User;
  channel: Channel;
  accessToken: string;
}

// Confirmed user with a channel, logged in through the real /auth/login endpoint.
export async function createLoggedInUser(
  app: INestApplication,
  dataSource: DataSource,
  email: string,
  nickname: string,
): Promise<E2eUser> {
  const user = await dataSource.getRepository(User).save({
    email,
    password: await argon2.hash(E2E_PASSWORD),
    is_confirmed: true,
  });
  const channel = await dataSource
    .getRepository(Channel)
    .save({ name: nickname, nickname, user_id: user.id });
  const login = await request(app.getHttpServer() as never)
    .post('/auth/login')
    .send({ email, password: E2E_PASSWORD })
    .expect(200);
  return {
    user,
    channel,
    accessToken: (login.body as { access_token: string }).access_token,
  };
}
