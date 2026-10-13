---
subproject: frontend
runner: playwright
scope: phase-03-videos
si: SI-03.31b
target_file: tests/studio-video-uploading.e2e-spec.ts
---

# Tela do vídeo no studio — upload em andamento — Test Plan

## Application Overview

A rota `/studio/videos/[publicId]` é uma página RSC assíncrona que lê o vídeo no upstream com o token da sessão (`notFound()` em `404 VIDEO_NOT_FOUND`, `redirect("/login")` em `401`) e entrega o `VideoResponseDto` inicial ao Client Component `video-studio-view`. Esta tela cobre os estados anteriores a `ready`: com upload ativo no provider Uppy, o `UploadProgressPanel` mostra nome do arquivo, "Uploading... N%" e a barra (`role="progressbar"`) com o mesmo valor; ao concluir, `POST /api/videos/{publicId}/upload-completion` devolve `uploaded` e o hook de status passa a fazer polling (~3s) de `GET /api/videos/{publicId}`; sem upload ativo em `awaiting_upload` (reload / acesso direto) mostra "Envio interrompido — selecione o arquivo novamente" com seletor que reanexa ao **mesmo** `publicId`; `failed` mostra a copy do `failureReason` e link para `/studio/upload`, sem reanexar. O heading é "Video details" e o `CardVideoConfig` exibe o VideoLink `{origin}/v/{publicId}` como texto copiável, sem navegação.

## Test Scenarios

### 1. Acompanhar o envio e o status do vídeo

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied; upstream faked server-side via `instrumentation.ts`, sem `page.route()` de `/api/**`; fake de storage `routeStorageFake` auto-aplicado na origem `http://storage.e2e.invalid`, per SI-03.19 / `e2e-video-upload-fixtures/TD-01`). Cada teste começa autenticado: login pela UI em `/login` com credenciais válidas (handler MSW de auth). Os handlers de vídeo mantêm estado por `publicId` (SI-03.18 / `e2e-video-upload-fixtures/TD-02`): o rascunho criado pelo teste começa em `awaiting_upload` e passa a `uploaded` depois do `upload-completion`; `publicId` desconhecido e não reservado devolve `awaiting_upload`. Triggers reservados: `missingVid1` → `404 VIDEO_NOT_FOUND`; `failedVid01` → `failed` com `failureReason: "not_a_video"`; `procVid0001` → `processing`. Arquivos de vídeo com ≥ 2 partes (≥ 10 MiB, parte mínima de 5 MiB) para o progresso avançar em degraus. Requisições ao BFF são apenas observadas (`page.waitForRequest` / `waitForResponse`), nunca interceptadas.

#### 1.1. progresso-do-upload-e-status-apos-conclusao

**Covers AC:** #1, #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/upload` e seleciona `my-video.mp4` (`video/mp4`, buffer de 12 MiB)
    - expect: a URL passa a ser `/studio/videos/{publicId}`
    - expect: heading "Video details" e o nome "my-video.mp4" visíveis
  2. Upload em andamento
    - expect: o painel mostra "Uploading... N%" e o `progressbar` tem `aria-valuenow` igual a N, com N aumentando ao longo das partes
    - expect: requisições `POST /api/videos/{publicId}/upload-signatures` são disparadas para o mesmo `publicId` e os `PUT`s de parte vão para `http://storage.e2e.invalid`
  3. Upload termina
    - expect: `POST /api/videos/{publicId}/upload-completion` é disparada e responde `200` com `processingStatus: "uploaded"`
    - expect: o rótulo deixa "Uploading" e passa a exibir a copy de `uploaded`, sem recarregar a página (URL e documento inalterados)
    - expect: o `GET /api/videos/{publicId}` de polling seguinte devolve `uploaded` e a página não volta ao estado "Envio interrompido"

#### 1.2. video-em-processamento-mostra-status

**Covers AC:** #2
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega diretamente para `/studio/videos/procVid0001`
    - expect: o rótulo de status exibe a copy de `processing` e a mudança é anunciada em live region
    - expect: não há painel "Envio interrompido" nem barra de upload
    - expect: requisições `GET /api/videos/procVid0001` de polling são disparadas em intervalo (~3s), sem sobreposição

#### 1.3. reload-mostra-envio-interrompido-e-reanexa

**Covers AC:** #3
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. O teste segura as respostas de `PUT` de parte no fake de storage (resposta atrasada até ser liberada) para manter o upload em andamento; usuário inicia um upload a partir de `/studio/upload` e, já em `/studio/videos/{publicId}`, recarrega a página
    - expect: a página mostra "Envio interrompido — selecione o arquivo novamente" com um seletor de arquivo
    - expect: não há barra de progresso de upload ativa
  2. O teste libera o fake de storage; usuário seleciona `my-video.mp4` no seletor do estado interrompido
    - expect: nenhuma nova requisição `POST /api/videos` é disparada (não cria outro rascunho)
    - expect: `POST /api/videos/{publicId}/upload-signatures` é disparada para o **mesmo** `publicId` da URL
    - expect: o painel volta a mostrar "Uploading... N%"

#### 1.4. video-failed-mostra-motivo-e-link

**Covers AC:** #4
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/failedVid01`
    - expect: a mensagem mapeada de `failureReason: "not_a_video"` é exibida
    - expect: um link para `/studio/upload` é exibido
    - expect: não há seletor de arquivo nem opção de reanexar
    - expect: nenhuma requisição de polling `GET /api/videos/failedVid01` é disparada após o carregamento

#### 1.5. video-alheio-ou-inexistente-404

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/missingVid1`
    - expect: a página 404 do Next.js é renderizada (resposta HTTP `404`)
    - expect: nenhum dado de vídeo, painel de upload ou VideoLink é exibido

#### 1.6. video-link-copiavel-sem-navegacao

**Covers AC:** #6
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Usuário navega para `/studio/videos/procVid0001`
    - expect: o VideoLink exibe o texto `{origin}/v/procVid0001` (origin da página)
    - expect: o VideoLink não é um link navegável (sem `href` para `/v/...`)
  2. Usuário clica no `CopyLinkButton` (botão com `aria-label`), com permissão de clipboard concedida ao contexto
    - expect: o clipboard contém `{origin}/v/procVid0001`
    - expect: a URL da página permanece `/studio/videos/procVid0001`

### 2. Gate de autenticação do studio

**Setup:** `next-frontend/tests/fixtures.ts` (MSW network fixture auto-applied); contexto de browser sem cookie de sessão.

#### 2.1. anonimo-redirecionado-para-login

**Covers AC:** #5
**Source:** auto
**Last sync:** 2026-10-13T17:21:05Z

**Steps:**
  1. Visitante anônimo navega para `/studio/videos/procVid0001`
    - expect: é redirecionado para `/login`
    - expect: nenhum dado do vídeo é renderizado
