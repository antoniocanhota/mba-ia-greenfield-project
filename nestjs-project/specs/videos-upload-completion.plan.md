---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.9
target_file: test/videos-upload-completion.e2e-spec.ts
---

# POST /videos/{publicId}/upload-completion — Test Plan

## Application Overview

`POST /videos/{publicId}/upload-completion` (`@HttpCode(200)`) confirma o objeto enviado e entrega o vídeo ao processamento. Faz `HeadObject` em `videos/{publicId}/original`: ausente → `409 UPLOAD_INCOMPLETE`; acima de 10 GiB → apaga o objeto e responde `422 FILE_TOO_LARGE` (vídeo segue em `awaiting_upload`). Caso contrário grava o `size_bytes` provisório, transiciona `awaiting_upload → uploaded` de forma condicional e, após o commit, enfileira `process-video` na fila BullMQ `videos` com `jobId = video.id`. É idempotente: em `uploaded`/`processing`/`ready` devolve o estado atual sem novo job; em `failed` (terminal) responde `409 INVALID_VIDEO_STATE`.

## Test Scenarios

### 1. Concluir o upload e enfileirar o processamento

**Setup:** `beforeAll`: `Test.createTestingModule({ imports: [AppModule] }).compile()` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `DomainExceptionFilter`/`ValidationExceptionFilter` (reproduz `main.ts`); MinIO e Redis reais do Compose; obtém a `Queue` `videos` do módulo para inspeção; `beforeEach`: `cleanAllTables(dataSource)`, remove objetos do prefixo `videos/`, `queue.obliterate({ force: true })`, cria usuário confirmado com canal, obtém `access_token` via `POST /auth/login` e cria um rascunho via `POST /videos`; `afterAll`: fecha a fila e `app.close()`.

#### 1.1. objeto-presente-200-e-job-enfileirado

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Grava diretamente no storage (client S3 do teste) um objeto de 2048 bytes em `videos/{publicId}/original`
    - expect: objeto presente
  2. POST /videos/{publicId}/upload-completion autenticado, sem body
    - expect: status `200`
    - expect: body com `processingStatus: "uploaded"` e `sizeBytes: 2048`
  3. Inspeciona a fila `videos`
    - expect: existe exatamente um job `process-video` com `jobId` igual ao `id` interno do vídeo e `data` `{ videoId: <id interno> }`
    - expect: no banco, `processing_status = 'uploaded'` e `size_bytes = 2048`

#### 1.2. chamada-repetida-idempotente

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Com o objeto presente, chama POST /videos/{publicId}/upload-completion duas vezes
    - expect: ambas respondem `200` com `processingStatus: "uploaded"`
  2. Inspeciona a fila `videos`
    - expect: há um único job `process-video` para o vídeo (contagem de jobs = 1)

#### 1.3. objeto-ausente-409-upload-incomplete

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Sem nenhum objeto em `videos/{publicId}/original`, POST /videos/{publicId}/upload-completion autenticado
    - expect: status `409` com `error: "UPLOAD_INCOMPLETE"`
    - expect: vídeo continua em `awaiting_upload` e nenhum job foi enfileirado

#### 1.4. objeto-acima-de-10gib-422

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Simula um original acima de 10 GiB sem gravar 10 GiB de dados — `overrideProvider` do serviço de storage apenas no `headObject` para devolver `ContentLength: 10737418241` sobre o objeto real gravado em `videos/{publicId}/original` (demais operações reais)
    - expect: objeto presente no storage antes da chamada
  2. POST /videos/{publicId}/upload-completion autenticado
    - expect: status `422` com `error: "FILE_TOO_LARGE"`
    - expect: o objeto `videos/{publicId}/original` deixa de existir no storage
    - expect: o vídeo continua em `awaiting_upload` e nenhum job foi enfileirado

#### 1.5. video-failed-409-invalid-state

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Atualiza no banco o vídeo para `processing_status = 'failed'`, `failure_reason = 'upload_abandoned'`
    - expect: linha atualizada
  2. POST /videos/{publicId}/upload-completion autenticado
    - expect: status `409` com `error: "INVALID_VIDEO_STATE"`
    - expect: nenhum job foi enfileirado

### 2. Ownership e autenticação

**Setup:** mesmo bootstrap do grupo 1, com um segundo usuário confirmado (com canal) e seu `access_token`.

#### 2.1. nao-dono-404-sem-autorizacao-401

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Com o objeto presente, POST /videos/{publicId}/upload-completion com o Bearer do outro usuário
    - expect: status `404` com `error: "VIDEO_NOT_FOUND"`
    - expect: vídeo continua em `awaiting_upload` e a fila está vazia
  2. Mesma requisição sem header `Authorization`
    - expect: status `401`
