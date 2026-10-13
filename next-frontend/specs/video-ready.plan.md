---
subproject: frontend
runner: playwright
scope: phase-03-videos
si: SI-03.32b
target_file: tests/studio-video-ready.e2e-spec.ts
---

# Tela do vídeo no studio — upload concluído (player + download) — Test Plan

## Application Overview

Quando o vídeo está em `ready` (no carregamento inicial ou quando o polling chega a `ready`), a mesma página `/studio/videos/[publicId]` troca para a variante "upload concluído": o `video-studio-view` busca `GET /api/videos/{publicId}/media-urls` uma única vez, entrega `src = streamUrl` e `poster = thumbnailUrl` ao `<video controls>` nativo e `href = downloadUrl` ao DownloadButton "Download" (desabilitado até as URLs chegarem ou se a busca falhar). O `CardVideoConfig` mostra o nome original do arquivo, a duração formatada de `durationMs` (`m:ss` / `h:mm:ss`) e o rótulo de qualidade derivado do lado menor de `width`/`height` (ex.: "1080p HD"); `ThumbUpload` mostra a thumbnail e `ProcessingStatus` a copy de `ready`. A reprodução usa HTTP Range direto do storage e o download vem da `downloadUrl` com `Content-Disposition: attachment`.

## Test Scenarios

### 1. Reproduzir e baixar o vídeo processado

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; upstream faked server-side via `instrumentation.ts`, sem `page.route()` de `/api/**`). Cada teste começa autenticado: login pela UI em `/login` com credenciais válidas (handler MSW de auth). Trigger reservado de `mocks/handlers/videos.ts`: `readyVid001` → vídeo `ready` com `durationMs`, `width`, `height` e `thumbnailUrl`; valores esperados derivados de `buildVideo`/`buildMediaUrls` (`mocks/factories/videos.ts`), nunca hardcodados no teste. Requisições ao BFF são apenas observadas (`page.waitForRequest` / `waitForResponse`).

#### 1.1. video-ready-player-com-controles-e-poster

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/readyVid001`
    - expect: exatamente uma requisição `GET /api/videos/readyVid001/media-urls` é disparada
    - expect: o elemento `<video>` tem o atributo `controls` e `poster` igual ao `thumbnailUrl` da fixture
    - expect: após a resposta, o `src` do `<video>` é igual ao `streamUrl` da fixture
  2. Página estabilizada
    - expect: `ProcessingStatus` exibe a copy de `ready`
    - expect: `ThumbUpload` exibe a thumbnail (`img` com `src` igual ao `thumbnailUrl`)
    - expect: nenhuma requisição de polling `GET /api/videos/readyVid001` é disparada após o carregamento

#### 1.2. botao-download-aponta-para-download-url

**Covers AC:** #3, #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/readyVid001`
    - expect: o botão "Download" (com ícone `aria-hidden`) fica abaixo do VideoLink no `CardVideoConfig`
    - expect: antes da resposta de `media-urls`, o botão "Download" está desabilitado (`aria-disabled="true"` / `disabled`)
  2. Resposta de `GET /api/videos/readyVid001/media-urls` chega
    - expect: o botão "Download" fica habilitado e seu destino (`href`) é igual ao `downloadUrl` da fixture
  _(o nome `.mp4` via `Content-Disposition: attachment` é responsabilidade do storage — coberto pelo spec backend `nestjs-project/specs/videos-media-urls.plan.md` cenário 1.3)_

#### 1.3. duracao-e-qualidade-formatadas

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/readyVid001`
    - expect: a duração exibida é `formatDuration(durationMs)` da fixture (formato `m:ss` ou `h:mm:ss`)
    - expect: a qualidade exibida é `qualityLabel(width, height)` da fixture (ex.: "1080p HD")
    - expect: o nome original do arquivo da fixture é exibido no `CardVideoConfig`

### 2. Gate de autenticação do studio

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); contexto de browser sem cookie de sessão.

#### 2.1. anonimo-redirecionado-para-login

**Covers AC:** #1
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Visitante anônimo navega para `/studio/videos/readyVid001`
    - expect: é redirecionado para `/login`
    - expect: nenhuma requisição `GET /api/videos/readyVid001/media-urls` é disparada
