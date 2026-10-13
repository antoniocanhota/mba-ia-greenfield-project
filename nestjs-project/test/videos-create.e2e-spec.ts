import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Channel } from '../src/channels/entities/channel.entity';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { buildSwaggerConfig } from '../src/swagger/swagger-document';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { User } from '../src/users/entities/user.entity';
import { Video } from '../src/videos/entities/video.entity';

const PASSWORD = 'password123';
const VALID_BODY = {
  filename: 'my-video.mp4',
  sizeBytes: 1048576,
  contentType: 'video/mp4',
};

describe('videos-create (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let throttlerStorage: ThrottlerStorageService;
  let channel: Channel;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, buildSwaggerConfig()),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();

    const user = await dataSource.getRepository(User).save({
      email: 'owner@example.com',
      password: await argon2.hash(PASSWORD),
      is_confirmed: true,
    });
    channel = await dataSource
      .getRepository(Channel)
      .save({ name: 'owner', nickname: 'owner', user_id: user.id });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    accessToken = (login.body as { access_token: string }).access_token;
    throttlerStorage.storage.clear();
  });

  const postVideo = (body: object) =>
    request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);

  // 1. Pré-cadastrar o vídeo como rascunho
  it('cria-rascunho-201', async () => {
    const res = await postVideo(VALID_BODY).expect(201);

    const body = res.body as Record<string, unknown>;
    expect(body.publicId).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(body.filename).toBe('my-video.mp4');
    expect(body.processingStatus).toBe('awaiting_upload');
    expect(body.publicationStatus).toBe('draft');
    for (const field of [
      'failureReason',
      'durationMs',
      'width',
      'height',
      'thumbnailUrl',
    ]) {
      expect(body[field]).toBeNull();
    }
    expect(new Date(body.createdAt as string).toISOString()).toBe(
      body.createdAt,
    );
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('processing_status');
    expect(body).not.toHaveProperty('publication_status');

    const stored = await dataSource
      .getRepository(Video)
      .findOneByOrFail({ public_id: body.publicId as string });
    expect(stored.processing_status).toBe('awaiting_upload');
    expect(stored.publication_status).toBe('draft');
    expect(stored.channel_id).toBe(channel.id);
  });

  it('validacao-dto-400', async () => {
    const tooBig = await postVideo({
      filename: 'big.mp4',
      sizeBytes: 10737418241,
      contentType: 'video/mp4',
    }).expect(400);
    expect((tooBig.body as { error: string }).error).toBe('VALIDATION_ERROR');

    const notVideo = await postVideo({
      filename: 'doc.pdf',
      sizeBytes: 1024,
      contentType: 'application/pdf',
    }).expect(400);
    expect((notVideo.body as { error: string }).error).toBe('VALIDATION_ERROR');

    expect(await dataSource.getRepository(Video).count()).toBe(0);
  });

  it('sem-autorizacao-401', async () => {
    await request(app.getHttpServer())
      .post('/videos')
      .send(VALID_BODY)
      .expect(401);

    expect(await dataSource.getRepository(Video).count()).toBe(0);
  });

  it('controller-isento-do-throttler', async () => {
    const publicIds = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const res = await postVideo(VALID_BODY).expect(201);
      publicIds.add((res.body as { publicId: string }).publicId);
    }

    expect(publicIds.size).toBe(12);
    expect(
      await dataSource.getRepository(Video).countBy({ channel_id: channel.id }),
    ).toBe(12);
  });

  // 2. Documentação OpenAPI
  it('operacao-documentada-em-api-docs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const document = res.body as {
      paths: Record<
        string,
        {
          post?: {
            tags: string[];
            security: Record<string, string[]>[];
            responses: Record<string, unknown>;
          };
        }
      >;
    };
    const operation = document.paths['/videos'].post;
    expect(operation).toBeDefined();
    expect(operation!.tags).toContain('videos');
    expect(operation!.security).toEqual(
      expect.arrayContaining([expect.objectContaining({ 'access-token': [] })]),
    );
    expect(JSON.stringify(operation!.responses['201'])).toContain(
      'VideoResponseDto',
    );
    expect(JSON.stringify(operation!.responses['400'])).toContain(
      'ApiErrorEnvelope',
    );
    expect(JSON.stringify(operation!.responses['401'])).toContain(
      'ApiErrorEnvelope',
    );
  });
});
