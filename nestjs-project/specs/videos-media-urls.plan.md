---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.10
target_file: test/videos-media-urls.e2e-spec.ts
---

# GET /videos/{publicId}/media-urls — Test Plan

## Application Overview

`GET /videos/{publicId}/media-urls` emite as URLs pré-assinadas de entrega do MP4 normalizado (`videos/{publicId}/video.mp4`) para o dono: `streamUrl` (disposition inline, HTTP Range servido direto pelo storage) e `downloadUrl` (`ResponseContentDisposition: attachment; filename="{nome original sem extensão}.mp4"`), ambas com TTL `VIDEO_URL_TTL_SECONDS` (default 4 horas), e `expiresAt = now + TTL`. Os bytes nunca passam pela API. Fora de `ready` responde `409 VIDEO_NOT_READY`; não-dono recebe `404 VIDEO_NOT_FOUND`.

## Test Scenarios

### 1. Emitir URLs de streaming e download

**Setup:** `beforeAll`: `Test.createTestingModule({ imports: [AppModule] }).compile()` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `DomainExceptionFilter`/`ValidationExceptionFilter` (reproduz `main.ts`); MinIO real do Compose; `beforeEach`: `cleanAllTables(dataSource)`, remove objetos do prefixo `videos/`, cria usuário confirmado com canal, obtém `access_token` via `POST /auth/login`, cria um rascunho via `POST /videos` com `filename: "My Trip.mov"`, atualiza no banco para `processing_status = 'ready'` e grava diretamente no storage um `videos/{publicId}/video.mp4` de ≥ 4 KiB com `Content-Type: video/mp4`; `afterAll(() => app.close())`. As URLs pré-assinadas usam `S3_PUBLIC_ENDPOINT` — o teste executa os GETs contra um endpoint alcançável a partir do container de teste.

#### 1.1. video-ready-200-com-urls

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/{publicId}/media-urls com o Bearer do dono
    - expect: status `200`
    - expect: body com `streamUrl`, `downloadUrl` (strings pré-assinadas para `videos/{publicId}/video.mp4`) e `expiresAt` ISO-8601
    - expect: `expiresAt` está a cerca de 4 horas do momento da requisição (tolerância de ±60s com o default de `VIDEO_URL_TTL_SECONDS`)

#### 1.2. stream-url-atende-range-206

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Obtém a `streamUrl` (como em 1.1) e faz `GET` com header `Range: bytes=0-1023`
    - expect: o storage responde `206 Partial Content`
    - expect: `Content-Range` começa com `bytes 0-1023/` e o corpo tem 1024 bytes

#### 1.3. download-url-attachment-mp4

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Obtém a `downloadUrl` e faz `GET`
    - expect: status `200`
    - expect: header `Content-Disposition` contém `attachment` e `filename="My Trip.mp4"` (nome original sem extensão + `.mp4`)

#### 1.4. video-fora-de-ready-409

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Atualiza no banco o vídeo para `processing_status = 'processing'`
    - expect: linha atualizada
  2. GET /videos/{publicId}/media-urls com o Bearer do dono
    - expect: status `409` com `error: "VIDEO_NOT_READY"`
  3. Cria um novo rascunho (em `awaiting_upload`) e chama GET /videos/{publicId}/media-urls dele
    - expect: status `409` com `error: "VIDEO_NOT_READY"`

### 2. Ownership e autenticação

**Setup:** mesmo bootstrap do grupo 1, com um segundo usuário confirmado (com canal) e seu `access_token`.

#### 2.1. nao-dono-404-sem-autorizacao-401

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/{publicId}/media-urls do vídeo `ready` do dono com o Bearer do outro usuário
    - expect: status `404` com `error: "VIDEO_NOT_FOUND"`
  2. Mesma requisição sem header `Authorization`
    - expect: status `401`
