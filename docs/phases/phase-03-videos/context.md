---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-08T08:04:12-03:00"
  docs/decisions/technical-decisions-video-metadata.md: "2026-10-07T14:40:53-03:00"
  docs/decisions/technical-decisions-e2e-video-upload-fixtures.md: "2026-10-13T14:11:00-03:00"
  docs/decisions/technical-decisions-next-frontend-config-base.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-next-frontend-msw-foundation.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-next-frontend-openapi-typing.md: "2026-09-28T14:55:47-03:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-09-28T14:55:47-03:00"
  docs/phases/phase-01-configuracao-base/context.md: "2026-09-28T14:55:47-03:00"
  docs/phases/phase-02-auth/context.md: "2026-09-28T14:55:47-03:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-09-28T14:55:47-03:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-09-28T14:55:47-03:00"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-09-28T14:55:47-03:00"
  docs/inventories/screen-inventory-phase-03-videos.md: "2026-10-06T13:51:35-03:00"
---

# phase-03-videos — Context

## Scope

**Phase name:** Upload e Processamento de Vídeos

**Capabilities** (literal, `docs/project-plan.md`):

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Out of scope:** _Not specified._

**Deliverables:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

**Affected subprojects:** _No subproject paths are named in the Phase 03 section._

**Deferred subprojects:** _None._

**Sequencing notes:** "> Depende de: Fase 01, Fase 02". Intro sentence: "Upload de arquivos grandes sem travar o sistema, processamento automático do vídeo e geração de URL única."

**Neighbors (for boundary detection only):**

- **Phase 02:** Fase 02 — Cadastro, Login e Gerenciamento de Conta (Depende de: Fase 01)
- **Phase 04:** Fase 04 — Gerenciamento de Vídeos e Canal (Depende de: Fase 02, Fase 03)

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-03-videos/TD-01 | phase | Backend | Object Storage Service (dev) and S3 Client | decided | A (MinIO) | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner |
|     └─ Last revision: 2026-10-07 — Archived MinIO image accepted for dev: pin the last community image tag in… | | | | | | |
| phase-03-videos/TD-02 | phase | Backend | Background Job Queue | decided | A (BullMQ + Redis) | bullmq, @nestjs/bullmq |
| phase-03-videos/TD-03 | phase | Backend | Video Worker Runtime Topology | decided | A (Same Nest codebase, separate entrypoint and Compose service) | — |
| phase-03-videos/TD-04 | phase | Cross-layer | Large-File Upload Protocol (10GB, resumable) | decided | A (presigned S3 multipart) | — |
|     └─ Last revision: 2026-10-07 — This replaces the "aborted best-effort via `signRequest`" clause in the… | | | | | | |
| phase-03-videos/TD-05 | phase | Frontend | Browser Upload Client | decided | A (Uppy 6 headless) | @uppy/core, @uppy/aws-s3 |
| phase-03-videos/TD-06 | phase | Cross-layer | Video Lifecycle Status Model | decided | B (Two orthogonal fields) | — |
|     └─ Last revision: 2026-10-08 — Wire-format (API/OpenAPI) field names are camelCase: `processingStatus` and… | | | | | | |
| phase-03-videos/TD-07 | phase | Cross-layer | Public Video Identifier for Unique URLs | decided | B (Random 11-char base64url) | — |
| phase-03-videos/TD-08 | phase | Cross-layer | Playback Format and Processing Scope | decided | A (Normalize to a single progressive MP4) | — |
|     └─ Last revision: 2026-10-07 — The original upload object is deleted as soon as processing reaches a terminal… | | | | | | |
| phase-03-videos/TD-09 | phase | Cross-layer | Media Delivery Path and Access (Streaming, Download, …) | decided | B (hybrid) | — |
| phase-03-videos/TD-10 | phase | Backend | FFmpeg Integration | decided | B (`fluent-ffmpeg` + system ffmpeg) | fluent-ffmpeg |
|     └─ Last revision: 2026-10-07 — The unmaintained-dependency risk of `fluent-ffmpeg` is accepted. Usage is… | | | | | | |
| phase-03-videos/TD-11 | phase | Cross-layer | Processing-Status Propagation to the Frontend | decided | A (short polling through the BFF) | — |
|     └─ Last revision: 2026-10-06 — Client mechanism pinned: hand-rolled hook (setTimeout chain + fetch to the BFF)… | | | | | | |
| video-metadata/TD-01 | ad-hoc | Cross-layer | Metadata Set and Persistence Shape | decided | A (Minimal typed fields only) | — |
|     └─ Last revision: 2026-10-07 — No raw-probe column is persisted: the Recommendation's internal `jsonb` probe… | | | | | | |
| video-metadata/TD-02 | ad-hoc | Cross-layer | Metadata Extraction Timing and Source of Truth | decided | C (Two-stage — provisional from original, authoritative from output) | — |
| video-metadata/TD-03 | ad-hoc | Cross-layer | Metadata Value Contract (duration unit, display dimensions… | decided | A (Raw numeric fields; frontend derives labels) | — |
| video-metadata/TD-04 | ad-hoc | Cross-layer | Processing Failure Reason Contract | decided | B (Machine-readable `failureReason` enum) | — |
|     └─ Last revision: 2026-10-07 — Adds the `upload_abandoned` code, set by the abandoned-upload sweep from the… | | | | | | |
| video-metadata/TD-05 | ad-hoc | Frontend | Metadata Shown While the Upload Is Still Running | decided | A (Server values only; placeholders until the probe runs) | — |
| e2e-video-upload-fixtures/TD-01 | ad-hoc | Frontend | Storage Target for Presigned Upload URLs in Frontend E2E | decided | A | — |
| e2e-video-upload-fixtures/TD-02 | ad-hoc | Frontend | State Model of the MSW Video Handlers Across Requests | decided | A | — |
|     └─ Last revision: 2026-10-13 — `publicId`s generated by the in-memory store are deterministic: a module-level… | | | | | | |

_Source files:_

- phase-03-videos — `docs/decisions/technical-decisions-phase-03-videos.md` (scope_type: phase, related_phases: [3])
- video-metadata — `docs/decisions/technical-decisions-video-metadata.md` (scope_type: ad-hoc, related_phases: [3])
- e2e-video-upload-fixtures — `docs/decisions/technical-decisions-e2e-video-upload-fixtures.md` (scope_type: ad-hoc, related_phases: [3])

## Capability Coverage

| Capability (from project-plan.md) | Covered by |
|-----------------------------------|------------|
| Serviço de armazenamento de arquivos (vídeos e thumbnails) | phase-03-videos/TD-01 |
| Serviço de processamento em segundo plano (filas) | phase-03-videos/TD-02, phase-03-videos/TD-03 |
| Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance | phase-03-videos/TD-04, phase-03-videos/TD-05, e2e-video-upload-fixtures/TD-01, e2e-video-upload-fixtures/TD-02 |
| Pré-cadastro automático do vídeo como rascunho ao iniciar o upload | phase-03-videos/TD-06 |
| Processamento automático do vídeo após upload (extração de duração e metadados) | phase-03-videos/TD-03, phase-03-videos/TD-06, phase-03-videos/TD-08, phase-03-videos/TD-10, phase-03-videos/TD-11, video-metadata/TD-01, video-metadata/TD-02, video-metadata/TD-03, video-metadata/TD-04, video-metadata/TD-05, e2e-video-upload-fixtures/TD-02 |
| Geração automática de thumbnail a partir de um frame do vídeo | phase-03-videos/TD-03, phase-03-videos/TD-09, phase-03-videos/TD-10 |
| URL única por vídeo, sem conflito com outros vídeos | phase-03-videos/TD-07 |
| Reprodução via streaming (sem necessidade de download completo) | phase-03-videos/TD-08, phase-03-videos/TD-09 |
| Download do vídeo pelo usuário | phase-03-videos/TD-09 |

## Decisions Detail

### phase-03-videos/TD-01

**Recommendation:** RustFS keeps the MinIO workflow the C4 diagram assumed and supports every S3 feature this phase needs (presigned multipart, CORS, lifecycle), without starting the project on an archived image. The app only uses the S3 API through the AWS SDK, so if RustFS shows a fidelity gap, swapping to SeaweedFS (Option C, the close second) only changes the Compose service. Consequence for the env contract: the API needs an **internal** endpoint (`http://<storage-service>:9000`, per the Docker-networking rule) for server-side calls, plus a **browser-reachable public** endpoint (`http://localhost:9000` in dev) used only when presigning URLs. Signing is offline, so a second `S3Client` configured with the public endpoint and `forcePathStyle: true` produces URLs the browser can resolve.
**Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

**Revisions:**
- 2026-10-07 — Archived MinIO image accepted for dev: pin the last community image tag in Compose; RustFS/SeaweedFS stay drop-in fallbacks because the app only uses the S3 API through the AWS SDK. _Rationale:_ Archived image accepted for dev-only use.

### phase-03-videos/TD-02

**Recommendation:** It is the only option with a first-party Nest 11 integration that fits the CommonJS build. Its progress API and stalled-job detection match long FFmpeg jobs, and `jobId = videoId` makes enqueue idempotent, which contains the dual-write risk with a simple sweep. pg-boss's transactional enqueue is a genuine advantage, but here it costs an ESM migration or a pinned old major plus a hand-written integration.
**Libraries:** bullmq, @nestjs/bullmq

### phase-03-videos/TD-03

**Recommendation:** It gives the isolation the "sem impacto" requirement demands and that the C4 diagram already draws, while reusing the backend's entities, config and storage module unchanged. Option C's extra isolation only pays off once there is shared-package tooling.
**Libraries:** —

### phase-03-videos/TD-04

**Recommendation:** It is the only option that meets all three constraints at once: resume after failure, no load on the API, and strict BFF unchanged. The BFF and Nest only handle a few small JSON requests per upload while the 10GB goes straight to storage, which is exactly the path `next-frontend-config-base/TD-03` reserved for media.
**Libraries:** —

**Revisions:**
- 2026-10-07 — Abandoned uploads get a bounded lifetime: a bucket lifecycle rule `AbortIncompleteMultipartUpload` after 1 day, plus a BullMQ repeatable sweep that marks drafts still uploading after 24h as `failed` with `failureReason: upload_abandoned` (see `video-metadata/TD-04`). _Rationale:_ Phase 03 has no explicit upload cancel, so orphan parts and stale drafts need cleanup (resolves AMB-1 of phase-03 validation).
- 2026-10-07 — Resume scope is the browser session only. When a file is re-attached to the same draft after a reload or direct access mid-upload (the "Envio interrompido" state), the client starts a **new** multipart upload for the draft's object key and the whole file is sent again. The previous multipart is aborted best-effort (`AbortMultipartUpload` via `signRequest`), and the 1-day `AbortIncompleteMultipartUpload` lifecycle rule is the backstop. `uploadId` is not persisted on the draft and there is no list-parts BFF read. _Rationale:_ Restart: new multipart. Uppy 6's documented API has no way to resume a known `uploadId` after a reload without `@uppy/golden-retriever`, which was not adopted (resolves AMB-3 of phase-03 validation).
- 2026-10-07 — This replaces the "aborted best-effort via `signRequest`" clause in the previous entry, which could not run because no one holds the old `uploadId` after a reload. When the API signs a `CreateMultipartUpload` for a draft's object key, it first calls `ListMultipartUploads` with `Prefix` set to that key and runs `AbortMultipartUpload` on every in-progress upload it returns. The new upload does not exist yet at signing time, so it is never affected. Cleanup runs server-side only: no `uploadId` is persisted and the client is not involved. The 1-day `AbortIncompleteMultipartUpload` lifecycle rule stays as the backstop. _Rationale:_ API aborts by key (resolves AMB-5 of phase-03 validation).

### phase-03-videos/TD-05

**Recommendation:** Resumable parallel multipart is exactly the hard, edge-case-heavy code Uppy exists to own. The `signRequest` model maps onto a single BFF route, which fits strict BFF, and the `HeadObject` verification the API needs anyway (TD-04 size cap) also covers the client-side completion trade-off.
**Libraries:** @uppy/core, @uppy/aws-s3

### phase-03-videos/TD-06

**Recommendation:** Phase 03 owns the processing pipeline and Phase 04 owns publication, so separate fields keep those concerns separate. The OpenAPI contract the FE codegen consumes stays stable across phases instead of being reshaped in Phase 04.
**Libraries:** —

**Revisions:**
- 2026-10-07 — `processing_status: failed` is terminal: the API rejects any transition out of `failed`, whatever the `failureReason` (including `upload_abandoned`), so no file can be re-attached to a failed draft. Re-uploading means creating a new draft from `/studio/upload`. The failed draft keeps its `publicId` and stays until Phase 04 adds video management. On `/studio/videos/[publicId]` the `failed` state shows the `failureReason` message plus a link to `/studio/upload`. Re-attaching to the same draft (the "Envio interrompido" state) is allowed only while `processing_status = awaiting_upload`. _Rationale:_ failed is terminal. This is consistent with the `TD-08` revision ("a failed video is re-uploaded rather than reprocessed") (resolves AMB-4 of phase-03 validation).
- 2026-10-08 — Wire-format (API/OpenAPI) field names are camelCase: `processingStatus` and `publicationStatus`. Enum values (`awaiting_upload`, `uploaded`, `processing`, `ready`, `failed`, `draft`, `published`) and DB columns (`processing_status`, `publication_status`) are unchanged. _Rationale:_ Aligns the video contract with the other camelCase wire fields (`publicId`, `failureReason`, `durationMs`, `width`, `height`, `sizeBytes`); the snake_case names in this TD's prose describe the domain model/DB columns, not the HTTP contract.

### phase-03-videos/TD-07

**Recommendation:** It is the only option that is both short (the "URL curta" requirement) and unguessable, which Phase 05's unlisted videos depend on. `node:crypto` provides it with no dependency and no ESM friction. The UUID PK stays internal.
**Libraries:** —

### phase-03-videos/TD-08

**Recommendation:** It makes "streaming without full download" true for every accepted upload. The cost stays low in the common H.264 case (remux only) and the worker absorbs the rare transcode, which is what the background worker exists for. Unlike HLS, it keeps one stored file, which addresses the storage-cost point in "Pontos de Atenção", and lets the Phase 05 player stay a native `<video>`. ABR can be added later as a Revision without changing the upload contract.
**Libraries:** —

**Revisions:**
- 2026-10-07 — The original upload object is deleted as soon as processing reaches a terminal state: after the normalized MP4 is stored (`ready`) and also on `failed`. Only the normalized MP4 is retained. _Rationale:_ "Keeps one stored file" applies to every terminal state; a failed video is re-uploaded rather than reprocessed from the original (resolves AMB-2 of phase-03 validation).

### phase-03-videos/TD-09

**Recommendation:** Video bytes stay behind API-issued presigned URLs, which keeps the draft, published and unlisted guarantees enforceable and keeps the API out of the data path. Thumbnails get the stable URLs that every list screen in Phases 04 and 07 needs for caching. Video presign TTL should exceed a realistic viewing session (hours, not minutes). "Download pelo usuário" means anyone allowed to watch (Phase 05 places the button on the watch page); in Phase 03, only the owner.
**Libraries:** —

### phase-03-videos/TD-10

**Recommendation:** The project already runs everything in a controlled Docker image, so apt-installed ffmpeg plus a small typed spawn wrapper is the least-dependency, best-tested path. Option B is dead upstream, and Option C solves a portability problem the project doesn't have.
**Libraries:** fluent-ffmpeg

**Revisions:**
- 2026-10-07 — The unmaintained-dependency risk of `fluent-ffmpeg` is accepted. Usage is limited to the ffprobe JSON probe and the remux, transcode and thumbnail commands; Option A (typed `spawn` wrapper) stays the planned replacement. _Rationale:_ Unmaintained dep accepted for API ergonomics.

### phase-03-videos/TD-11

**Recommendation:** Processing takes seconds to minutes, so a few seconds of polling latency is invisible to the user. Polling reuses the exact Route Handler + MSW patterns already in place. SSE and WebSocket would bring long-lived-connection auth and a pub/sub channel, and WebSocket would also break strict BFF, all for a sub-second improvement nobody notices here.
**Libraries:** —

**Revisions:**
- 2026-10-06 — Client mechanism pinned: hand-rolled hook (setTimeout chain + fetch to the BFF), no SWR/TanStack; ~3s interval, stops at ready/failed. _Rationale:_ Option A was chosen to "reuse existing patterns only (Route Handler + `fetch` + MSW handler)"; one polling consumer in Phase 03 doesn't justify a new client data-fetching library, and `next-frontend-openapi-typing/TD-01` reserves TanStack Query adoption for when client-side fetching grows. The hook polls `GET /api/videos/{id}` while `processing_status ∈ {uploaded, processing}`, schedules the next request only after the previous one settles (no overlapping requests), and stops at a terminal state.

### e2e-video-upload-fixtures/TD-01

**Recommendation:** It covers the one risk unit tests cannot (the provider surviving navigation and driving the page), with no new infrastructure. Playwright already handles the CORS preflight for routed requests, and the real S3/CORS contract stays proven where it lives, in the backend's MinIO integration test. Option B pays for a second storage stack to re-prove what SI-03.8 already proves, and Option C drops coverage of the flow's main risk.
**Libraries:** —

### e2e-video-upload-fixtures/TD-02

**Recommendation:** It is the only option that makes the real sequence observable without race-prone assertions or shared reserved IDs. Unique `publicId`s give per-test isolation that holds under `fullyParallel` against the single Next process. The cost is one documented exception to the stateless convention, scoped to resources that have a lifecycle (video processing status). Stateless triggers remain the default for everything else.
**Libraries:** —

**Revisions:**
- 2026-10-13 — `publicId`s generated by the in-memory store are deterministic: a module-level counter rendered as an 11-char base64url-shaped ID (`vid` + zero-padded number, e.g. `vid00000001`), never colliding with the reserved triggers. `resetVideoStore()` (called from `mocks/setup.ts` `afterEach`) clears the records and resets the counter, so every Vitest test sees the same ID sequence and can assert exact values. In E2E all Playwright workers hit one Next.js process, so the shared counter keeps IDs unique across parallel tests. This replaces the Cons clause "Vitest tests must not assume a fixed `publicId`". _Rationale:_ Deterministic counter — keeps `next-frontend-openapi-typing/TD-05` ("determinism over auto-generation") and `next-frontend-msw-foundation/TD-03` ("hand-written deterministic defaults") intact (resolves ICC-1 of phase-03 validation).

### video-metadata/TD-01

**Recommendation:** The contract carries only what screens use, so the FE side is identical to Option A. The worker already holds the full probe object (fluent-ffmpeg returns it in one call), so keeping it costs a column and saves a 10GB re-download whenever someone needs another field or has to explain a failure. Option A is equivalent if you don't value diagnostics. Option C is extrapolation with no consuming screen.
**Libraries:** —

**Revisions:**
- 2026-10-07 — No raw-probe column is persisted: the Recommendation's internal `jsonb` probe (Option B) is not part of the decided contract. Failure diagnostics come from worker logs plus the `failureReason` enum (TD-04). _Rationale:_ Diagnostics via logs; no unused column.

### video-metadata/TD-02

**Recommendation:** Probing the original is already paid for by TD-08, so exposing it costs one write. It answers the inventory's open question with real data instead of placeholders for the whole `processing` window, which matters on the transcode path. The final probe keeps the "what you see is what you download" guarantee. Choose Option A if a single write is preferred and placeholders during processing are acceptable.
**Libraries:** —

### video-metadata/TD-03

**Recommendation:** It keeps the contract numeric and stable across Phases 03–07 while presentation stays where the copy lives. The two choices that matter for correctness, integer milliseconds and rotation-applied display dimensions, are fixed once at the source in the worker. Option B only pays off with a second non-web client, which the project doesn't have.
**Libraries:** —

### video-metadata/TD-04

**Recommendation:** A small enum makes `failed` actionable for the user. It follows the project's habit of typed contracts flowing through OpenAPI to `types.gen.ts`, and stderr stays server-side. Product policies such as maximum duration or resolution, if adopted, become new codes rather than new mechanisms.
**Libraries:** —

**Revisions:**
- 2026-10-07 — Adds the `upload_abandoned` code, set by the abandoned-upload sweep from the `phase-03-videos/TD-04` revision. Because TD-01 stays on Option A, ffmpeg stderr goes to worker logs only (there is no internal probe column). _Rationale:_ A new product policy becomes a new code, per this TD's Recommendation.

### video-metadata/TD-05

**Recommendation:** It keeps the screen driven by one contract. Paired with TD-02 Option C, the real values appear seconds after the upload completes. Option B is a purely additive FE enhancement that can be added later without touching the backend or the contract.
**Libraries:** —

## Inherited Decisions Detail

### phase-01-configuracao-base/TD-01

**Recommendation:** Option A (@nestjs/config) — Official, core-team-maintained, guaranteed NestJS 11 compatibility. The `registerAs()` factory pattern solves the TypeORM CLI sharing problem: the factory function can be imported as a plain function by `data-source.ts` while also serving as a DI injection token inside NestJS. Building a custom module recreates solved functionality; third-party packages carry maintenance risk.
**Libraries:** `@nestjs/config@^4.x`

### phase-01-configuracao-base/TD-02

**Recommendation:** Option A (Joi) — First-class integration with `@nestjs/config` via `validationSchema`, requiring zero custom wiring. Handles string-to-number coercion natively. Using a different tool for env validation vs. request validation is reasonable — env config is validated once at startup, DTOs are validated per-request. Zod is elegant but adds a third validation paradigm to the project.
**Libraries:** `joi@^17.x`

### phase-01-configuracao-base/TD-03

**Recommendation:** Option B (Namespaced/grouped with registerAs) — The project roadmap explicitly calls for auth, email, and storage in upcoming phases. Namespaced configs provide clear file boundaries per domain, typed injection via `ConfigType<typeof databaseConfig>`, and natural scalability. The `registerAs()` factory is dual-purpose: DI token inside NestJS and plain importable function for `data-source.ts`. Initial files for Phase 01: `src/config/database.config.ts`, `src/config/app.config.ts`.
**Libraries:** —

### phase-01-configuracao-base/TD-04

**Recommendation:** Option A (Shared registerAs factory) — Natural outcome of choosing `@nestjs/config` with `registerAs`. The factory is already callable by design. `data-source.ts` imports it, calls `dotenv.config()`, then calls the factory. Zero duplication, minimal code, no extra abstraction.
**Libraries:** `dotenv` (transitive via `@nestjs/config`)

### phase-02-auth/TD-01

**Recommendation:** Argon2id — For a greenfield project in 2026, Argon2id is the OWASP-recommended choice. The native build dependency is a one-time Docker setup cost. The project has no legacy constraints favoring bcrypt. OWASP minimum: 19MiB memory, 2 iterations.
**Libraries:** `argon2@^0.41.x`

### phase-02-auth/TD-02

**Recommendation:** Option A (@nestjs/passport) — The project plan includes only email/password auth for now, but the plugin architecture costs little and future phases may add social login. Aligns with official NestJS docs, making onboarding and maintenance easier.

**Note:** Decision deliberately diverged from the Recommendation during implementation — custom guards were preferred over `@nestjs/passport` to keep the dependency surface smaller; social login is not on the near-term roadmap, so the plugin-architecture benefit did not justify the extra abstraction layer.
**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-03

**Recommendation:** Option A (Refresh Token Rotation) — Provides the strongest security model with automatic theft detection. The DB write overhead is acceptable for a video platform (auth refresh is infrequent vs. video operations). PostgreSQL is already in the stack, so no new infrastructure needed. Race conditions can be mitigated with a short grace period for the old token.
**Libraries:** —

### phase-02-auth/TD-04

**Recommendation:** Option B (Random Opaque Tokens in DB) — Revocability is important: when a user requests a new password reset, previous tokens should be invalidated. The DB table is trivial to implement, and the tokens table can also serve future needs (e.g., API keys). Keeps email tokens decoupled from the JWT auth system.
**Libraries:** —

### phase-02-auth/TD-05

**Recommendation:** Option A (@nestjs-modules/mailer) — Best NestJS integration with minimal boilerplate. Supports SMTP (matching the architecture diagram), works with MailHog/Mailpit for local development without external dependencies, and scales to any SMTP provider in production. Template engine support (Handlebars) simplifies email formatting. No vendor lock-in.
**Libraries:** `@nestjs-modules/mailer@^2.x`, `handlebars@^4.x`

### phase-02-auth/TD-06

**Recommendation:** Option A (class-validator + class-transformer) — This is a backend-only project (no shared schemas with frontend), so Zod's single-source-of-truth advantage is less impactful. class-validator is the documented NestJS approach, and the project already uses decorators extensively (TypeORM entities, NestJS DI). Fewer integration surprises with NestJS 11.
**Libraries:** `class-validator@^0.14.x`, `class-transformer@^0.5.x`

### phase-02-auth/TD-07

**Recommendation:** Option A (Custom Domain Exception Filter) — Provides machine-readable error codes that the Next.js frontend can switch on, without the overhead of RFC 9457's URI-based type system. The project is single-consumer (first-party frontend), so a simple `{ statusCode, error, message }` format with domain codes balances clarity and simplicity. The custom filter cost is low — two small files.
**Libraries:** —

### phase-02-auth/TD-08

**Recommendation:** Option A (@nestjs/throttler) — Native NestJS integration is decisive: the guard system allows scoping rate limiting to `AuthModule` only via module-level `APP_GUARD`, with `@SkipThrottle()` for exemptions. The project is single-instance with no distributed requirements, so in-memory storage is sufficient. Using express-rate-limit would bypass NestJS's DI and guard lifecycle for no clear benefit.
**Libraries:** `@nestjs/throttler@^6.x`

### phase-02-auth/TD-09

**Recommendation:** Option B (Opaque) — Since DB lookup is mandatory (TD-03), JWT signature adds no security value. Opaque tokens are shorter, leak no data, and are simpler to generate.

**Note:** Decision deliberately diverged from the Recommendation — JWT was kept to reuse the access-token signing/verification infrastructure (`@nestjs/jwt`), trading token size and base64-readability for a single token format across the codebase.
**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-10

**Recommendation:** Option A — The platform is a video sharing service with URL-based channel handles. A strict `[a-z0-9_]` allowlist is the simplest and most portable choice: no extra dependencies, no edge cases around hyphen positioning, and the `user_<random>` fallback provides a valid handle even for extreme email prefixes. Hyphens can always be added in a future iteration if user feedback justifies it.
**Libraries:** —

### phase-02-auth-frontend/TD-01

**Recommendation:** Three reasons. (1) **Architectural fit.** The strict-BFF model in `next-frontend-config-base/TD-03` already nominates the Route Handler as the only NestJS caller; cookie-based sessions are the natural match, and Auth.js's framework adds layers between the BFF and the cookie that buy nothing because the backend is the auth authority — Auth.js's value (DB adapters, OAuth providers, magic-link, `getServerSession` helpers) is mostly unused in this configuration. (2) **Smaller blast radius.** A ~50-LOC session helper is grep-friendly, debuggable, and test-friendly via the existing MSW+BFF integration test pattern; a misconfigured Auth.js callback is a longer fault-isolation loop. (3) **Compatibility with Next.js 16 / React 19.** Built-in `next/headers` `cookies()` is the canonical primitive both runtimes already use; Auth.js v5 versions track Next.js majors with a lag, adding compatibility risk that Option A does not have. Option C is rejected as unsafe (`localStorage` for refresh tokens) and architecturally regressive (loses RSC personalization).
**Libraries:** —

### phase-02-auth-frontend/TD-02

**Recommendation:** Three reasons. (1) **Defense in depth on the cookie content** — `httpOnly` blocks JS, encryption blocks accidental log/proxy inspection; the marginal cost is one ~3KB dep. (2) **Single cookie to manage** simplifies logout (one `session.destroy()` call) and avoids the orphan-cookie failure mode of Option A. (3) **Room to carry minimal user metadata** (`userId`, `email`, `channelSlug`) lets `app/layout.tsx` RSC render the authenticated chrome (avatar, channel name) without a per-render `/auth/me` round-trip — Phase 04+ gains compound here. Option A is a viable downgrade if the team rejects `iron-session` for any reason; the migration A→B (or B→A) is a one-Route-Handler refactor with no test changes downstream because the BFF interface is unchanged. Option C is rejected: it solves a problem (server-side revocation) the project does not have at the cost of infrastructure the project does not own.
**Libraries:** iron-session

### phase-02-auth-frontend/TD-03

**Recommendation:** The single-flight detail is non-trivial and goes in the helper from day one — tested by MSW with a "two concurrent intercepted upstream calls; one refresh expected" assertion. Option B's client-driven pattern is rejected because it doesn't replace Option A (RSC still needs server-side refresh) — adopting B means doing both. Option C's pre-emptive timer is rejected because the failure modes (multiple tabs, sleep/wake) outweigh the latency saving and force a `"use client"` shell near the root.
**Libraries:** —

### phase-02-auth-frontend/TD-04

**Recommendation:** Three reasons. (1) **Decoupled from TD-05** — works with Route Handlers OR Server Actions; the form code does not change if TD-05 is revisited later. (2) **Aligned with shadcn's canonical form primitive** — the project already commits to `radix-nova` shadcn (`components.json`); `npx shadcn@latest add form` produces react-hook-form wrappers; choosing react-hook-form means using the supported primitive instead of hand-rolling around it. (3) **Zod-first developer ergonomics match the rest of the FE foundation** — `next-frontend-config-base/TD-01` chose Zod 4 for env; the same schemas-as-source-of-truth pattern carries to forms with zero new validator paradigm. Option B is rejected for impedance with shadcn's primitive and for over-investing in progressive-enhancement that the strict-BFF model does not require. Option C is rejected for the per-field boilerplate and the loss of client-side feedback on a project that values quick, type-safe form iteration.
**Libraries:** react-hook-form, @hookform/resolvers

### phase-02-auth-frontend/TD-05

**Recommendation:** Three reasons. (1) **Strict-BFF alignment.** `next-frontend-config-base/TD-03` named Route Handlers as the BFF surface; Option A keeps every mutation visible under `app/api/**`. (2) **Test scaffold already exists** — `next-frontend/CLAUDE.md` § Testing and `next-frontend-msw-foundation` were authored for Route-Handlers-as-functions; Option A reuses them with zero invention. (3) **Single mutation surface** — Phase 02 sets the precedent for Phases 03–07; uniformity beats per-mutation idiom-picking when the cost of inconsistency compounds (Option C). Option B has real ergonomic appeal for the simplest forms but fragments the BFF surface and forces test-pattern reinvention; if the team later wants progressive enhancement for specific forms, the migration A→B is per-form and doesn't require touching unrelated routes — A is the safer default and the cheaper baseline.
**Libraries:** —

### phase-02-auth-frontend/TD-06

**Recommendation:** Two reinforcing reasons. (1) **No first-render flicker, no round-trip** — the session is delivered in the same response as the page HTML; the Client Provider hydrates with the correct initial state; users never see "Login" briefly turn into their avatar. (2) **No new BFF endpoint** — the cookie is the source of truth, RSC reads it, the Provider broadcasts it; the BFF surface stays minimal. The `router.refresh()` requirement after mid-session mutations is a small price (one line in the relevant mutation handler) for the structural benefits. Option B is rejected for the double-read-and-flicker; Option C is dominated by Option B and rejected.
**Libraries:** —

### phase-02-auth-frontend/TD-07

**Recommendation:** Three reasons. (1) **First-paint-correct** — the user sees the right outcome on the first paint, no skeleton, no flicker. (2) **Single integration pattern across both flows** — confirmation is RSC-only; reset is RSC + Client form (TD-04, TD-05 patterns reused) — both share the "RSC owns the token, Client Component owns the input" split. (3) **Email-prefetch behavior** is solved at the backend's idempotent-confirmation level (a small note for `/plan-build` to confirm; not a separate TD). Option B's Route-Handler-as-link-target adds redirects for no clean gain. Option C is dominated.
**Libraries:** —

### next-frontend-config-base/TD-01

**Recommendation:** **Option A (Zod 4)**. Three converging reasons: (1) **Type-inference matches the FE's strict-TS culture** — `lib/env.ts` exports a typed `env` object with no `as` casts, satisfying the project's "Type Safety" working principle. (2) **Ecosystem gravity in Next.js / React 19** — Zod is the de-facto schema language for App Router (Server Actions inputs, form resolvers, future contract validation), so introducing it once at the env layer compounds value for forms in Phase 02+. (3) **Direct enablement of TD-02 Option A (`@t3-oss/env-nextjs`)** — t3-env's first-citizen validator. Backend parity with Joi is not load-bearing: env schemas are not shared FE↔BE (different runtimes, different key sets); two validators across two subprojects is a bounded cost.
**Libraries:** zod

### next-frontend-config-base/TD-02

**Recommendation:** **Option A (`@t3-oss/env-nextjs`)**. The only option that combines (i) **type-level NEXT_PUBLIC_ prefix enforcement**, (ii) **runtime Proxy-based leak detection**, and (iii) **single-file, single-import-path consumer ergonomics**. Option B reaches roughly the same _structural_ outcome at higher implementation and maintenance cost, with a weaker guarantee (no prefix enforcement, no proxy). Option C is unsafe at any non-trivial team size. The marginal cost over B is one ~3KB dep — well-spent for the strongest boundary among the three.
**Libraries:** @t3-oss/env-nextjs

### next-frontend-config-base/TD-03

**Recommendation:** **Option A (Strict BFF — single server-only `API_URL`)**. Aligned with the BFF testing strategy and architectural commitment already documented in `next-frontend/CLAUDE.md` (Route Handlers as the only NestJS caller; BFF tests stub `fetch` via MSW). Eliminates CORS, eliminates public exposure of the backend URL, and produces the smallest correct foundation. Option B's `NEXT_PUBLIC_API_URL` is a future-proofing concession with no current consumer — and adding a public key later is a non-breaking change, while removing one is breaking. Option C ties a foundational decision to infra work explicitly deferred elsewhere. The Docker networking gap (how server-in-container resolves the backend) is a separate orthogonal decision, surfaced below.
**Libraries:** —

### next-frontend-msw-foundation/TD-01

**Recommendation:** **Option B (per-domain modules + barrel)**. Three reasons. (1) **MSW's own best-practice recommends it** — the project should not invent its own scheme when the official one is documented and matches the codebase's domain orientation. (2) **Domain ownership tracks the codebase**, not the project plan — `components/`, `app/api/`, and any future feature folders will be organized by domain (auth, videos, channels), so handler files mirror that vocabulary and remain stable as phases come and go. (3) **Append-only growth with minimal merge conflicts** — each phase touches a new file plus one line in the barrel, which is the smallest practical concurrent-PR footprint. Option A is acceptable through Phase 02 alone (~5–7 endpoints) but accumulates costs that B avoids from day one; bootstrapping directly into B costs one extra file and one barrel and pays off by Phase 03. Option C's phase coupling is rejected outright — domain-by-phase is a category error.
**Libraries:** —

### next-frontend-msw-foundation/TD-02

**Recommendation:** **Option A (test-only, `setupServer` only at the foundation)**. The browser worker is a future capability with no documented current consumer; wiring it now (Option B) is speculative investment, and wiring it incoherently (Option C) actively misleads developers into thinking interception works when it doesn't under strict BFF. Option A keeps the foundation minimal, aligns 1:1 with everything CLAUDE.md and the existing rules currently document, and is non-breaking to extend.
**Libraries:** —

### next-frontend-msw-foundation/TD-03

**Recommendation:** **Option D (hand-written defaults as the default + opt-in seeded faker for bulk collections)**. Reasons: (1) **Option B's determinism + readability is the right baseline** — every fixture in Phase 02 (5–7 endpoints, single-record-mostly) is naturally hand-written, and the diff-revealing override pattern is the highest-value benefit. (2) **Bulk-collection cases will arrive (Phase 07 home page grid, Phase 06 comment threads) and inline hand-written lists of 20+ items are genuinely tedious** — keeping faker available as a scoped tool is pragmatic. (3) **Per-fixture local seeding eliminates the global-cursor pitfall** that makes Option C structurally fragile — using `faker.seed(N)` immediately before a collection-builder run scopes the determinism to that fixture and isolates it from upstream changes to other factories.
**Libraries:** —

### next-frontend-msw-foundation/TD-04

**Recommendation:** **Option A (universal handler set + `server.use(...)` overrides + `onUnhandledRequest: "error"`)**. The user's "import only what it needs" requirement is satisfied at the *authoring* layer by TD-01 (per-domain files; each phase adds one file). At the *runtime* layer, loading all handlers is the canonical MSW v2 model and imposes no cost on tests that don't fetch the extra URLs. `onUnhandledRequest: "error"` enforces that a phase's test cannot accidentally invoke a route outside its scope (the fetch fails loudly with "no handler matched"), which is the strongest version of "stays inside its phase" available. Option B's per-suite composition pays real boilerplate cost for an explicitness gain that TD-01 already provides at a different layer. Option C invents a Vitest-projects-shaped problem for a phase-shaped concern.
**Libraries:** —

### next-frontend-openapi-typing/TD-01

**Recommendation:** **Option A (`openapi-typescript` + `openapi-fetch`)**. Three reinforcing reasons. (1) **Strict BFF makes the SDK surface valueless on the client.** Only Route Handlers ever call the upstream Nest; they already use `fetch` (Next 16's caching extensions sit on top of native `fetch`); a generated SDK adds a third client style to learn for zero functional gain. (2) **Types-first matches the rest of the FE foundation.** Env validation is Zod-derived types; component variants are `cva` types; both are TS-first with zero generated runtime. `paths` is the natural extension — one `.d.ts` file imported wherever the contract is touched. (3) **MSW typing is solved by the same `paths` symbol.** Hand-written handlers in `mocks/handlers.ts` type their resolver returns off `paths["/videos"]["get"]["responses"][200]`, giving the contract guarantee without orval/kubb's verbose generated handlers (which would be overridden per-test anyway). The marginal cost of adding `openapi-fetch` (~6KB, server-side only) is small enough that we recommend the **types + thin-client** pair, not types alone — `openapi-fetch` removes the `fetch(API_URL + path, { method, headers, body })` boilerplate in each Route Handler while staying within the BFF model. Options B/C/D may be revisited if (a) client-side data-fetching enters the stack with TanStack Query and per-endpoint hooks are wanted, or (b) the API grows beyond ~20 operations and per-call boilerplate becomes painful.
**Libraries:** openapi-typescript, openapi-fetch

### next-frontend-openapi-typing/TD-02

**Recommendation:** **Option B (committed local copy + repo-root sync script)**. Three reasons. (1) **Preserves the compose-stack independence** that `next-frontend-config-base/TD-03` Context calls out as the current architecture — neither subproject's compose file references the other. (2) **Drift is eliminated structurally when paired with TD-03's CI freshness check** — the check runs the sync script and asserts no diff on either `openapi.json` or `types.gen.ts`, so a backend PR that forgets to re-sync fails CI with a clear message. (3) **The committed local file is a real artifact in PR review** — reviewers see the contract change in `next-frontend/openapi.json`'s diff at the same time as the backend change, doubling the visibility (an `openapi.json`-only diff in a feature PR is a red flag for accidental drift). Option A is acceptable as a pre-CI fallback; Option C is rejected because the cross-stack file dependency in `docker-compose.yaml` introduces coupling that the current architecture explicitly avoids, and the "no drift" gain over B is small once TD-03 lands.
**Libraries:** —

### next-frontend-openapi-typing/TD-03

**Recommendation:** **Option C (committed + CI freshness check)**. It is the only option that makes contract drift _both_ visible (in PR diffs) _and_ impossible to merge accidentally (CI fail). The complexity premium over Option A is one CI step. Option B's "no committed artifacts" purity is poorly paid for in a monorepo where the cross-subproject build coupling becomes a real ergonomic cost, and it wastes the PR visibility that TD-02 Option B's committed `openapi.json` is specifically designed to deliver. Option A is acceptable as a temporary state until the CI pipeline lands; downgrading from C to A is reversible (just remove the CI step) but upgrading to C later requires explaining `types.gen.ts` history in a separate commit. Start at C. Apply the same script-and-check pattern to any future generated artifact (e.g., if `openapi-fetch` is wrapped, the wrapper file is hand-written; the only generated artifact remains `types.gen.ts`).
**Libraries:** —

### next-frontend-openapi-typing/TD-04

**Recommendation:** **Option A (single `lib/api/contracts.ts` with explicit aliases)**. It is the only option that (i) handles pass-through and reshape with the same mechanism, (ii) gives a single grep target for "what shape does the BFF expose", and (iii) decouples Component imports from App Router file paths (Components import `from "@/lib/api/contracts"`, not `from "@/app/api/videos/route"`). Option B is theoretically minimal but fragile against Next's actual RSC/Client/Route-Handler typing; Option C scatters the contract surface and creates drift opportunities. The "long file" concern is bounded — for the scope of StreamTube, the BFF will likely have <30 contract aliases at peak; sectioning by feature header comments is sufficient. Make `lib/api/contracts.ts` the only file that imports `paths` from `types.gen.ts` (lintable later); every other consumer imports from `contracts.ts`.
**Libraries:** —

### next-frontend-openapi-typing/TD-05

**Recommendation:** **Option A (hand-written, typed via `paths`)**. Reasons: (1) **Determinism over auto-generation** — BFF integration tests assert on specific values; randomized fixtures are anti-helpful. (2) **Coherence with TD-01 recommendation** — `openapi-typescript`'s `paths` type is the single contract anchor; reusing it in MSW handlers means "spec ↔ handler ↔ assertion" is one type chain. (3) **Scale fit** — Phase 02 introduces few endpoints; the manual cost is negligible at this stage. If the API grows to dozens of endpoints and authoring overhead becomes real, this TD can be superseded with a Kubb-or-hey-api MSW plugin without touching TD-01's `paths` import sites (the generator just produces additional handler files; the existing manual handlers stay valid). Option B locks the project into a heavier TD-01 choice for marginal mock-authoring savings; Option C is Option A with an unnecessary detour.
**Libraries:** —

### openapi-docs-nestjs/TD-01

**Recommendation:** **Option A (`@nestjs/swagger`)** — é a única opção que preserva as decisões anteriores (`class-validator` em TD-06 de phase-02-auth) sem re-platform; o CLI plugin com `classValidatorShim: true` aproveita os decoradores `class-validator` existentes para inferir schemas, mantendo o boilerplate baixo. Nestia tem mérito técnico real mas o custo de migração do stack de validação inviabiliza-a sem uma decisão upstream de supersede de TD-06. Manual authoring é descartado.
**Libraries:** @nestjs/swagger
**Revisions:**

- 2026-05-12 — Esclarece que o CLI plugin (`classValidatorShim: true`) cobre apenas inferência de schemas de DTOs a partir de `class-validator`; documentação de operações, respostas tipadas por status code, contratos de erro (alinhados ao envelope de phase-02-auth/TD-07) e exemplos exigem decoradores explícitos (`@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiParam`, `@ApiQuery`, `@ApiExtraModels`). _Rationale:_ openapi.json gerado pelo bootstrap atual está genérico — sem detalhes de parâmetros, schemas de retorno por status, nem contratos de erro — porque a base instalada se apoiou só na introspecção automática. Esta revisão fixa que enriquecimento via decoradores explícitos faz parte da Option A escolhida, não é trabalho fora do escopo do TD.

### openapi-docs-nestjs/TD-02

**Recommendation:** **Option C (Ambos)** — o custo marginal sobre Option A é apenas um npm script (~15 linhas) e o benefício é uma fundação correta para futura integração FE (codegen offline) sem perder a UI interativa que dev/QA usam. Option B sozinho pune a experiência de desenvolvimento em dev/local; Option A sozinho compromete o pipeline de codegen futuro. Combinar é dominante.
**Libraries:** —

### openapi-docs-nestjs/TD-03

**Recommendation:** **Option B (Apenas em dev/staging)** — alinha com a postura defensiva já estabelecida em phase 02 e não compromete consumidores legítimos (o `openapi.json` commitado em TD-02 cumpre o papel de "spec consultável fora da UI"). Re-abrir como Option A ou C é trivial no futuro se um caso de uso de API pública aparecer.
**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOpt... _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`; the same factory is importable as a plain function... _(from phase 01)_
- `data-source.ts` loads `.env` via `import 'dotenv/config'` at the top, then imports `databaseConfig` and calls it as a plain function. _(from phase 01)_
- Database connection parameters (host, port, etc.) are sourced from a single `databaseConfig` factory — never duplicated between `AppModule` and... _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `imports: [ConfigModule]`, `inject: [databaseConfig.KEY]`, `useFactory` returning... _(from phase 01)_

## Inherited Deferred Capabilities

| Capability | Status | Origin phase | Rationale |
|-----------|--------|--------------|-----------|
| Telas de frontend | deferred | phase-01-configuracao-base | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| Telas de cadastro, login, confirmação de conta e recuperação de senha | deferred | phase-02-auth | `next-frontend/` is not initialized in this phase; UI surfaces start in a later phase. |
| "Confirmação de conta via e-mail com link de ativação" | deferred | phase-02-auth-frontend | deferred_to_next_phase — UI landing screen de-scoped 2026-05-14; FE confirmation flow (TD-07) picked up by a future phase. BE side unchanged in `phase-02-auth`. |
| "Logout" | deferred | phase-02-auth-frontend | deferred_to_next_phase — logout button lives inside authenticated chrome (typically Phase 04). Phase 02 still implements POST `/api/auth/logout` (BFF route handler + `session.destroy()`) so the contract is ready when the chrome lands. |
| "Recuperação de senha (destination screen / set-new-password)" | deferred | phase-02-auth-frontend | deferred_to_next_phase — `/forgot-password` ships this phase sending the e-mail; the reset-password destination screen is absent from Figma → link destination remains a 404 until a later phase delivers the screen via `/screen-inventory` extension run. Documented as a known gap. |
| "Telas de cadastro, login, confirmação de conta e recuperação de senha" | deferred | phase-02-auth-frontend | a tela de confirmação da conta não será implementada nesta fase corrente, será adiada — the umbrella bullet's full coverage requires the confirmação and reset-password destination screens; both are deferred per Non-UI rows above. The 3 ship-this-phase telas (signup, login, forgot-password) are inventoried and covered by their own verbs; the umbrella bullet itself is deferred to the phase that lands the missing screens. |

## UI Inventory

**Source:** `docs/inventories/screen-inventory-phase-03-videos.md`
**Screens in scope:** 3

### UI ↔ Capability Join

| Screen | Route | Verb | Capability | Covering Component |
|--------|-------|------|------------|-------------------|
| Tela de upload de vídeo | /studio/upload | Pré-cadastrar o vídeo como rascunho ao selecionar ou soltar o arquivo | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload" | UploadDropzone + SelectFilesButton |
| Tela de upload de vídeo | /studio/upload | Iniciar o envio do arquivo de vídeo (até 10GB) para o armazenamento | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" | UploadDropzone + SelectFilesButton |
| Tela de upload de vídeo | /studio/upload | Obter o identificador público único do vídeo recém-criado para redirecionar à sua página | "URL única por vídeo, sem conflito com outros vídeos" | UploadDropzone |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Enviar o arquivo do vídeo direto ao armazenamento em partes, de forma retomável | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" | UploadProgressPanel |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Exibir o progresso do envio do arquivo de vídeo | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" | UploadProgressPanel |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Concluir o envio e marcar o vídeo como enviado para processamento | "Processamento automático do vídeo após upload (extração de duração e metadados)" | UploadProgressPanel |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Acompanhar o status de processamento do vídeo após o envio | "Processamento automático do vídeo após upload (extração de duração e metadados)" | UploadProgressPanel (slot UploadStatusLabel) |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Exibir os dados do rascunho do vídeo pré-cadastrado | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload" | CardVideoConfig |
| Tela do vídeo no studio — upload em andamento | /studio/videos/[publicId] | Exibir a URL única do vídeo | "URL única por vídeo, sem conflito com outros vídeos" | CardVideoConfig (VideoLink) |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Reproduzir o vídeo via streaming na prévia do studio | "Reprodução via streaming (sem necessidade de download completo)" | Video player (in CardVideoConfig) |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Exibir a URL única do vídeo para compartilhamento | "URL única por vídeo, sem conflito com outros vídeos" | CardVideoConfig (VideoLink) |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Exibir metadados extraídos do vídeo (duração e qualidade) | "Processamento automático do vídeo após upload (extração de duração e metadados)" | CardVideoConfig |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Exibir o nome original do arquivo do vídeo pré-cadastrado | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload" | CardVideoConfig (Filename block) |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Exibir a thumbnail gerada automaticamente | "Geração automática de thumbnail a partir de um frame do vídeo" | ThumbUpload |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Acompanhar o status de processamento do vídeo até um estado terminal | "Processamento automático do vídeo após upload (extração de duração e metadados)" | ProcessingStatus |
| Tela do vídeo no studio — upload concluído (player + download) | /studio/videos/[publicId] | Baixar o arquivo do vídeo processado | "Download do vídeo pelo usuário" | DownloadButton (in CardVideoConfig) |

### Server-connected Components

- `UploadDropzone` (Tela de upload de vídeo) — `Reuse?: new`
- `SelectFilesButton` (Tela de upload de vídeo) — `Reuse?: components/ui/button.tsx`
- `UploadProgressPanel` (Tela do vídeo no studio — upload em andamento) — `Reuse?: new`
- `CardVideoConfig` (Tela do vídeo no studio — upload em andamento) — `Reuse?: new`
- `CardVideoConfig` (Tela do vídeo no studio — upload concluído (player + download)) — `Reuse?: new`
- `Video player` (Tela do vídeo no studio — upload concluído (player + download)) — `Reuse?: new`
- `ThumbUpload` (Tela do vídeo no studio — upload concluído (player + download)) — `Reuse?: new`
- `ProcessingStatus` (Tela do vídeo no studio — upload concluído (player + download)) — `Reuse?: new`
- `DownloadButton` (Tela do vídeo no studio — upload concluído (player + download)) — `Reuse?: components/ui/button.tsx`

### Open Questions from Inventory

- **Componentes `(new)` fora do escopo da fase 03:** as telas 2734:2140 e 2734:2196 inventariam o formulário de metadados (Fase 04), que o usuário decidiu omitir por inteiro. Os componentes planejados só por esse formulário, `components/ui/textarea.tsx (new)`, `components/ui/select.tsx (new)` e `components/studio/privacy-option.tsx (new)`, NÃO devem gerar SI de bootstrap (`phase-b.md` § B2.6) nesta fase. As linhas Title/Description/Change Thumbnail/Category/Visibility/Cancel/Save Changes também não entram nos UI Contracts da fase 03. `plan-build` precisa respeitar as notas "Omitido na fase 03 / Fora do escopo da Fase 03".
- **Componentes `(new)` da fase 03 (gatilho de B2.6):** `components/layout/side-nav.tsx`, `components/layout/side-nav-item.tsx`, `components/layout/subscriptions-channel-list.tsx`, `components/studio/upload-dropzone.tsx`, `components/studio/upload-progress-panel.tsx`, `components/studio/video-status-badge.tsx`, `components/studio/video-details-card.tsx`, `components/studio/video-player.tsx`, `components/studio/copy-link-button.tsx`, `components/studio/thumb-upload.tsx`, `components/studio/processing-status.tsx`, `components/ui/progress.tsx`, `components/ui/section-header.tsx`, `components/icons/upload-icon.tsx`, `components/icons/video-file-icon.tsx`. Confirmar com `plan-build` que todos serão materializados nesta fase.
- **Estados de processamento sem design (TD-06/TD-11):** só existem frames para "upload em andamento" (`Uploading`, 84%) e "concluído" ("Checks complete. No issues found."). `uploaded`, `processing` e `failed` (com retry/mensagem de erro) não têm design, e também não há badge de `publication_status` (`draft`). A copy "Checks complete. No issues found." não corresponde a nenhum valor do TD-06. Decidir copy/cores/posição desses estados: (a) inferir no implement a partir de `UploadStatusLabel`/`ProcessingStatus`; (b) pedir variants ao designer.
- **Erros e estados da tela de upload (`/studio/upload`):** sem design para drag-over/hover da dropzone, arquivo acima de 10GB, tipo não suportado, falha no pré-cadastro do rascunho e carregamento/desabilitado entre a seleção e o redirect.
- **Um ou vários arquivos:** a copy usa plural ("Drag and drop video files", "Select files"), mas o fluxo decidido redireciona para uma única `/studio/videos/[publicId]`. Confirmar upload de um arquivo por vez (Uppy `maxNumberOfFiles: 1`, TD-05) e ajustar a copy.
- **Continuidade do upload entre rotas e após reload (TD-04/TD-05):** o envio começa em `/studio/upload` e continua em `/studio/videos/[publicId]`, então a instância Uppy e o `File` precisam sobreviver à navegação (provider no layout de `/studio`). Num reload ou acesso direto durante o envio, a referência ao arquivo se perde. Decidir se a retomada é só automática dentro da sessão, se usa `@uppy/golden-retriever` (mencionado como opcional no TD-05) ou se há um estado "envio interrompido — selecione o arquivo novamente", que hoje não tem design. A fase 03 não tem cancelamento explícito de upload (decisão do usuário).
- **Copy do heading em `/studio/videos/[publicId]`:** os dois frames exibem "Channel Settings" (156:2114, 156:2794), copy herdada de outra tela. Definir o título correto (por exemplo, nome do arquivo ou "Video details").
- **Player sem controles no Figma:** o player (I156:3122;156:3089) é um placeholder estático (play + "0:00"). Confirmar uso de `<video controls>` nativo (TD-08) com a thumbnail como `poster`.
- **Download sem design:** o DownloadButton foi adicionado por decisão do usuário sem node Figma. Posição (CardVideoConfig), label e ícone serão inferidos no implement; o botão só fica habilitado em `ready`.
- **Campos dependentes do processamento durante o upload:** VideoQualityRow ("1080p HD"), duração do player e ThumbUpload só têm dado real depois do processamento. Definir placeholder/"—"/oculto até `ready`.
- **VideoLink aponta para `/v/...` (Fase 05):** a rota pública de visualização ainda não existe e o vídeo é rascunho. Decidir se o link aparece desabilitado, oculto ou só como texto copiável até a Fase 05 (e até `ready`). O exemplo "streamtube.com/v/tech2024" não segue o formato de 11 caracteres base64url do TD-07.
- **App chrome / autenticação:** nenhum frame tem top header/app bar (logo, busca, avatar, logout), e não há indicação de rota protegida nem estado para usuário anônimo. A SideNav entra com links para rotas de fases futuras (Home, Subscriptions, Your videos, Liked videos). Decidir o destino desses links nesta fase (stubs, desabilitados ou rotas 404) e o comportamento de `/studio/**` para usuário não autenticado (redirect para `/login`, padrão da Fase 02).
- **Nomes de camadas no Figma:** a dropzone se chama "Channel card" (154:1730) e o círculo do ícone "upload form" (154:1901); os dados de exemplo trazem nomes de arquivo divergentes e barra 80% vs texto 84%. São inconsistências só de design; sugerir correção ao designer.

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|-----------|--------|-----------|---------|
| "Serviço de armazenamento de arquivos (vídeos e thumbnails)" | non-ui | backend_service | phase-03-videos/TD-01 |
| "Serviço de processamento em segundo plano (filas)" | non-ui | backend_service | phase-03-videos/TD-02, phase-03-videos/TD-03 |

## Testing Requirements

### nestjs-project

| Artifact type | Required layers |
|---------------|-----------------|
| Entity (`*.entity.ts`) | Integration: constraints, defaults, `select: false` |
| Service with branching + DB | Unit: branch logic (mock repo) + Integration: DB contract |
| Service with DB only (no branching) | Integration: DB contract |
| Service with configured lib (JWT, cache) | Unit: real lib with test config |
| Service with side-effect dep (email, storage) | Integration: real capture service (Mailpit) or local adapter |
| Module with configured imports | Unit: compilation test |
| Controller | E2E only — do NOT write unit tests |
| DTO | E2E: one validation wiring test per endpoint |
| Guard (delegates to service for business logic) | E2E + Unit if complex internal logic |
| Guard (simple, delegates to Passport) | E2E only |
| Strategy (Passport) | E2E via guard |
| Pipe (custom transformation/validation) | Unit |
| Interceptor (response transform, logging) | Unit and/or E2E |
| Exception Filter | Unit + E2E |
| Middleware | E2E |

_Artifacts not in the checklist (queue processors, worker entrypoint, storage/FFmpeg adapters) → see `artifacts/future-types.md` and `references/external-systems.md` in `testing-guide-nestjs-project`._

### next-frontend

| Artifact type | Required layers |
|---------------|-----------------|
| Page — sync RSC, static, no logic | None at component level; cover only if part of a critical flow → `*.e2e-spec.ts` |
| Page — sync RSC composing client children | Test client children directly; cover rendered page via `*.e2e-spec.ts` |
| Page — async RSC (`async function Page()` with `await`) | `*.e2e-spec.ts` only — Vitest cannot render it |
| Layout (`layout.tsx`) | None unless it adds logic (auth gate, conditional render); else via E2E |
| Client component (`"use client"`) with state/handlers | `*.test.tsx` — RTL + `jsdom` docblock, mock `next/navigation`, MSW for fetch |
| Feature component (server, composes primitives) | Skip unit; cover via the page's E2E |
| shadcn UI primitive (`components/ui/*`) | None — trust the library; cover via consumers |
| Icon (`components/icons/*`) | None |
| `lib/` utility / boundary module with branching or shape assumptions | `*.test.ts` |
| Custom hook (`hooks/*`) | `*.test.ts(x)` with `renderHook`, `jsdom` docblock |
| Route handler (`app/api/**/route.ts`) — proxy or with branching | `*.integration.test.ts` with MSW (+ `*.test.ts` for extracted pure logic) |
| Server action / middleware / error-loading-not-found / metadata | See `artifacts/future-types.md` — depends on type |

_Playwright is not yet installed in `next-frontend` (per the testing guide's 2026-05 tooling status); the first phase needing a browser test triggers the install._
