# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 18/44 completed

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
