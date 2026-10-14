# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 35/45 completed

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
- **Status:** completed
- **Tests:** 2 new passing (`queue.module.spec.ts`); `videos.module.spec.ts` ajustado (1 passing); suite completa 174 passing; e2e 52 passing; `tsc --noEmit` exit 0
- **Observations:**
  - **Desvio de versão:** `@nestjs/bullmq@^12.0.0` (library-refs.md / SI-03.1) é ESM-only (`"type": "module"`), então o Jest CommonJS não carrega o pacote (`SyntaxError: Unexpected token 'export'`). Fixado em `^11.0.5` — CJS e dentro da faixa que o TD-02 aceita (11.0.5/12.0.0, Nest 11 + bullmq 6), coerente com a justificativa do TD de "fits the CommonJS build". `library-refs.md` e o texto de SI-03.1 ainda dizem `^12.0.0`.
  - **Dependência faltante no plano:** `bullmq` 6 trata `ioredis` como peer opcional e falha ao criar a `Queue` sem ele ("could not load the optional 'ioredis' package"). Instalado `ioredis@^5.11.1` (peer `>=5.0.0`); não consta em SI-03.1 nem em library-refs.
  - O teste de conexão usa `queue.waitUntilReady()` + `getJobCounts()` (bullmq 6 removeu o getter `queue.client`). Fica como `*.spec.ts` conforme o plano, abrindo conexão real com o Redis do Compose (mesmo precedente de `channels.module.spec.ts` com o banco).
  - `VideosModule` importa `QueueModule`, então `videos.module.spec.ts` agora precisa de `ConfigModule.forRoot({ isGlobal: true, load: [queueConfig] })`. Nenhum processor é registrado na API.

### SI-03.5 — VideosService: rascunho, ownership e mapeamento de resposta
- **Status:** completed
- **Tests:** 38 new passing (`public-id.util.spec.ts` 15, `video-response.dto.spec.ts` 7, `videos.service.spec.ts` 9, `videos.service.integration-spec.ts` 5) + 2 em `channels.service.integration-spec.ts` (`findByUserId`); suite completa 212 passing; e2e 52 passing; `tsc --noEmit` exit 0
- **Observations:**
  - `toVideoResponse(video, publicUrl)` recebe a função de URL pública como segundo argumento (o plano cita só `toVideoResponse(video)`): `thumbnailUrl` depende de `S3_PUBLIC_ENDPOINT` + bucket, então a função continua pura e o `VideosService.toResponse(video)` injeta `StorageService.publicUrl`.
  - `createDraft` recebe `sizeBytes`/`contentType` só como entrada já validada (interface `CreateDraftInput`); nenhum dos dois é persistido (o tamanho vem do `HeadObject` na conclusão). O `CreateVideoDto` fica para SI-03.6.
  - Usuário sem canal em `createDraft` lança `Error` genérico (500): todo usuário recebe canal no registro e o Error Catalog não prevê código para isso.
  - `findOwnedByPublicId` valida o formato antes de consultar e resolve ownership numa única query (`channel: { user_id }`); os três casos (formato inválido, inexistente, de outro canal) dão `VideoNotFoundException`.
  - `VideosModule` agora importa `ChannelsModule`, `QueueModule` e `StorageModule` e exporta `VideosService`; `videos.module.spec.ts` carrega `queueConfig` e `storageConfig`.
  - O teste de integração do `VideosService` usa um stub de `StorageService` (só `publicUrl`), pois o storage não é o objeto sob teste.
  - `npm run lint` em `src/channels/channels.service.ts` mantém os erros pré-existentes do helper `err as any` (baseline 26 problemas em `src/channels`).

### SI-03.6 — Endpoint POST /videos
- **Status:** completed
- **Tests:** `videos-create.e2e-spec.ts` 5 passing (spec-derived, `nestjs-project/specs/videos-create.plan.md`); `videos.module.spec.ts` continua passando; suite unit/integration 212 passing; e2e 57 passing (duas rodadas seguidas); `tsc --noEmit` exit 0
- **Observations:**
  - `test/videos-create.e2e-spec.ts` foi autorado a partir do spec (1 `describe` com os 5 cenários, grupos como comentários). O usuário de teste é criado direto no banco (confirmado, com canal, senha argon2) e autenticado via `POST /auth/login`, como o spec pede.
  - **Correção de config:** `npm run test:e2e` rodava as suítes em paralelo (o `test/jest-e2e.json` não tinha `maxWorkers`, ao contrário do que o CLAUDE.md afirma — "already configured"). Com 4 suítes compartilhando o mesmo banco e fazendo `cleanAllTables`, elas colidiam (login 500, `confirm-email` 401). Adicionado `"maxWorkers": 1` em `test/jest-e2e.json`. Provável causa também do flaky de `swagger.e2e-spec.ts` registrado em SI-03.3 (não confirmado).
  - `CreateVideoDto` usa a constante `MAX_VIDEO_SIZE_BYTES` (`videos.constants.ts`), reaproveitável em `upload-completion` (SI-03.9). O controller devolve `VideosService.toResponse(video)` (em vez de chamar `toVideoResponse` direto) para injetar a URL pública da thumbnail.
  - `@SkipThrottle()` fica no nível da classe do controller, valendo para os endpoints seguintes (SI-03.7 a 03.10).
  - `src/metadata.js` (metadata do plugin Swagger) não foi regenerado; a operação aparece em `/api/docs-json` com 201/400/401 sem isso. O export do OpenAPI é o SI-03.15.

### SI-03.7 — Endpoint GET /videos/{publicId}
- **Status:** completed
- **Tests:** `videos-get.e2e-spec.ts` 4 passing (spec-derived, `nestjs-project/specs/videos-get.plan.md`); suite unit/integration 212 passing; e2e 61 passing (duas rodadas seguidas); `tsc --noEmit` exit 0
- **Observations:**
  - O plano marca Tests como vazio (E2E vem do spec de `/plan-test-specs`); o e2e foi autorado a partir do spec, 1 `describe` com 4 cenários (200 do dono, 404 de outro canal/inexistente com respostas idênticas, 404 de formato inválido, 401).
  - Extraído `src/test/e2e-users.ts` (`createLoggedInUser`: usuário confirmado + canal + login real) para os e2e de vídeos seguintes não duplicarem o setup; `videos-create.e2e-spec.ts` (SI-03.6) foi ajustado para usá-lo, sem mudar o comportamento.
  - `:publicId` é lido sem pipe de validação, de propósito: formato inválido deve virar 404 `VIDEO_NOT_FOUND` (e não 400).

### SI-03.8 — Endpoint POST /videos/{publicId}/upload-signatures
- **Status:** completed
- **Tests:** 24 new unit/integration passing (`upload-signing.service.spec.ts` 20, `upload-signing.service.integration-spec.ts` 3, +1 em `storage.service.integration-spec.ts`) + `videos-upload-signatures.e2e-spec.ts` 7 passing (spec-derived, `nestjs-project/specs/videos-upload-signatures.plan.md`); suite unit/integration 236 passing; e2e 68 passing (duas rodadas seguidas); `tsc --noEmit` exit 0
- **Observations:**
  - **Bug do SI-03.3 corrigido:** o client signer (`S3_SIGNER_CLIENT`) usava o `requestChecksumCalculation` padrão do AWS SDK v3, que embute na URL pré-assinada o CRC32 de um corpo vazio (`x-amz-checksum-crc32`); qualquer `UploadPart` real do browser falharia com `BadDigest` (RustFS respondeu 400). O client signer agora usa `requestChecksumCalculation: 'WHEN_REQUIRED'`. Descoberto pelo teste de integração (URLs executadas de verdade) e travado por testes em `storage.service.integration-spec.ts` e `upload-signing.service.integration-spec.ts`.
  - A checagem de estado (`INVALID_VIDEO_STATE`) fica no `UploadSigningService.sign`, não no controller, para manter a regra de negócio no service (o plano a descreve no controller). Ordem de erros: 404 (ownership) → 409 (estado) → 400 (key/operação).
  - Com `uploadId`, a key é validada antes do método (key divergente = `INVALID_UPLOAD_KEY` mesmo para combinação inválida). Sem `uploadId`, só `POST` sem `partNumber` é aceito; o resto (`PUT` sem `uploadId`, `partNumber` sem `uploadId`, `GET`/`DELETE` sem `uploadId`) é `UNSUPPORTED_UPLOAD_OPERATION`.
  - O `CreateMultipartUpload` só aborta uploads cuja `Key` é exatamente a key do rascunho (o `ListMultipartUploads` filtra por prefixo, então chaves parecidas ficam de fora).
  - Em testes, executar a URL pré-assinada exige o endpoint interno com o `Host` público; `fetchViaInternalEndpoint` agora também envia `Content-Length` (S3 rejeita upload chunked) e devolve os headers (ETag).
  - Um `prettier --write src` amplo reformatou por engano dois templates `.hbs`; revertidos antes do fim (nenhuma mudança neles ficou no diff).

### SI-03.9 — Endpoint POST /videos/{publicId}/upload-completion
- **Status:** completed
- **Tests:** 18 new unit/integration passing (`videos.service.spec.ts` +11, `videos.service.integration-spec.ts` +7) + `videos-upload-completion.e2e-spec.ts` 6 passing (spec-derived, `nestjs-project/specs/videos-upload-completion.plan.md`); suite unit/integration 254 passing; e2e 74 passing (duas rodadas seguidas); `tsc --noEmit` exit 0
- **Observations:**
  - `VideosService` ganhou a `Queue` `videos` (`@InjectQueue`) como 4ª dependência; os construtores manuais nos specs existentes foram ajustados. As opções do job (`attempts: 3`, backoff exponencial de 5 s) ficaram em `PROCESS_VIDEO_JOB_OPTIONS` (`queue.constants.ts`) para o sweep (SI-03.14) reutilizar.
  - Transição por `UPDATE ... WHERE id AND processing_status = 'awaiting_upload'`; só quem ganha a corrida (`affected = 1`) enfileira. Teste de integração com duas conclusões concorrentes confirma 1 job. Em `uploaded`/`processing`/`ready` devolve o vídeo sem tocar em storage/fila (como o plano manda); `failed` lança `INVALID_VIDEO_STATE`.
  - Falha no `queue.add` **propaga** (500) em vez de ser engolida: a regra de services do projeto proíbe catch sem rethrow. O vídeo já está em `uploaded` e, como uma nova chamada vira no-op, quem reenfileira é o sweep (SI-03.14), que o plano já prevê para o dual-write.
  - Os e2e usam o Redis e o bucket de dev (`videos` queue e `S3_BUCKET`) e chamam `queue.obliterate({ force: true })` por cenário, como o spec pede: rodar o e2e com o worker ativo (SI-03.11+) apagaria jobs reais da fila de dev.
  - Cenário de objeto >10 GiB: `jest.spyOn(storageService, 'headObject')` devolve `ContentLength: 10737418241` sobre o objeto real (equivalente ao `overrideProvider` do spec); `deleteObject` roda de verdade e o teste confirma o 404 no storage.

### SI-03.10 — Endpoint GET /videos/{publicId}/media-urls
- **Status:** completed
- **Tests:** 20 new unit/integration passing (`download-disposition.util.spec.ts` 10, `videos.service.spec.ts` +7, `videos.service.integration-spec.ts` +3) + `videos-media-urls.e2e-spec.ts` 5 passing (spec-derived, `nestjs-project/specs/videos-media-urls.plan.md`); suite unit/integration 274 passing; e2e 79 passing (duas rodadas seguidas); `tsc --noEmit` exit 0
- **Observations:**
  - `VideosService` agora também injeta `storageConfig` (para `VIDEO_URL_TTL_SECONDS`), 5ª dependência; construtores manuais nos specs ajustados.
  - O header de download vem de `download-disposition.util.ts` (não previsto no plano): `attachment; filename="<ASCII>"; filename*=UTF-8''<RFC 5987>`. Aspas, barras e `%` do nome original são neutralizados e acentos vão só no `filename*`, para um nome como `Férias.mov` não quebrar o header nem a assinatura. Nomes sem base utilizável caem em `video.mp4`.
  - `streamUrl` é um `GetObject` sem disposition (inline); `downloadUrl` é o mesmo objeto com `ResponseContentDisposition`. O RustFS atendeu `Range: bytes=0-1023` com `206` e `Content-Range`, e devolveu o `Content-Disposition` assinado.
  - `expiresAt` = `Date.now() + TTL` calculado no service, independente do relógio do storage; com o default (14400 s) fica ~4 h à frente.
  - `fetchViaInternalEndpoint` passou a aceitar `headers` (necessário para o `Range`).
  - Os e2e gravam um `video.mp4` de 4 KiB no bucket de dev e o removem em `afterEach`.

### SI-03.11 — Entrypoint do worker e serviço `video-worker` no Compose
- **Status:** completed
- **Tests:** 2 new passing (`worker.module.spec.ts` 1, `worker.module.integration-spec.ts` 1); suite unit/integration 276 passing (`--runInBand`); e2e 79 passing; `tsc --noEmit` exit 0
- **Observations:**
  - O teste de compilação do `WorkerModule` abre conexão real com db/Redis/storage, então foi para `worker.module.integration-spec.ts` (regra do CLAUDE.md do subprojeto); o `worker.module.spec.ts` do plano ficou só com a checagem de ausência de controllers via metadata.
  - `npx jest` sem `--runInBand` falha de forma intermitente em suítes de integração diferentes a cada rodada (DB compartilhado, `cleanAllTables` concorrente); em série passam todas. Pré-existente, não relacionado a esta SI.
  - O serviço `video-worker` sobe e loga `Video worker started` após inicializar TypeOrm, Bull e Storage; não publica portas. A API não é iniciada pelo Compose (só o container), então o `GET /` 200 foi coberto por `app.controller.spec.ts` e pelos e2e (79 passing) após a extração de `buildTypeOrmOptions`.
  - `nestjs-project/CLAUDE.md` ganhou os serviços `video-worker`, `storage`, `redis` e as checagens `redis-cli ping` e `/health` do storage (RustFS, não MinIO — ver desvio do SI-03.1).
  - A lista de tarefas persistente (TaskCreate) não está disponível neste ambiente; o progress file foi o único registro.

### SI-03.12 — Adapter FFmpeg (probe, normalização e thumbnail)
- **Status:** completed
- **Tests:** 28 new passing (`probe-metadata.spec.ts` 20, `ffmpeg.service.integration-spec.ts` 8); suite unit/integration 304 passing (`--runInBand`); e2e 79 passing; `tsc --noEmit` exit 0
- **Observations:**
  - **Rotação validada com ffmpeg real (pendência do plano/library-refs):** o `fluent-ffmpeg` não devolve `side_data_list`; ele achata o side data no próprio stream (`stream.rotation`, ex.: `90`). `readRotation` lê `rotation` primeiro e mantém `side_data_list[].rotation` e a tag `rotate` como fallback. O ffmpeg 5.1 converte `-metadata:s:v rotate=90` em displaymatrix, e o teste de integração gera esse fixture (320×240 → 240×320). Não há `-display_rotation` na versão 5.1 da imagem.
  - `extractMetadata` ignora streams de vídeo com `disposition.attached_pic` (capa de álbum de mp3 não é vídeo), o que o plano não menciona; `durationMs` e dimensões ficam `null` quando ausentes (`N/A`).
  - `normalize` em modo remux repassa o erro original do ffmpeg (o plano só classifica erro de transcode como `UnsupportedMediaError`); `thumbnail` também rejeita com o erro original. SI-03.13 deve tratá-los como transitórios (retry → `processing_error`). Transcode usa `-preset veryfast -pix_fmt yuv420p` (escolha minha, para compatibilidade de reprodução).
  - Falhas de `ffprobe` logam o `err.message` do fluent-ffmpeg, que inclui o banner completo do ffprobe; ruidoso, mas fica só no log (nunca na mensagem do erro de domínio).
  - `MediaModule` ainda não é importado por nada; o `WorkerModule` o importa em SI-03.13 junto com o processor.

### SI-03.13 — Processor `process-video` (pipeline de processamento)
- **Status:** completed
- **Tests:** 26 new passing (`video-processing.service.spec.ts` 15, `video.processor.spec.ts` 6, `video-processing.module.spec.ts` 1, `video-processing.service.integration-spec.ts` 4); suite unit/integration 330 passing (`--runInBand`, worker parado); e2e 79 passing; `tsc --noEmit` exit 0
- **Observations:**
  - **Bug de wiring achado pelo teste do `WorkerModule`:** `VideoProcessingModule` só registrava `Video`, e o TypeORM falha com "Entity metadata for Video#channel was not found" porque o grafo é `Video → Channel → User`. O módulo agora importa `ChannelsModule` e `UsersModule` (sem controllers, exportam `TypeOrmModule`) para o worker subir. O teste do SI-03.11 passava só porque o worker ainda não tinha entidades.
  - **Teste com o worker de verdade:** subi `video-worker` e enfileirei um job para um vídeo inexistente; o processor consumiu e completou (guard de idempotência). O pipeline completo com ffmpeg/storage/DB foi coberto pelo teste de integração (MP4 gerado por `lavfi` → `ready`; texto → `failed` `unreadable_file` + `UnrecoverableError`; redelivery sem alterar `updated_at` nem o ETag).
  - **Worker interfere nos e2e:** com o `video-worker` rodando, os e2e de `upload-completion` (SI-03.9) enfileiram jobs na fila `videos` de dev e o worker os consome. Rodei as suítes completas com `docker compose stop video-worker` e religuei depois. Vale decidir uma fila de teste separada (ou parar o worker no `pretest:e2e`) antes de fechar a fase.
  - A limpeza do original (`discardOriginal`) é best-effort: falha de delete é logada, não relançada, para um hiccup de storage não transformar um vídeo já `ready`/`failed` em job com retry. Exceção deliberada à regra de não engolir erros, porque o status terminal já está persistido.
  - Transcode usa o `onProgress` por etapa (5/20/35/60/70/85/100); o `VideoProcessor` ignora jobs que não são `process-video` (o roteamento do `sweep-videos` fica para o SI-03.14).
  - O `NotAVideoError` é lançado no próprio service (probe sem stream de vídeo), já que o `FfmpegService` não conhece essa regra.
  - Erro de probe 2 / upload com falha transitória deixa o vídeo em `processing`, e o retry reentra pelo guard (aceita `processing`).

### SI-03.14 — Scheduler e processor `sweep-videos`
- **Status:** completed
- **Tests:** 11 new passing (`video-sweep.service.integration-spec.ts` 7, `video-sweep.scheduler.integration-spec.ts` 1, +3 em `video.processor.spec.ts`); suite unit/integration 339 passing (`--runInBand`, worker parado); e2e 79 passing; `tsc --noEmit` exit 0
- **Observations:**
  - **Verificado no worker real:** após subir e reiniciar o `video-worker`, o Redis tem um único job scheduler `sweep-videos` (`every: 900000`, `iterationCount: 2`), ou seja, o sweep já executou sem erro e o reinício não duplicou o agendamento.
  - **Corrida com `upload-completion`:** `markAbandonedUploads` usa `UPDATE ... WHERE processing_status = 'awaiting_upload' AND created_at < cutoff ... RETURNING public_id`, a mesma guarda condicional do completion, então só um dos dois vence. O teste cobre o lado determinístico (vídeo `uploaded` com 30h nunca vira `upload_abandoned`); a corrida em si é garantida pelo Postgres, não por um teste concorrente.
  - O abort de multiparts só atua na key exata do rascunho (o `ListMultipartUploads` filtra por prefixo; o teste cria uma key irmã `...original-other` e confirma que ela sobrevive). Falha do storage no abort é logada e não impede a varredura dos demais vídeos (backstop: lifecycle rule do bucket).
  - `requeueStrandedUploads` depende de `jobId = videoId` e de os jobs `process-video` não terem `removeOnComplete`/`removeOnFail` (hoje não têm); se isso mudar, o re-add deixa de ser ignorado e o sweep passaria a reprocessar vídeos já tratados. O guard de idempotência do `VideoProcessingService` continua protegendo vídeos `ready`/`failed`.
  - Constantes `SWEEP_SCHEDULER_ID` e `SWEEP_INTERVAL_MS` em `queue.constants.ts`. O plano fala em `VideoSweepProcessor`; seguindo a ação 3 (um único `WorkerHost` por fila), o roteamento ficou no `VideoProcessor`.
  - Os dois sweeps rodam em sequência no mesmo job e compartilham o mesmo `now`; erro no primeiro faz o job falhar sem rodar o segundo (sem retry configurado para o sweep; roda de novo em 15 min).
  - O worker ficou ligado ao final; para rodar o e2e é preciso pará-lo (ver observação do SI-03.13).

### SI-03.15 — Export e sync do contrato OpenAPI para o frontend
- **Status:** completed
- **Tests:** 12 new passing em `openapi-export.integration-spec.ts` (21 no arquivo); suite unit/integration 351 passing (`--runInBand`, worker parado); e2e 79 passing; `tsc --noEmit` exit 0 no backend e no `next-frontend`
- **Observations:**
  - **Corpos de requisição de vídeos saem vazios no contrato:** `CreateVideoDto` e `SignUploadRequestDto` têm `properties` vazio em `openapi.json` (e, portanto, `Record<string, never>` em `types.gen.ts`). Mesma limitação já existente nos DTOs de auth: `openapi:export` roda por `ts-node`, sem o plugin do `@nestjs/swagger` (que só atua no `nest build`), e esses DTOs não têm `@ApiProperty` explícito; `src/metadata.ts` é só um stub. As respostas (`VideoResponseDto`, `SignUploadResponseDto`, `MediaUrlsResponseDto`) saem completas porque têm `@ApiProperty`. Impacto: os aliases `CreateVideoDto`/`SignUploadRequestDto` do SI-03.16 e os handlers BFF dos SI-03.20/22 não terão tipagem dos campos do corpo vindo do contrato. Correção sugerida como tarefa separada: `@ApiProperty` nos DTOs de entrada ou aplicar o plugin no export.
  - **`next-frontend/openapi.json` não é commitado:** está no `.gitignore` do `next-frontend` (linha 42); o plano pedia commitar. É uma cópia local gerada por `scripts/sync-openapi.sh` (idêntica à do backend, verificada com `cmp`); só `nestjs-project/openapi.json` e `next-frontend/lib/api/types.gen.ts` entram no commit.
  - `types.gen.ts` expõe os cinco paths (`/videos`, `/videos/{publicId}`, `…/upload-signatures`, `…/upload-completion`, `…/media-urls`); `npx tsc --noEmit` no container do frontend sai com 0.
  - Os testes novos conferem status documentados por operação, `ApiErrorEnvelope` em todo erro 4xx, `access-token` em todas as rotas de vídeos e os campos do `VideoResponseDto`.
  - O `video-worker` foi parado para a suíte e religado ao final.

### SI-03.16 — Aliases de contrato de vídeos em `lib/api/contracts.ts`
- **Status:** completed
- **Tests:** no tests (type-only, compile-gated); `tsc --noEmit` exit 0, `eslint` limpo; suite vitest do frontend 108 passing (29 arquivos)
- **Observations:**
  - **Critério de aceite não literal:** `lib/api/upstream.ts` (anterior a esta SI) também faz `import type { paths } from "./types.gen"`, para tipar o client do `openapi-fetch`. Além dele e de `contracts.ts`, nenhum outro arquivo importa `types.gen`; `mocks/` ainda não importa. Não alterei o `upstream.ts` (fora de escopo).
  - `CreateVideoDto` e `SignUploadRequestDto` resolvem para `Record<string, never>` (limitação de corpos de requisição vazios registrada em SI-03.15); o comentário no código registra isso. Quem for tipar o corpo de `POST /api/videos` e das assinaturas no BFF (SI-03.20/22) não terá os campos vindos do contrato.
  - `VideoProcessingStatus` (união de 5 valores) e `VideoFailureReason` (5 valores) são derivados de `VideoResponse`; `processing-status.tsx` (SI-03.0.5) ainda usa a união local `ProcessingStatusValue` e deve migrar para `VideoProcessingStatus` quando for tocado.

### SI-03.17 — Helper de chamada autenticada ao upstream (`lib/auth/authorized-upstream.ts`)
- **Status:** completed
- **Tests:** 7 new passing (`authorized-upstream.integration.test.ts`); vitest completo 115 passing (30 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente em `signup-form.tsx`)
- **Observations:**
  - **API do helper:** `callAuthorizedUpstream(call)` recebe `call(headers)` e devolve `NextResponse`; `AuthorizedHeaders` é um `type` (não `interface`) porque o `openapi-fetch` exige um tipo com index signature para `headers`. O resultado do `call` é tipado estruturalmente (`{ data?, error?, response }`), compatível com qualquer operação do client `upstream`.
  - **Refresh em cima de `withRefresh`:** o helper reaproveita `withRefresh` (single-flight já existente) e relê `accessToken` da sessão a cada tentativa; como o `withRefresh` responde com um `Response` 401 próprio quando o refresh falha, o helper detecta isso (`final !== last.response`) e devolve o envelope `UNAUTHORIZED` do plano. O `withRefresh` não foi alterado.
  - **Testes precisam importar o `upstream` dentro de `beforeAll`:** o `openapi-fetch` captura o `fetch` global na criação do client; um `await import` no topo do arquivo roda antes do `server.listen()` do `mocks/setup.ts` e as chamadas vão à rede real (`ENOTFOUND nestjs-api`). Mesmo padrão do teste de rota de login. Vale lembrar nos testes dos BFF handlers (SI-03.20 a 24).
  - Sucesso sem corpo (204) devolve `NextResponse` com corpo nulo; erro sem corpo devolve `null` como JSON com o status do upstream. Nenhum endpoint de vídeos hoje retorna 204, então é só defensivo.
  - **Armadilha:** `prettier --write lib/auth` reformatou 4 arquivos existentes (`refresh.ts`, `error-mapping.ts` e dois testes); revertidos com `git checkout`, só os dois arquivos novos ficam no diff. Usar `prettier --write` apenas nos arquivos criados.

### SI-03.18 — Handlers MSW de vídeos (`mocks/handlers/videos.ts`)
- **Status:** completed
- **Tests:** 15 new passing (`mocks/handlers/__tests__/videos.integration.test.ts`); vitest completo 130 passing (31 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - **Bearer obrigatório nos handlers (além do plano):** os cinco handlers respondem `401 UNAUTHORIZED` sem `Authorization`, como o upstream real. Assim os testes dos BFF handlers (SI-03.20 a 24) provam que o token é injetado server-side. No E2E funciona porque o mock de login devolve `access_token` e a sessão o repassa.
  - **Triggers fora de GET:** `missingVid1` dá 404 em todas as rotas `/videos/{publicId}/**`. `failedVid01`/`procVid0001`/`readyVid001` são stateless também no `upload-completion` (o `failedVid01` responde `409 INVALID_VIDEO_STATE`, como o backend; os outros devolvem a própria fixture). `media-urls` responde `409 VIDEO_NOT_READY` para qualquer vídeo não `ready` (rascunho, `uploaded`, `processing`, `failed`), então só `readyVid001` entrega as URLs.
  - **Envelope de erro** segue o backend real (`{ statusCode, error: <CODE>, message }`, sem `code`); `VALIDATION_ERROR` de `too-large.mp4` usa `message` como array. Os handlers de auth usam `code: null` e `error` em outro formato; não alterei.
  - **`sizeBytes`:** o rascunho devolve `sizeBytes: null` (o backend só o grava na conclusão) e o `upload-completion` aplica o tamanho declarado no `POST /videos`.
  - `upload-signatures` só devolve `key` no `CreateMultipartUpload` (`method POST` sem `uploadId`); nas demais operações (`UploadPart` etc.) devolve só a `url` na origem `E2E_STORAGE_ORIGIN`, com `uploadId`/`partNumber` na query. As `thumbnailUrl`/`streamUrl`/`downloadUrl` também apontam para `storage.e2e.invalid`; precisam do fake de storage do SI-03.19 no E2E (e do `next/image` com `unoptimized`, já usado no `thumb-upload`).
  - **Documentação da exceção ao padrão stateless:** o TD `e2e-video-upload-fixtures/TD-02` pede registrar o store em `next-frontend/CLAUDE.md` e `.claude/rules/next-frontend-msw-mocks.md`; o plano concentra isso no SI-03.19, então não toquei nesses arquivos aqui (o cabeçalho de `videos.ts` documenta a tabela de triggers e a exceção).
  - O teste "reinicia o contador" depende da ordem dos testes do arquivo (o anterior também cria rascunho e o `afterEach` global zera o store).

### SI-03.19 — Fake de storage no Playwright e documentação das exceções de E2E
- **Status:** completed
- **Tests:** no tests (infra de teste, plano marca Tests vazio); verificado com um spec Playwright descartável (1 passing, removido); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente); vitest 130 passing
- **Observations:**
  - **Verificação sem dev server:** o spec descartável serviu uma página em `http://app.e2e.invalid/` (via `page.route`) para tornar as chamadas realmente cross-origin e exercitou create → `PUT` de parte → list → complete → delete contra `http://storage.e2e.invalid`. Confirmou `200` + `ETag` legível por JavaScript (`"e2e-part-1"`), XML com `UploadId`, `ListPartsResult` com a parte enviada, `CompleteMultipartUploadResult` e `204` no abort. O preflight de CORS foi respondido pelo próprio Playwright, sem handler de `OPTIONS`. Não rodei o dev server nem o Uppy real: a integração com o `@uppy/aws-s3` só será exercitada nos specs E2E de SI-03.30b/31b.
  - **`ListParts` com estado por página:** o fake guarda as partes enviadas por `uploadId` (Map no closure de `routeStorageFake`, ou seja, por teste) para o `GET` listar o que foi subido; o plano só pedia o XML. Os `uploadId`s são `e2e-upload-N`.
  - **Dependência do desenho do `upload-signatures`:** o fake distingue as operações por método + `uploadId` na query (o handler MSW do SI-03.18 coloca `uploadId`/`partNumber` na URL assinada). Se o Uppy 6 assinar a criação do multipart com `?uploads` e o fake não depender disso, continua funcionando; mas se o SI-03.26 mudar a forma de assinar, vale reconferir.
  - **Docs atualizadas com as duas exceções** (`e2e-video-upload-fixtures/TD-01` e `TD-02`): `next-frontend/CLAUDE.md` § E2E architecture, `.claude/rules/next-frontend-msw-mocks.md` (nova seção "Stateful handlers") e `.claude/skills/testing-guide-next-frontend/references/external-systems.md` (linha de Object Storage de "Fake (deferred)" para o fake de browser; também ajustei a frase de abertura, que dizia que o Storage estava adiado). Arquivos em `.claude/` e `next-frontend/CLAUDE.md` entram no diff desta SI.
  - O fixture `network` agora recebe `page` e registra o fake em todo teste E2E; a regra de não interceptar `/api/**` continua válida e está escrita no comentário do fixture.

### SI-03.20 — BFF Route Handler: POST /api/videos
- **Status:** completed
- **Tests:** 5 new passing (`app/api/videos/__tests__/route.integration.test.ts`); vitest completo 135 passing (32 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - Corpo malformado (JSON inválido) é encaminhado como `{}` para o upstream responder o próprio `400`, em vez de estourar 500 no `request.json()`; o plano não cobria esse caso. A rota de login existente não trata isso.
  - Sem validação no BFF: o `CreateVideoDto` do contrato é `Record<string, never>` (SI-03.15), então o corpo vai cru ao upstream, que valida (class-validator). O `body` compila porque o tipo vazio aceita o objeto lido.
  - O teste de 400 usa o trigger `too-large.mp4` do handler MSW (SI-03.18), e o de Bearer confere que o token da sessão chega ao upstream.
  - O handler é fino: toda a regra de sessão/refresh/pass-through está em `callAuthorizedUpstream`; os próximos handlers (SI-03.21 a 24) seguem o mesmo molde.

### SI-03.21 — BFF Route Handler: GET /api/videos/{publicId}
- **Status:** completed
- **Tests:** 5 new passing (`app/api/videos/[publicId]/__tests__/route.integration.test.ts`); vitest completo 140 passing (33 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - `params` tipado como `Promise<{ publicId: string }>` e confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Next 16).
  - `Cache-Control: no-store` é aplicado a toda resposta do handler, inclusive aos pass-throughs de erro (404/409) e ao 401 sem sessão, não só ao 200; o plano cita só o 200. Para polling, uma resposta de erro em cache seria igualmente indesejada.
  - O `publicId` vai ao upstream via `params.path` do `openapi-fetch` (codificado pelo client); o teste confere o path e o Bearer recebidos.
  - O `publicId` não é validado no BFF: formato inválido chega ao upstream, que responde `404 VIDEO_NOT_FOUND` (comportamento do backend, SI-03.7).

### SI-03.22 — BFF Route Handler: POST /api/videos/{publicId}/upload-signatures
- **Status:** completed
- **Tests:** 9 new passing (`app/api/videos/[publicId]/upload-signatures/__tests__/route.integration.test.ts`, contando os 3 casos do `it.each` de erro); vitest completo 149 passing (34 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - Os erros 400 `INVALID_UPLOAD_KEY`, 404 e 409 `INVALID_VIDEO_STATE` são exercitados com `server.use(...)`, pois o handler MSW de `upload-signatures` (SI-03.18) só tem o caminho feliz e o trigger `missingVid1`; o `it.each` confere status e envelope idênticos aos do upstream.
  - Mesmo tratamento de corpo malformado do `POST /api/videos` (encaminhado como `{}` para o upstream responder o próprio 400). `SignUploadRequestDto` do contrato é `Record<string, never>` (SI-03.15), então o corpo (`method`, `key`, `uploadId`, `partNumber`) passa sem tipagem de campos.
  - O BFF não valida `method`/`key`: quem restringe o que pode ser assinado (key vinculada ao rascunho, métodos permitidos) é o upstream (SI-03.8); a rota só repassa, como pede o plano.

### SI-03.23 — BFF Route Handler: POST /api/videos/{publicId}/upload-completion
- **Status:** completed
- **Tests:** 8 new passing (`app/api/videos/[publicId]/upload-completion/__tests__/route.integration.test.ts`, contando os 4 casos do `it.each`); vitest completo 157 passing (35 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - O teste do caminho feliz atravessa três rotas do BFF contra o store dos handlers MSW: `POST /api/videos` (rascunho) → `GET` em `awaiting_upload` → `upload-completion` → `GET` em `uploaded` com `sizeBytes` do pré-cadastro. Por isso o arquivo importa também as rotas `route.ts` de `videos` e `videos/[publicId]`.
  - O upstream recebe a requisição sem corpo (o teste confere `body: ""`) e o Bearer da sessão; a rota não declara corpo porque o endpoint não tem `requestBody` no contrato.
  - Os erros `409 UPLOAD_INCOMPLETE`, `409 INVALID_VIDEO_STATE`, `422 FILE_TOO_LARGE` e `404` são simulados com `server.use(...)`: o handler MSW de `upload-completion` (SI-03.18) só produz 200, 404 (`missingVid1`) e 409 `INVALID_VIDEO_STATE` (`failedVid01`).

### SI-03.24 — BFF Route Handler: GET /api/videos/{publicId}/media-urls
- **Status:** completed
- **Tests:** 5 new passing (`app/api/videos/[publicId]/media-urls/__tests__/route.integration.test.ts`); vitest completo 162 passing (36 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - `Cache-Control: no-store` em toda resposta do handler (inclui os erros 409/404 e o 401), como no `GET /api/videos/{publicId}`; as URLs pré-assinadas expiram, então cache seria perigoso.
  - Os testes usam os triggers do SI-03.18: `readyVid001` → 200 com URLs na origem `E2E_STORAGE_ORIGIN` (`response-content-disposition=attachment` no `downloadUrl`, `expiresAt` parseável); `procVid0001` → 409 `VIDEO_NOT_READY`; `missingVid1` → 404.
  - O BFF não valida nem reescreve as URLs: a origem real do storage (browser-reachable) vem do upstream (`S3_PUBLIC_ENDPOINT`), então `next.config` / CSP de mídia precisam permitir esse host quando o player for ligado (SI-03.32b); fora de escopo aqui.
  - Com isso os cinco Route Handlers BFF de vídeos (SI-03.20 a 24) estão prontos. Commit: o usuário pediu para não commitar esta SI.

### SI-03.25 — Infra: instalar `@uppy/core` e `@uppy/aws-s3`
- **Status:** completed
- **Tests:** no tests (Infra); `tsc --noEmit` exit 0; vitest 162 passing; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - Instalados `@uppy/core@^6.2.0` (resolveu 6.2.0) e `@uppy/aws-s3@^6.2.2` (6.2.2), os únicos `@uppy/*` em `package.json`; `npm ls` mostra um único `@uppy/core` (deduped). Nenhum `@uppy/react`, `dashboard` ou `golden-retriever`. Só `package.json` e `package-lock.json` mudam (+168 linhas no lock).
  - `@uppy/core` traz o próprio `nanoid@6.0.2` aninhado; o `npm audit` já reportava vulnerabilidades pré-existentes (inclusive `nanoid <=3.3.17` no topo da árvore, vindo do Next), nenhuma ligada aos pacotes novos.
  - **Pendência de decisão herdada da library-refs:** o provider headless planejado para SI-03.26 usa `UppyContextProvider` de `@uppy/react`, que o plano proíbe instalar aqui e que não está em TD-05. SI-03.26 deve usar um contexto React escrito à mão (ou abrir revisão do TD-05).
  - Ação 2 (commitar) não executada nesta SI: git fica com o usuário.

### SI-03.26 — Provider de upload (Uppy headless) para o studio
- **Status:** completed
- **Tests:** 24 new passing (`lib/studio/__tests__/create-uppy.test.ts` 11, `components/studio/__tests__/upload-provider.test.tsx` 13); vitest completo 186 passing (38 arquivos); `tsc --noEmit` exit 0; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - **O draft ativo vive no `meta` do Uppy, não numa ref:** o plano pede `createUppy({ getPublicId })`, mas `useState(() => createUppy({ getPublicId: () => ref.current }))` é barrado pelo lint do React Compiler ("Cannot access refs during render"). O provider chama `uppy.setMeta({ publicId })` em `start()` e o `getPublicId`, o `signRequest` e os handlers de evento leem `uppy.getState().meta.publicId`; `clear()` zera o meta. A assinatura pública de `createUppy` continua a do plano.
  - **Contrato do provider:** `useUpload()` expõe `addFile(file)` (lança o erro de restrição do Uppy), `start(publicId)`, `clear()` e `getUpload(publicId)` → `{ fileName, progress, phase, error?, errorCode?, video? }`. O plano cita só `error?`; acrescentei `errorCode` (`UPLOAD_INCOMPLETE`, `FILE_TOO_LARGE`, `NETWORK_ERROR`, `UPLOAD_FAILED`, ou o código do envelope) separado da mensagem, para as telas mapearem erro por código.
  - **`upload-completion` roda uma vez por rascunho** (guarda com `Set` em ref) e o `uppy.clear()` acontece no `finally` da conclusão, quer termine em `completed` ou em `error`, para liberar o Uppy para um novo envio. `upload-error` do Uppy vira `phase: "error"` (`UPLOAD_FAILED`); não há `retry` na API do provider (o plano não prevê); a tela decide entre `clear()` + novo arquivo.
  - **Os testes dirigem o Uppy real:** o `Probe` pega a instância pelo `UppyContext` e emite `upload-progress`/`upload-success`/`upload-error`, com `uppy.upload` mockado (senão o plugin S3 tentaria rede) e `fetch` stubado com `vi.stubGlobal` (a rota `/api/videos/...` do BFF não tem handler MSW; o plano pede `fetch` stubado). As restrições (não-vídeo, >10 GiB, segundo arquivo) são exercitadas no Uppy real, usando `Object.defineProperty(file, "size", …)` para simular 10 GiB sem alocar.
  - **Não verificado de ponta a ponta:** o `AwsS3` do Uppy 6 falando com o `routeStorageFake` (SI-03.19) e com a rota de assinatura só será exercitado nos E2E do SI-03.30b/31b. Em especial, a forma exata das URLs que o Uppy 6 deriva da `url` assinada para create/list/complete (o fake distingue operações por método + `uploadId` na query) precisa ser confirmada lá.
  - A progressão de `progress` usa `bytesUploaded/bytesTotal` do evento `upload-progress` (arredondado e limitado a 0–100) e só atualiza enquanto `phase === "uploading"`, para um evento tardio não regredir um upload já em `completing`/`completed`.
  - Usei apenas o Prettier nos arquivos criados (lição do SI-03.17).

### SI-03.27 — Hook de polling `useVideoStatus`
- **Status:** completed
- **Tests:** 9 passing (`hooks/__tests__/use-video-status.test.tsx`); `tsc --noEmit` exit 0; eslint em `hooks/` 0 problemas
- **Observations:**
  - Os testes stubam `fetch` com `vi.stubGlobal` em vez de MSW: o `fetch` do Node em jsdom não resolve URL relativa (`/api/videos/...`) e o controle de resposta lenta/timers fica direto; mesmo precedente do `upload-provider.test.tsx` (SI-03.26).
  - Respostas não-OK diferentes de 401 (ex.: 5xx) e falhas de rede não interrompem o polling: o hook reagenda e tenta de novo. O plano só define parada em `ready`/`failed` e em 401.

### SI-03.28 — Utilitários de apresentação de vídeo (`lib/videos/format.ts`)
- **Status:** completed
- **Tests:** 21 passing (`lib/videos/__tests__/format.test.ts`); `tsc --noEmit` exit 0; eslint em `lib/videos` 0 problemas
- **Observations:**
  - Copy de status e de `failureReason` escrita em inglês (idioma da UI e do Figma), inferida no implement conforme OQ-3; textos a revisar com o designer. "Envio interrompido" (PT) citado pelo plano não está aqui, pois é estado da tela, não de `processingStatus`.
  - Limiares de `qualityLabel` (lado menor): ≥2160 "4K", ≥1440 "1440p", ≥1080 "1080p HD", ≥720 "720p HD", abaixo disso `{n}p`. O plano só fixa 1080 e 4K; 1440p e os demais são escolha de implementação.
  - `Record<VideoProcessingStatus|VideoFailureReason, string>` já garante cobertura de copy em compilação; o teste só confere que nenhuma é vazia.

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

### SI-03.33 (amendment of SI-03.25) — Infra: instalar `@uppy/react`
- **Status:** completed
- **Tests:** no tests (Infra); `tsc --noEmit` exit 0; vitest 162 passing; `npm run lint` 0 erros (1 warning pré-existente)
- **Observations:**
  - Appended by /plan-build append-mode on 2026-10-14; tracks delta from phase-03-videos/TD-05 Revision 2026-10-14. Executar antes de SI-03.26.
  - Instalado `@uppy/react@^6.0.0` (6.0.0) sem os peers opcionais (`dashboard`, `status-bar`, `webcam`, `screen-capture`) nem `golden-retriever`. `package.json` lista só `@uppy/core`, `@uppy/aws-s3` e `@uppy/react`; `npm ls @uppy/core` mostra uma única versão (6.2.0, deduped).
  - **Dependências transitivas de `@uppy/*` no lockfile:** `@uppy/react` puxa `@uppy/components`, `@uppy/google-drive-picker` e `@uppy/google-photos-picker` (dependências de runtime dele, não declaradas no `package.json`). O critério "nenhum outro pacote `@uppy/*`" foi lido como sobre o `package.json`; os pickers do Google vêm junto de `@uppy/components` e não são importados pelo app.
  - O lock também mudou +104/−2 linhas (preact, use-sync-external-store e afins). Ação 2 (commitar) não executada: git fica com o usuário.
