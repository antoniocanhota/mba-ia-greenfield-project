---
subproject: backend
runner: jest+supertest
scope: phase-03-videos
si: SI-03.7
target_file: test/videos-get.e2e-spec.ts
---

# GET /videos/{publicId} — Test Plan

## Application Overview

`GET /videos/{publicId}` devolve o `VideoResponseDto` do vídeo ao seu dono — é a fonte do RSC de `/studio/videos/[publicId]` e do polling de status. Ownership é aplicada por `VideosService.findOwnedByPublicId`: `publicId` inexistente, com formato inválido (fora de `^[A-Za-z0-9_-]{11}$`) ou pertencente a outro canal respondem igualmente `404 VIDEO_NOT_FOUND`, para não revelar a existência de rascunhos alheios nem diferenciar formato de existência.

## Test Scenarios

### 1. Ler o vídeo do dono

**Setup:** `beforeAll`: `Test.createTestingModule({ imports: [AppModule] }).compile()` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `DomainExceptionFilter`/`ValidationExceptionFilter` (reproduz `main.ts`); `beforeEach`: `cleanAllTables(dataSource)`, cria dois usuários confirmados com canal (dono e outro) e obtém o `access_token` de cada via `POST /auth/login`; o dono cria um rascunho via `POST /videos`; `afterAll(() => app.close())`.

#### 1.1. dono-le-video-200

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/{publicId} com o Bearer do dono
    - expect: status `200`
    - expect: body com o mesmo `publicId` e `filename` do rascunho, `processingStatus: "awaiting_upload"`, `publicationStatus: "draft"`
    - expect: body não contém a propriedade `id` interna

#### 1.2. outro-canal-ou-inexistente-404

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/{publicId} do rascunho do dono, com o Bearer do outro usuário
    - expect: status `404` com `error: "VIDEO_NOT_FOUND"` e `message: "Video not found"`
  2. GET /videos/{publicId} com um `publicId` bem formado (11 caracteres) que não existe, com o Bearer do dono
    - expect: status `404` com o mesmo envelope `VIDEO_NOT_FOUND` do passo 1 (respostas indistinguíveis)

#### 1.3. formato-invalido-404

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/abc com o Bearer do dono
    - expect: status `404` (não `400`) com `error: "VIDEO_NOT_FOUND"`

#### 1.4. sem-autorizacao-401

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. GET /videos/{publicId} sem header `Authorization`
    - expect: status `401`
