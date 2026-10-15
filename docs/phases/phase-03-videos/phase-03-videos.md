---
kind: phase
name: phase-03-videos
test_specs_aware: true
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-10-15T11:22:45-03:00"
  docs/phases/phase-03-videos/library-refs.md: "2026-10-15T09:42:43-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-15T11:17:07-03:00"
  docs/decisions/technical-decisions-video-metadata.md: "2026-10-13T14:25:28-03:00"
  docs/decisions/technical-decisions-e2e-video-upload-fixtures.md: "2026-10-13T14:25:28-03:00"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-09-28T14:55:47-03:00"
  docs/inventories/screen-inventory-phase-03-videos.md: "2026-10-13T14:25:28-03:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Entregar o upload de vídeos de até 10GB sem impacto na performance — com serviço de armazenamento de arquivos (vídeos e thumbnails), serviço de processamento em segundo plano (filas), pré-cadastro automático do vídeo como rascunho ao iniciar o upload, processamento automático após o upload (extração de duração e metadados), geração automática de thumbnail a partir de um frame do vídeo, URL única por vídeo sem conflito, reprodução via streaming e download pelo usuário — de forma que o upload de até 10GB funcione, o processamento seja automático, o streaming funcione e URLs únicas sejam geradas.

---

## Step Implementations

### SI-03.0.1 — Infra: install batch shadcn primitives

**Description:** Instalar o shadcn primitive `progress` via CLI registry e commitar o arquivo gerado em `components/ui/`.

**Technical actions:**

1. Rodar `docker compose exec next-frontend npx shadcn@latest add progress` — gera `components/ui/progress.tsx`.
2. Commitar `components/ui/progress.tsx`.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/progress.tsx` existe.
- Arquivo gerado compila per `docker compose exec next-frontend npx tsc --noEmit`.

---

### SI-03.0.2 — Tests shadcn batch (progress)

**Description:** Unit test para o shadcn primitive instalado em SI-03.0.1 — data-slot, a11y e valor determinado.

**Technical actions:**

1. Criar `components/ui/__tests__/progress.test.tsx` cobrindo o primitive `progress`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `progress.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" — data-slot, `role="progressbar"`, `aria-valuenow` refletindo `value`, indicator proporcional | `components/ui/__tests__/progress.test.tsx` |

**Dependencies:** SI-03.0.1

**Acceptance criteria:**

- O primitive renderizado com `value={84}` expõe `role="progressbar"` com `aria-valuenow` igual a `84`.
- Os testes passam per `docker compose exec next-frontend npm test -- components/ui/__tests__/progress.test.tsx`.

---

### SI-03.0.3 — Custom-ui: section-header.tsx

**Description:** Autorar `components/ui/section-header.tsx` per UI Contract — primitive sob `components/ui/` não disponível no shadcn registry (componente DS "SectionHeader": Title + Description).

**Technical actions:**

1. Criar `components/ui/section-header.tsx` — props `title` e `description` opcional, variantes via `cva`, tokens de tipografia de `app/globals.css` (per UI Contract `#### Screen: Tela do vídeo no studio — upload em andamento` → SectionHeader "Thumbnail").

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `section-header.tsx` | Unit per testing-guide-next-frontend § "UI Primitives" + custom-logic — título como heading, descrição opcional omitida quando ausente, data-slot | `components/ui/__tests__/section-header.test.tsx` |

**Dependencies:** none

**Acceptance criteria:**

- `components/ui/section-header.tsx` existe e renderiza o título como heading e a descrição só quando fornecida.
- O teste unitário exercita a presença e a ausência da descrição.

---

### SI-03.0.4 — Custom-business simple group: download-icon + upload-icon + video-file-icon + side-nav-item + side-nav

**Description:** Autorar os ícones e os componentes de navegação do app chrome do studio — sem dados do servidor.

**Technical actions:**

1. Criar `components/icons/download-icon.tsx` — ícone do DownloadButton (resolução OQ-9; sem node Figma), mesmo padrão dos ícones existentes em `components/icons/`.
2. Criar `components/icons/upload-icon.tsx` — ícone SVG de upload (48px) a partir do asset Figma da dropzone.
3. Criar `components/icons/video-file-icon.tsx` — ícone DS "video_file" a partir do asset Figma do UploadProgressPanel.
4. Criar `components/layout/side-nav-item.tsx` — item com Next.js `<Link>`, estado ativo e variante desabilitada (links para rotas de fases futuras renderizam desabilitados, OQ-12).
5. Criar `components/layout/side-nav.tsx` — SideNav só com links (Home, Subscriptions, You → Your videos / Liked videos), sem o bloco de inscrições (OQ-2).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `side-nav-item.tsx` | Unit per testing-guide-next-frontend § "Client Components" — estado ativo, variante desabilitada sem `href` navegável e com `aria-disabled` | `components/layout/__tests__/side-nav-item.test.tsx` |
| `side-nav.tsx` | Unit per testing-guide-next-frontend § "Client Components" — renderiza os itens previstos e não renderiza lista de inscrições | `components/layout/__tests__/side-nav.test.tsx` |

Ícones não recebem testes (testing-guide-next-frontend § "Icon (`components/icons/*`)" → None).

**Dependencies:** none

**Acceptance criteria:**

- Os cinco arquivos existem nos paths declarados e correspondem aos UI Contracts das telas que os citam.
- Itens da SideNav que apontam para rotas de fases futuras renderizam desabilitados e não navegam.
- A SideNav não renderiza a lista de canais inscritos.

---

### SI-03.0.5 — Custom-business simple group: copy-link-button + processing-status + thumb-upload + upload-dropzone + upload-progress-panel

**Description:** Autorar os componentes de negócio do studio em forma presentational (props tipadas, sem wiring de dados) — o wiring fica nos SIs Xb.

**Technical actions:**

1. Criar `components/studio/copy-link-button.tsx` — botão só-ícone com `aria-label`, reusando `components/ui/icon-button.tsx`; copia o texto recebido via prop para o clipboard.
2. Criar `components/studio/processing-status.tsx` — ícone + caption para um `processingStatus` recebido via prop (copy via prop; a copy "Checks complete. No issues found." não é usada, OQ-3).
3. Criar `components/studio/thumb-upload.tsx` — imagem da thumbnail quando `thumbnailUrl` existe; skeleton caso contrário (OQ-10).
4. Criar `components/studio/upload-dropzone.tsx` — área de drag-and-drop com estados idle / drag-over / carregando / erro inline e o `SelectFilesButton` (`components/ui/button.tsx`), copy singular (OQ-4, OQ-5); emite `onFileSelected(file)`.
5. Criar `components/studio/upload-progress-panel.tsx` — nome do arquivo, "Uploading... N%", slot de status e `components/ui/progress.tsx` com o mesmo valor (OQ-13).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `copy-link-button.tsx` | Unit per testing-guide-next-frontend § "Client Components" — click chama `navigator.clipboard.writeText` com o texto; `aria-label` presente | `components/studio/__tests__/copy-link-button.test.tsx` |
| `processing-status.tsx` | Unit per testing-guide-next-frontend § "Client Components" — renderiza a copy recebida por status | `components/studio/__tests__/processing-status.test.tsx` |
| `thumb-upload.tsx` | Unit per testing-guide-next-frontend § "Client Components" — imagem com `thumbnailUrl`, skeleton sem | `components/studio/__tests__/thumb-upload.test.tsx` |
| `upload-dropzone.tsx` | Unit per testing-guide-next-frontend § "Client Components" — drop e seleção disparam `onFileSelected`; drag-over destaca; erro inline renderizado; desabilitada em carregamento | `components/studio/__tests__/upload-dropzone.test.tsx` |
| `upload-progress-panel.tsx` | Unit per testing-guide-next-frontend § "Client Components" — texto e barra exibem o mesmo percentual | `components/studio/__tests__/upload-progress-panel.test.tsx` |

**Dependencies:** SI-03.0.1 (o painel usa `components/ui/progress.tsx`)

**Acceptance criteria:**

- Cada componente existe no path declarado e corresponde ao seu UI Contract.
- Soltar um arquivo ou escolhê-lo no seletor chama `onFileSelected` uma vez com o `File`.
- O percentual do texto e o valor da barra do painel de progresso são sempre iguais.
- Sem `thumbnailUrl`, o ThumbUpload mostra skeleton em vez de imagem.

---

### SI-03.0.6 — Custom-business simple group: video-details-card + video-player + video-status-badge

**Description:** Autorar o painel de detalhes do vídeo, o player e o rótulo de status em forma presentational — o wiring fica nos SIs Xb.

**Technical actions:**

1. Criar `components/studio/video-details-card.tsx` — compõe player, VideoLink como texto + `copy-link-button`, Filename e Video Quality (com "—" para valores ausentes, OQ-10) e um slot para o DownloadButton.
2. Criar `components/studio/video-player.tsx` — `<video controls>` nativo com props `src` e `poster`; sem `src` renderiza o placeholder (OQ-8).
3. Criar `components/studio/video-status-badge.tsx` — rótulo de status com a cor `--link` (UploadStatusLabel), copy via prop.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `video-details-card.tsx` | Unit per testing-guide-next-frontend § "Client Components" — exibe filename, link e "—" para metadados nulos | `components/studio/__tests__/video-details-card.test.tsx` |
| `video-player.tsx` | Unit per testing-guide-next-frontend § "Client Components" — `<video controls>` com `src`/`poster`; placeholder sem `src` | `components/studio/__tests__/video-player.test.tsx` |
| `video-status-badge.tsx` | Unit per testing-guide-next-frontend § "Client Components" — renderiza a copy recebida | `components/studio/__tests__/video-status-badge.test.tsx` |

**Dependencies:** SI-03.0.5 (o card compõe `copy-link-button.tsx`)

**Acceptance criteria:**

- Cada componente existe no path declarado e corresponde ao seu UI Contract.
- Com `src`, o player renderiza um `<video>` com controles nativos e `poster`; sem `src`, renderiza o placeholder sem `<video>` reproduzível.
- Metadados nulos aparecem como "—" no card.

---

### SI-03.1 — Infra: dependências, namespaces de config e serviços de storage e fila no Compose

**Description:** Preparar a infraestrutura do backend para storage S3 (MinIO em dev), fila BullMQ (Redis) e FFmpeg, seguindo o padrão `registerAs` + Joi herdado da Fase 01.

**Technical actions:**

1. Instalar no container `nestjs-api`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (per `phase-03-videos/TD-01`), `bullmq`, `@nestjs/bullmq` (per `phase-03-videos/TD-02`), `fluent-ffmpeg` + `@types/fluent-ffmpeg` (dev) (per `phase-03-videos/TD-10`); versões per library-refs.md.
2. Estender `nestjs-project/compose.yaml` — serviço `storage` com a última tag community do MinIO **fixada** (per `phase-03-videos/TD-01`, revisão 2026-10-07), portas `9000`/`9001`, volume nomeado, credenciais por env e `MINIO_API_CORS_ALLOW_ORIGIN=http://localhost:3001`; serviço `redis` com tag fixada e porta `6379`; `nestjs-api` passa a depender de `storage` e `redis`.
3. Instalar `ffmpeg` via apt em `nestjs-project/Dockerfile.dev` (per `phase-03-videos/TD-10`: "apt-installed ffmpeg").
4. Criar `src/config/storage.config.ts` (`registerAs('storage')`: `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `UPLOAD_SIGN_TTL_SECONDS` default `3600`, `VIDEO_URL_TTL_SECONDS` default `14400`) e `src/config/queue.config.ts` (`registerAs('queue')`: `REDIS_HOST`, `REDIS_PORT`); registrar ambos em `ConfigModule.forRoot({ load })` do `AppModule` (per `phase-01-configuracao-base/TD-03`). `S3_ENDPOINT=http://storage:9000` e `REDIS_HOST=redis` usam o nome do serviço Compose; `S3_PUBLIC_ENDPOINT=http://localhost:9000` é o único endpoint browser-reachable (per `phase-03-videos/TD-01`).
5. Adicionar as novas chaves ao Joi schema em `src/config/env.validation.ts` (obrigatórias: `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `REDIS_HOST`; demais com default) e a `.env.example` (per `phase-01-configuracao-base/TD-02`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `env.validation.ts` | Integration: falha sem `S3_ENDPOINT`/`S3_BUCKET`/`REDIS_HOST`; defaults de `S3_REGION`, `REDIS_PORT`, TTLs aplicados | `src/config/env.validation.integration-spec.ts` |

**Dependencies:** none

**Acceptance criteria:**

- `docker compose up -d` (em `nestjs-project/`) sobe `storage` e `redis` além de `db`, `mailpit` e `nestjs-api`, todos com status running.
- `docker compose exec redis redis-cli ping` responde `PONG` e `curl -f http://localhost:9000/minio/health/live` responde `200`.
- `docker compose exec nestjs-api ffmpeg -version` e `ffprobe -version` executam com sucesso.
- A aplicação recusa iniciar quando `S3_ENDPOINT`, `S3_BUCKET` ou `REDIS_HOST` estão ausentes.

---

### SI-03.2 — Entidade Video e migration CreateVideos

**Description:** Persistir o vídeo com os dois campos de ciclo de vida ortogonais, o `public_id` público e os metadados técnicos, conforme `### Data Model` → `#### Video`.

**Technical actions:**

1. Criar `src/videos/entities/video-enums.ts` — enums TypeScript `VideoProcessingStatus` (`awaiting_upload`, `uploaded`, `processing`, `ready`, `failed`), `VideoPublicationStatus` (`draft`, `published`) e `VideoFailureReason` (`not_a_video`, `unreadable_file`, `unsupported_media`, `processing_error`, `upload_abandoned`) (per `phase-03-videos/TD-06`, `video-metadata/TD-04`).
2. Criar `src/videos/entities/video.entity.ts` — `@Entity('videos')` com as colunas, tipos e constraints de `### Data Model` → `#### Video` (`public_id` varchar(11) unique, `channel_id` FK com `ON DELETE CASCADE`, enums Postgres nomeados `video_processing_status` / `video_publication_status` / `video_failure_reason`, `size_bytes` bigint com transformer `string ↔ number`, `duration_ms`/`width`/`height` integer nullable) e índices `(channel_id)` e `(processing_status, created_at)` (per `phase-03-videos/TD-07`, `video-metadata/TD-01`, `video-metadata/TD-03`).
3. Adicionar o lado inverso `@OneToMany(() => Video, (video) => video.channel) videos` em `src/channels/entities/channel.entity.ts` (regra de entidades: ambos os lados declarados).
4. Gerar `src/database/migrations/{timestamp}-CreateVideos.ts` via TypeORM CLI (`docker compose exec nestjs-api npm run typeorm -- migration:generate`) — cria os três tipos enum, a tabela e os índices; `down` reverte tudo.
5. Criar `src/videos/videos.module.ts` com `TypeOrmModule.forFeature([Video])` e registrá-lo no `AppModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Video` entity | Integration: defaults `awaiting_upload`/`draft`, unique `public_id`, FK cascade ao apagar o canal, `size_bytes` de 10 GiB lido como `number` | `src/videos/entities/video.entity.integration-spec.ts` |
| `CreateVideos` migration | Integration: migration aplica e reverte (`up`/`down`) sem erro | `src/database/migrations.integration-spec.ts` |
| `VideosModule` | Unit: compilação do módulo | `src/videos/videos.module.spec.ts` |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Inserir um vídeo sem status explícitos persiste `processing_status = awaiting_upload` e `publication_status = draft`.
- Inserir dois vídeos com o mesmo `public_id` viola a constraint unique.
- Apagar um canal remove os vídeos dele.
- Um vídeo salvo com `size_bytes = 10737418240` é lido de volta como o número `10737418240`.
- A migration `CreateVideos` aplica e reverte sem erro em um banco limpo.

---

### SI-03.3 — Módulo de storage S3 (clients, keys, presign e configuração do bucket)

**Description:** Encapsular todo acesso ao object storage num `StorageModule` reutilizado pela API e pelo worker, com o layout de keys e a configuração do bucket de `### Data Model` → `#### Storage object layout`.

**Technical actions:**

1. Criar `src/storage/storage-keys.ts` — funções puras `originalKey(publicId)` → `videos/{publicId}/original`, `videoKey(publicId)` → `videos/{publicId}/video.mp4`, `thumbnailKey(publicId)` → `thumbnails/{publicId}.jpg` e `publicObjectUrl(key)` montada com `S3_PUBLIC_ENDPOINT` + bucket (path-style) (per `phase-03-videos/TD-09`).
2. Criar `src/storage/storage.module.ts` — providers de dois `S3Client` com `forcePathStyle: true`: um interno (`S3_ENDPOINT`) para chamadas server-side e um signer (`S3_PUBLIC_ENDPOINT`) usado só para presign, assinatura offline (per `phase-03-videos/TD-01`; library-refs.md → @aws-sdk/client-s3). Exporta `StorageService`.
3. Criar `src/storage/storage.service.ts` — `presign(command, expiresIn)` via `getSignedUrl` no client signer; `headObject`, `deleteObject`, `listMultipartUploads(prefix)`, `abortMultipartUpload`, `downloadToFile(key, path)` (stream do `GetObject` para disco) e `uploadFile(key, path, contentType)` no client interno (per `phase-03-videos/TD-01`, `phase-03-videos/TD-04`).
4. Criar `src/storage/storage-bucket.initializer.ts` — `OnModuleInit` idempotente registrado só na API: cria o bucket se ausente, aplica lifecycle `AbortIncompleteMultipartUpload` com `DaysAfterInitiation: 1` (per `phase-03-videos/TD-04`, revisão 2026-10-07) e a bucket policy de leitura anônima restrita a `thumbnails/*` (per `phase-03-videos/TD-09`). Confirmar no implement que a imagem MinIO fixada aceita a lifecycle rule (library-refs.md → "Lifecycle").
5. Exportar `StorageModule` para ser importado por `VideosModule` e pelo módulo do worker.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `storage-keys.ts` | Unit: keys e URL pública derivadas do `publicId` | `src/storage/storage-keys.spec.ts` |
| `StorageService` | Integration (MinIO real do Compose): presign de PUT/GET utilizável via `fetch`, `headObject` com `ContentLength`, `listMultipartUploads` + `abortMultipartUpload`, `deleteObject` | `src/storage/storage.service.integration-spec.ts` |
| `StorageBucketInitializer` | Integration (MinIO real): bucket criado, policy pública só em `thumbnails/*`, segunda execução sem erro | `src/storage/storage-bucket.initializer.integration-spec.ts` |

Testes de integração usam o MinIO real do Compose, na mesma linha do Mailpit para e-mail. A recomendação de adapter de filesystem local do `testing-guide-nestjs-project` é anterior à decisão `phase-03-videos/TD-01` (app usa só a API S3 via AWS SDK).

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Uma URL pré-assinada de `PUT` emitida pelo serviço aceita um upload via HTTP, e o objeto passa a existir com o `ContentLength` enviado.
- URLs pré-assinadas usam o host de `S3_PUBLIC_ENDPOINT`, nunca o de `S3_ENDPOINT`.
- Um `GET` anônimo em `thumbnails/{x}.jpg` responde `200`; um `GET` anônimo em `videos/{x}/video.mp4` responde `403`.
- Iniciar a API duas vezes seguidas não falha nem duplica a configuração do bucket.

---

### SI-03.4 — Módulo de fila BullMQ (conexão Redis e fila `videos`)

**Description:** Centralizar a conexão BullMQ e o registro da fila `videos` num `QueueModule` compartilhado entre API (produtora) e worker (consumidor).

**Technical actions:**

1. Criar `src/queue/queue.constants.ts` — `VIDEOS_QUEUE = 'videos'`, `PROCESS_VIDEO_JOB = 'process-video'`, `SWEEP_VIDEOS_JOB = 'sweep-videos'` (per `### Events/Messages`).
2. Criar `src/queue/queue.module.ts` — `BullModule.forRootAsync({ imports: [ConfigModule], inject: [queueConfig.KEY], useFactory })` usando a opção `connection` do BullMQ (não a chave legada `redis:`) + `BullModule.registerQueue({ name: VIDEOS_QUEUE })`; exporta `BullModule` (per `phase-03-videos/TD-02`; library-refs.md → @nestjs/bullmq).
3. Importar `QueueModule` em `VideosModule` (produtor). Nenhum processor é registrado na API (per `phase-03-videos/TD-03`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `QueueModule` | Unit: compilação do módulo com config de teste e resolução do token `getQueueToken('videos')` | `src/queue/queue.module.spec.ts` |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- A API inicia conectada ao Redis do serviço `redis` e com a fila `videos` disponível para injeção.
- O processo da API não consome jobs da fila `videos` (nenhum worker BullMQ ativo nele).

---

### SI-03.5 — VideosService: rascunho, ownership e mapeamento de resposta

**Description:** Implementar o núcleo de domínio de vídeos usado por todos os endpoints: geração do `public_id`, criação do rascunho no canal do usuário, lookup com ownership e o mapeamento para `VideoResponseDto`.

**Technical actions:**

1. Criar `src/videos/public-id.util.ts` — `generatePublicId()` com `randomBytes(8).toString('base64url')` de `node:crypto` (11 caracteres, 64 bits) e `isPublicIdFormat(value)` (`^[A-Za-z0-9_-]{11}$`) (per `phase-03-videos/TD-07`).
2. Criar `src/videos/exceptions/video.exceptions.ts` — `VideoNotFoundException` (`VIDEO_NOT_FOUND`, 404), `InvalidVideoStateException` (`INVALID_VIDEO_STATE`, 409), `VideoNotReadyException` (`VIDEO_NOT_READY`, 409), `InvalidUploadKeyException` (`INVALID_UPLOAD_KEY`, 400), `UnsupportedUploadOperationException` (`UNSUPPORTED_UPLOAD_OPERATION`, 400), `UploadIncompleteException` (`UPLOAD_INCOMPLETE`, 409), `FileTooLargeException` (`FILE_TOO_LARGE`, 422), estendendo `DomainException` com as mensagens de `### Error Catalog` (per `phase-02-auth/TD-07`).
3. Criar `src/videos/videos.service.ts` — `createDraft(userId, { filename, sizeBytes, contentType })`: resolve o canal pelo `user_id` via um novo `ChannelsService.findByUserId(userId)` (o `VideosModule` importa `ChannelsModule`; o serviço de vídeos não acessa o repositório de `Channel`), gera o `public_id` e insere; em unique violation de `public_id` regenera e tenta de novo (máx. 3) (per `phase-03-videos/TD-07`, `phase-03-videos/TD-06`).
4. Em `VideosService`: `findOwnedByPublicId(userId, publicId)` — formato inválido, inexistente ou de outro canal lança `VideoNotFoundException` (per `### Authorization Matrix`).
5. Criar `src/videos/dto/video-response.dto.ts` + `toVideoResponse(video)` — campos e casing exatamente como `### API Contracts` → `VideoResponseDto` (`publicId`, `filename`, `processingStatus`, `publicationStatus` — mapeados das colunas `processing_status`/`publication_status` da entidade per `phase-03-videos/TD-06` revisão 2026-10-08 —, `failureReason`, `durationMs`, `width`, `height`, `sizeBytes`, `thumbnailUrl` só quando `processingStatus = ready`, `createdAt`), com `@ApiProperty` para o OpenAPI (per `openapi-docs-nestjs/TD-01`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `public-id.util.ts` | Unit: 11 caracteres base64url; validação de formato | `src/videos/public-id.util.spec.ts` |
| `VideosService` | Unit: retry em colisão de `public_id` (mock repo), ownership negada lança `VideoNotFoundException` | `src/videos/videos.service.spec.ts` |
| `VideosService` | Integration: rascunho persistido no canal do usuário com defaults; lookup de outro canal lança 404 | `src/videos/videos.service.integration-spec.ts` |
| `toVideoResponse` | Unit: campos em camelCase no wire (`processingStatus`/`publicationStatus` a partir das colunas snake_case); `thumbnailUrl` nulo fora de `ready` | `src/videos/dto/video-response.dto.spec.ts` |

**Dependencies:** SI-03.2, SI-03.3

**Acceptance criteria:**

- Criar um rascunho persiste um vídeo no canal do usuário com `processing_status = awaiting_upload`, `publication_status = draft` e `public_id` de 11 caracteres `[A-Za-z0-9_-]`.
- Uma colisão de `public_id` na primeira tentativa não falha a criação; o vídeo é salvo com outro `public_id`.
- Buscar um vídeo de outro canal, inexistente ou com `publicId` mal formado resulta em `VIDEO_NOT_FOUND`.
- A representação de resposta nunca contém o `id` UUID interno.

---

### SI-03.6 — Endpoint POST /videos

**Route:** POST /videos
**Test Specs:** see `nestjs-project/specs/videos-create.plan.md`
**Authorization:** Authenticated
**API Contract:** see `## Technical Specifications` → `### API Contracts` → `#### POST /videos`

**Description:** Expor o pré-cadastro do vídeo como rascunho no início do upload.

**Technical actions:**

1. Criar `src/videos/dto/create-video.dto.ts` — `CreateVideoDto` com `filename` (`@IsString() @Length(1, 255)`), `sizeBytes` (`@IsInt() @Min(1) @Max(10737418240)`) e `contentType` (`@IsString() @Matches(/^video\//)`) (per `### API Contracts` → `#### Validation Rules — videos`; per `phase-02-auth/TD-06`).
2. Criar `src/videos/videos.controller.ts` — `@ApiTags('videos') @Controller('videos') @SkipThrottle()` (o `ThrottlerGuard` global de `phase-02-auth/TD-08` bloquearia a assinatura de partes); handler `@Post()` com `@HttpCode(201)`, `@CurrentUser()` e chamada a `VideosService.createDraft`, retornando `toVideoResponse` (per `phase-03-videos/TD-06`).
3. Documentar com `@ApiBearerAuth('access-token')`, `@ApiOperation` e `@ApiResponse` para 201 (`VideoResponseDto`), 400 e 401 com `ApiErrorEnvelope` (per `openapi-docs-nestjs/TD-01`, regra de controllers).
4. Registrar `VideosController` em `VideosModule`.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosModule` | Unit: compilação do módulo com controller + `ChannelsModule` + `QueueModule` + `StorageModule` | `src/videos/videos.module.spec.ts` |

E2E do endpoint (fluxo HTTP, validação do DTO, 401) é autorado externamente por `/plan-test-specs` no spec referenciado em `**Test Specs:**`.

**Dependencies:** SI-03.4, SI-03.5

**Acceptance criteria:**

- `POST /videos` autenticado com `{ filename, sizeBytes, contentType: "video/mp4" }` válidos retorna `201` com `VideoResponseDto` em `processingStatus: "awaiting_upload"` e `publicationStatus: "draft"`.
- `POST /videos` com `sizeBytes` acima de `10737418240` ou `contentType` sem prefixo `video/` retorna `400` com `error: "VALIDATION_ERROR"`.
- `POST /videos` sem `Authorization` retorna `401`.
- Mais de 10 requisições por minuto ao controller de vídeos não são limitadas pelo throttler.
- A operação aparece em `/api/docs` com as respostas 201, 400 e 401 documentadas.

---

### SI-03.7 — Endpoint GET /videos/{publicId}

**Route:** GET /videos/{publicId}
**Test Specs:** see `nestjs-project/specs/videos-get.plan.md`
**Authorization:** Owner
**API Contract:** see `## Technical Specifications` → `### API Contracts` → `#### GET /videos/{publicId}`

**Description:** Expor a leitura do vídeo do dono — fonte do RSC de `/studio/videos/[publicId]` e do polling de status.

**Technical actions:**

1. Adicionar `@Get(':publicId')` em `VideosController` — chama `VideosService.findOwnedByPublicId(user.sub, publicId)` e retorna `toVideoResponse` (per `phase-03-videos/TD-11`, `phase-03-videos/TD-09`).
2. Documentar com `@ApiBearerAuth('access-token')`, `@ApiOperation`, `@ApiParam('publicId')` e `@ApiResponse` para 200 (`VideoResponseDto`), 401 e 404 com `ApiErrorEnvelope` (per `openapi-docs-nestjs/TD-01`).

**Tests:** _(empty — controller sem lógica própria; ownership coberta em SI-03.5; E2E no spec de `/plan-test-specs`)_

**Dependencies:** SI-03.6

**Acceptance criteria:**

- `GET /videos/{publicId}` pelo dono retorna `200` com `VideoResponseDto` do vídeo.
- `GET /videos/{publicId}` de um vídeo de outro canal retorna `404` com `error: "VIDEO_NOT_FOUND"` — mesma resposta de um `publicId` inexistente.
- `GET /videos/abc` (formato inválido) retorna `404` com `error: "VIDEO_NOT_FOUND"`.

---

### SI-03.8 — Endpoint POST /videos/{publicId}/upload-signatures

**Route:** POST /videos/{publicId}/upload-signatures
**Test Specs:** see `nestjs-project/specs/videos-upload-signatures.plan.md`
**Authorization:** Owner
**API Contract:** see `## Technical Specifications` → `### API Contracts` → `#### POST /videos/{publicId}/upload-signatures`

**Description:** Assinar cada operação S3 do upload multipart pedida pelo `signRequest` do Uppy, com a key definida pelo servidor e a limpeza server-side de multiparts antigos.

**Technical actions:**

1. Criar `src/videos/dto/sign-upload-request.dto.ts` (`method` `@IsIn(['PUT','POST','GET','DELETE'])`, `key` `@IsString() @IsNotEmpty()`, `uploadId` opcional, `partNumber` opcional `@IsInt() @Min(1) @Max(10000)`) e `src/videos/dto/sign-upload-response.dto.ts` (`url`, `key?`) (per `### API Contracts` → `#### Validation Rules — videos`).
2. Criar `src/videos/upload-signing.service.ts` — `UploadSigningService.sign(video, dto)` aplicando a tabela de mapeamento do contrato: `POST` sem `uploadId` → `CreateMultipartUpload` em `originalKey(publicId)` com `ContentType: application/octet-stream`, precedido de `listMultipartUploads(prefix = key)` + `abortMultipartUpload` em cada upload em andamento, e resposta com `key`; `PUT` + `uploadId` + `partNumber` → `UploadPart`; `GET` + `uploadId` → `ListParts`; `POST` + `uploadId` → `CompleteMultipartUpload`; `DELETE` + `uploadId` → `AbortMultipartUpload`; demais combinações → `UnsupportedUploadOperationException`; `key` ≠ `originalKey(publicId)` com `uploadId` → `InvalidUploadKeyException`. TTL `UPLOAD_SIGN_TTL_SECONDS` (per `phase-03-videos/TD-04` e revisões 2026-10-07; `phase-03-videos/TD-05`; library-refs.md → @uppy/aws-s3 `signRequest`).
3. Não persistir o `contentType` do pré-cadastro: o original é transitório (apagado no estado terminal) e o tipo final `video/mp4` é definido pelo worker no MP4 normalizado (per `phase-03-videos/TD-08`, revisão 2026-10-07).
4. Adicionar `@Post(':publicId/upload-signatures')` (`@HttpCode(201)`) em `VideosController` — busca o vídeo com ownership, rejeita com `InvalidVideoStateException` quando `processing_status ≠ awaiting_upload` (per `phase-03-videos/TD-06`, revisão 2026-10-07) e delega a `UploadSigningService`.
5. Documentar com `@ApiBearerAuth`, `@ApiOperation`, `@ApiBody(SignUploadRequestDto)` e `@ApiResponse` para 201, 400, 401, 404 e 409 (per `openapi-docs-nestjs/TD-01`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `UploadSigningService` | Unit: cada linha da tabela de mapeamento → comando S3 esperado; key divergente → `INVALID_UPLOAD_KEY`; `PUT` sem `uploadId` → `UNSUPPORTED_UPLOAD_OPERATION` (mock `StorageService`) | `src/videos/upload-signing.service.spec.ts` |
| `UploadSigningService` | Integration (MinIO real): `CreateMultipartUpload` assinado aborta multipart pré-existente da mesma key; URLs assinadas executam create → upload part → complete | `src/videos/upload-signing.service.integration-spec.ts` |

**Dependencies:** SI-03.7

**Acceptance criteria:**

- `POST /videos/{publicId}/upload-signatures` com `{ method: "POST", key: "qualquer" }` retorna `201` com `url` pré-assinada e `key: "videos/{publicId}/original"`.
- Antes de responder a um `CreateMultipartUpload`, nenhum multipart anterior em andamento para a key do rascunho permanece listado no storage.
- Com `{ method: "PUT", key: "videos/{publicId}/original", uploadId, partNumber: 1 }` retorna `201` com `url` de `UploadPart` utilizável pelo browser.
- Com `uploadId` e `key` diferente da key do rascunho retorna `400` com `error: "INVALID_UPLOAD_KEY"`.
- Com `{ method: "PUT", key }` sem `uploadId` retorna `400` com `error: "UNSUPPORTED_UPLOAD_OPERATION"`.
- Para um vídeo fora de `awaiting_upload` retorna `409` com `error: "INVALID_VIDEO_STATE"`.

---

### SI-03.9 — Endpoint POST /videos/{publicId}/upload-completion

**Route:** POST /videos/{publicId}/upload-completion
**Test Specs:** see `nestjs-project/specs/videos-upload-completion.plan.md`
**Authorization:** Owner
**API Contract:** see `## Technical Specifications` → `### API Contracts` → `#### POST /videos/{publicId}/upload-completion`

**Description:** Confirmar o objeto enviado e entregar o vídeo ao processamento em segundo plano, de forma idempotente.

**Technical actions:**

1. Em `VideosService`, criar `completeUpload(userId, publicId)` — `headObject(originalKey)`: ausente → `UploadIncompleteException`; `ContentLength` > `10737418240` → `deleteObject` + `FileTooLargeException` (vídeo segue em `awaiting_upload`) (per `phase-03-videos/TD-04`, `phase-03-videos/TD-05`).
2. Transição condicional `UPDATE ... SET processing_status = 'uploaded', size_bytes = :contentLength WHERE id = :id AND processing_status = 'awaiting_upload'` (protege contra corrida com o sweep); em `uploaded`/`processing`/`ready` devolve o estado atual sem efeitos; em `failed` lança `InvalidVideoStateException` (per `phase-03-videos/TD-06`, revisão 2026-10-07; `video-metadata/TD-02` — tamanho provisório).
3. Após o commit, `queue.add(PROCESS_VIDEO_JOB, { videoId }, { jobId: videoId, attempts: 3, backoff: { type: 'exponential', delay: 5000 } })` via `@InjectQueue(VIDEOS_QUEUE)` — mesmo `jobId` torna o enqueue idempotente; falha no enqueue fica para o sweep de dual-write (per `phase-03-videos/TD-02`; library-refs.md → bullmq "Idempotent enqueue").
4. Adicionar `@Post(':publicId/upload-completion')` com `@HttpCode(200)` em `VideosController`, retornando `toVideoResponse`.
5. Documentar com `@ApiBearerAuth`, `@ApiOperation` e `@ApiResponse` para 200, 401, 404, 409 e 422 (per `openapi-docs-nestjs/TD-01`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.completeUpload` | Unit: ramos de estado (`awaiting_upload` → enfileira; `ready` → no-op; `failed` → 409; objeto ausente → 409; acima de 10 GiB → apaga + 422) com mocks de storage/queue/repo | `src/videos/videos.service.spec.ts` |
| `VideosService.completeUpload` | Integration (DB + MinIO + Redis reais): objeto enviado → status `uploaded`, `size_bytes` gravado e job `process-video` com `jobId = videoId` na fila; segunda chamada não cria segundo job | `src/videos/videos.service.integration-spec.ts` |

**Dependencies:** SI-03.8

**Acceptance criteria:**

- Com o original no storage, `POST /videos/{publicId}/upload-completion` retorna `200` com `processingStatus: "uploaded"` e `sizeBytes` igual ao tamanho do objeto, e um job `process-video` com `jobId` igual ao id interno do vídeo fica na fila `videos`.
- Repetir a chamada retorna `200` com o estado atual e não cria um segundo job.
- Sem o objeto original no storage, retorna `409` com `error: "UPLOAD_INCOMPLETE"`.
- Com objeto acima de 10 GiB, retorna `422` com `error: "FILE_TOO_LARGE"`, o objeto deixa de existir e o vídeo continua em `awaiting_upload`.
- Para um vídeo em `failed`, retorna `409` com `error: "INVALID_VIDEO_STATE"`.

---

### SI-03.10 — Endpoint GET /videos/{publicId}/media-urls

**Route:** GET /videos/{publicId}/media-urls
**Test Specs:** see `nestjs-project/specs/videos-media-urls.plan.md`
**Authorization:** Owner
**API Contract:** see `## Technical Specifications` → `### API Contracts` → `#### GET /videos/{publicId}/media-urls`

**Description:** Emitir as URLs pré-assinadas de streaming e download do MP4 normalizado, mantendo os bytes fora da API.

**Technical actions:**

1. Criar `src/videos/dto/media-urls-response.dto.ts` — `streamUrl`, `downloadUrl`, `expiresAt` com `@ApiProperty`.
2. Em `VideosService`, criar `getMediaUrls(userId, publicId)` — `VideoNotReadyException` quando `processing_status ≠ ready`; presign de `GetObjectCommand` em `videoKey(publicId)` para streaming e outro com `ResponseContentDisposition: attachment; filename="{nome original sem extensão}.mp4"` para download, ambos com `VIDEO_URL_TTL_SECONDS`; `expiresAt = now + TTL` (per `phase-03-videos/TD-09`, `phase-03-videos/TD-08`; library-refs.md → presigning).
3. Adicionar `@Get(':publicId/media-urls')` em `VideosController` e documentar 200, 401, 404 e 409 (per `openapi-docs-nestjs/TD-01`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosService.getMediaUrls` | Unit: fora de `ready` → `VIDEO_NOT_READY`; filename do download derivado do nome original com extensão `.mp4`; `expiresAt` coerente com o TTL | `src/videos/videos.service.spec.ts` |
| `VideosService.getMediaUrls` | Integration (MinIO real): `streamUrl` responde `206` a um `Range: bytes=0-1023`; `downloadUrl` responde com `Content-Disposition: attachment` | `src/videos/videos.service.integration-spec.ts` |

**Dependencies:** SI-03.9

**Acceptance criteria:**

- `GET /videos/{publicId}/media-urls` para um vídeo `ready` do dono retorna `200` com `streamUrl`, `downloadUrl` e `expiresAt` cerca de 4 horas no futuro (com o default de `VIDEO_URL_TTL_SECONDS`).
- Um `GET` na `streamUrl` com `Range: bytes=0-1023` responde `206 Partial Content` direto do storage.
- Um `GET` na `downloadUrl` responde com `Content-Disposition: attachment` e nome de arquivo terminado em `.mp4`.
- Para um vídeo fora de `ready`, retorna `409` com `error: "VIDEO_NOT_READY"`.

---

### SI-03.11 — Entrypoint do worker e serviço `video-worker` no Compose

**Description:** Criar o processo do Video Worker no mesmo codebase Nest, com entrypoint e serviço Compose próprios, isolando o processamento da API.

**Technical actions:**

1. Extrair a factory de opções do TypeORM do `AppModule` para `src/database/typeorm-options.ts` (`buildTypeOrmOptions(dbConfig)`) e usá-la no `AppModule` e no worker — conexão definida num único lugar (convenção herdada: parâmetros de banco nunca duplicados; per `phase-01-configuracao-base/TD-04`).
2. Criar `src/worker/worker.module.ts` — `ConfigModule.forRoot` com os mesmos `load` + `validationSchema` da API, `TypeOrmModule.forRootAsync` via `buildTypeOrmOptions`, `QueueModule` e `StorageModule`; sem controllers, sem `StorageBucketInitializer` (per `phase-03-videos/TD-03`).
3. Criar `src/worker.ts` — `NestFactory.createApplicationContext(WorkerModule)` com `enableShutdownHooks()`; scripts `start:worker` (`node dist/worker`) e `start:worker:dev` (`nest start --watch --entryFile worker`) em `package.json` (per `phase-03-videos/TD-03`).
4. Adicionar o serviço `video-worker` em `nestjs-project/compose.yaml` — mesmo build do `nestjs-api` (com ffmpeg), comando `npm run start:worker:dev`, `depends_on` `db`, `redis` e `storage`, sem portas publicadas (per `phase-03-videos/TD-03`).
5. Atualizar `nestjs-project/CLAUDE.md` — lista de serviços (`storage`, `redis`, `video-worker`) e checagens de prontidão (`redis-cli ping`, health do MinIO).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `WorkerModule` | Unit: compilação do módulo sem controllers HTTP | `src/worker/worker.module.spec.ts` |

**Dependencies:** SI-03.3, SI-03.4

**Acceptance criteria:**

- `docker compose up -d` sobe o serviço `video-worker`, que permanece running e não expõe porta HTTP.
- `docker compose logs video-worker` mostra o contexto Nest inicializado com conexão ao banco e ao Redis.
- A API continua iniciando e servindo `GET /` com `200` após a extração da factory do TypeORM.

---

### SI-03.12 — Adapter FFmpeg (probe, normalização e thumbnail)

**Description:** Isolar todo uso do `fluent-ffmpeg` num `MediaModule` com funções de classificação puras e testáveis, mapeando falhas para os códigos de `failureReason`.

**Technical actions:**

1. Criar `src/media/probe-metadata.ts` — funções puras sobre o objeto do ffprobe: `extractMetadata(probe)` → `{ durationMs, width, height, hasVideoStream }` com `durationMs` inteiro (`Math.round(Number(format.duration) * 1000)`) e dimensões de **exibição** (troca `width`/`height` quando a rotação via side data `displaymatrix` ou tag `rotate` é ±90/270) (per `video-metadata/TD-03`; library-refs.md → fluent-ffmpeg "Probe" — validar o campo de rotação com um vídeo de celular no implement); `needsTranscode(probe)` → `false` só para vídeo H.264 com áudio AAC ou sem áudio (per `phase-03-videos/TD-08`).
2. Criar `src/media/media.errors.ts` — `MediaProbeError` (→ `unreadable_file`), `NotAVideoError` (→ `not_a_video`), `UnsupportedMediaError` (→ `unsupported_media`), cada um carregando o `VideoFailureReason` correspondente (per `video-metadata/TD-04`).
3. Criar `src/media/ffmpeg.service.ts` — `probe(path)` (ffprobe JSON; erro → `MediaProbeError`), `normalize(input, output, { transcode })` (remux `-c copy -movflags +faststart` ou transcode H.264/AAC `+faststart`; erro de codec/parâmetro no transcode → `UnsupportedMediaError`) e `thumbnail(input, folder, filename)` (`screenshots` com `timestamps: ['10%']`, opção `size: '1280x?'`) (per `phase-03-videos/TD-10` e revisão 2026-10-07 — uso restrito a probe, remux, transcode e thumbnail; library-refs.md → fluent-ffmpeg). stderr só em log.
4. Criar `src/media/media.module.ts` exportando `FfmpegService`; importado só pelo módulo do worker.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `probe-metadata.ts` | Unit: duração em ms inteiros, dimensões com rotação aplicada (0/90/180/270), `needsTranscode` para H.264+AAC, H.264 sem áudio, HEVC e VP9 | `src/media/probe-metadata.spec.ts` |
| `FfmpegService` | Integration (ffmpeg real, fixtures geradas no setup via `lavfi testsrc`, sem binários commitados): probe de MP4 H.264; remux gera MP4 com `moov` antes de `mdat`; transcode de VP9/WebM gera H.264; thumbnail JPEG criada; arquivo de texto → `MediaProbeError` | `src/media/ffmpeg.service.integration-spec.ts` |

**Dependencies:** SI-03.1, SI-03.2

**Acceptance criteria:**

- Um vídeo de 596,458 s é reportado com `durationMs = 596458`.
- Um vídeo retrato gravado como 1920×1080 com rotação de 90° é reportado com `width = 1080` e `height = 1920`.
- Normalizar um MP4 H.264/AAC não reencoda (codec de saída igual ao de entrada) e produz um arquivo com `moov` antes de `mdat`.
- Normalizar um WebM VP9 produz um MP4 H.264 reproduzível.
- Fazer o probe de um arquivo que não é mídia resulta em erro classificado como `unreadable_file`; o probe de um arquivo só de áudio reporta `hasVideoStream = false`.

---

### SI-03.13 — Processor `process-video` (pipeline de processamento)

**Description:** Consumir `process-video` no worker e executar o pipeline completo: probe em dois estágios, normalização para MP4 progressivo, thumbnail, status terminal e remoção do original.

**Technical actions:**

1. Criar `src/video-processing/video-processing.service.ts` — `process(videoId, { isFinalAttempt })` seguindo `### Events/Messages` → `#### process-video` → Processing steps 1–9: guarda de idempotência (`processing_status ∉ {uploaded, processing}` → encerra), `uploaded → processing`, download do original para diretório temporário, probe 1 com gravação provisória de `duration_ms`/`width`/`height` (`hasVideoStream = false` → `not_a_video`), normalização (remux ou transcode), thumbnail em `thumbnailKey`, upload do MP4 em `videoKey` com `Content-Type: video/mp4`, probe 2 com gravação autoritativa de `duration_ms`/`width`/`height`/`size_bytes`, `processing → ready` (per `phase-03-videos/TD-08`, `phase-03-videos/TD-09`, `video-metadata/TD-01`, `video-metadata/TD-02`, `video-metadata/TD-03`).
2. Falhas de mídia (`not_a_video`, `unreadable_file`, `unsupported_media`) → `failed` + `failure_reason` imediatamente e relançar como `UnrecoverableError` do BullMQ (sem retry); demais erros relançados para retry e, na última tentativa, `failed` + `processing_error`. Em todo estado terminal, apagar `originalKey` (per `phase-03-videos/TD-06` e `phase-03-videos/TD-08`, revisões 2026-10-07; `video-metadata/TD-04` — stderr só em log). Diretório temporário removido sempre (`finally`).
3. Criar `src/video-processing/video.processor.ts` — `@Processor(VIDEOS_QUEUE)` estendendo `WorkerHost`; roteia `job.name === PROCESS_VIDEO_JOB` para o serviço, passa `isFinalAttempt = job.attemptsMade + 1 >= job.opts.attempts` e chama `job.updateProgress` por etapa (per `phase-03-videos/TD-02`; library-refs.md → @nestjs/bullmq "Producer and consumer").
4. Criar `src/video-processing/video-processing.module.ts` (`TypeOrmModule.forFeature([Video])`, `MediaModule`, `StorageModule`, `QueueModule`, provider do processor) e importá-lo **apenas** em `WorkerModule` (per `phase-03-videos/TD-03`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoProcessingService` | Unit: guarda de idempotência; mapeamento de cada erro de mídia → `failure_reason` + `UnrecoverableError`; erro transitório só marca `processing_error` na última tentativa; original apagado em `ready` e em `failed` (mocks de ffmpeg/storage/repo) | `src/video-processing/video-processing.service.spec.ts` |
| `VideoProcessingService` | Integration (DB + MinIO + ffmpeg reais, fixture gerada por `lavfi`): vídeo `uploaded` termina `ready` com metadados, `thumbnails/{publicId}.jpg` e `videos/{publicId}/video.mp4` presentes e original ausente; arquivo de texto termina `failed` com `unreadable_file` | `src/video-processing/video-processing.service.integration-spec.ts` |
| `VideoProcessingModule` | Unit: compilação do módulo | `src/video-processing/video-processing.module.spec.ts` |

**Dependencies:** SI-03.9, SI-03.11, SI-03.12

**Acceptance criteria:**

- Após `upload-completion` de um MP4 válido, o vídeo chega a `processing_status = ready` sem chamadas adicionais, com `durationMs`, `width`, `height` e `sizeBytes` preenchidos e `thumbnailUrl` não nulo em `GET /videos/{publicId}`.
- Com o vídeo `ready`, `thumbnails/{publicId}.jpg` e `videos/{publicId}/video.mp4` existem no bucket e `videos/{publicId}/original` não existe.
- Enquanto o vídeo está em `processing`, `GET /videos/{publicId}` já retorna `durationMs` provisório (não nulo) após o primeiro probe.
- O upload de um arquivo que não é vídeo termina em `processing_status = failed` com `failureReason` `unreadable_file` ou `not_a_video`, sem novas tentativas do job, e o original é apagado.
- Reentregar o mesmo job a um vídeo já `ready` não altera o vídeo nem os objetos no bucket.

---

### SI-03.14 — Scheduler e processor `sweep-videos`

**Description:** Dar vida útil limitada a uploads abandonados e fechar o risco de dual-write entre banco e fila com uma varredura periódica no worker.

**Technical actions:**

1. Criar `src/video-processing/video-sweep.service.ts` — `markAbandonedUploads(now)`: `UPDATE` condicional de vídeos em `awaiting_upload` com `created_at < now − 24h` para `failed` + `failure_reason = upload_abandoned`, seguido de abort best-effort dos multiparts com prefixo `originalKey(publicId)` (per `phase-03-videos/TD-04`, revisão 2026-10-07; `video-metadata/TD-04`, revisão 2026-10-07).
2. Em `VideoSweepService`, `requeueStrandedUploads(now)`: para vídeos em `uploaded` com `updated_at < now − 5 min`, `queue.add(PROCESS_VIDEO_JOB, { videoId }, { jobId: videoId, ... })` — ignorado pelo BullMQ se o job ainda existe (per `phase-03-videos/TD-02`).
3. Rotear `job.name === SWEEP_VIDEOS_JOB` no processor da fila `videos` (SI-03.13) para as duas varreduras — um único `WorkerHost` por fila.
4. Criar `src/video-processing/video-sweep.scheduler.ts` — `OnApplicationBootstrap` no worker chamando `queue.upsertJobScheduler('sweep-videos', { every: 900000 }, { name: SWEEP_VIDEOS_JOB })` (idempotente por scheduler ID; API v6 de Job Schedulers — library-refs.md → bullmq "Repeatable sweep").

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoSweepService` | Integration (DB + Redis + MinIO reais): rascunho de 25h vira `failed`/`upload_abandoned` e rascunho de 1h não muda; vídeo `uploaded` parado há 10 min ganha job `process-video`; vídeo `uploaded` recente não | `src/video-processing/video-sweep.service.integration-spec.ts` |
| `VideoSweepScheduler` | Integration (Redis real): após o bootstrap existe exatamente um job scheduler `sweep-videos`, mesmo após dois bootstraps | `src/video-processing/video-sweep.scheduler.integration-spec.ts` |

**Dependencies:** SI-03.13

**Acceptance criteria:**

- Um rascunho em `awaiting_upload` criado há mais de 24h passa a `processing_status = failed` com `failureReason = "upload_abandoned"` na varredura seguinte.
- Um rascunho em `awaiting_upload` criado há menos de 24h não é alterado pela varredura.
- Um vídeo `uploaded` sem job na fila há mais de 5 minutos volta a ser processado até `ready` sem intervenção.
- Reiniciar o worker não cria um segundo agendamento de `sweep-videos`.
- Uma chamada de `upload-completion` concorrente com a varredura nunca deixa um vídeo ao mesmo tempo `uploaded` e marcado `upload_abandoned`.

---

### SI-03.15 — Export e sync do contrato OpenAPI para o frontend

**Description:** Publicar os cinco endpoints de vídeos no `openapi.json` e regenerar os tipos do frontend — a fonte de verdade que o BFF tier deriva.

**Technical actions:**

1. Rodar `docker compose exec nestjs-api npm run openapi:export` (em `nestjs-project/`) e commitar `nestjs-project/openapi.json` (per `openapi-docs-nestjs/TD-02`).
2. Rodar `bash scripts/sync-openapi.sh` na raiz do repo (host) e `docker compose exec next-frontend npm run openapi:types` (em `next-frontend/`); commitar `next-frontend/openapi.json` e `next-frontend/lib/api/types.gen.ts` no mesmo commit (per `next-frontend-openapi-typing/TD-02`, `next-frontend-openapi-typing/TD-03`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `openapi.json` export | Integration: o documento exportado contém os paths de vídeos com os status de resposta documentados e o schema `VideoResponseDto` | `src/openapi-export.integration-spec.ts` |

**Dependencies:** SI-03.6, SI-03.7, SI-03.8, SI-03.9, SI-03.10

**Acceptance criteria:**

- `nestjs-project/openapi.json` contém `/videos`, `/videos/{publicId}`, `/videos/{publicId}/upload-signatures`, `/videos/{publicId}/upload-completion` e `/videos/{publicId}/media-urls`, com as respostas de erro referenciando `ApiErrorEnvelope`.
- `next-frontend/openapi.json` é idêntico a `nestjs-project/openapi.json`.
- `next-frontend/lib/api/types.gen.ts` expõe esses paths em `paths`, e `docker compose exec next-frontend npx tsc --noEmit` sai com código 0.

---

### SI-03.16 — Aliases de contrato de vídeos em `lib/api/contracts.ts`

**Description:** Expor aos Route Handlers, componentes e hooks os shapes de vídeos derivados de `paths`, mantendo `contracts.ts` como único ponto de import de `types.gen.ts`.

**Technical actions:**

1. Estender `lib/api/contracts.ts` com uma seção `// ─── Videos` — aliases pass-through `CreateVideoDto`, `VideoResponse` (200 de `GET /videos/{publicId}`), `SignUploadRequestDto`, `SignUploadResponse` (201 de `POST /videos/{publicId}/upload-signatures`) e `MediaUrlsResponse` (200 de `GET /videos/{publicId}/media-urls`), mais os tipos derivados `VideoProcessingStatus = VideoResponse["processingStatus"]` e `VideoFailureReason = NonNullable<VideoResponse["failureReason"]>` (per `next-frontend-openapi-typing/TD-04`; shapes per `### API Contracts` → BFF tier).

**Tests:** _(empty — type-only aliases; compile-gated por `npx tsc --noEmit`)_

**Dependencies:** SI-03.15

**Acceptance criteria:**

- `lib/api/contracts.ts` exporta `CreateVideoDto`, `VideoResponse`, `SignUploadRequestDto`, `SignUploadResponse`, `MediaUrlsResponse`, `VideoProcessingStatus` e `VideoFailureReason`.
- Nenhum arquivo fora de `lib/api/contracts.ts` e `mocks/` importa `paths` de `types.gen.ts`.
- `docker compose exec next-frontend npx tsc --noEmit` sai com código 0.

---

### SI-03.17 — Helper de chamada autenticada ao upstream (`lib/auth/authorized-upstream.ts`)

**Description:** Centralizar o padrão comum aos cinco Route Handlers de vídeos — sessão obrigatória, Bearer injetado server-side e refresh single-flight em 401 — num único helper.

**Technical actions:**

1. Criar `lib/auth/authorized-upstream.ts` (server-only) — `callAuthorizedUpstream(call)`: sem `session.isLoggedIn` responde `401` com `{ statusCode: 401, error: "UNAUTHORIZED", message: "Session expired" }` sem chamar o upstream; com sessão, executa `call({ Authorization: "Bearer " + session.accessToken })` via `upstream` (`openapi-fetch`) dentro de `withRefresh`, relendo o token da sessão a cada tentativa (per `phase-02-auth-frontend/TD-02`, `phase-02-auth-frontend/TD-03`; regra BFF: só `upstream` chama o host upstream).
2. Converter o resultado em `NextResponse` pass-through: sucesso com o status e body do upstream; erro com o envelope `ApiErrorEnvelope` e o status do upstream (per `### API Contracts` → BFF tier "pass-through").

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `authorized-upstream.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler (proxy or with branching)" — sem sessão → 401 sem request upstream; Bearer da sessão enviado; 401 upstream → refresh → retry com token novo; refresh falho → 401 `UNAUTHORIZED`; erro 4xx do upstream repassado | `lib/auth/__tests__/authorized-upstream.integration.test.ts` |

**Dependencies:** SI-03.16

**Acceptance criteria:**

- Sem sessão, o helper responde `401` com `error: "UNAUTHORIZED"` e nenhuma requisição chega ao upstream.
- Com sessão válida, a requisição ao upstream carrega `Authorization: Bearer {accessToken}` da sessão.
- Um `401` do upstream com refresh bem-sucedido resulta numa única nova tentativa com o token renovado, e a resposta final é a do retry.
- Erros `4xx` do upstream chegam ao chamador com o mesmo status e envelope.

---

### SI-03.18 — Handlers MSW de vídeos (`mocks/handlers/videos.ts`)

**Description:** Fornecer o upstream falso dos cinco endpoints de vídeos para os testes de BFF (Vitest) e para o E2E (instrumentation), com fixtures tipadas por `paths` e um store em memória por `publicId` que torna observável a sequência rascunho → `upload-completion` → polling.

**Technical actions:**

1. Criar `mocks/factories/videos.ts` — `buildVideo(overrides?)` e `buildMediaUrls(overrides?)` hand-written e determinísticos, tipados por `paths` (per `next-frontend-openapi-typing/TD-05`, `next-frontend-msw-foundation/TD-03`).
2. Criar em `mocks/handlers/videos.ts` o store em memória por `publicId`: `POST /videos` gera o `publicId` por contador de módulo (`vid` + número zero-padded, 11 caracteres — formato de `phase-03-videos/TD-07`, ex.: `vid00000001`) e registra o vídeo em `awaiting_upload`; `upload-completion` move o registro para `uploaded` com o `sizeBytes` do pré-cadastro; `GET /videos/{publicId}` e `GET /videos/{publicId}/media-urls` leem o registro; `publicId` desconhecido e não reservado devolve a fixture default em `awaiting_upload`. Exportar `resetVideoStore()`, que limpa os registros e zera o contador (per `e2e-video-upload-fixtures/TD-02` e revisão 2026-10-13).
3. Criar `mocks/storage-origin.ts` com a constante `E2E_STORAGE_ORIGIN = "http://storage.e2e.invalid"` (sem importar `env`, para o Playwright no host poder importá-la); `POST /videos/{publicId}/upload-signatures` devolve `url` nessa origem com path `/videos/{publicId}/original` e query de assinatura fictícia, e `key: "videos/{publicId}/original"` no `CreateMultipartUpload` (per `e2e-video-upload-fixtures/TD-01`; `phase-03-videos/TD-04`).
4. Definir a tabela de trigger fixtures reservadas, stateless e com precedência sobre o store, documentada no topo do arquivo e sem colisão com os triggers de auth nem com o padrão `vid…` do contador: `publicId` `missingVid1` → 404 `VIDEO_NOT_FOUND`; `failedVid01` → vídeo `failed` com `failureReason: "not_a_video"`; `readyVid001` → vídeo `ready` com metadados e `thumbnailUrl`; `procVid0001` → `processing`; `filename` `"too-large.mp4"` → 400 `VALIDATION_ERROR` no `POST /videos` (per `next-frontend/CLAUDE.md` § "E2E architecture").
5. Registrar `videosHandlers` no barrel `mocks/handlers/index.ts` e chamar `resetVideoStore()` no `afterEach` de `mocks/setup.ts`, ao lado de `server.resetHandlers()` (per `next-frontend-msw-foundation/TD-04`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `mocks/handlers/videos.ts` | Integration (msw/node) per testing-guide-next-frontend § "Utilities" (boundary module) — `POST /videos` → `GET` em `awaiting_upload` → `upload-completion` → `GET` em `uploaded`; após `resetVideoStore()` o primeiro `publicId` volta a ser `vid00000001`; triggers reservados prevalecem sobre o store; `upload-signatures` devolve `url` em `E2E_STORAGE_ORIGIN` e a key do rascunho | `mocks/handlers/__tests__/videos.integration.test.ts` |

**Dependencies:** SI-03.16

**Acceptance criteria:**

- Com MSW ativo, cada um dos cinco endpoints upstream de vídeos responde com fixture tipada, e nenhum teste de vídeos falha com "request unhandled".
- Depois de um `POST /videos`, o `GET` do `publicId` retornado devolve `awaiting_upload`; depois do `upload-completion`, o mesmo `GET` devolve `uploaded`.
- Em todo teste Vitest, o primeiro `POST /videos` devolve `publicId` `vid00000001`.
- `upload-signatures` devolve `url` na origem `http://storage.e2e.invalid` e, no `CreateMultipartUpload`, `key: "videos/{publicId}/original"`.
- Os triggers reservados produzem as respostas da tabela documentada no arquivo, independentemente do estado do store.
- `docker compose exec next-frontend npx tsc --noEmit` sai com código 0 com as fixtures tipadas por `paths`.

---

### SI-03.19 — Fake de storage no Playwright e documentação das exceções de E2E

**Description:** Responder no browser, durante o E2E, às operações S3 que o Uppy envia às URLs pré-assinadas da origem reservada, e documentar as duas exceções às convenções de E2E/MSW.

**Technical actions:**

1. Criar `tests/storage-fake.ts` — `routeStorageFake(page)` registra `page.route()` apenas para `${E2E_STORAGE_ORIGIN}/**` (importado de `mocks/storage-origin.ts`) e responde ao subconjunto S3 usado pelo `@uppy/aws-s3`: `POST` sem `uploadId` → XML `InitiateMultipartUploadResult` com `UploadId`; `PUT` com `uploadId` + `partNumber` → `200` com `ETag`, `Access-Control-Expose-Headers: ETag` e `Access-Control-Allow-Origin`; `GET` com `uploadId` → XML `ListPartsResult`; `POST` com `uploadId` → XML `CompleteMultipartUploadResult`; `DELETE` → `204` (per `e2e-video-upload-fixtures/TD-01`; library-refs.md → @uppy/aws-s3 `signRequest`).
2. Auto-aplicar `routeStorageFake(page)` no fixture `network` de `tests/fixtures.ts`, mantendo a proibição de interceptar `/api/**` no browser (per `next-frontend/CLAUDE.md` § "E2E architecture").
3. Atualizar `next-frontend/CLAUDE.md` § "E2E architecture" — documentar o fake de storage via `page.route()` restrito à origem reservada como exceção permitida, e o store em memória dos handlers de vídeos (contador determinístico + `resetVideoStore()`) como exceção à convenção stateless de triggers reservados (per `e2e-video-upload-fixtures/TD-01`, `e2e-video-upload-fixtures/TD-02`).
4. Atualizar `.claude/rules/next-frontend-msw-mocks.md` (store stateful só para recursos com ciclo de vida, IDs determinísticos, reset no `afterEach` de `mocks/setup.ts`) e a linha "Object Storage (S3/MinIO)" de `.claude/skills/testing-guide-next-frontend/references/external-systems.md` (de "Fake (deferred)" para o fake de browser no E2E) (per `e2e-video-upload-fixtures/TD-02`).

**Tests:** _(empty — infraestrutura de teste; exercitada pelos specs E2E de SI-03.30b e SI-03.31b gerados por /plan-test-specs)_

**Dependencies:** SI-03.18

**Acceptance criteria:**

- Num teste Playwright com o fixture `network`, um `PUT` feito pelo browser a uma URL de `http://storage.e2e.invalid` responde `200` com o header `ETag` legível por JavaScript.
- Um `POST` sem `uploadId` à mesma origem devolve XML com um `UploadId`, e um `POST` com `uploadId` devolve XML de conclusão.
- Nenhuma requisição a `/api/**` é interceptada pelo browser (os Route Handlers continuam respondendo).
- `next-frontend/CLAUDE.md` e `.claude/rules/next-frontend-msw-mocks.md` descrevem as duas exceções citando `e2e-video-upload-fixtures/TD-01` e `e2e-video-upload-fixtures/TD-02`.
- `docker compose exec next-frontend npx tsc --noEmit` e `docker compose exec next-frontend npm run lint` saem com código 0.

---

### SI-03.20 — BFF Route Handler: POST /api/videos

**Route:** POST /api/videos
**API Contract:** see `## Technical Specifications` → `### API Contracts` → BFF tier → `#### POST /api/videos`

**Description:** Route Handler same-origin que encaminha o pré-cadastro do rascunho ao upstream, mantendo o modelo strict-BFF.

**Technical actions:**

1. Criar `app/api/videos/route.ts` — `POST` que lê o body como `CreateVideoDto` e encaminha para `POST /videos` via `callAuthorizedUpstream` (per `next-frontend-config-base/TD-03`, `phase-02-auth-frontend/TD-05`, `next-frontend-openapi-typing/TD-01`).
2. Responder `201` com `VideoResponse` pass-through; `400`/`401` pass-through no envelope (per `### API Contracts` → BFF tier `#### POST /api/videos`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/route.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler" — 201 pass-through; 400 pass-through; sem sessão → 401 sem upstream | `app/api/videos/__tests__/route.integration.test.ts` |

**Dependencies:** SI-03.17, SI-03.18

**Acceptance criteria:**

- `POST /api/videos` com sessão e body válido retorna `201` com o `VideoResponse` do upstream.
- `POST /api/videos` com body rejeitado pelo upstream retorna `400` com o envelope `VALIDATION_ERROR` repassado.
- `POST /api/videos` sem sessão retorna `401` com `error: "UNAUTHORIZED"`.

---

### SI-03.21 — BFF Route Handler: GET /api/videos/{publicId}

**Route:** GET /api/videos/{publicId}
**API Contract:** see `## Technical Specifications` → `### API Contracts` → BFF tier → `#### GET /api/videos/{publicId}`

**Description:** Route Handler same-origin de leitura do vídeo — alvo do polling de status.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/route.ts` — `GET` que encaminha para `GET /videos/{publicId}` via `callAuthorizedUpstream`; `params` tipado como `Promise<{ publicId: string }>` conforme a convenção de Route Handlers do Next 16 instalado (confirmar em `node_modules/next/dist/docs/` antes de escrever, per `next-frontend/CLAUDE.md`) (per `phase-03-videos/TD-11`, `next-frontend-config-base/TD-03`).
2. Responder com `Cache-Control: no-store` para o polling sempre ler o estado atual; `200` pass-through; `404`/`401` pass-through no envelope (per `### API Contracts` → BFF tier `#### GET /api/videos/{publicId}`).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/[publicId]/route.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler" — 200 pass-through com `Cache-Control: no-store`; trigger `missingVid1` → 404 pass-through; sem sessão → 401 | `app/api/videos/[publicId]/__tests__/route.integration.test.ts` |

**Dependencies:** SI-03.17, SI-03.18

**Acceptance criteria:**

- `GET /api/videos/{publicId}` com sessão do dono retorna `200` com o `VideoResponse` do upstream e `Cache-Control: no-store`.
- `GET /api/videos/{publicId}` de vídeo inexistente ou alheio retorna `404` com `error: "VIDEO_NOT_FOUND"`.
- `GET /api/videos/{publicId}` sem sessão retorna `401` com `error: "UNAUTHORIZED"`.

---

### SI-03.22 — BFF Route Handler: POST /api/videos/{publicId}/upload-signatures

**Route:** POST /api/videos/{publicId}/upload-signatures
**API Contract:** see `## Technical Specifications` → `### API Contracts` → BFF tier → `#### POST /api/videos/{publicId}/upload-signatures`

**Description:** Route Handler same-origin que o `signRequest` do Uppy chama para cada operação S3 — a "single BFF route" de `phase-03-videos/TD-05`.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/upload-signatures/route.ts` — `POST` que lê `SignUploadRequestDto` e encaminha para `POST /videos/{publicId}/upload-signatures` via `callAuthorizedUpstream` (per `phase-03-videos/TD-05`, `phase-03-videos/TD-04`).
2. Responder `201` com `{ url, key? }` pass-through (é o retorno esperado pelo `signRequest`); `400`/`404`/`409`/`401` pass-through no envelope (per `### API Contracts` → BFF tier).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/[publicId]/upload-signatures/route.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler" — 201 com `{ url, key }` repassado; 409 `INVALID_VIDEO_STATE` pass-through; sem sessão → 401 | `app/api/videos/[publicId]/upload-signatures/__tests__/route.integration.test.ts` |

**Dependencies:** SI-03.17, SI-03.18

**Acceptance criteria:**

- `POST /api/videos/{publicId}/upload-signatures` com sessão do dono e `{ method: "POST", key }` retorna `201` com `url` e `key` do upstream.
- Erros `400`, `404` e `409` do upstream chegam ao browser com o mesmo status e envelope.
- Sem sessão, retorna `401` com `error: "UNAUTHORIZED"` sem chamar o upstream.

---

### SI-03.23 — BFF Route Handler: POST /api/videos/{publicId}/upload-completion

**Route:** POST /api/videos/{publicId}/upload-completion
**API Contract:** see `## Technical Specifications` → `### API Contracts` → BFF tier → `#### POST /api/videos/{publicId}/upload-completion`

**Description:** Route Handler same-origin que confirma o fim do upload e dispara o processamento.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/upload-completion/route.ts` — `POST` sem body que encaminha para `POST /videos/{publicId}/upload-completion` via `callAuthorizedUpstream` (per `phase-03-videos/TD-05`, `phase-03-videos/TD-02`).
2. Responder `200` com `VideoResponse` pass-through; `404`/`409`/`422`/`401` pass-through no envelope (per `### API Contracts` → BFF tier).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/[publicId]/upload-completion/route.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler" — 200 com `processingStatus: "uploaded"`; 409 `UPLOAD_INCOMPLETE` e 422 `FILE_TOO_LARGE` pass-through; sem sessão → 401 | `app/api/videos/[publicId]/upload-completion/__tests__/route.integration.test.ts` |

**Dependencies:** SI-03.17, SI-03.18

**Acceptance criteria:**

- `POST /api/videos/{publicId}/upload-completion` com sessão do dono retorna `200` com o `VideoResponse` em `processingStatus: "uploaded"`.
- Respostas `409 UPLOAD_INCOMPLETE`, `409 INVALID_VIDEO_STATE` e `422 FILE_TOO_LARGE` do upstream chegam ao browser com o mesmo status e envelope.
- Sem sessão, retorna `401` com `error: "UNAUTHORIZED"`.

---

### SI-03.24 — BFF Route Handler: GET /api/videos/{publicId}/media-urls

**Route:** GET /api/videos/{publicId}/media-urls
**API Contract:** see `## Technical Specifications` → `### API Contracts` → BFF tier → `#### GET /api/videos/{publicId}/media-urls`

**Description:** Route Handler same-origin que entrega ao player e ao botão de download as URLs pré-assinadas emitidas pela API.

**Technical actions:**

1. Criar `app/api/videos/[publicId]/media-urls/route.ts` — `GET` que encaminha para `GET /videos/{publicId}/media-urls` via `callAuthorizedUpstream`, com `Cache-Control: no-store` (as URLs expiram) (per `phase-03-videos/TD-09`).
2. Responder `200` com `MediaUrlsResponse` pass-through; `404`/`409`/`401` pass-through no envelope (per `### API Contracts` → BFF tier).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `app/api/videos/[publicId]/media-urls/route.ts` | Integration (MSW) per testing-guide-next-frontend § "Route handler" — 200 com `{ streamUrl, downloadUrl, expiresAt }`; 409 `VIDEO_NOT_READY` pass-through; sem sessão → 401 | `app/api/videos/[publicId]/media-urls/__tests__/route.integration.test.ts` |

**Dependencies:** SI-03.17, SI-03.18

**Acceptance criteria:**

- `GET /api/videos/{publicId}/media-urls` para um vídeo `ready` do dono retorna `200` com `streamUrl`, `downloadUrl` e `expiresAt` e `Cache-Control: no-store`.
- Para um vídeo fora de `ready`, retorna `409` com `error: "VIDEO_NOT_READY"`.
- Sem sessão, retorna `401` com `error: "UNAUTHORIZED"`.

---

### SI-03.25 — Infra: instalar `@uppy/core` e `@uppy/aws-s3`

**Description:** Adicionar ao frontend o cliente de upload decidido para o multipart pré-assinado retomável.

**Technical actions:**

1. Rodar `docker compose exec next-frontend npm install @uppy/core @uppy/aws-s3` com as versões de library-refs.md (`^6.2.0` / `^6.2.2`) — uso headless, sem `@uppy/dashboard`, `@uppy/react` ou `@uppy/golden-retriever` (per `phase-03-videos/TD-05`; OQ-6).
2. Commitar `package.json` e `package-lock.json`.

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `next-frontend/package.json` lista `@uppy/core` e `@uppy/aws-s3` na major 6 e nenhum outro pacote `@uppy/*`.
- `docker compose exec next-frontend npx tsc --noEmit` sai com código 0 após a instalação.

---

### SI-03.26 — Provider de upload (Uppy headless) para o studio

**Description:** Manter uma única instância Uppy num Client Provider acima das rotas de `/studio`, para que o upload iniciado em `/studio/upload` continue em `/studio/videos/[publicId]` e retome falhas de rede dentro da sessão.

**Technical actions:**

1. Criar `lib/studio/create-uppy.ts` — factory `createUppy({ getPublicId })`: `restrictions: { maxNumberOfFiles: 1, maxFileSize: 10 * 2 ** 30, allowedFileTypes: ["video/*"] }`; plugin `AwsS3` com `shouldUseMultipart: true`, `getChunkSize: (file) => Math.max(5 * 2 ** 20, Math.ceil(file.size / 10000))` (mínimo de 5 MiB do S3 e teto de 10000 partes), `limit: 6` e `signRequest` fazendo `POST /api/videos/{publicId}/upload-signatures` com `{ method, key, uploadId, partNumber }` e devolvendo `{ url, key? }` (per `phase-03-videos/TD-05`, `phase-03-videos/TD-04`; library-refs.md → @uppy/aws-s3; OQ-5).
2. Criar `components/studio/upload-provider.tsx` (`"use client"`) — instância criada via `useState(() => createUppy(...))` e compartilhada por `UppyContextProvider` de `@uppy/react`; o estado do Uppy (arquivos, progresso) é lido com `useUppyState` e os eventos com `useUppyEvent`, e o estado de domínio por `publicId` fica num contexto próprio do app por cima do `UppyContext`; API `addFile(file)` (aplica as restrições e lança o erro de restrição do Uppy), `start(publicId)`, `clear()` e `getUpload(publicId)` → `{ fileName, progress, phase: "uploading" | "completing" | "completed" | "error", error?, video? }` (per `phase-03-videos/TD-05`, revisão 2026-10-14; library-refs.md → @uppy/react; OQ-6).
3. Em `upload-success`, chamar `POST /api/videos/{publicId}/upload-completion` e guardar o `VideoResponse` retornado em `getUpload(publicId).video`; erros `409 UPLOAD_INCOMPLETE` e `422 FILE_TOO_LARGE` viram `phase: "error"` com o `errorCode`; ao concluir, limpar o arquivo do Uppy para permitir um novo upload (per `phase-03-videos/TD-05`, `phase-03-videos/TD-02`).
4. Expor `useUpload()` para os consumidores; o provider não persiste nada em `localStorage` (retomada só dentro da sessão do browser — `phase-03-videos/TD-04`, revisão 2026-10-07).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `create-uppy.ts` | Unit per testing-guide-next-frontend § "Utilities" — chunk mínimo de 5 MiB e teto de 10000 partes; restrições rejeitam arquivo não-vídeo, acima de 10 GiB e segundo arquivo; `signRequest` envia o body esperado ao endpoint do `publicId` (`fetch` stubado) | `lib/studio/__tests__/create-uppy.test.ts` |
| `upload-provider.tsx` | Unit per testing-guide-next-frontend § "Client Components" — eventos `upload-progress` atualizam `progress`; `upload-success` chama `upload-completion` e expõe o `video`; `422` vira `phase: "error"` com `FILE_TOO_LARGE` | `components/studio/__tests__/upload-provider.test.tsx` |

**Dependencies:** SI-03.22, SI-03.23, SI-03.25, SI-03.33

**Acceptance criteria:**

- Um arquivo de 10 GiB é enviado em partes de pelo menos 5 MiB e em no máximo 10000 partes.
- Adicionar um arquivo não-vídeo, um arquivo acima de 10 GiB ou um segundo arquivo é rejeitado antes de qualquer chamada ao BFF.
- Cada operação S3 do upload é assinada via `POST /api/videos/{publicId}/upload-signatures`; nenhuma requisição do browser vai ao NestJS.
- Ao terminar o envio, `POST /api/videos/{publicId}/upload-completion` é chamado uma vez e o estado do upload passa a `completed` com o vídeo em `uploaded`.
- O progresso do upload sobrevive à navegação client-side de `/studio/upload` para `/studio/videos/{publicId}`.

---

### SI-03.27 — Hook de polling `useVideoStatus`

**Description:** Propagar o status de processamento ao frontend por short polling no BFF, com o mecanismo hand-rolled decidido.

**Technical actions:**

1. Criar `hooks/use-video-status.ts` (`"use client"`) — `useVideoStatus(publicId, initialVideo)` → `{ video, setVideo }`: enquanto `video.processingStatus ∈ {"uploaded", "processing"}`, encadeia `setTimeout(~3000)` + `fetch("/api/videos/{publicId}")`, agendando a próxima requisição só depois que a anterior termina (sem requisições sobrepostas); para em `ready`/`failed`; limpa o timer no unmount; sem SWR/TanStack (per `phase-03-videos/TD-11` e revisão 2026-10-06).
2. `setVideo` permite injetar o `VideoResponse` devolvido pelo `upload-completion`, o que (re)inicia o polling; `401` interrompe o polling e redireciona para `/login` (per `### UI Contracts` → Error Catalog → UX mapping).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `use-video-status.ts` | Unit per testing-guide-next-frontend § "Hooks" (`renderHook`, jsdom, fake timers, MSW) — não faz polling em `awaiting_upload`/`ready`/`failed`; faz polling a cada ~3s em `uploaded`/`processing`; nunca sobrepõe requisições com resposta lenta; para ao receber `ready`; `setVideo` com `uploaded` inicia o polling; unmount cancela o timer | `hooks/__tests__/use-video-status.test.tsx` |

**Dependencies:** SI-03.21

**Acceptance criteria:**

- Com o vídeo em `processing`, `GET /api/videos/{publicId}` é chamado aproximadamente a cada 3 segundos até a resposta trazer `ready` ou `failed`, e nenhuma chamada é feita depois disso.
- Com uma resposta mais lenta que o intervalo, nunca há duas requisições de status em andamento ao mesmo tempo.
- Com o vídeo em `awaiting_upload`, nenhuma requisição de status é feita até o upload ser concluído.

---

### SI-03.28 — Utilitários de apresentação de vídeo (`lib/videos/format.ts`)

**Description:** Concentrar no frontend a derivação de rótulos a partir dos valores numéricos do contrato e a copy dos estados — única fonte para as três telas.

**Technical actions:**

1. Criar `lib/videos/format.ts` — `formatDuration(durationMs)` (`m:ss` / `h:mm:ss`; `null` → "—"), `qualityLabel(width, height)` derivado do lado menor (ex.: `1080` → "1080p HD", ≥`2160` → "4K"; `null` → "—") (per `video-metadata/TD-03`, `video-metadata/TD-05`; OQ-10).
2. Em `lib/videos/format.ts`, `processingStatusCopy(status)` com uma copy por valor de `VideoProcessingStatus` e `failureReasonCopy(reason)` com uma mensagem por valor de `VideoFailureReason` (per `phase-03-videos/TD-06`, `video-metadata/TD-04`; OQ-3 — copy inferida no implement).
3. Em `lib/videos/format.ts`, `publicVideoUrl(origin, publicId)` → `{origin}/v/{publicId}` (per `phase-03-videos/TD-07`; OQ-11).

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `lib/videos/format.ts` | Unit per testing-guide-next-frontend § "Utilities" — durações abaixo e acima de 1h; rótulos 720p/1080p/4K e vídeo retrato; "—" para nulos; copy definida para todo status e todo `failureReason` | `lib/videos/__tests__/format.test.ts` |

**Dependencies:** SI-03.16

**Acceptance criteria:**

- `formatDuration(941000)` retorna `"15:41"` e `formatDuration(3723000)` retorna `"1:02:03"`.
- `qualityLabel(1920, 1080)` e `qualityLabel(1080, 1920)` retornam o mesmo rótulo.
- Todo valor de `processingStatus` e de `failureReason` do contrato tem uma copy não vazia (checado contra o tipo derivado do contrato).

---

### SI-03.29 — Layout de `/studio` (auth gate, SideNav e provider de upload)

**Description:** Criar o shell comum das rotas do studio: bloqueio de anônimos, app chrome e a instância Uppy compartilhada.

**Technical actions:**

1. Criar `app/studio/layout.tsx` (RSC) — lê a sessão com `getSession()`; sem `isLoggedIn` faz `redirect("/login")` (per `phase-02-auth-frontend/TD-06`; OQ-12).
2. Compor no layout a `SideNav` (`components/layout/side-nav.tsx`, item ativo pela rota) e o `UploadProvider` envolvendo `children`, sem top header/app bar (per `phase-03-videos/TD-05`; OQ-6, OQ-12).

**Tests:** _(empty — o auth gate do layout é coberto pelos specs E2E das telas de `/studio` gerados por /plan-test-specs)_

Layouts com auth gate são cobertos via E2E (testing-guide-next-frontend § "Layouts").

**Dependencies:** SI-03.0.4, SI-03.26

**Acceptance criteria:**

- Um visitante anônimo que acessa `/studio/upload` ou `/studio/videos/{publicId}` é redirecionado para `/login`.
- Um usuário autenticado em qualquer rota de `/studio` vê a SideNav sem a lista de inscrições e sem top header.
- `docker compose exec next-frontend npx tsc --noEmit` e `npm run lint` saem com código 0.

---

### SI-03.30.0 — Drift audit: Tela de upload de vídeo

**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de upload de vídeo`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142
   - Reused DS components: [`components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/studio/upload-dropzone.tsx`, `components/ui/card.tsx`, `components/icons/upload-icon.tsx`, `components/ui/button.tsx`]
   - Server-connected component names: [`UploadDropzone`, `SelectFilesButton`]
   - Target paths (read-only context; no writes here): `app/studio/upload/page.tsx` + `components/studio/upload-dropzone.tsx`

   Para cada componente da Reused DS list, fazer value-level diff contra o arquivo em disco e classificar per o enum de 4 valores (`alinhado` / `drift menor` / `drift relevante` / `componente ausente`); compor Decision per default policy (`.claude/skills/plan-build/references/frontend-drift-report-schema.md`); escrever a seção `## Screen: upload — audited at SI-03.30.0 ({YYYY-MM-DD})` em `docs/phases/phase-03-videos/frontend-drift-report.md`. Ignorar nomes de camada e dados de exemplo do Figma (OQ-13) e o bloco de inscrições da SideNav (OQ-2). **Sem edits de código.**

**Dependencies:** SI-03.0.4, SI-03.0.5

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` contém a seção `## Screen: upload` com a data do run no heading.
- Todo componente da Reused DS list tem exatamente uma linha com a coluna Decision preenchida per o enum de status.
- Todo `exception` carrega justificativa de uma linha.
- `git diff --name-only HEAD -- next-frontend` após o SI está vazio.

---

### SI-03.30a — Tela de upload de vídeo (visual shell)

**Route:** /studio/upload
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de upload de vídeo`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: upload`

**Technical actions:**

1. **Apply drift decisions** — ler a seção do Drift Report desta tela; para cada linha aplicar o verbo (`auto-Edit "<specifics>"` → Edit no arquivo DS; `create` → criar arquivo; `exception`/`skip` → no-op; `CONFLICT:` → tirar o prefixo e aplicar o verbo). Sem detecção/julgamento de drift aqui.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142
   - Reused DS components: lista do UI Contract _(refletindo edits da ação 1)_
   - Server-connected component names: [`UploadDropzone`, `SelectFilesButton`]
   - Target paths: `app/studio/upload/page.tsx` + `components/studio/upload-dropzone.tsx`

   Copy no singular ("Drag and drop a video file to upload" / "Select file") (OQ-5); heading "Upload Video".

**Dependencies:** SI-03.30.0 + SI-03.0.4, SI-03.0.5, SI-03.29

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-03.30b; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- `app/studio/upload/page.tsx` e `components/studio/upload-dropzone.tsx` existem, exportam os componentes esperados e compilam per `docker compose exec next-frontend npx tsc --noEmit`.
- Renderização corresponde à fidelidade do node Figma dentro da tolerância do DS set, com a copy no singular.
- Sem imports de runtime além da Reused DS list (escopo visual preservado).

---

### SI-03.30b — Tela de upload de vídeo (lógica & wiring)

**Test Specs:** see `next-frontend/specs/video-upload.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela de upload de vídeo`

**Technical actions:**

1. **Route guard + rendering strategy** — `app/studio/upload/page.tsx` como RSC estático compondo `components/studio/upload-dropzone.tsx` marcado `"use client"`; a rota herda o gate `Authenticated` do layout de `/studio` (SI-03.29) (per UI Contract `**Auth requirement:**` e `**Rendering strategy:**`; per `phase-02-auth-frontend/TD-06`).
2. **Endpoint wiring** — ao soltar/selecionar: `useUpload().addFile(file)` (restrições do Uppy) → `fetch("/api/videos", { method: "POST" })` com `{ filename, sizeBytes, contentType }` tipado por `CreateVideoDto` de `@/lib/api/contracts` → `start(publicId)` → `router.push("/studio/videos/{publicId}")` (per `### API Contracts` → BFF tier `#### POST /api/videos`; per `phase-03-videos/TD-05`, `phase-03-videos/TD-06`, `phase-03-videos/TD-07`).
3. **Estados** — dropzone desabilitada com spinner do envio do arquivo até o redirect; drag-over destacado (per UI Contract `*Rendered states:*`; OQ-4).
4. **Error mapping** — erro de restrição do Uppy e `400 VALIDATION_ERROR` → erro inline na dropzone; erro de rede/5xx → erro inline "falha no pré-cadastro" com nova tentativa possível e `clear()` do Uppy; `401 UNAUTHORIZED` → redirect `/login` (per UI Contract `**Error Catalog → UX mapping:**`).
5. **Client-side validation mirror** — um arquivo, `video/*`, até 10 GiB e nome com 1–255 caracteres checados antes do `POST /api/videos` (per UI Contract `**Client-side validation mirror:**`).

**Dependencies:** SI-03.30a, SI-03.20, SI-03.26, SI-03.16, SI-03.19

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/studio/upload-dropzone.tsx` | Unit per testing-guide-next-frontend § "Client Components" (`next/navigation` mockado, MSW) — arquivo válido → `POST /api/videos` com payload tipado → `start(publicId)` → `router.push`; arquivo não-vídeo e acima de 10 GiB → erro inline sem chamada ao BFF; `400` → erro inline; `401` → redirect `/login`; dropzone desabilitada durante o pré-cadastro | `components/studio/__tests__/upload-dropzone.wiring.test.tsx` |

E2E da página (fluxo de seleção → redirect, gate de anônimo) é autorado externamente por `/plan-test-specs` no spec referenciado em `**Test Specs:**` e consumido JIT por `/implement`. /plan-build não emite linha E2E aqui.

**Acceptance criteria:**

- Selecionar um arquivo de vídeo válido cria o rascunho via `POST /api/videos` e leva o usuário a `/studio/videos/{publicId}` com o upload em andamento.
- Selecionar um arquivo não-vídeo ou acima de 10GB mostra erro inline na dropzone e não chama o BFF.
- Uma falha no pré-cadastro mostra erro inline e permite tentar de novo com o mesmo arquivo.
- Entre a seleção e o redirect, a dropzone fica desabilitada e não aceita um segundo arquivo.

---

### SI-03.31.0 — Drift audit: Tela do vídeo no studio — upload em andamento

**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload em andamento`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140
   - Reused DS components: [`components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/ui/card.tsx`, `components/studio/upload-progress-panel.tsx`, `components/icons/video-file-icon.tsx`, `components/studio/video-status-badge.tsx`, `components/ui/progress.tsx`, `components/studio/video-details-card.tsx`, `components/studio/video-player.tsx`, `components/studio/copy-link-button.tsx`, `components/ui/section-header.tsx`, `components/studio/thumb-upload.tsx`]
   - Server-connected component names: [`UploadProgressPanel`, `CardVideoConfig`]
   - Target paths (read-only context; no writes here): `app/studio/videos/[publicId]/page.tsx` + `components/studio/video-studio-view.tsx` + `components/studio/upload-progress-panel.tsx` + `components/studio/video-details-card.tsx`

   Para cada componente da Reused DS list, fazer value-level diff contra o arquivo em disco e classificar per o enum de 4 valores; compor Decision per default policy; escrever a seção `## Screen: video-uploading — audited at SI-03.31.0 ({YYYY-MM-DD})` em `docs/phases/phase-03-videos/frontend-drift-report.md`. Fora do escopo do diff: formulário de metadados, "Change Thumbnail", Category, Visibility, Cancel/Save Changes e CheckStatus (OQ-1, OQ-3). **Sem edits de código.**

**Dependencies:** SI-03.0.1, SI-03.0.2, SI-03.0.3, SI-03.0.4, SI-03.0.5, SI-03.0.6

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` contém a seção `## Screen: video-uploading` com a data do run no heading.
- Todo componente da Reused DS list tem exatamente uma linha com a coluna Decision preenchida per o enum de status.
- Todo `exception` carrega justificativa de uma linha.
- `git diff --name-only HEAD -- next-frontend` após o SI está vazio.

---

### SI-03.31a — Tela do vídeo no studio — upload em andamento (visual shell)

**Route:** /studio/videos/[publicId]
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload em andamento`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: video-uploading`

**Technical actions:**

1. **Apply drift decisions** — ler a seção do Drift Report desta tela; para cada linha aplicar o verbo (`auto-Edit "<specifics>"` → Edit no arquivo DS; `create` → criar arquivo; `exception`/`skip` → no-op; `CONFLICT:` → tirar o prefixo e aplicar o verbo). Sem detecção/julgamento de drift aqui.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140
   - Reused DS components: lista do UI Contract _(refletindo edits da ação 1)_
   - Server-connected component names: [`UploadProgressPanel`, `CardVideoConfig`]
   - Target paths: `app/studio/videos/[publicId]/page.tsx` + `components/studio/video-studio-view.tsx`

   Heading estático "Video details" (OQ-7); layout em duas colunas com UploadProgressPanel e SectionHeader "Thumbnail" + ThumbUpload à esquerda e CardVideoConfig à direita; sem o formulário de metadados e sem rodapé de ações (OQ-1).

**Dependencies:** SI-03.31.0 + SI-03.0.1, SI-03.0.2, SI-03.0.3, SI-03.0.4, SI-03.0.5, SI-03.0.6, SI-03.29

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-03.31b; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- `app/studio/videos/[publicId]/page.tsx` e `components/studio/video-studio-view.tsx` existem, exportam os componentes esperados e compilam per `docker compose exec next-frontend npx tsc --noEmit`.
- Renderização corresponde à fidelidade do node Figma dentro da tolerância do DS set, sem as seções de metadados da Fase 04 e com o heading "Video details".
- Sem imports de runtime além da Reused DS list (escopo visual preservado).

---

### SI-03.31b — Tela do vídeo no studio — upload em andamento (lógica & wiring)

**Test Specs:** see `next-frontend/specs/video-uploading.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload em andamento`

**Technical actions:**

1. **Route guard + rendering strategy** — `app/studio/videos/[publicId]/page.tsx` como RSC assíncrono: lê o vídeo via novo `lib/videos/get-video.ts` (server-only; `upstream.GET("/videos/{publicId}")` com o Bearer da sessão); `404 VIDEO_NOT_FOUND` → `notFound()`; `401` → `redirect("/login")` (RSC não regrava cookie, então não tenta refresh aqui); passa o `VideoResponse` inicial a `components/studio/video-studio-view.tsx` (`"use client"`) (per UI Contract `**Auth requirement:**` Authenticated+Owner e `**Rendering strategy:**`; per `phase-02-auth-frontend/TD-06`, `next-frontend-config-base/TD-03`).
2. **Endpoint wiring — upload e status** — `video-studio-view` combina `useUpload().getUpload(publicId)` (progresso do Uppy) com `useVideoStatus(publicId, initialVideo)`; quando o provider expõe o `video` devolvido pelo `upload-completion`, chama `setVideo` para iniciar o polling (per `phase-03-videos/TD-05`, `phase-03-videos/TD-11`; endpoints per `### API Contracts` → BFF tier).
3. **Estados** — `awaiting_upload` + upload ativo → UploadProgressPanel com percentual e barra iguais e rótulo "Uploading"; `awaiting_upload` sem upload ativo → estado "Envio interrompido — selecione o arquivo novamente" com seletor que chama `addFile` + `start(publicId)` no **mesmo** rascunho; `uploaded`/`processing` → `processingStatusCopy`; `failed` → `failureReasonCopy(failureReason)` + link para `/studio/upload`, sem reanexar; CardVideoConfig com filename, VideoLink `publicVideoUrl(window.location.origin, publicId)` copiável sem navegação e metadados via `formatDuration`/`qualityLabel` ("—" para nulos) (per `phase-03-videos/TD-04` e `phase-03-videos/TD-06`, revisões 2026-10-07; `video-metadata/TD-05`; OQ-3, OQ-6, OQ-10, OQ-11).
4. **Error mapping** — `UPLOAD_INCOMPLETE` → mensagem no painel com o seletor de reanexação; `FILE_TOO_LARGE` → mensagem "arquivo acima de 10GB" no painel; `INVALID_VIDEO_STATE` → recarrega via `GET /api/videos/{publicId}` e renderiza o estado atual; `UNAUTHORIZED` → redirect `/login` (per UI Contract `**Error Catalog → UX mapping:**`).
5. **Acessibilidade** — `ProgressLinear` com `role="progressbar"` e `aria-valuenow`; mudanças de status anunciadas por live region (per UI Contract `**Accessibility notes:**`).

**Dependencies:** SI-03.31a, SI-03.21, SI-03.23, SI-03.26, SI-03.27, SI-03.28, SI-03.19

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/studio/video-studio-view.tsx` | Unit per testing-guide-next-frontend § "Client Components" (provider de upload stubado, MSW, fake timers) — upload ativo mostra progresso; sem upload ativo em `awaiting_upload` mostra "Envio interrompido" e reanexa ao mesmo `publicId`; `video` do `upload-completion` inicia polling e troca o rótulo; `failed` mostra a copy do `failureReason` e link para `/studio/upload`; `FILE_TOO_LARGE` e `UPLOAD_INCOMPLETE` renderizam a mensagem do painel | `components/studio/__tests__/video-studio-view.uploading.test.tsx` |
| `lib/videos/get-video.ts` | Integration (MSW) per testing-guide-next-frontend § "Utilities" (boundary module) — Bearer da sessão enviado; `missingVid1` → resultado "not found"; `401` → resultado "unauthorized" | `lib/videos/__tests__/get-video.integration.test.ts` |

E2E da página (upload até `uploaded`, reload em "Envio interrompido", 404 para vídeo alheio) é autorado externamente por `/plan-test-specs` no spec referenciado em `**Test Specs:**` e consumido JIT por `/implement`. /plan-build não emite linha E2E aqui.

**Acceptance criteria:**

- Logo após o redirect de `/studio/upload`, a página mostra o nome do arquivo e o percentual do upload avançando, com texto e barra iguais.
- Ao terminar o envio, o rótulo deixa "Uploading" e passa a refletir `uploaded`/`processing` sem recarregar a página.
- Recarregar a página durante o upload mostra "Envio interrompido — selecione o arquivo novamente"; selecionar o arquivo retoma o envio para o mesmo `publicId`.
- Um vídeo `failed` mostra a mensagem do seu `failureReason` e um link para `/studio/upload`, sem opção de reanexar.
- Acessar `/studio/videos/{publicId}` de um vídeo alheio ou inexistente mostra a página 404.
- O VideoLink exibe `{origin}/v/{publicId}` como texto copiável e não navega.

---

### SI-03.32.0 — Drift audit: Tela do vídeo no studio — upload concluído (player + download)

**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload concluído (player + download)`

**Technical actions:**

1. **Drift audit** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196
   - Reused DS components: [`components/layout/side-nav.tsx`, `components/ui/card.tsx`, `components/studio/video-details-card.tsx`, `components/studio/video-player.tsx`, `components/studio/copy-link-button.tsx`, `components/ui/section-header.tsx`, `components/studio/thumb-upload.tsx`, `components/studio/processing-status.tsx`, `components/ui/button.tsx`, `components/icons/download-icon.tsx`]
   - Server-connected component names: [`Video player`, `CardVideoConfig`, `ThumbUpload`, `ProcessingStatus`, `DownloadButton`]
   - Target paths (read-only context; no writes here): `app/studio/videos/[publicId]/page.tsx` + `components/studio/video-studio-view.tsx` + `components/studio/video-details-card.tsx`

   Para cada componente da Reused DS list, fazer value-level diff contra o arquivo em disco e classificar per o enum de 4 valores; compor Decision per default policy; escrever a seção `## Screen: video-ready — audited at SI-03.32.0 ({YYYY-MM-DD})` em `docs/phases/phase-03-videos/frontend-drift-report.md`, consultando a seção `video-uploading` como `prior_decisions` (mesma rota). DownloadButton e `download-icon.tsx` não têm node Figma (OQ-9) — classificar sem diff visual. **Sem edits de código.**

**Dependencies:** SI-03.31.0 (prior decisions da mesma rota), SI-03.0.3, SI-03.0.4, SI-03.0.5, SI-03.0.6

**Tests:** _(empty — audit-only; the report is the deliverable)_

**Acceptance criteria:**

- `frontend-drift-report.md` contém a seção `## Screen: video-ready` com a data do run no heading.
- Todo componente da Reused DS list tem exatamente uma linha com a coluna Decision preenchida per o enum de status.
- Divergências com decisões da seção `video-uploading` aparecem marcadas como `CONFLICT`.
- `git diff --name-only HEAD -- next-frontend` após o SI está vazio.

---

### SI-03.32a — Tela do vídeo no studio — upload concluído (visual shell)

**Route:** /studio/videos/[publicId]
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload concluído (player + download)`
**Drift Report:** see `frontend-drift-report.md` → `## Screen: video-ready`

**Technical actions:**

1. **Apply drift decisions** — ler a seção do Drift Report desta tela; para cada linha aplicar o verbo (`auto-Edit "<specifics>"` → Edit no arquivo DS; `create` → criar arquivo; `exception`/`skip` → no-op; `CONFLICT:` → tirar o prefixo e aplicar o verbo). Sem detecção/julgamento de drift aqui.
2. **Visual shell generation** — invoke `figma:figma-implement-design` (narrow handoff) with:
   - Figma URL: https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196
   - Reused DS components: lista do UI Contract _(refletindo edits da ação 1)_
   - Server-connected component names: [`Video player`, `CardVideoConfig`, `ThumbUpload`, `ProcessingStatus`, `DownloadButton`]
   - Target paths: `components/studio/video-studio-view.tsx` (variante `ready`) + `components/studio/video-details-card.tsx`

   DownloadButton secundário "Download" com `download-icon`, abaixo do VideoLink dentro do CardVideoConfig (OQ-9); ProcessingStatus no rodapé no lugar do CheckStatus (OQ-3).

**Dependencies:** SI-03.32.0 + SI-03.0.3, SI-03.0.4, SI-03.0.5, SI-03.0.6, SI-03.31a

**Tests:** _(empty — shell smoke-gated by build AC; Unit tests live in SI-03.32b; E2E in /plan-test-specs spec)_

**Acceptance criteria:**

- A variante `ready` de `video-studio-view.tsx` e o slot de download do `video-details-card.tsx` existem e compilam per `docker compose exec next-frontend npx tsc --noEmit`.
- Renderização corresponde à fidelidade do node Figma dentro da tolerância do DS set, com o DownloadButton abaixo do VideoLink.
- Sem imports de runtime além da Reused DS list (escopo visual preservado).

---

### SI-03.32b — Tela do vídeo no studio — upload concluído (lógica & wiring)

**Test Specs:** see `next-frontend/specs/video-ready.plan.md`
**UI Contract:** see `## Technical Specifications` → `### UI Contracts` → `#### Screen: Tela do vídeo no studio — upload concluído (player + download)`

**Technical actions:**

1. **Rendering strategy** — mesma página RSC e `video-studio-view.tsx` de SI-03.31b; a variante `ready` é escolhida por `processingStatus === "ready"`, seja no carregamento inicial, seja quando o polling chega a `ready` (per UI Contract `**Rendering strategy:**`; per `phase-03-videos/TD-11`).
2. **Endpoint wiring — mídia** — ao entrar em `ready`, `fetch("/api/videos/{publicId}/media-urls")` uma vez, tipado por `MediaUrlsResponse`; `VideoPlayer` recebe `src = streamUrl` e `poster = thumbnailUrl` (`<video controls>` nativo, OQ-8); DownloadButton recebe `href = downloadUrl` e fica desabilitado até as URLs chegarem (per `### API Contracts` → BFF tier `#### GET /api/videos/{publicId}/media-urls`; per `phase-03-videos/TD-08`, `phase-03-videos/TD-09`).
3. **Dados exibidos** — ThumbUpload com `thumbnailUrl`; duração via `formatDuration(durationMs)` e qualidade via `qualityLabel(width, height)`; filename original; ProcessingStatus com `processingStatusCopy("ready")` (per `video-metadata/TD-03`, `video-metadata/TD-05`).
4. **Error mapping** — falha ou `409 VIDEO_NOT_READY` ao buscar as URLs → player sem `src` com mensagem curta e DownloadButton desabilitado; `UNAUTHORIZED` → redirect `/login` (per UI Contract `**Error Catalog → UX mapping:**`).
5. **Acessibilidade** — DownloadButton desabilitado expõe `aria-disabled`; ícones decorativos com `aria-hidden`; `CopyLinkButton` com `aria-label` (per UI Contract `**Accessibility notes:**`).

**Dependencies:** SI-03.32a, SI-03.31b, SI-03.24, SI-03.28

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `components/studio/video-studio-view.tsx` | Unit per testing-guide-next-frontend § "Client Components" (MSW, fake timers) — vídeo `ready` busca as media URLs uma vez e passa `src`/`poster` ao player e `href` ao DownloadButton; DownloadButton desabilitado antes das URLs e em `409`; polling chegando a `ready` dispara a busca; duração e qualidade formatadas | `components/studio/__tests__/video-studio-view.ready.test.tsx` |

E2E da página (reprodução com `src` pré-assinado, download, estado `ready` vindo do polling) é autorado externamente por `/plan-test-specs` no spec referenciado em `**Test Specs:**` e consumido JIT por `/implement`. /plan-build não emite linha E2E aqui.

**Acceptance criteria:**

- Quando o vídeo chega a `ready`, o player passa a ter controles nativos e a thumbnail como poster, sem recarregar a página.
- Reproduzir e avançar o vídeo funciona sem baixar o arquivo inteiro (o storage atende requisições `Range` da `streamUrl`).
- Clicar em "Download" baixa o MP4 processado com nome terminado em `.mp4`.
- Antes de as media URLs chegarem, ou se a busca falhar, o botão "Download" fica desabilitado.
- A duração e a qualidade exibidas correspondem a `durationMs` e às dimensões de exibição do vídeo.

---

### SI-03.33 (amendment of SI-03.25) — Infra: instalar `@uppy/react`

**Description:** Adicionar `@uppy/react`, adotado pela revisão 2026-10-14 do TD-05, para o provider de upload do studio compartilhar a instância Uppy via `UppyContextProvider` e ler o estado com os hooks oficiais.

**Technical actions:**

1. Rodar `docker compose exec next-frontend npm install @uppy/react@^6.0.0` com a versão de library-refs.md — sem os peers opcionais `@uppy/dashboard`, `@uppy/status-bar`, `@uppy/webcam` e `@uppy/screen-capture`, e sem `@uppy/golden-retriever` (per `phase-03-videos/TD-05`, revisão 2026-10-14; library-refs.md → @uppy/react).
2. Commitar `package.json` e `package-lock.json`.

**Tests:** _(empty — Infra)_

**Dependencies:** SI-03.25

**Acceptance criteria:**

- `next-frontend/package.json` lista `@uppy/core`, `@uppy/aws-s3` e `@uppy/react` na major 6 e nenhum outro pacote `@uppy/*`.
- `docker compose exec next-frontend npm ls @uppy/core` mostra uma única versão de `@uppy/core` (deduped).
- `docker compose exec next-frontend npx tsc --noEmit` sai com código 0 após a instalação.

---

### SI-03.34 (amendment of SI-03.1) — Infra: storage de dev/test em RustFS

**Description:** Registrar no plano a troca do servidor S3 de dev/test de MinIO para RustFS (`rustfs/rustfs:1.0.1`), formalizada pela revisão 2026-10-15 do TD-01: a imagem `minio/minio` não puxa mais, e o RustFS é o fallback drop-in já previsto no TD. O app continua falando só a API S3 via AWS SDK, então nenhum código de aplicação muda.

**Technical actions:**

1. Conferir que o serviço `storage` de `nestjs-project/compose.yaml` usa `rustfs/rustfs:1.0.1`, portas `9000`/`9001`, credenciais por `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY` (iguais a `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` do `.env.example`) e CORS por `RUSTFS_CORS_ALLOWED_ORIGINS=http://localhost:3001` (per `phase-03-videos/TD-01`, revisão 2026-10-15).
2. Trocar o comentário acima do serviço `storage` em `nestjs-project/compose.yaml` para citar a revisão 2026-10-15 do `phase-03-videos/TD-01` como origem da escolha do RustFS, em vez de descrevê-la como desvio do TD.

**Tests:** _(empty — Infra; a cobertura contra o storage real já existe nas suítes de integração de SI-03.3, SI-03.8, SI-03.9, SI-03.10, SI-03.13 e SI-03.14)_

**Dependencies:** SI-03.1

**Acceptance criteria:**

- `docker compose up -d` (em `nestjs-project/`) sobe `storage` com a imagem `rustfs/rustfs:1.0.1` e status healthy.
- `curl -f http://localhost:9000/health` responde `200`.
- O comentário do serviço `storage` em `compose.yaml` referencia `phase-03-videos/TD-01` (revisão 2026-10-15).
- As suítes de integração do storage (`storage.service.integration-spec.ts`, `storage-bucket.initializer.integration-spec.ts`, `upload-signing.service.integration-spec.ts`) passam contra o RustFS do Compose.

---

### SI-03.35 (amendment of SI-03.4) — Isolar a fila dos testes com um `prefix` próprio do BullMQ

**Description:** Fazer os testes usarem um `prefix` de chaves do BullMQ diferente do de dev, conforme a revisão 2026-10-15 do TD-02. O `video-worker` do Compose usa o mesmo Redis e a mesma fila `videos` dos testes que sobem o `AppModule`; ele consumia o job `process-video` desses testes e avançava o vídeo para `processing` no meio do E2E. Com prefixos distintos, o worker de dev nunca enxerga jobs de teste e pode continuar rodando durante a suíte.

**Technical actions:**

1. Estender `src/config/queue.config.ts` (`registerAs('queue')`) com `prefix` lido de `QUEUE_PREFIX`, default `bull` — o mesmo default do BullMQ, então dev não muda (per `phase-03-videos/TD-02`, revisão 2026-10-15; `phase-01-configuracao-base/TD-03`).
2. Adicionar `QUEUE_PREFIX: Joi.string().default('bull')` ao schema de `src/config/env.validation.ts` e a chave `QUEUE_PREFIX=bull` ao `.env.example` (per `phase-01-configuracao-base/TD-02`).
3. Em `src/queue/queue.module.ts`, o `useFactory` do `BullModule.forRootAsync` passa a retornar `{ connection: { host, port }, prefix: queue.prefix }` — `prefix` é opção de `QueueOptions`/`WorkerOptions` do BullMQ v6, então vale para a fila da API e para o worker (per `phase-03-videos/TD-02`, revisão 2026-10-15).
4. Criar `src/test/test-queue-prefix.ts`, que atribui `process.env.QUEUE_PREFIX = 'streamtube-test'` (atribuição direta, sobrescrevendo o valor vindo do `.env` ou do container), e registrá-lo em `setupFiles` logo após `dotenv/config` no Jest do `package.json` e em `test/jest-e2e.json` (per `phase-03-videos/TD-02`, revisão 2026-10-15).
5. Atualizar `nestjs-project/CLAUDE.md` § "Test execution": os testes usam o prefixo `streamtube-test` do BullMQ, então o `video-worker` pode ficar rodando durante as suítes.

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `env.validation.ts` | Integration: `QUEUE_PREFIX` ausente assume o default `bull`; valor explícito é preservado | `src/config/env.validation.integration-spec.ts` |
| `QueueModule` | Unit (compilação): a fila `videos` registrada usa o `prefix` vindo da config (`streamtube-test` sob o setup de teste) | `src/queue/queue.module.spec.ts` |

**Dependencies:** SI-03.1, SI-03.4

**Acceptance criteria:**

- Com o `video-worker` rodando, `docker compose exec nestjs-api npm run test:e2e` passa por completo, incluindo `videos-upload-completion` › `chamada-repetida-idempotente`.
- Sem `QUEUE_PREFIX` definido, a API e o worker sobem com o prefixo `bull`; os jobs de dev continuam sendo consumidos normalmente pelo `video-worker`.
- Os testes que sobem o `AppModule` registram a fila `videos` com o prefixo `streamtube-test`.

---

## Technical Specifications

### Data Model

#### Video

Tabela `videos` (`@Entity('videos')`). Identificadores de domínio copiados verbatim dos TDs: `public_id` (phase-03-videos/TD-07), `processing_status` / `publication_status` (phase-03-videos/TD-06), `failureReason` → coluna `failure_reason` (video-metadata/TD-04), `durationMs` / `width` / `height` / `sizeBytes` → colunas `duration_ms` / `width` / `height` / `size_bytes` (video-metadata/TD-03). Colunas seguem o padrão snake_case das entidades existentes (`is_confirmed`, `user_id`); no wire, `processing_status`/`publication_status` viram `processingStatus`/`publicationStatus` (phase-03-videos/TD-06, revisão 2026-10-08) — ver §API Contracts.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, generated | Interno — nunca exposto no wire nem em object keys (phase-03-videos/TD-07: "The UUID PK stays internal") |
| public_id | varchar(11) | unique, not null | Random 11-char base64url (64 bits) gerado com `node:crypto` (`randomBytes(8).toString('base64url')`) no service, antes do insert; colisão (unique violation) → regenera e tenta de novo (máx. 3) (phase-03-videos/TD-07) |
| channel_id | uuid | FK → channels.id, not null, `ON DELETE CASCADE` | Dono do vídeo; a ownership é resolvida por `channels.user_id = JWT sub` |
| original_filename | varchar(255) | not null | Nome original do arquivo, capturado no pré-cadastro (não vem do ffprobe) |
| processing_status | enum `video_processing_status` (`awaiting_upload`, `uploaded`, `processing`, `ready`, `failed`) | not null, default `awaiting_upload` | Ciclo de processamento (phase-03-videos/TD-06). `failed` é terminal — nenhuma transição sai de `failed` |
| publication_status | enum `video_publication_status` (`draft`, `published`) | not null, default `draft` | Fase 03 só escreve `draft`; `published` existe no enum para o contrato OpenAPI ficar estável até a Fase 04 (phase-03-videos/TD-06) |
| failure_reason | enum `video_failure_reason` (`not_a_video`, `unreadable_file`, `unsupported_media`, `processing_error`, `upload_abandoned`) | nullable | Preenchido só quando `processing_status = failed` (video-metadata/TD-04). stderr do ffmpeg vai só para logs do worker |
| duration_ms | integer | nullable | Duração em milissegundos inteiros (video-metadata/TD-03). Provisória após o probe do original, autoritativa após o probe do MP4 normalizado (video-metadata/TD-02) |
| width | integer | nullable | Largura de **exibição** (rotação aplicada no worker) (video-metadata/TD-03) |
| height | integer | nullable | Altura de **exibição** (rotação aplicada no worker) (video-metadata/TD-03) |
| size_bytes | bigint | nullable | Tamanho em bytes; `bigint` porque 10GB excede `int4`. Transformer TypeORM `string ↔ number` na coluna (10 GiB < `Number.MAX_SAFE_INTEGER`). Provisório = `ContentLength` do original (HeadObject na conclusão do upload); autoritativo = tamanho do MP4 normalizado |
| created_at | timestamptz | not null, `@CreateDateColumn` | Também é o marco das 24h do sweep de uploads abandonados |
| updated_at | timestamptz | not null, `@UpdateDateColumn` | Usado pelo sweep de reenfileiramento (dual-write) |

**Relations:** `Video` → `Channel` (many-to-one, owning side via `channel_id`); `Channel` → `Video` (one-to-many, lado inverso `channel.videos`) — os dois lados são declarados (regra de entidades).
**Indexes:** `(public_id)` — unique; `(channel_id)`; `(processing_status, created_at)` — atende o sweep de abandono e o de reenfileiramento.
**Migration:** gerada via TypeORM CLI (`CreateVideos`), criando os três tipos enum e a tabela; `down` remove tabela e tipos.

#### Storage object layout (bucket `S3_BUCKET`)

Layout derivado de forma determinística do `public_id` por um único helper do módulo de storage — nenhuma coluna de key é persistida, e nenhum `uploadId` é persistido (phase-03-videos/TD-04, revisão 2026-10-07).

| Object key | Escrito por | Visibilidade | Ciclo de vida |
|------------|-------------|--------------|---------------|
| `videos/{public_id}/original` | Browser (multipart presigned, phase-03-videos/TD-04) | Privado | Apagado quando o processamento chega a um estado terminal (`ready` ou `failed`) (phase-03-videos/TD-08, revisão 2026-10-07) |
| `videos/{public_id}/video.mp4` | Worker | Privado — só via presigned GET emitido pela API (phase-03-videos/TD-09) | Único arquivo de vídeo retido |
| `thumbnails/{public_id}.jpg` | Worker | Public-read (bucket policy no prefixo `thumbnails/*`) — URL estável (phase-03-videos/TD-09) | Retido |

**Bucket configuration (idempotente, aplicada no boot da API):** bucket criado se ausente; lifecycle rule `AbortIncompleteMultipartUpload` com `DaysAfterInitiation: 1` (phase-03-videos/TD-04, revisão 2026-10-07); bucket policy de leitura anônima restrita a `thumbnails/*`; CORS permitindo `PUT`/`POST`/`GET`/`DELETE` a partir da origem do frontend (`http://localhost:3001` em dev) e expondo o header `ETag` (necessário para o Uppy montar o `CompleteMultipartUpload`). No RustFS de dev/test (phase-03-videos/TD-01, revisão 2026-10-15) o CORS é configurado no serviço (env `RUSTFS_CORS_ALLOWED_ORIGINS` no Compose), não via `PutBucketCors`; a lifecycle rule e a bucket policy foram aceitas pelo RustFS no implement (SI-03.3).

### API Contracts

> _Backend tier — `nestjs-project`. Novo `VideosController` (`@ApiTags('videos')`, `@Controller('videos')`), todas as rotas autenticadas (guard JWT global — nenhuma `@Public()`) com `@ApiBearerAuth('access-token')`, e `@SkipThrottle()` no controller: o `ThrottlerGuard` global (10 req/min, phase-02-auth/TD-08) bloquearia a assinatura de partes, já que um arquivo de 10GB gera milhares de requests `upload-signatures`. Erros usam o envelope compartilhado `ApiErrorEnvelope` (phase-02-auth/TD-07). Todos os campos do wire são camelCase — `publicId`, `processingStatus`, `publicationStatus`, `failureReason`, `durationMs`, `width`, `height`, `sizeBytes` (phase-03-videos/TD-06, revisão 2026-10-08); colunas do banco (`processing_status`, `publication_status`) e valores de enum (`awaiting_upload`, `draft`, …) seguem em snake_case._

#### Shared response shape — `VideoResponseDto`

- publicId: string — 11 caracteres base64url (phase-03-videos/TD-07)
- filename: string — nome original do arquivo capturado no pré-cadastro
- processingStatus: `"awaiting_upload" | "uploaded" | "processing" | "ready" | "failed"` (phase-03-videos/TD-06)
- publicationStatus: `"draft" | "published"` — sempre `"draft"` na Fase 03 (phase-03-videos/TD-06)
- failureReason: `"not_a_video" | "unreadable_file" | "unsupported_media" | "processing_error" | "upload_abandoned"` | null — não-nulo só quando `processingStatus = "failed"` (video-metadata/TD-04)
- durationMs: integer | null — milissegundos inteiros (video-metadata/TD-03)
- width: integer | null — largura de exibição, rotação aplicada (video-metadata/TD-03)
- height: integer | null — altura de exibição, rotação aplicada (video-metadata/TD-03)
- sizeBytes: integer | null (video-metadata/TD-03)
- thumbnailUrl: string | null — URL pública estável de `thumbnails/{publicId}.jpg` (montada com `S3_PUBLIC_ENDPOINT`); `null` até a thumbnail existir (phase-03-videos/TD-09)
- createdAt: string (ISO-8601 date-time)

Os metadados (`durationMs`, `width`, `height`, `sizeBytes`) ficam `null` até o primeiro probe; os rótulos de exibição ("15:41", "1080p HD") são derivados no frontend (video-metadata/TD-03, video-metadata/TD-05).

---

#### POST /videos (SI-03.6)

Pré-cadastra o vídeo como rascunho (`processingStatus: awaiting_upload`, `publicationStatus: draft`) no canal do usuário autenticado e gera o `public_id`.

**Request headers:**
- Authorization: Bearer {access_token}
- Content-Type: application/json

**Request body:** `CreateVideoDto`
- filename: string, required — 1–255 caracteres
- sizeBytes: integer, required — min 1, max 10737418240 (10 GiB)
- contentType: string, required — deve começar com `video/` (só validação do pré-cadastro; não persistido — o original é assinado como `application/octet-stream` e o tipo final `video/mp4` é definido pelo worker)

**Response 201:** `VideoResponseDto`

**Error responses:**
- 400 VALIDATION_ERROR: body falha na validação (inclui `sizeBytes` acima de 10 GiB e `contentType` não-vídeo)
- 401 Unauthorized: access token ausente ou inválido

---

#### GET /videos/{publicId} (SI-03.7)

Lê o vídeo do dono. Consumido pelo RSC de `/studio/videos/[publicId]` e pelo polling de status (phase-03-videos/TD-11).

**Request headers:**
- Authorization: Bearer {access_token}

**Request path parameters:**
- publicId: string, required — 11 caracteres base64url

**Response 200:** `VideoResponseDto`

**Error responses:**
- 404 VIDEO_NOT_FOUND: `publicId` inexistente **ou** pertencente a outro canal (não revela a existência de rascunhos alheios — phase-03-videos/TD-09)
- 401 Unauthorized: access token ausente ou inválido

---

#### POST /videos/{publicId}/upload-signatures (SI-03.8)

Assina uma operação S3 do upload multipart — é o alvo do `signRequest` do Uppy (phase-03-videos/TD-04, phase-03-videos/TD-05). A API só pré-assina URLs com o client S3 configurado com `S3_PUBLIC_ENDPOINT` (assinatura offline, phase-03-videos/TD-01); os bytes vão do browser direto ao storage. Permitido só enquanto `processingStatus = awaiting_upload` (phase-03-videos/TD-06, revisão 2026-10-07). A key do objeto é sempre a do servidor: `videos/{publicId}/original`.

**Request headers:**
- Authorization: Bearer {access_token}
- Content-Type: application/json

**Request path parameters:**
- publicId: string, required

**Request body:** `SignUploadRequestDto` (espelha o argumento do `signRequest` do `@uppy/aws-s3` 6)
- method: `"PUT" | "POST" | "GET" | "DELETE"`, required
- key: string, required — key proposta pelo Uppy
- uploadId: string, optional — presente nas operações sobre um multipart existente
- partNumber: integer, optional — 1–10000, presente só em `UploadPart`

Mapeamento (tabela do `signRequest` no Uppy 6):

| Request | S3 operation | Regra |
|---------|--------------|-------|
| `{ method: "POST", key }` (sem `uploadId`) | CreateMultipartUpload | Ignora a `key` recebida e assina para `videos/{publicId}/original`, com `ContentType: application/octet-stream`. **Antes** de assinar, chama `ListMultipartUploads` com `Prefix` = essa key e `AbortMultipartUpload` em cada upload em andamento (phase-03-videos/TD-04, revisão 2026-10-07 — limpeza server-side, sem persistir `uploadId`). Responde com `key` |
| `{ method: "PUT", key, uploadId, partNumber }` | UploadPart | `key` deve ser igual à key do rascunho |
| `{ method: "GET", key, uploadId }` | ListParts | `key` deve ser igual à key do rascunho (retomada dentro da sessão do browser) |
| `{ method: "POST", key, uploadId }` | CompleteMultipartUpload | `key` deve ser igual à key do rascunho |
| `{ method: "DELETE", key, uploadId }` | AbortMultipartUpload | `key` deve ser igual à key do rascunho |
| `{ method: "PUT", key }` (sem `uploadId`) | PutObject | Rejeitado — o cliente usa sempre multipart (`shouldUseMultipart: true`) |

**Response 201:**
- url: string — URL pré-assinada (expira em `UPLOAD_SIGN_TTL_SECONDS`)
- key: string, optional — presente só no `CreateMultipartUpload` (key definida pelo servidor)

**Error responses:**
- 400 VALIDATION_ERROR: body falha na validação
- 400 INVALID_UPLOAD_KEY: operação com `uploadId` cuja `key` difere de `videos/{publicId}/original`
- 400 UNSUPPORTED_UPLOAD_OPERATION: combinação fora da tabela (ex.: `PUT` sem `uploadId`, `partNumber` sem `uploadId`)
- 404 VIDEO_NOT_FOUND: vídeo inexistente ou de outro canal
- 409 INVALID_VIDEO_STATE: `processingStatus` diferente de `awaiting_upload`
- 401 Unauthorized: access token ausente ou inválido

---

#### POST /videos/{publicId}/upload-completion (SI-03.9)

Ação de transição de estado (`@HttpCode(200)`): confirma o objeto enviado e entrega o vídeo ao processamento. Chamada pelo cliente após o `upload-success` do Uppy (phase-03-videos/TD-05). Faz `HeadObject` em `videos/{publicId}/original` para verificar existência e tamanho (cap de 10 GiB, phase-03-videos/TD-04), grava `size_bytes` provisório com o `ContentLength`, transiciona `awaiting_upload → uploaded` e enfileira `process-video` com `jobId = video.id` (phase-03-videos/TD-02). Idempotente: em `uploaded`, `processing` ou `ready` devolve o estado atual sem efeitos (o `queue.add` com o mesmo `jobId` é ignorado).

**Request headers:**
- Authorization: Bearer {access_token}

**Request path parameters:**
- publicId: string, required

**Request body:** none

**Response 200:** `VideoResponseDto` (normalmente com `processingStatus: "uploaded"`)

**Error responses:**
- 404 VIDEO_NOT_FOUND: vídeo inexistente ou de outro canal
- 409 UPLOAD_INCOMPLETE: `HeadObject` não encontra o objeto original (multipart não concluído)
- 409 INVALID_VIDEO_STATE: `processingStatus = failed` (terminal — phase-03-videos/TD-06, revisão 2026-10-07)
- 422 FILE_TOO_LARGE: `ContentLength` do objeto acima de 10 GiB — o objeto é apagado e o vídeo permanece em `awaiting_upload`
- 401 Unauthorized: access token ausente ou inválido

---

#### GET /videos/{publicId}/media-urls (SI-03.10)

Emite as URLs pré-assinadas de entrega do MP4 normalizado (phase-03-videos/TD-09): uma para streaming (`<video src>`, HTTP Range servido pelo storage — phase-03-videos/TD-08) e uma para download (`ResponseContentDisposition: attachment; filename="{nome original sem extensão}.mp4"`). TTL `VIDEO_URL_TTL_SECONDS` — horas, não minutos (phase-03-videos/TD-09). Na Fase 03 só o dono acessa (phase-03-videos/TD-09: "in Phase 03, only the owner").

**Request headers:**
- Authorization: Bearer {access_token}

**Request path parameters:**
- publicId: string, required

**Response 200:**
- streamUrl: string — presigned GET de `videos/{publicId}/video.mp4` (disposition inline)
- downloadUrl: string — presigned GET do mesmo objeto com disposition `attachment`
- expiresAt: string (ISO-8601 date-time)

**Error responses:**
- 404 VIDEO_NOT_FOUND: vídeo inexistente ou de outro canal
- 409 VIDEO_NOT_READY: `processingStatus` diferente de `ready`
- 401 Unauthorized: access token ausente ou inválido

---

> _BFF tier — frontend-exposed contract. O browser chama a rota same-origin; a rota faz proxy para o upstream conforme o modelo strict-BFF documentado em `next-frontend/CLAUDE.md` (next-frontend-config-base/TD-03). A fonte de verdade do contrato é a cadeia `openapi.json` → `lib/api/types.gen.ts` → `paths`; os endpoints upstream abaixo são os do backend tier desta mesma fase, publicados no `openapi.json` pelo SI de export/sync antes de qualquer Route Handler ser escrito. Todas as rotas: leem o iron-session; sem sessão → 401 sem chamar o upstream; injetam `Authorization: Bearer {session.accessToken}` server-side e passam pelo `withRefresh` single-flight (per phase-02-auth-frontend/TD-02, phase-02-auth-frontend/TD-03)._

#### POST /api/videos (SI-03.20)

**forwards-to:** `POST /videos` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `CreateVideoDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 201 (FE-facing):** `VideoResponseDto` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sessão ausente ou refresh falhou — envelope `{ statusCode: 401, error: "UNAUTHORIZED", message }` *(per phase-02-auth-frontend/TD-03)*

---

#### GET /api/videos/{publicId} (SI-03.21)

**forwards-to:** `GET /videos/{publicId}` *(derived: project contract source)*

**Request headers:** none além do cookie de sessão *(per phase-02-auth-frontend/TD-02)*

**Response 200 (FE-facing):** `VideoResponseDto` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sessão ausente ou refresh falhou *(per phase-02-auth-frontend/TD-03)*

Consumido pelo hook de polling (~3s, sem requests sobrepostos, só enquanto `processingStatus ∈ {uploaded, processing}`) *(per phase-03-videos/TD-11)*.

---

#### POST /api/videos/{publicId}/upload-signatures (SI-03.22)

**forwards-to:** `POST /videos/{publicId}/upload-signatures` *(derived: project contract source)*

**Request headers:**
- Content-Type: application/json *(derived: project contract source)*

**Request body:** `SignUploadRequestDto` *(derived: project contract source — fields per source; not re-spelled to avoid duplication)*

**Response 201 (FE-facing):** `{ url, key? }` — pass-through; é exatamente o retorno esperado pelo `signRequest` do Uppy *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 400 VALIDATION_ERROR / INVALID_UPLOAD_KEY / UNSUPPORTED_UPLOAD_OPERATION: pass-through *(derived: project contract source)*
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 409 INVALID_VIDEO_STATE: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sessão ausente ou refresh falhou *(per phase-02-auth-frontend/TD-03)*

---

#### POST /api/videos/{publicId}/upload-completion (SI-03.23)

**forwards-to:** `POST /videos/{publicId}/upload-completion` *(derived: project contract source)*

**Request body:** none *(derived: project contract source)*

**Response 200 (FE-facing):** `VideoResponseDto` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 409 UPLOAD_INCOMPLETE / INVALID_VIDEO_STATE: pass-through *(derived: project contract source)*
- 422 FILE_TOO_LARGE: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sessão ausente ou refresh falhou *(per phase-02-auth-frontend/TD-03)*

---

#### GET /api/videos/{publicId}/media-urls (SI-03.24)

**forwards-to:** `GET /videos/{publicId}/media-urls` *(derived: project contract source)*

**Response 200 (FE-facing):** `{ streamUrl, downloadUrl, expiresAt }` — pass-through *(derived: project contract source; reshape: none)*

**Error responses (FE-facing):**
- 404 VIDEO_NOT_FOUND: pass-through *(derived: project contract source)*
- 409 VIDEO_NOT_READY: pass-through *(derived: project contract source)*
- 401 UNAUTHORIZED: sessão ausente ou refresh falhou *(per phase-02-auth-frontend/TD-03)*

---

#### Validation Rules — videos

- `filename`: required, string, 1–255 caracteres
- `sizeBytes`: required, integer, min 1, max 10737418240 (10 GiB)
- `contentType`: required, string, começa com `video/`
- `method`: required, um de `PUT`, `POST`, `GET`, `DELETE`
- `key`: required, string não vazia
- `uploadId`: optional, string não vazia
- `partNumber`: optional, integer, 1–10000; só válido junto com `uploadId`
- `publicId` (path): 11 caracteres `[A-Za-z0-9_-]` — formato inválido responde 404 VIDEO_NOT_FOUND (não 400), para não diferenciar formato de existência

### Authorization Matrix

| Endpoint | Anonymous | Authenticated | Owner | Notes |
|----------|-----------|---------------|-------|-------|
| POST /videos | ✗ | ✓ | — | Cria no canal do próprio usuário (`channels.user_id = JWT sub`) |
| GET /videos/{publicId} | ✗ | ✗ | ✓ | Não-dono recebe 404 VIDEO_NOT_FOUND |
| POST /videos/{publicId}/upload-signatures | ✗ | ✗ | ✓ | Não-dono recebe 404 VIDEO_NOT_FOUND |
| POST /videos/{publicId}/upload-completion | ✗ | ✗ | ✓ | Não-dono recebe 404 VIDEO_NOT_FOUND |
| GET /videos/{publicId}/media-urls | ✗ | ✗ | ✓ | Só o dono na Fase 03; a Fase 05 amplia para quem pode assistir (phase-03-videos/TD-09) |
| POST /api/videos | ✗ | ✓ | — | BFF: sem sessão → 401 sem chamar o upstream |
| GET /api/videos/{publicId} | ✗ | ✗ | ✓ | BFF — ownership aplicada pelo upstream |
| POST /api/videos/{publicId}/upload-signatures | ✗ | ✗ | ✓ | BFF — ownership aplicada pelo upstream |
| POST /api/videos/{publicId}/upload-completion | ✗ | ✗ | ✓ | BFF — ownership aplicada pelo upstream |
| GET /api/videos/{publicId}/media-urls | ✗ | ✗ | ✓ | BFF — ownership aplicada pelo upstream |
| Page `/studio/**` | ✗ (redirect `/login`) | ✓ | — | Gate no layout RSC de `/studio`; páginas de vídeo dependem do 404 do upstream para não-donos |
| Object `thumbnails/{publicId}.jpg` | ✓ | ✓ | ✓ | Public-read no storage (phase-03-videos/TD-09) |
| Objects `videos/{publicId}/*` | ✗ | ✗ | ✓ (via presigned URL) | Privados; só URLs pré-assinadas emitidas pela API (phase-03-videos/TD-09) |

### Error Catalog

**Error response format:** herdado de phase-02-auth/TD-07 — `{ statusCode: number, error: string, message: string }` (`ApiErrorEnvelope`). Exceções de domínio novas estendem `DomainException` (`src/common/exceptions/domain.exception.ts`) e são mapeadas pelo `DomainExceptionFilter` global.

| errorCode | HTTP | Message | Trigger |
|-----------|------|---------|---------|
| VIDEO_NOT_FOUND | 404 | Video not found | `publicId` inexistente, com formato inválido ou de outro canal — em qualquer rota `/videos/{publicId}/**` |
| INVALID_VIDEO_STATE | 409 | Operation not allowed in the current processing status | `upload-signatures` com `processingStatus ≠ awaiting_upload`; `upload-completion` com `processingStatus = failed` (terminal, phase-03-videos/TD-06) |
| VIDEO_NOT_READY | 409 | Video is not ready | `media-urls` com `processingStatus ≠ ready` |
| INVALID_UPLOAD_KEY | 400 | Upload key does not belong to this video | `upload-signatures` com `uploadId` e `key` ≠ `videos/{publicId}/original` |
| UNSUPPORTED_UPLOAD_OPERATION | 400 | Unsupported upload operation | `upload-signatures` com combinação fora da tabela do `signRequest` (ex.: `PUT` sem `uploadId`) |
| UPLOAD_INCOMPLETE | 409 | Uploaded file not found | `upload-completion` quando `HeadObject` não encontra o objeto original |
| FILE_TOO_LARGE | 422 | File exceeds the 10GB limit | `upload-completion` com `ContentLength` > 10 GiB (objeto apagado; vídeo continua em `awaiting_upload`) |
| VALIDATION_ERROR | 400 | _array de erros por campo_ | Falha de class-validator em qualquer body (herdado de phase-02-auth) |
| UNAUTHORIZED | 401 | Session expired | Só no BFF: sessão ausente ou refresh falhou (phase-02-auth-frontend/TD-03). No upstream, o guard JWT responde 401 padrão do Nest |

**Processing failure reasons** — não são erros HTTP; são valores de `failureReason` no `VideoResponseDto` quando `processingStatus = failed` (video-metadata/TD-04). O frontend mapeia cada código para copy.

| failureReason | Set by | Trigger |
|---------------|--------|---------|
| not_a_video | Worker | ffprobe lê o arquivo, mas não há stream de vídeo |
| unreadable_file | Worker | ffprobe não consegue ler o arquivo (corrompido / formato não reconhecido) |
| unsupported_media | Worker | Stream de vídeo presente, mas o transcode para MP4 progressivo falha por codec/parâmetros não suportados |
| processing_error | Worker | Falha não-classificada (storage, I/O, ffmpeg inesperado) após esgotar as tentativas do job |
| upload_abandoned | Sweep | Rascunho ainda em `awaiting_upload` 24h após `created_at` (phase-03-videos/TD-04, revisão 2026-10-07) |

### Events/Messages

Fila BullMQ `videos` sobre Redis (phase-03-videos/TD-02). A API só produz; os processors são registrados **apenas** no módulo do entrypoint do worker, que roda em processo e serviço Compose separados com o mesmo codebase Nest (phase-03-videos/TD-03).

#### process-video

**Payload:**

```json
{ "videoId": "uuid" }
```

**Job options:** `jobId = videoId` (idempotência do enqueue — phase-03-videos/TD-02), `attempts: 3`, `backoff: { type: "exponential", delay: 5000 }`.
**Producer:** `VideosService` na API, em `POST /videos/{publicId}/upload-completion`, **depois** do commit de `awaiting_upload → uploaded` (per phase-03-videos/TD-02)
**Consumer:** `VideoProcessor` (`WorkerHost`) no worker (per phase-03-videos/TD-03)
**Trigger:** upload concluído e verificado por `HeadObject`.
**Processing steps** (cada passo chama `job.updateProgress`):
1. Carrega o vídeo; se `processing_status ∉ {uploaded, processing}` encerra sem efeito (reentrega/duplicata).
2. `uploaded → processing`.
3. Baixa `videos/{publicId}/original` para um arquivo temporário (o `screenshots` do fluent-ffmpeg não aceita stream).
4. **Probe 1 (original):** ffprobe → sem stream de vídeo = `not_a_video`; erro de leitura = `unreadable_file` (ambos com `UnrecoverableError`, sem retry). Grava metadados provisórios `duration_ms`, `width`/`height` de exibição (rotação aplicada) (video-metadata/TD-02, video-metadata/TD-03).
5. **Normalização (phase-03-videos/TD-08):** remux `-c copy -movflags +faststart` quando vídeo H.264 e áudio AAC (ou sem áudio); senão transcode para H.264/AAC com `+faststart`. Falha de transcode por codec/parâmetro = `unsupported_media` (sem retry).
6. **Thumbnail:** frame em 10% da duração → `thumbnails/{publicId}.jpg`.
7. Envia o MP4 para `videos/{publicId}/video.mp4` (`Content-Type: video/mp4`).
8. **Probe 2 (saída):** metadados autoritativos `duration_ms`, `width`, `height`, `size_bytes` (video-metadata/TD-02).
9. `processing → ready`; apaga o original (phase-03-videos/TD-08, revisão 2026-10-07).
**Falha terminal:** `processing_status = failed` + `failure_reason`; apaga o original; stderr do ffmpeg só no log do worker (video-metadata/TD-04). Erros transitórios fazem retry; esgotadas as tentativas → `processing_error`. O arquivo temporário é sempre removido.
**Delivery semantics:** at-least-once — o processor é idempotente pelo passo 1 e pelo overwrite determinístico das keys (per phase-03-videos/TD-02).

#### sweep-videos

**Payload:**

```json
{}
```

**Scheduler:** `queue.upsertJobScheduler("sweep-videos", { every: 900000 }, { name: "sweep-videos" })` chamado no boot do worker (idempotente por scheduler ID; API v6 de Job Schedulers).
**Producer:** worker (scheduler)
**Consumer:** `VideoSweepProcessor` no worker
**Trigger:** a cada 15 minutos. Duas varreduras:
1. **Uploads abandonados** (phase-03-videos/TD-04, revisão 2026-10-07): vídeos em `awaiting_upload` com `created_at` < agora − 24h → `failed` com `failure_reason = upload_abandoned`; abort best-effort dos multiparts do prefixo da key (o lifecycle rule de 1 dia continua como backstop).
2. **Dual-write** (phase-03-videos/TD-02): vídeos em `uploaded` com `updated_at` < agora − 5 min → `queue.add("process-video", { videoId }, { jobId: videoId })` de novo (ignorado se o job ainda existe).
**Delivery semantics:** at-least-once; as duas varreduras são idempotentes.

#### Processing-status propagation (Cross-layer)

Não há evento push para o frontend: o status chega por short polling de `GET /api/videos/{publicId}` (~3s, sem requests sobrepostos, para em `ready`/`failed`) (phase-03-videos/TD-11, revisão 2026-10-06). O `job.updateProgress` fica restrito à observabilidade do worker.

### UI Contracts

> _Escopo de UI da Fase 03 (resoluções de validação): o formulário de metadados (Details/Title/Description, "Change Thumbnail", Category, Visibility, Cancel/Save Changes) e os componentes `components/ui/textarea.tsx (new)`, `components/ui/select.tsx (new)` e `components/studio/privacy-option.tsx (new)` ficam **fora** (OQ-1, Fase 04). `components/layout/subscriptions-channel-list.tsx (new)` **não** é materializado — a SideNav é renderizada sem o bloco de inscrições (OQ-2). Não há top header/app bar nesta fase; links da SideNav para rotas de fases futuras (Home, Subscriptions, Your videos, Liked videos) ficam desabilitados (OQ-12). Dados de exemplo e nomes de camada do Figma não são copiados (OQ-13)._

#### Screen: Tela de upload de vídeo

**Route:** `/studio/upload`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142 (node `dfxpXk5c5urLHMh4axx5cq:2728:2142`)
**Purpose:** "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance"

**Auth requirement:** Authenticated _(source: §Authorization Matrix — `POST /api/videos`; anônimo é redirecionado para `/login` pelo layout de `/studio`, OQ-12)_

**Rendering strategy:** página RSC estática (heading + layout) compondo o Client Component `UploadDropzone`; a instância Uppy headless vive num Client Provider montado no layout RSC de `/studio`, para sobreviver à navegação client-side até `/studio/videos/[publicId]` _(source: phase-02-auth-frontend/TD-06 — RSC + Client Provider; phase-03-videos/TD-05 — Uppy 6 headless; OQ-6)_

**Reused DS components:**
- `components/layout/side-nav.tsx (new)` — SideNav — App chrome. Componente DS do Figma "SideNav" com variantes collapsed/expanded. Decisão do usuário: construído nesta fase só com links (sem dados do servidor)
- `components/layout/side-nav-item.tsx (new)` — SideNavItem — Navegação client-side (Next.js `<Link>`); estado ativo/selecionado no Figma. Links para rotas de fases futuras renderizam desabilitados (OQ-12)
- `components/studio/upload-dropzone.tsx (new)` — UploadDropzone — Camada nomeada "Channel card" no Figma. Área de drag-and-drop dirigida pelo Uppy headless (TD-05); ao receber o arquivo, pré-cadastra o rascunho e inicia o upload multipart presigned (TD-04)
- `components/ui/card.tsx` — Card — Fundo/borda da dropzone; State-layer (I154:1731;143:1247) sugere hover/drag-over
- `components/icons/upload-icon.tsx (new)` — UploadIcon — Ícone SVG de upload (48px)
- `components/ui/button.tsx` — SelectFilesButton — Abre o seletor de arquivos nativo; a seleção dispara o pré-cadastro + upload (mesmo fluxo da dropzone)

**Server-connected components:**
- `UploadDropzone` — verbs: Pré-cadastrar o vídeo como rascunho ao selecionar ou soltar o arquivo; Iniciar o envio do arquivo de vídeo (até 10GB) para o armazenamento; Obter o identificador público único do vídeo recém-criado para redirecionar à sua página | endpoint: `POST /api/videos` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection); o envio começa aqui pelo Uppy via `POST /api/videos/{publicId}/upload-signatures` (§API Contracts → BFF tier) | reuse: `components/studio/upload-dropzone.tsx (new)` _(E2E: per `e2e-video-upload-fixtures/TD-01`, `e2e-video-upload-fixtures/TD-02`)_
- `SelectFilesButton` — verbs: Pré-cadastrar o vídeo como rascunho ao selecionar ou soltar o arquivo; Iniciar o envio do arquivo de vídeo (até 10GB) para o armazenamento | endpoint: `POST /api/videos` (§API Contracts → BFF tier) | reuse: `components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: entre a seleção e o redirect, dropzone desabilitada com spinner (OQ-4)
- Empty: estado inicial — ícone, título "Drag and drop a video file to upload", helper "Your videos will be private until you publish them." e botão "Select file" (copy no singular, OQ-5)
- Success: rascunho criado → `router.push("/studio/videos/{publicId}")` com o upload já em andamento no provider
- Error: texto de erro inline dentro da dropzone para arquivo acima de 10GB, tipo não suportado e falha no pré-cadastro do rascunho (OQ-4)

*Interactions:*
- Drag-over na dropzone → borda destacada (OQ-4)
- Soltar arquivo / escolher no seletor → `uppy.addFile` (restrições `maxNumberOfFiles: 1`, `maxFileSize: 10 GiB`, `allowedFileTypes: ["video/*"]`) → `POST /api/videos` com `filename`/`sizeBytes`/`contentType` → provider inicia o upload para o `publicId` retornado → navegação para `/studio/videos/{publicId}`
- Violação de restrição do Uppy → erro inline, sem chamar o BFF
- `SelectFilesButton` click → abre o seletor nativo (`accept="video/*"`, um arquivo)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VALIDATION_ERROR` | Erro inline na dropzone (mesma área das restrições client-side) |
| `UNAUTHORIZED` | Redirect para `/login` |
| _erro de rede / 5xx_ | Erro inline "falha no pré-cadastro" na dropzone, permitindo nova tentativa |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules — videos)_

- `sizeBytes`: max 10737418240 (10 GiB) — via `restrictions.maxFileSize`
- `contentType`: começa com `video/` — via `restrictions.allowedFileTypes: ["video/*"]`
- `filename`: 1–255 caracteres — truncar não é permitido; arquivo com nome acima de 255 é rejeitado inline

**Accessibility notes:**
- Dropzone operável por teclado (o `SelectFilesButton` é o caminho acessível); ícones decorativos com `aria-hidden`
- Mensagens de erro e o estado de carregamento anunciados por live region (`role="alert"` / `aria-live="polite"`)

#### Screen: Tela do vídeo no studio — upload em andamento

**Route:** `/studio/videos/[publicId]`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140 (node `dfxpXk5c5urLHMh4axx5cq:2734:2140`)
**Purpose:** "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance"

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `GET /api/videos/{publicId}`, `POST /api/videos/{publicId}/upload-signatures`, `POST /api/videos/{publicId}/upload-completion`)_

**Rendering strategy:** página RSC assíncrona — lê o vídeo no upstream server-side com o token da sessão (`notFound()` em 404 VIDEO_NOT_FOUND) e entrega o `VideoResponseDto` inicial a Client Components; o progresso vem do provider Uppy do layout e o status do hook de polling hand-rolled _(source: phase-02-auth-frontend/TD-06; phase-03-videos/TD-05; phase-03-videos/TD-11)_. As duas telas inventariadas para esta rota são estados da mesma página, escolhidos por `processingStatus` + presença de upload ativo no provider.

**Reused DS components:**
- `components/layout/side-nav.tsx (new)` — SideNav — see screen: Tela de upload de vídeo
- `components/layout/side-nav-item.tsx (new)` — SideNavItem — Navegação client-side (Next.js `<Link>`). As rotas de destino não fazem parte da Fase 03
- `components/ui/card.tsx` — Card — fundo/borda do container principal
- `components/studio/upload-progress-panel.tsx (new)` — UploadProgressPanel — Painel de envio em andamento: nome do arquivo + "Uploading... 84%" + rótulo de status + barra de progresso. É alimentado pela instância Uppy headless (TD-05) que envia as partes direto ao storage via multipart pré-assinado (TD-04)
- `components/icons/video-file-icon.tsx (new)` — VideoFileIcon — Ícone DS "video_file"
- `components/studio/video-status-badge.tsx (new)` — UploadStatusLabel — Slot do status do vídeo (TD-06). No Figma é um `<p>` com a cor `--link`, não um badge
- `components/ui/progress.tsx (new)` — ProgressLinear — Primitivo DS determinado (Track I157:1939;2924:253 + Indicator I157:1939;2924:254)
- `components/studio/video-details-card.tsx (new)` — CardVideoConfig — Painel lateral com os dados do rascunho pré-cadastrado: preview, link único, nome do arquivo e qualidade. Lido do backend pelo `publicId` da rota
- `components/studio/video-player.tsx (new)` — VideoPreview — Neste frame é um placeholder preto com ícone de play e "0:00". Ainda não há mídia reproduzível durante o upload
- `components/studio/copy-link-button.tsx (new)` — CopyLinkButton — Copia o link para a área de transferência (só no client). No Figma é um `i` > svg, não uma instância de "Icon button" (reusa `components/ui/icon-button.tsx` internamente, per observação de reuse do inventário)
- `components/ui/section-header.tsx (new)` — SectionHeader "Thumbnail" — Componente DS "SectionHeader" (Title + Description)
- `components/studio/thumb-upload.tsx (new)` — ThumbUpload — Placeholder de thumbnail (descrição DS: "shown on upload screens before processing completes")

**Server-connected components:**
- `UploadProgressPanel` — verbs: Enviar o arquivo do vídeo direto ao armazenamento em partes, de forma retomável; Exibir o progresso do envio do arquivo de vídeo; Concluir o envio e marcar o vídeo como enviado para processamento; Acompanhar o status de processamento do vídeo após o envio | endpoint: `POST /api/videos/{publicId}/upload-signatures`, `POST /api/videos/{publicId}/upload-completion`, `GET /api/videos/{publicId}` (§API Contracts → BFF tier — see for `forwards-to` + request/response/projection) | reuse: `components/studio/upload-progress-panel.tsx (new)` _(E2E: storage per `e2e-video-upload-fixtures/TD-01`; estado dos handlers per `e2e-video-upload-fixtures/TD-02`)_
- `CardVideoConfig` — verbs: Exibir os dados do rascunho do vídeo pré-cadastrado; Exibir a URL única do vídeo | endpoint: `GET /api/videos/{publicId}` (§API Contracts → BFF tier; carga inicial via RSC + atualizações do polling) | reuse: `components/studio/video-details-card.tsx (new)`

**Behaviors:**

*Rendered states:*
- Loading: render inicial já vem com o vídeo do RSC (sem skeleton de página); ThumbUpload em skeleton até a thumbnail existir (OQ-10)
- Empty: not applicable
- Success (`awaiting_upload` + upload ativo no provider): nome do arquivo, "Uploading... N%" e barra com o mesmo valor (OQ-13), rótulo "Uploading"
- Success (`uploaded` / `processing`): rótulo de status com a copy do valor TD-06 correspondente; polling ativo; metadados mostram "—" até o servidor devolver valores (provisórios após o primeiro probe — OQ-10, video-metadata/TD-02, video-metadata/TD-05)
- Interrupted (`awaiting_upload` sem upload ativo — reload ou acesso direto): estado "Envio interrompido — selecione o arquivo novamente" com seletor de arquivo que re-anexa ao **mesmo** rascunho; a reanexação inicia um **novo** multipart (phase-03-videos/TD-04, revisões 2026-10-07; OQ-6)
- Error (`failed`): mensagem mapeada do `failureReason` + link para `/studio/upload`; nenhuma ação de reanexar (phase-03-videos/TD-06, revisão 2026-10-07; OQ-3)
- Sempre: heading estático "Video details" (OQ-7); VideoLink mostra a URL completa `/v/{publicId}` como texto copiável, sem navegação (OQ-11); a copy "Checks complete. No issues found." não é usada (OQ-3)

*Interactions:*
- `upload-progress` do Uppy → atualiza percentual e `ProgressLinear` do `UploadProgressPanel`
- `upload-success` do Uppy → `POST /api/videos/{publicId}/upload-completion` → o `VideoResponseDto` retornado (`uploaded`) alimenta o hook de status, que passa a fazer polling
- Polling (~3s, sem requests sobrepostos) enquanto `processingStatus ∈ {uploaded, processing}`; para em `ready`/`failed` (phase-03-videos/TD-11)
- `ready` → a página troca para o estado "upload concluído" (screen seguinte) sem reload
- `CopyLinkButton` click → copia a URL do VideoLink para o clipboard
- Seletor do estado "Envio interrompido" → provider inicia o upload do novo arquivo para o mesmo `publicId`

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VIDEO_NOT_FOUND` | `notFound()` no RSC (página 404) |
| `INVALID_VIDEO_STATE` | Recarrega o vídeo (`GET`) e renderiza o estado atual (ex.: `failed`) |
| `UPLOAD_INCOMPLETE` | Mensagem no painel com opção de selecionar o arquivo novamente (mesmo fluxo do estado "Envio interrompido") |
| `FILE_TOO_LARGE` | Mensagem no painel "arquivo acima de 10GB"; vídeo continua em `awaiting_upload` |
| `UNAUTHORIZED` | Redirect para `/login` |
| _erro de rede no upload_ | Retomada automática do Uppy dentro da sessão; sem botões de pausar/cancelar (sem cancelamento explícito nesta fase) |

**Client-side validation mirror:** _(source: §API Contracts → Validation Rules — videos)_

- Reanexação usa as mesmas restrições do Uppy: um arquivo, `maxFileSize` 10 GiB, `allowedFileTypes: ["video/*"]`

**Accessibility notes:**
- `ProgressLinear` com `role="progressbar"` e `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
- Mudanças de status anunciadas por live region
- `CopyLinkButton` é só ícone e precisa de `aria-label`

#### Screen: Tela do vídeo no studio — upload concluído (player + download)

**Route:** `/studio/videos/[publicId]`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196 (node `dfxpXk5c5urLHMh4axx5cq:2734:2196`)
**Purpose:** "Reprodução via streaming (sem necessidade de download completo)"

**Auth requirement:** Authenticated+Owner _(source: §Authorization Matrix — `GET /api/videos/{publicId}`, `GET /api/videos/{publicId}/media-urls`)_

**Rendering strategy:** mesma página RSC assíncrona da tela anterior (estado `ready`); as URLs de mídia são buscadas pelo Client Component via BFF quando o status chega a `ready` (ou no carregamento, se já estiver `ready`) _(source: phase-02-auth-frontend/TD-06; phase-03-videos/TD-09; phase-03-videos/TD-11)_

**Reused DS components:**
- `components/layout/side-nav.tsx (new)` — SideNav — see screen: Tela de upload de vídeo
- `components/ui/card.tsx` — Card — Container principal
- `components/studio/video-details-card.tsx (new)` — CardVideoConfig — Painel de prévia com dados do vídeo vindos do servidor: link único, nome do arquivo, qualidade e duração
- `components/studio/video-player.tsx (new)` — Video player — `<video>` simples com HTTP Range (TD-08), servido por presigned GET emitida pela API (TD-09)
- `components/studio/copy-link-button.tsx (new)` — CopyLinkIcon — Copia para o clipboard no cliente
- `components/ui/section-header.tsx (new)` — SectionHeader "Thumbnail" — Título + descrição
- `components/studio/thumb-upload.tsx (new)` — ThumbUpload — Mostra a thumbnail gerada automaticamente, com URL estável public-read (TD-09)
- `components/studio/processing-status.tsx (new)` — ProcessingStatus — Mostra o status de processamento do servidor via short polling no BFF (TD-11)
- `components/ui/button.tsx` — DownloadButton — **Adicionado por decisão do usuário** (2026-10-06): download nesta tela, implementado sem design. Fica no CardVideoConfig, habilitado só em `ready`; usa presigned GET com disposition `attachment` (TD-09). Exclusivo do dono na fase 03
- `components/icons/download-icon.tsx (new)` — ícone do DownloadButton — derivado da resolução OQ-9 ("labeled 'Download' with a download icon"); não há node Figma

**Server-connected components:**
- `Video player` — verbs: Reproduzir o vídeo via streaming na prévia do studio | endpoint: `GET /api/videos/{publicId}/media-urls` (§API Contracts → BFF tier — `streamUrl`) | reuse: `components/studio/video-player.tsx (new)`
- `CardVideoConfig` — verbs: Exibir a URL única do vídeo para compartilhamento; Exibir metadados extraídos do vídeo (duração e qualidade); Exibir o nome original do arquivo do vídeo pré-cadastrado | endpoint: `GET /api/videos/{publicId}` (§API Contracts → BFF tier) | reuse: `components/studio/video-details-card.tsx (new)`
- `ThumbUpload` — verbs: Exibir a thumbnail gerada automaticamente | endpoint: `GET /api/videos/{publicId}` (§API Contracts → BFF tier — `thumbnailUrl`) | reuse: `components/studio/thumb-upload.tsx (new)`
- `ProcessingStatus` — verbs: Acompanhar o status de processamento do vídeo até um estado terminal | endpoint: `GET /api/videos/{publicId}` (§API Contracts → BFF tier) | reuse: `components/studio/processing-status.tsx (new)`
- `DownloadButton` — verbs: Baixar o arquivo do vídeo processado | endpoint: `GET /api/videos/{publicId}/media-urls` (§API Contracts → BFF tier — `downloadUrl`) | reuse: `components/ui/button.tsx`

**Behaviors:**

*Rendered states:*
- Loading: enquanto as media URLs não chegam, player mostra o poster (thumbnail) e o DownloadButton fica desabilitado
- Empty: not applicable
- Success: `<video controls>` nativo com `poster = thumbnailUrl` e `src = streamUrl` (OQ-8); duração formatada a partir de `durationMs` (`m:ss` / `h:mm:ss`) e rótulo de qualidade derivado do lado menor de `width`/`height` (ex.: "1080p HD") (video-metadata/TD-03); nome original do arquivo; thumbnail em ThumbUpload; ProcessingStatus com a copy de `ready`; DownloadButton secundário "Download" com ícone, abaixo do VideoLink, `href = downloadUrl` (OQ-9)
- Error: falha ao obter as media URLs → player sem `src` com mensagem curta e DownloadButton desabilitado

*Interactions:*
- `DownloadButton` click → navega para `downloadUrl` (o storage responde com `Content-Disposition: attachment`)
- `CopyLinkButton` click → copia a URL do VideoLink
- Controles nativos do `<video>` (play/pause/seek via HTTP Range)

**Error Catalog → UX mapping:**

| errorCode (from §Error Catalog) | UX treatment |
|---------------------------------|--------------|
| `VIDEO_NOT_FOUND` | `notFound()` no RSC (página 404) |
| `VIDEO_NOT_READY` | Mantém player sem `src` e DownloadButton desabilitado; o polling continua até `ready` |
| `UNAUTHORIZED` | Redirect para `/login` |

**Client-side validation mirror:** _not applicable — a tela não envia bodies._

**Accessibility notes:**
- `<video>` nativo mantém os controles acessíveis do browser
- DownloadButton desabilitado expõe o estado (`disabled` / `aria-disabled`); ícone decorativo com `aria-hidden`
- `CopyLinkButton` precisa de `aria-label`

### UI ↔ API Traceability Matrix

| Verb | Component | Screen | Endpoint (from API Contracts) | TD ref |
|------|-----------|--------|-------------------------------|--------|
| Pré-cadastrar o vídeo como rascunho ao selecionar ou soltar o arquivo | UploadDropzone + SelectFilesButton | /studio/upload | POST /api/videos → forwards-to POST /videos | phase-03-videos/TD-06 |
| Iniciar o envio do arquivo de vídeo (até 10GB) para o armazenamento | UploadDropzone + SelectFilesButton | /studio/upload | POST /api/videos/{publicId}/upload-signatures → forwards-to POST /videos/{publicId}/upload-signatures | phase-03-videos/TD-04, phase-03-videos/TD-05 |
| Obter o identificador público único do vídeo recém-criado para redirecionar à sua página | UploadDropzone | /studio/upload | POST /api/videos → forwards-to POST /videos | phase-03-videos/TD-07 |
| Enviar o arquivo do vídeo direto ao armazenamento em partes, de forma retomável | UploadProgressPanel | /studio/videos/[publicId] | POST /api/videos/{publicId}/upload-signatures → forwards-to POST /videos/{publicId}/upload-signatures | phase-03-videos/TD-04, phase-03-videos/TD-05 |
| Exibir o progresso do envio do arquivo de vídeo | UploadProgressPanel | /studio/videos/[publicId] | — _(estado local do Uppy; sem endpoint)_ | phase-03-videos/TD-05 |
| Concluir o envio e marcar o vídeo como enviado para processamento | UploadProgressPanel | /studio/videos/[publicId] | POST /api/videos/{publicId}/upload-completion → forwards-to POST /videos/{publicId}/upload-completion | phase-03-videos/TD-02, phase-03-videos/TD-06 |
| Acompanhar o status de processamento do vídeo após o envio | UploadProgressPanel (slot UploadStatusLabel) | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-11 |
| Exibir os dados do rascunho do vídeo pré-cadastrado | CardVideoConfig | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-06 |
| Exibir a URL única do vídeo | CardVideoConfig (VideoLink) | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-07 |
| Reproduzir o vídeo via streaming na prévia do studio | Video player (in CardVideoConfig) | /studio/videos/[publicId] | GET /api/videos/{publicId}/media-urls → forwards-to GET /videos/{publicId}/media-urls | phase-03-videos/TD-08, phase-03-videos/TD-09 |
| Exibir a URL única do vídeo para compartilhamento | CardVideoConfig (VideoLink) | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-07 |
| Exibir metadados extraídos do vídeo (duração e qualidade) | CardVideoConfig | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | video-metadata/TD-01, video-metadata/TD-02, video-metadata/TD-03, video-metadata/TD-05 |
| Exibir o nome original do arquivo do vídeo pré-cadastrado | CardVideoConfig (Filename block) | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-06 |
| Exibir a thumbnail gerada automaticamente | ThumbUpload | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} (`thumbnailUrl`, objeto public-read) | phase-03-videos/TD-09, phase-03-videos/TD-10 |
| Acompanhar o status de processamento do vídeo até um estado terminal | ProcessingStatus | /studio/videos/[publicId] | GET /api/videos/{publicId} → forwards-to GET /videos/{publicId} | phase-03-videos/TD-11, video-metadata/TD-04 |
| Baixar o arquivo do vídeo processado | DownloadButton (in CardVideoConfig) | /studio/videos/[publicId] | GET /api/videos/{publicId}/media-urls → forwards-to GET /videos/{publicId}/media-urls | phase-03-videos/TD-09 |

_Capabilities marked in `## Non-UI / Deferred Capabilities` are excluded from this matrix._

---

## Dependency Map

```
Backend (nestjs-project)

SI-03.1 (root — infra: deps, config, storage + redis no Compose, ffmpeg)
├── SI-03.2 — depends on SI-03.1 (entidade precisa das deps/config)
│   └── SI-03.12 — depends on SI-03.1, SI-03.2 (adapter FFmpeg usa os enums de failure_reason)
├── SI-03.3 — depends on SI-03.1 (storage precisa da config S3 e do serviço `storage`)
│   └── SI-03.5 — depends on SI-03.2, SI-03.3 (service precisa da entidade e das keys/URL pública)
│       └── SI-03.6 — depends on SI-03.4, SI-03.5 (controller sobre o service; módulo importa a fila)
│           └── SI-03.7 — depends on SI-03.6 (mesmo controller)
│               └── SI-03.8 — depends on SI-03.7 (assinatura reusa o lookup com ownership)
│                   └── SI-03.9 — depends on SI-03.8 (completion só faz sentido após o multipart assinado)
│                       └── SI-03.10 — depends on SI-03.9 (media URLs exigem o fluxo até `ready`)
├── SI-03.4 — depends on SI-03.1 (fila precisa do Redis e da config)
│   └── SI-03.35 — depends on SI-03.1, SI-03.4 (amendment: prefixo próprio do BullMQ nos testes, TD-02 revisão 2026-10-15)
├── SI-03.34 — depends on SI-03.1 (amendment: storage de dev/test em RustFS, TD-01 revisão 2026-10-15)
└── SI-03.11 — depends on SI-03.3, SI-03.4 (worker importa storage e fila)
    └── SI-03.13 — depends on SI-03.9, SI-03.11, SI-03.12 (processor consome o job enfileirado no completion)
        └── SI-03.14 — depends on SI-03.13 (sweep é roteado pelo mesmo processor da fila)

SI-03.15 — depends on SI-03.6, SI-03.7, SI-03.8, SI-03.9, SI-03.10 (export do OpenAPI após todos os endpoints)

Frontend (next-frontend) — cross-layer edge: SI-03.16 depends on SI-03.15 (backend)

SI-03.16 — depends on SI-03.15 (aliases derivados do `types.gen.ts` regenerado)
├── SI-03.17 — depends on SI-03.16 (helper tipado pelos aliases)
├── SI-03.18 — depends on SI-03.16 (fixtures tipadas)
│   ├── SI-03.19 — depends on SI-03.18 (fake de storage usa a origem reservada exportada pelos handlers)
│   ├── SI-03.20 — depends on SI-03.17, SI-03.18 (POST /api/videos)
│   ├── SI-03.21 — depends on SI-03.17, SI-03.18 (GET /api/videos/{publicId})
│   │   └── SI-03.27 — depends on SI-03.21 (polling usa a rota de leitura)
│   ├── SI-03.22 — depends on SI-03.17, SI-03.18 (upload-signatures)
│   ├── SI-03.23 — depends on SI-03.17, SI-03.18 (upload-completion)
│   │   └── SI-03.26 — depends on SI-03.22, SI-03.23, SI-03.25, SI-03.33 (provider assina partes e conclui o upload)
│   │       └── SI-03.29 — depends on SI-03.0.4, SI-03.26 (layout compõe SideNav + provider)
│   └── SI-03.24 — depends on SI-03.17, SI-03.18 (media-urls)
└── SI-03.28 — depends on SI-03.16 (format usa os tipos derivados do contrato)
SI-03.25 (root — infra: @uppy/core + @uppy/aws-s3)
└── SI-03.33 — depends on SI-03.25 (amendment: instala @uppy/react, TD-05 revisão 2026-10-14)

Bootstrap (next-frontend)

SI-03.0.1 (root — shadcn progress)
├── SI-03.0.2 — depends on SI-03.0.1 (testa o primitive instalado)
└── SI-03.0.5 — depends on SI-03.0.1 (painel de progresso usa `progress.tsx`)
    └── SI-03.0.6 — depends on SI-03.0.5 (card compõe `copy-link-button.tsx`)
SI-03.0.3 (root — section-header)
SI-03.0.4 (root — ícones + SideNav)

Telas

SI-03.30.0 — depends on SI-03.0.4, SI-03.0.5 (audit lê os componentes da tela de upload)
└── SI-03.30a — depends on SI-03.30.0 + SI-03.0.4, SI-03.0.5, SI-03.29
    └── SI-03.30b — depends on SI-03.30a, SI-03.20, SI-03.26, SI-03.16, SI-03.19

SI-03.31.0 — depends on SI-03.0.1 … SI-03.0.6 (audit lê todos os componentes do studio)
└── SI-03.31a — depends on SI-03.31.0 + SI-03.0.1 … SI-03.0.6, SI-03.29
    └── SI-03.31b — depends on SI-03.31a, SI-03.21, SI-03.23, SI-03.26, SI-03.27, SI-03.28, SI-03.19

SI-03.32.0 — depends on SI-03.31.0 (prior decisions da mesma rota), SI-03.0.3 … SI-03.0.6
└── SI-03.32a — depends on SI-03.32.0 + SI-03.0.3 … SI-03.0.6, SI-03.31a
    └── SI-03.32b — depends on SI-03.32a, SI-03.31b, SI-03.24, SI-03.28
```

**Ordem sugerida de execução:** backend `SI-03.1 → SI-03.15` (o worker `SI-03.11`–`SI-03.14` pode correr em paralelo aos endpoints depois de `SI-03.9`); bootstrap `SI-03.0.1 → SI-03.0.6` e `SI-03.25` (+ amendment `SI-03.33`, antes de `SI-03.26`) a qualquer momento; frontend `SI-03.16 → SI-03.29` após `SI-03.15`; telas por último, na ordem `30 → 31 → 32`.

---

## Deliverables

- [ ] SI-03.0.1 — Infra: install batch shadcn primitives
- [ ] SI-03.0.2 — Tests shadcn batch (progress)
- [ ] SI-03.0.3 — Custom-ui: section-header.tsx
- [ ] SI-03.0.4 — Custom-business simple group: download-icon + upload-icon + video-file-icon + side-nav-item + side-nav
- [ ] SI-03.0.5 — Custom-business simple group: copy-link-button + processing-status + thumb-upload + upload-dropzone + upload-progress-panel
- [ ] SI-03.0.6 — Custom-business simple group: video-details-card + video-player + video-status-badge
- [ ] SI-03.1 — Infra: dependências, namespaces de config e serviços de storage e fila no Compose
- [ ] SI-03.2 — Entidade Video e migration CreateVideos
- [ ] SI-03.3 — Módulo de storage S3 (clients, keys, presign e configuração do bucket)
- [ ] SI-03.4 — Módulo de fila BullMQ (conexão Redis e fila `videos`)
- [ ] SI-03.5 — VideosService: rascunho, ownership e mapeamento de resposta
- [ ] SI-03.6 — Endpoint POST /videos
- [ ] SI-03.7 — Endpoint GET /videos/{publicId}
- [ ] SI-03.8 — Endpoint POST /videos/{publicId}/upload-signatures
- [ ] SI-03.9 — Endpoint POST /videos/{publicId}/upload-completion
- [ ] SI-03.10 — Endpoint GET /videos/{publicId}/media-urls
- [ ] SI-03.11 — Entrypoint do worker e serviço `video-worker` no Compose
- [ ] SI-03.12 — Adapter FFmpeg (probe, normalização e thumbnail)
- [ ] SI-03.13 — Processor `process-video` (pipeline de processamento)
- [ ] SI-03.14 — Scheduler e processor `sweep-videos`
- [ ] SI-03.15 — Export e sync do contrato OpenAPI para o frontend
- [ ] SI-03.16 — Aliases de contrato de vídeos em `lib/api/contracts.ts`
- [ ] SI-03.17 — Helper de chamada autenticada ao upstream (`lib/auth/authorized-upstream.ts`)
- [ ] SI-03.18 — Handlers MSW de vídeos (`mocks/handlers/videos.ts`)
- [ ] SI-03.19 — Fake de storage no Playwright e documentação das exceções de E2E
- [ ] SI-03.20 — BFF Route Handler: POST /api/videos
- [ ] SI-03.21 — BFF Route Handler: GET /api/videos/{publicId}
- [ ] SI-03.22 — BFF Route Handler: POST /api/videos/{publicId}/upload-signatures
- [ ] SI-03.23 — BFF Route Handler: POST /api/videos/{publicId}/upload-completion
- [ ] SI-03.24 — BFF Route Handler: GET /api/videos/{publicId}/media-urls
- [ ] SI-03.25 — Infra: instalar `@uppy/core` e `@uppy/aws-s3`
- [ ] SI-03.26 — Provider de upload (Uppy headless) para o studio
- [ ] SI-03.27 — Hook de polling `useVideoStatus`
- [ ] SI-03.28 — Utilitários de apresentação de vídeo (`lib/videos/format.ts`)
- [ ] SI-03.29 — Layout de `/studio` (auth gate, SideNav e provider de upload)
- [ ] SI-03.30.0 — Drift audit: Tela de upload de vídeo
- [ ] SI-03.30a — Tela de upload de vídeo (visual shell)
- [ ] SI-03.30b — Tela de upload de vídeo (lógica & wiring)
- [ ] SI-03.31.0 — Drift audit: Tela do vídeo no studio — upload em andamento
- [ ] SI-03.31a — Tela do vídeo no studio — upload em andamento (visual shell)
- [ ] SI-03.31b — Tela do vídeo no studio — upload em andamento (lógica & wiring)
- [ ] SI-03.32.0 — Drift audit: Tela do vídeo no studio — upload concluído (player + download)
- [ ] SI-03.32a — Tela do vídeo no studio — upload concluído (visual shell)
- [ ] SI-03.32b — Tela do vídeo no studio — upload concluído (lógica & wiring)
- [ ] SI-03.33 (amendment of SI-03.25) — Infra: instalar `@uppy/react`
- [ ] SI-03.34 (amendment of SI-03.1) — Infra: storage de dev/test em RustFS
- [ ] SI-03.35 (amendment of SI-03.4) — Isolar a fila dos testes com um `prefix` próprio do BullMQ

**Per-screen deliverables:**

- [ ] Screen Tela de upload de vídeo (/studio/upload) is routable
- [ ] Screen Tela de upload de vídeo (/studio/upload) renders loading, success, and error states
- [ ] Screen Tela de upload de vídeo (/studio/upload) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Tela do vídeo no studio — upload em andamento (/studio/videos/[publicId]) is routable
- [ ] Screen Tela do vídeo no studio — upload em andamento (/studio/videos/[publicId]) renders loading, success, and error states (incl. "Envio interrompido" e `failed`)
- [ ] Screen Tela do vídeo no studio — upload em andamento (/studio/videos/[publicId]) passes component tests (per testing-guide-next-frontend layers)
- [ ] Screen Tela do vídeo no studio — upload concluído (player + download) (/studio/videos/[publicId]) is routable
- [ ] Screen Tela do vídeo no studio — upload concluído (player + download) (/studio/videos/[publicId]) renders loading, success, and error states
- [ ] Screen Tela do vídeo no studio — upload concluído (player + download) (/studio/videos/[publicId]) passes component tests (per testing-guide-next-frontend layers)

**Full test suites:**

- [ ] Backend tests pass (`cd nestjs-project && docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] Backend E2E tests pass (`cd nestjs-project && docker compose exec nestjs-api npm run test:e2e`)
- [ ] Backend type check passes (`cd nestjs-project && docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] Backend lint passes (`cd nestjs-project && docker compose exec nestjs-api npm run lint`)
- [ ] Frontend tests pass (`cd next-frontend && docker compose exec next-frontend npm test`)
- [ ] Frontend E2E tests pass (`cd next-frontend && npx playwright test` — on the host, with the dev server running inside the container with `MSW_ENABLED=true`)
- [ ] Frontend type check passes (`cd next-frontend && docker compose exec next-frontend npx tsc --noEmit`)
- [ ] Frontend lint passes (`cd next-frontend && docker compose exec next-frontend npm run lint`)
- [ ] OpenAPI contract is fresh (`bash scripts/sync-openapi.sh` + `docker compose exec next-frontend npm run openapi:types` produce no diff)
