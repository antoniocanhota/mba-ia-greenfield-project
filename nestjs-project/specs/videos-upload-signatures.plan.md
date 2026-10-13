---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.8
target_file: test/videos-upload-signatures.e2e-spec.ts
---

# POST /videos/{publicId}/upload-signatures — Test Plan

## Application Overview

`POST /videos/{publicId}/upload-signatures` é o alvo do `signRequest` do `@uppy/aws-s3` 6: assina uma operação S3 do upload multipart e devolve `{ url, key? }`. A key do objeto é sempre a do servidor (`videos/{publicId}/original`): um `CreateMultipartUpload` (`{ method: "POST", key }` sem `uploadId`) ignora a key recebida, aborta antes qualquer multipart em andamento no mesmo prefixo e responde com `key`; `UploadPart`, `ListParts`, `CompleteMultipartUpload` e `AbortMultipartUpload` exigem `uploadId` e a key do rascunho (`INVALID_UPLOAD_KEY` caso contrário); combinações fora da tabela (ex.: `PUT` sem `uploadId`) respondem `UNSUPPORTED_UPLOAD_OPERATION`. Só é permitido com o vídeo em `awaiting_upload` (`409 INVALID_VIDEO_STATE` caso contrário). Os bytes vão do browser direto ao storage — a API só pré-assina.

## Test Scenarios

### 1. Assinar operações do upload multipart

**Setup:** `beforeAll`: `Test.createTestingModule({ imports: [AppModule] }).compile()` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `DomainExceptionFilter`/`ValidationExceptionFilter` (reproduz `main.ts`); MinIO real do Compose (bucket da fase); `beforeEach`: `cleanAllTables(dataSource)`, aborta multiparts e remove objetos do prefixo `videos/` no bucket, cria usuário confirmado com canal, obtém `access_token` via `POST /auth/login` e cria um rascunho via `POST /videos`; `afterAll(() => app.close())`.

#### 1.1. create-multipart-key-do-servidor

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos/{publicId}/upload-signatures autenticado com `{ method: "POST", key: "qualquer" }`
    - expect: status `201`
    - expect: body com `key: "videos/{publicId}/original"` e `url` pré-assinada (query com `X-Amz-Signature`) apontando para essa key
  2. Executa um `POST` na `url` retornada (CreateMultipartUpload)
    - expect: o storage responde `200` com um `UploadId`

#### 1.2. create-multipart-aborta-anteriores

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Inicia um multipart diretamente no storage (client S3 do teste) para `videos/{publicId}/original`
    - expect: `ListMultipartUploads` com `Prefix = videos/{publicId}/original` lista 1 upload em andamento
  2. POST /videos/{publicId}/upload-signatures autenticado com `{ method: "POST", key: "qualquer" }`
    - expect: status `201`
    - expect: `ListMultipartUploads` com o mesmo prefixo não lista mais o upload criado no passo 1

#### 1.3. upload-part-utilizavel

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Assina e executa o CreateMultipartUpload (como em 1.1) e captura o `UploadId`
    - expect: `UploadId` não vazio
  2. POST /videos/{publicId}/upload-signatures com `{ method: "PUT", key: "videos/{publicId}/original", uploadId, partNumber: 1 }`
    - expect: status `201` com `url` pré-assinada (sem `key` no body)
  3. Executa um `PUT` na `url` com um buffer de 5 MiB
    - expect: o storage responde `200` com header `ETag`
  4. Assina `{ method: "GET", key: "videos/{publicId}/original", uploadId }` e executa a URL (ListParts)
    - expect: status `201` na assinatura; a listagem retorna a parte `1`

#### 1.4. key-divergente-400

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos/{publicId}/upload-signatures com `{ method: "PUT", key: "videos/outro/original", uploadId: "u-1", partNumber: 1 }`
    - expect: status `400` com `error: "INVALID_UPLOAD_KEY"`

#### 1.5. operacao-nao-suportada-400

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos/{publicId}/upload-signatures com `{ method: "PUT", key: "videos/{publicId}/original" }` (sem `uploadId`)
    - expect: status `400` com `error: "UNSUPPORTED_UPLOAD_OPERATION"`
  2. POST com `{ method: "PATCH", key: "x" }`
    - expect: status `400` com `error: "VALIDATION_ERROR"` (wiring do `ValidationPipe`)

#### 1.6. video-fora-de-awaiting-upload-409

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Atualiza no banco o `processing_status` do rascunho para `uploaded`
    - expect: linha atualizada
  2. POST /videos/{publicId}/upload-signatures com `{ method: "POST", key: "qualquer" }`
    - expect: status `409` com `error: "INVALID_VIDEO_STATE"`

### 2. Ownership e autenticação

**Setup:** mesmo bootstrap do grupo 1, com um segundo usuário confirmado (com canal) e seu `access_token`.

#### 2.1. nao-dono-404-sem-autorizacao-401

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. POST /videos/{publicId}/upload-signatures do rascunho do dono com o Bearer do outro usuário e `{ method: "POST", key: "qualquer" }`
    - expect: status `404` com `error: "VIDEO_NOT_FOUND"`
    - expect: nenhum multipart foi criado ou abortado no prefixo da key
  2. Mesma requisição sem header `Authorization`
    - expect: status `401`
