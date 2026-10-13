import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { createLoggedInUser } from '../src/test/e2e-users';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
}

describe('videos-get (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let throttlerStorage: ThrottlerStorageService;
  let ownerToken: string;
  let otherToken: string;
  let publicId: string;

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

    ({ accessToken: ownerToken } = await createLoggedInUser(
      app,
      dataSource,
      'owner@example.com',
      'owner',
    ));
    ({ accessToken: otherToken } = await createLoggedInUser(
      app,
      dataSource,
      'other@example.com',
      'other',
    ));
    throttlerStorage.storage.clear();

    const created = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        filename: 'my-video.mp4',
        sizeBytes: 1024,
        contentType: 'video/mp4',
      })
      .expect(201);
    publicId = (created.body as { publicId: string }).publicId;
  });

  const getVideo = (id: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/videos/${id}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  // 1. Ler o vídeo do dono

  it('dono-le-video-200', async () => {
    const res = await getVideo(publicId, ownerToken).expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body.publicId).toBe(publicId);
    expect(body.filename).toBe('my-video.mp4');
    expect(body.processingStatus).toBe('awaiting_upload');
    expect(body.publicationStatus).toBe('draft');
    expect(body).not.toHaveProperty('id');
  });

  it('outro-canal-ou-inexistente-404', async () => {
    const foreign = await getVideo(publicId, otherToken).expect(404);
    const foreignBody = foreign.body as ErrorBody;
    expect(foreignBody.error).toBe('VIDEO_NOT_FOUND');
    expect(foreignBody.message).toBe('Video not found');

    const missing = await getVideo('ZZZZZZZZZZZ', ownerToken).expect(404);
    expect(missing.body).toEqual(foreign.body);
  });

  it('formato-invalido-404', async () => {
    const res = await getVideo('abc', ownerToken).expect(404);

    expect((res.body as ErrorBody).error).toBe('VIDEO_NOT_FOUND');
  });

  it('sem-autorizacao-401', async () => {
    await getVideo(publicId).expect(401);
  });
});
