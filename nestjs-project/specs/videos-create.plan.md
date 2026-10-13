---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.6
target_file: test/videos-create.e2e-spec.ts
---

# POST /videos — Test Plan

## Application Overview

`POST /videos` pré-cadastra o vídeo como rascunho no início do upload: valida `CreateVideoDto` (`filename` 1–255, `sizeBytes` 1–10737418240, `contentType` com prefixo `video/`), resolve o canal do usuário autenticado (`channels.user_id = JWT sub`), gera o `publicId` de 11 caracteres base64url e persiste o vídeo com `processing_status = awaiting_upload` e `publication_status = draft`. A rota é autenticada (guard JWT global) e o `VideosController` tem `@SkipThrottle()` — o `ThrottlerGuard` global (10 req/min) bloquearia a assinatura de partes de arquivos grandes. A resposta é o `VideoResponseDto` em camelCase, sem o `id` UUID interno. Erros seguem o envelope `ApiErrorEnvelope` (`{ statusCode, error, message }`).

## Test Scenarios

### 1. Pré-cadastrar o vídeo como rascunho

**Setup:** `beforeAll`: `Test.createTestingModule({ imports: [AppModule] }).compile()` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `DomainExceptionFilter`/`ValidationExceptionFilter` (reproduz `main.ts`); `beforeEach`: `cleanAllTables(dataSource)`, cria usuário confirmado com canal e obtém `access_token` via `POST /auth/login` (reset do `ThrottlerStorage` entre testes, como em `auth.e2e-spec.ts`); `afterAll(() => app.close())`.

#### 1.1. cria-rascunho-201

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos com `Authorization: Bearer {access_token}` e body `{ filename: "my-video.mp4", sizeBytes: 1048576, contentType: "video/mp4" }`
    - expect: status `201`
    - expect: body com `publicId` casando `^[A-Za-z0-9_-]{11}$`, `filename: "my-video.mp4"`, `processingStatus: "awaiting_upload"`, `publicationStatus: "draft"`
    - expect: `failureReason`, `durationMs`, `width`, `height`, `thumbnailUrl` são `null`; `createdAt` é ISO-8601
    - expect: body não contém a propriedade `id` nem chaves snake_case (`processing_status`, `publication_status`)
  2. Consulta o banco pelo `public_id` retornado
    - expect: existe uma linha em `videos` com `processing_status = 'awaiting_upload'`, `publication_status = 'draft'` e `channel_id` igual ao canal do usuário autenticado

#### 1.2. validacao-dto-400

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos autenticado com `{ filename: "big.mp4", sizeBytes: 10737418241, contentType: "video/mp4" }`
    - expect: status `400` com `error: "VALIDATION_ERROR"`
  2. POST /videos autenticado com `{ filename: "doc.pdf", sizeBytes: 1024, contentType: "application/pdf" }`
    - expect: status `400` com `error: "VALIDATION_ERROR"`
  3. Consulta a tabela `videos`
    - expect: nenhum vídeo foi criado

#### 1.3. sem-autorizacao-401

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos sem header `Authorization`, com body válido
    - expect: status `401`
    - expect: nenhum vídeo é criado na tabela `videos`

#### 1.4. controller-isento-do-throttler

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Dispara 12 requisições sequenciais POST /videos autenticadas com body válido, sem resetar o `ThrottlerStorage` entre elas
    - expect: todas as 12 respondem `201` (nenhuma `429 Too Many Requests`)
    - expect: 12 vídeos distintos (12 `publicId` diferentes) persistidos no canal do usuário

### 2. Documentação OpenAPI

**Setup:** mesmo bootstrap do grupo 1, com `SwaggerModule.setup('api/docs', ...)` aplicado como em `main.ts` / `swagger.e2e-spec.ts`.

#### 2.1. operacao-documentada-em-api-docs

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /api/docs-json
    - expect: status `200`
    - expect: `paths["/videos"].post` existe com tag `videos` e requisito de segurança `access-token`
    - expect: `responses` documenta `201` (schema `VideoResponseDto`), `400` e `401` (schema `ApiErrorEnvelope`)
