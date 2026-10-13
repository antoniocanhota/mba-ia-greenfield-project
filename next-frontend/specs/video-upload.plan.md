---
subproject: frontend
runner: playwright
scope: phase-03-videos
si: SI-03.30b
target_file: tests/studio-video-upload.e2e-spec.ts
---

# Tela de upload de vídeo — Test Plan

## Application Overview

A tela `/studio/upload` inicia o envio de um vídeo de até 10 GiB. É uma página RSC estática sob o layout de `/studio` (que redireciona anônimos para `/login` e monta o provider Uppy headless), compondo o Client Component `UploadDropzone`. Ao soltar ou selecionar um arquivo (`SelectFilesButton`, `accept="video/*"`), o Uppy aplica as restrições (um arquivo, `video/*`, até 10 GiB, nome com 1–255 caracteres); em seguida o componente chama `POST /api/videos` com `{ filename, sizeBytes, contentType }`, o provider inicia o upload multipart para o `publicId` retornado e o usuário é levado a `/studio/videos/{publicId}`. Violações de restrição e `400 VALIDATION_ERROR` viram erro inline na dropzone; falha no pré-cadastro permite nova tentativa; `401` redireciona para `/login`. Entre a seleção e o redirect a dropzone fica desabilitada.

## Test Scenarios

### 1. Pré-cadastrar o vídeo e iniciar o envio

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; upstream faked server-side via `instrumentation.ts`, sem `page.route()` de `/api/**`; fake de storage `routeStorageFake` auto-aplicado na origem `http://storage.e2e.invalid`, per SI-03.19). Cada teste começa autenticado: login pela UI em `/login` com credenciais válidas (resposta default de sucesso do handler MSW de auth). Arquivos de entrada via `setInputFiles` com buffer em memória (ex.: `{ name: "my-video.mp4", mimeType: "video/mp4", buffer }`). O store dos handlers de vídeo gera `publicId`s `vid…` por contador (SI-03.18); o teste lê o `publicId` da URL, sem fixar o valor (o contador é compartilhado entre workers). Trigger reservado: `filename` `"too-large.mp4"` → `400 VALIDATION_ERROR` no `POST /videos`.

#### 1.1. arquivo-valido-cria-rascunho-e-redireciona

**Covers AC:** #1, #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/upload`
    - expect: heading "Upload Video", título "Drag and drop a video file to upload", helper "Your videos will be private until you publish them." e botão "Select file" visíveis
  2. Usuário seleciona `my-video.mp4` (`video/mp4`) pelo seletor do botão "Select file"
    - expect: a requisição `POST /api/videos` é disparada com `{ filename: "my-video.mp4", sizeBytes: <tamanho do buffer>, contentType: "video/mp4" }`
    - expect: enquanto o pré-cadastro está em voo, a dropzone fica desabilitada (botão "Select file" desabilitado / `aria-disabled`) com indicador de carregamento anunciado em live region
  3. BFF responde `201` com o `VideoResponseDto`
    - expect: a URL passa a ser `/studio/videos/{publicId}` com o `publicId` retornado
    - expect: a página mostra o nome do arquivo "my-video.mp4" com o upload em andamento

#### 1.2. arquivo-nao-video-erro-inline-sem-bff

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/upload` e seleciona `notes.pdf` (`application/pdf`)
    - expect: um erro inline (`role="alert"`) aparece dentro da dropzone indicando tipo não suportado
    - expect: nenhuma requisição `POST /api/videos` é disparada
    - expect: a URL permanece `/studio/upload`
  2. Usuário seleciona um arquivo `video/mp4` cujo nome tem 256 caracteres
    - expect: erro inline na dropzone e nenhuma requisição `POST /api/videos`
  _(o ramo "acima de 10 GiB" é coberto pelo unit test `upload-dropzone.wiring.test.tsx` — não é viável materializar um arquivo de 10 GiB no browser)_

#### 1.3. falha-no-pre-cadastro-erro-inline-e-nova-tentativa

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/upload` e seleciona `too-large.mp4` (`video/mp4`) — trigger reservado → upstream `400 VALIDATION_ERROR`
    - expect: a requisição `POST /api/videos` é disparada e responde `400`
    - expect: um erro inline aparece na dropzone e a URL permanece `/studio/upload`
  2. Usuário seleciona novamente um arquivo pelo botão "Select file"
    - expect: a dropzone voltou a aceitar arquivos (não desabilitada) e uma nova requisição `POST /api/videos` é disparada

### 2. Gate de autenticação do studio

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); contexto de browser sem cookie de sessão.

#### 2.1. anonimo-redirecionado-para-login

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Visitante anônimo navega para `/studio/upload`
    - expect: é redirecionado para `/login`
    - expect: nenhuma requisição `POST /api/videos` é disparada
