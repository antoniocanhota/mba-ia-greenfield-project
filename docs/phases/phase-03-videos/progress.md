# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 9/44 completed

### SI-03.0.1 — Infra: install batch shadcn primitives
- **Status:** completed
- **Tests:** no tests (Infra); `tsc --noEmit` exit 0
- **Observations:**
  - shadcn CLI 4.21.4 resolveu o alias `utils` como o pacote npm `cn@^0.4.0` (terceiro, não relacionado) e gerou `import { cn } from "cn"`, apesar de `components.json` declarar `"utils": "@/lib/utils"`. Pacote desinstalado e import corrigido para `@/lib/utils`; lockfile restaurado ao estado original. Vale checar o import após qualquer `shadcn add` futuro.
  - Ação 2 ("Commitar `components/ui/progress.tsx`") não executada — operações git ficam com o usuário.

### SI-03.0.2 — Tests shadcn batch (progress)
- **Status:** completed
- **Tests:** 4 passing
- **Observations:**
  - O `progress.tsx` gerado pelo shadcn (SI-03.0.1) desestruturava `value` sem repassá-lo ao `ProgressPrimitive.Root`, então o Radix tratava a barra como indeterminada e não expunha `aria-valuenow`. Corrigido com `value={value}` no Root (aprovado pelo usuário), o que satisfaz o critério de aceite `aria-valuenow="84"`.
  - O testing-guide-next-frontend § "UI Primitives" diz para não testar primitives shadcn; o plano exige este teste explicitamente (precedentes: `checkbox.test.tsx`, `icon-button.test.tsx`). Seguido o plano.

### SI-03.0.3 — Custom-ui: section-header.tsx
- **Status:** completed
- **Tests:** 4 passing
- **Observations:** none

### SI-03.0.4 — Custom-business simple group: download-icon + upload-icon + video-file-icon + side-nav-item + side-nav
- **Status:** completed
- **Tests:** 7 passing
- **Observations:**
  - Os três ícones usam paths Material Symbols (viewBox 0 -960 960 960) em vez de assets do Figma; não houve fetch via Figma MCP nesta SI. Os screens `.0` (audit) podem ajustar se o desenho divergir.
  - Todos os itens da SideNav (Home, Subscriptions, Your videos, Liked videos) renderizam desabilitados, pois nenhuma dessas rotas existe nesta fase (OQ-12); `/studio` (Your videos) também fica desabilitado até a fase seguinte. O estado ativo funciona via `usePathname` mas ainda não é exercitado por um item habilitado na SideNav.
  - `npm run lint` mostra 1 warning pré-existente em `components/auth/signup-form.tsx` (React Hook Form `watch`); fora de escopo.

### SI-03.0.5 — Custom-business simple group: copy-link-button + processing-status + thumb-upload + upload-dropzone + upload-progress-panel
- **Status:** completed
- **Tests:** 18 passing
- **Observations:**
  - `processing-status.tsx` define localmente a união de `processingStatus` (`ProcessingStatusValue`) porque `lib/api/contracts.ts` só ganha `VideoProcessingStatus` em SI-03.16; trocar pelo tipo do contrato depois.
  - `upload-progress-panel.tsx` arredonda e limita o percentual a 0–100 antes de renderizar texto e barra, garantindo que os dois nunca divergem.
  - O ícone de copiar (`copy-icon.tsx`) e os spinners (CSS) foram feitos sem fetch do Figma; o audit dos screens pode ajustar.

### SI-03.0.6 — Custom-business simple group: video-details-card + video-player + video-status-badge
- **Status:** completed
- **Tests:** 8 passing
- **Observations:**
  - `video-details-card.tsx` recebe também `duration` (opcional, "—" quando ausente), pois a variante `ready` exibe duração (SI-03.32); o plano só cita Filename e Video Quality.
  - O card mantém `src`/`poster` como props e delega ao `VideoPlayer`, sem `src` mostra o placeholder preto com "0:00" (OQ-8).
  - Correções pós-revisão em SI-03.0.5 (regras `next-frontend-code-quality.md` / `next-frontend-ui.md`): `thumb-upload.tsx` passou a usar `next/image` (`fill` + `unoptimized`, pois o host do storage varia por ambiente e não está em `remotePatterns`) e o SVG inline de `copy-link-button.tsx` virou `components/icons/copy-icon.tsx`.
  - `video-player.tsx` usa `<video>` nativo (não há `next/image` envolvido).

### SI-03.1 — Infra: dependências, namespaces de config e serviços de storage e fila no Compose
- **Status:** completed
- **Tests:** 12 passing (`env.validation.integration-spec.ts`); suite completa 152 passing; e2e 52 passing; `tsc --noEmit` exit 0
- **Observations:**
  - **Desvio do TD-01:** a imagem `minio/minio` não puxa mais (Docker Hub: `pull access denied`; `quay.io/minio/minio:latest` inexistente), contrariando a revisão de 2026-10-07 ("fixar a última tag community"). Com aprovação do usuário, o serviço `storage` usa `rustfs/rustfs:1.0.1` (fallback drop-in previsto no próprio TD-01, Option B). Mesmos nomes de serviço/portas (9000/9001), envs `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY` e CORS por `RUSTFS_CORS_ALLOWED_ORIGINS=http://localhost:3001` (em vez de `MINIO_API_CORS_ALLOW_ORIGIN`). `/health` e `/minio/health/live` respondem 200. O TD-01 deveria ganhar uma revisão registrando a troca.
  - Redis fixado em `redis:8.2-alpine`; `nestjs-api` depende de `storage` e `redis` (ambos `service_healthy`). ffmpeg/ffprobe 5.1.9 instalados via apt no `Dockerfile.dev`.
  - npm resolveu `@aws-sdk/*` para `^3.1150.0` e `bullmq` para `^6.3.14` (patches mais novos que os de library-refs; mesmos ranges).
  - `S3_BUCKET` do `.env.example` = `streamtube-videos` (o plano não fixa o nome); credenciais dev do storage em `compose.yaml` coincidem com `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` do `.env.example`. `.env` local (gitignored) recebeu as mesmas chaves.
  - `env.validation.integration-spec.ts`: `validate` agora devolve um tipo explícito, o que eliminou os erros `no-unsafe-*` pré-existentes do arquivo.
  - **Suite completa:** na primeira rodada `src/database/migrations.integration-spec.ts` falhou por estado sujo no DB compartilhado (`type "verification_tokens_type_enum" already exists`, enum órfão + tabela `migrations`). O usuário executou os dois `DROP`; após a limpeza, unit/integration 152 passing (23 suítes) e e2e 52 passing.
  - `npm run lint` global tem 100+ erros pré-existentes (baseline 142 problemas); os arquivos tocados estão limpos.

### SI-03.2 — Entidade Video e migration CreateVideos
- **Status:** completed
- **Tests:** 6 new passing (`video.entity.integration-spec.ts` 5, `videos.module.spec.ts` 1) + `migrations.integration-spec.ts` ampliado; suite completa 158 passing; e2e 52 passing; `tsc --noEmit` exit 0
- **Observations:**
  - Migration gerada via TypeORM CLI (`1791916388634-CreateVideos.ts`) e só formatada com Prettier; já aplicada no DB de dev pelo spec de migrations (`afterAll` re-aplica).
  - Adicionar `Channel.videos` obrigou incluir `Video` nos arrays `ALL_ENTITIES` de 10 specs existentes (TypeORM falha com "Entity metadata for Channel#videos was not found" sem isso); mudança mecânica, sem alteração de comportamento.
  - `migrations.integration-spec.ts`: o teste de revert agora desfaz `CreateVideos` (antes desfazia `CreateAuthTokens`) e confere que tabela e os 3 enums sumiram e as tabelas de token permanecem. O `beforeAll` passou a dropar também os tipos enum e a fazê-lo em sequência — o `Promise.all` de `DROP TABLE ... CASCADE` dava deadlock com a nova tabela ligada por FK, e a falta de `DROP TYPE` era a causa raiz do enum órfão (`verification_tokens_type_enum`) visto no SI-03.1.
  - `VideosModule` só registra `TypeOrmModule.forFeature([Video])` e o exporta; service/controller entram nos SIs seguintes.
  - Colunas `created_at`/`updated_at` de `videos` usam `timestamptz` (per Data Model); as tabelas anteriores usam `timestamp` sem fuso.

### SI-03.3 — Módulo de storage S3 (clients, keys, presign e configuração do bucket)
- **Status:** completed
- **Tests:** 14 new passing (`storage-keys.spec.ts` 3, `storage.service.integration-spec.ts` 7, `storage-bucket.initializer.integration-spec.ts` 4); suite completa 172 passing; e2e 52 passing; `tsc --noEmit` exit 0
- **Observations:**
  - Os testes de integração rodam contra o RustFS real do Compose (ver desvio do TD-01 em SI-03.1), cada spec com um bucket `test-<hex>` próprio, criado e apagado por ela (`src/test/storage-test-config.ts`), sem tocar o bucket de dev. Lifecycle `AbortIncompleteMultipartUpload` e bucket policy anônima foram aceitos pelo RustFS; `GET` anônimo dá 200 em `thumbnails/*` e 403 em `videos/*`.
  - Dentro do container o endpoint público (`localhost:9000`) não resolve, então os testes que usam URL pré-assinada chamam o endpoint interno mantendo o header `Host` público (a assinatura cobre o host) via `fetchViaInternalEndpoint` (`node:http`).
  - `StorageService.uploadFile` envia até 64 MiB com um `PutObject` e acima disso em partes de 64 MiB (CreateMultipartUpload/UploadPart/Complete, abort em falha), porque `PutObject` limita a 5 GiB e o vídeo normalizado pode chegar a 10 GiB; `@aws-sdk/lib-storage` não está no plano e não foi adicionado. Coberto por teste com arquivo de 64 MiB + 1 KiB.
  - O inicializador ficou num `StorageBucketModule` próprio (importado só pelo `AppModule`), já que o worker (SI-03.11) importa apenas `StorageModule`. Por isso a API passa a exigir o storage acessível no boot, inclusive nos e2e (usam o bucket `S3_BUCKET` de dev).
  - `StorageModule` exporta também o token `S3_INTERNAL_CLIENT`, necessário para o inicializador; `publicObjectUrl` recebe `(publicEndpoint, bucket, key)` (função pura) e `StorageService.publicUrl(key)` aplica a config.
  - **Flaky:** uma rodada de e2e falhou em `test/swagger.e2e-spec.ts` (3 testes; saída não capturada, causa não identificada); o spec passou isolado e em duas rodadas completas seguintes (52 passing). Vale observar se reaparece com o boot mais lento da API.
  - `npm run lint` aponta 1 erro pré-existente em `src/test/create-test-data-source.ts` (`Function`); fora de escopo.

### SI-03.4 — Módulo de fila BullMQ (conexão Redis e fila `videos`)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.5 — VideosService: rascunho, ownership e mapeamento de resposta
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.6 — Endpoint POST /videos
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.7 — Endpoint GET /videos/{publicId}
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.8 — Endpoint POST /videos/{publicId}/upload-signatures
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.9 — Endpoint POST /videos/{publicId}/upload-completion
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.10 — Endpoint GET /videos/{publicId}/media-urls
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.11 — Entrypoint do worker e serviço `video-worker` no Compose
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.12 — Adapter FFmpeg (probe, normalização e thumbnail)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.13 — Processor `process-video` (pipeline de processamento)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.14 — Scheduler e processor `sweep-videos`
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.15 — Export e sync do contrato OpenAPI para o frontend
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.16 — Aliases de contrato de vídeos em `lib/api/contracts.ts`
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.17 — Helper de chamada autenticada ao upstream (`lib/auth/authorized-upstream.ts`)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.18 — Handlers MSW de vídeos (`mocks/handlers/videos.ts`)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.19 — Fake de storage no Playwright e documentação das exceções de E2E
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.20 — BFF Route Handler: POST /api/videos
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.21 — BFF Route Handler: GET /api/videos/{publicId}
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.22 — BFF Route Handler: POST /api/videos/{publicId}/upload-signatures
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.23 — BFF Route Handler: POST /api/videos/{publicId}/upload-completion
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.24 — BFF Route Handler: GET /api/videos/{publicId}/media-urls
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.25 — Infra: instalar `@uppy/core` e `@uppy/aws-s3`
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.26 — Provider de upload (Uppy headless) para o studio
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.27 — Hook de polling `useVideoStatus`
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.28 — Utilitários de apresentação de vídeo (`lib/videos/format.ts`)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.29 — Layout de `/studio` (auth gate, SideNav e provider de upload)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.30.0 — Drift audit: Tela de upload de vídeo
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.30a — Tela de upload de vídeo (visual shell)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.30b — Tela de upload de vídeo (lógica & wiring)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.31.0 — Drift audit: Tela do vídeo no studio — upload em andamento
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.31a — Tela do vídeo no studio — upload em andamento (visual shell)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.31b — Tela do vídeo no studio — upload em andamento (lógica & wiring)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.32.0 — Drift audit: Tela do vídeo no studio — upload concluído (player + download)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.32a — Tela do vídeo no studio — upload concluído (visual shell)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.32b — Tela do vídeo no studio — upload concluído (lógica & wiring)
- **Status:** pending
- **Tests:** —
- **Observations:** none
