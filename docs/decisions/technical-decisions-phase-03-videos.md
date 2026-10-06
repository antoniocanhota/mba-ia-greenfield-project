---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-10-06
scope_description: "Phase 03 — object storage, background job queue and video worker, resumable 10GB upload protocol (backend + BFF + browser client), video lifecycle status, unique public video IDs, playback format, media delivery for streaming/download, FFmpeg integration and processing-status propagation to the frontend."
---

# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — primary. Receives the object-storage integration, the queue, the video worker (FFmpeg), the `videos` domain (entity, draft pre-registration, upload orchestration endpoints, processing pipeline) and the new Compose services (object store, queue backend, worker). TD-01, TD-02, TD-03, TD-10 plus the backend side of every Cross-layer TD.
- `next-frontend/` — the upload screen, the browser upload client, the BFF Route Handlers under `app/api/videos/**` that orchestrate the upload (control plane only), and processing-status display. TD-05 plus the frontend side of TD-04, TD-06, TD-07, TD-08, TD-09 and TD-11. Strict BFF (`next-frontend-config-base/TD-03`) stays in force: the browser never calls NestJS directly. Moving bytes straight between the browser and object storage through presigned URLs was already anticipated there ("object storage URLs will need a separate mechanism anyway — presigned URLs from object storage, NOT the backend URL").
- Repo-wide — no open decision. The Compose additions (object store, Redis or equivalent, worker service) are consequences of TD-01, TD-02 and TD-03 and go into `nestjs-project/compose.yaml`, following the Phase 02 Mailpit precedent.

**Inherited constraints (not reopened):** strict BFF with a single server-only `API_URL` (`next-frontend-config-base/TD-03`); error envelope from `phase-02-auth/TD-07`; `JwtAuthGuard` + `@Public()` from `phase-02-auth/TD-02`; class-validator DTOs (`phase-02-auth/TD-06`); OpenAPI → `openapi.json` → `types.gen.ts` contract chain (`openapi-docs-nestjs/TD-02`, `next-frontend-openapi-typing/TD-01..05`); MSW per-domain handlers (`mocks/handlers/videos.ts`, `next-frontend-msw-foundation/TD-01`); react-hook-form + Zod for any metadata form (`phase-02-auth-frontend/TD-04`); Route Handler POST + client `fetch` for mutations (`phase-02-auth-frontend/TD-05`).

**Installed versions checked (2026-10-06):** NestJS 11, TypeORM 0.3.28, TypeScript 5.9.3, Node 25.6 on Debian 12 (backend image); Next 16.2.6, React 19.2.4 (frontend). The backend compiles to **CommonJS** (`module: nodenext`, no `"type": "module"`). That matters for ESM-only libraries (see TD-02 and TD-07).

---

## TD-01: Object Storage Service (dev) and S3 Client

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** The C4 diagram names "S3 or MinIO". Since December 2025 the MinIO community edition has been in maintenance mode: source-only, no new binaries, repository archived in early 2026. The last `minio/minio` image still pulls, but it no longer gets fixes. The application should talk **only to the S3 API**, through `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` v3, which are the de-facto portable S3 client. That keeps production free to use AWS S3, R2 or similar. The open question is which S3-compatible server runs in the dev and test Compose stack. It must support presigned multipart uploads, bucket CORS with an exposed `ETag` (the browser uploads parts directly), HTTP Range on GET, and ideally lifecycle rules (`AbortIncompleteMultipartUpload`).

**Options:**

### Option A: MinIO (last community image)
- Same image and `mc` tooling as most tutorials. Fully featured for presign, multipart, CORS and lifecycle.
- **Pros:** Best-known developer experience; widest community documentation; drop-in for the C4 diagram.
- **Cons:** Archived upstream with no security fixes or features. Pinning a frozen image is technical debt from day one, and the community console was already stripped of admin features in 2025.

### Option B: RustFS
- Apache-2.0 Rust server with a MinIO-like operational model (single container, web console, `mc`-compatible). 1.0 GA on 2026-09-16.
- **Pros:** Actively maintained, permissive license; multipart, presigned URLs, CORS and lifecycle all implemented; closest to a drop-in replacement for MinIO workflows.
- **Cons:** GA is only weeks old, so edge-case S3 fidelity has less field history than SeaweedFS.

### Option C: SeaweedFS (`weed server -s3`)
- Apache-2.0 Go distributed store with an S3 gateway. A single container serves dev.
- **Pros:** Mature and widely deployed; full multipart API (incl. `ListParts`); presigned URLs; permissive CORS fallback exposes `ETag` (4.39+).
- **Cons:** Different operational model (master/volume/filer) leaks into config. Lifecycle support is less complete than MinIO/RustFS, and configuration knobs are less familiar.

### Option D: Garage
- AGPL Rust store aimed at small self-hosted clusters.
- **Pros:** Lightweight and stable.
- **Cons:** Needs bootstrap steps (layout assignment, key creation) before first use, which is friction for `docker compose up`. Partial S3 surface (limited lifecycle, CORS through its own admin API). AGPL.

**Recommendation:** **Option B (RustFS) + `@aws-sdk/client-s3` v3.** RustFS keeps the MinIO workflow the C4 diagram assumed and supports every S3 feature this phase needs (presigned multipart, CORS, lifecycle), without starting the project on an archived image. The app only uses the S3 API through the AWS SDK, so if RustFS shows a fidelity gap, swapping to SeaweedFS (Option C, the close second) only changes the Compose service. Consequence for the env contract: the API needs an **internal** endpoint (`http://<storage-service>:9000`, per the Docker-networking rule) for server-side calls, plus a **browser-reachable public** endpoint (`http://localhost:9000` in dev) used only when presigning URLs. Signing is offline, so a second `S3Client` configured with the public endpoint and `forcePathStyle: true` produces URLs the browser can resolve.

**Decision:** A (MinIO)

**Notes:** It is old but it is the recommended option for this exercise.

---

## TD-02: Background Job Queue

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** The C4 diagram leaves "Message Queue — TBD". Phase 03 needs one job type for now (process an uploaded video: probe, faststart/transcode, thumbnail). It has retries, a long runtime (minutes for a 10GB file) and progress reporting (feeds TD-11). Later phases may add scheduled jobs (cleanup sweeps).

**Options:**

### Option A: BullMQ + Redis (`@nestjs/bullmq`)
- Redis-backed queue with the official Nest integration (`BullModule`, `@Processor`, `WorkerHost`). `@nestjs/bullmq` 11.0.5/12.0.0 accept Nest 11 and BullMQ 6.
- **Pros:** First-party Nest module; built-in retries/backoff, `job.updateProgress()`, stalled-job detection, `jobId` dedupe (use `videoId` → idempotent enqueue), repeatable jobs; CJS-compatible; optional dashboard (bull-board).
- **Cons:** Adds a Redis container. Enqueue is a dual write (DB commit, then `queue.add`), so a crash in between needs a reconciliation path (re-enqueue stale `uploaded` videos).

### Option B: pg-boss (PostgreSQL)
- Queue tables inside the existing PostgreSQL; jobs can be created **inside the same transaction** that updates the video row.
- **Pros:** No new infra; transactional enqueue removes the dual-write problem; retries, `expireInSeconds`/`heartbeatSeconds` for long jobs.
- **Cons:** v12 is **ESM-only**, which clashes with the CJS Nest build and ts-jest. You either pin 11.x (last CJS) or migrate the module system. The only Nest wrapper (`@wavezync/nestjs-pgboss` 7.x) requires Nest 12, so it would be a hand-written provider. Queue load lands on the primary DB.

### Option C: RabbitMQ (`@nestjs/microservices` RMQ transport)
- AMQP broker; the worker is a Nest microservice consuming a queue.
- **Pros:** Real message broker, good for future fan-out/event routing; official transport.
- **Cons:** Retries, delays and progress tracking are not built in (DLX/TTL plumbing by hand); heavier container; over-powered for one job type.

**Recommendation:** **Option A (BullMQ + Redis).** It is the only option with a first-party Nest 11 integration that fits the CommonJS build. Its progress API and stalled-job detection match long FFmpeg jobs, and `jobId = videoId` makes enqueue idempotent, which contains the dual-write risk with a simple sweep. pg-boss's transactional enqueue is a genuine advantage, but here it costs an ESM migration or a pinned old major plus a hand-written integration.

**Decision:** A (BullMQ + Redis)

---

## TD-03: Video Worker Runtime Topology

**Scope:** Backend

**Capability:** Transversal — covers: Serviço de processamento em segundo plano (filas); Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** The C4 diagram shows a separate "Video Worker (FFmpeg)" container. The worker needs the `Video` entity, the storage client and config, and must not degrade the API ("sem impacto na performance"). It also needs scratch disk (about 2× the file size during remux/transcode) and the `ffmpeg` binary. Depends on TD-02.

**Options:**

### Option A: Same Nest codebase, separate entrypoint and Compose service
- `src/worker.ts` boots `NestFactory.createApplicationContext(WorkerModule)` (no HTTP). It runs as a `video-worker` Compose service built from the same image (with ffmpeg added).
- **Pros:** Shares entities, config namespaces, Joi schema and storage module with no duplication; separate CPU, memory and disk limits; scales independently; matches the C4 diagram.
- **Cons:** Two processes to start in dev; the image grows by the ffmpeg package for the API too (unless a multi-stage target is added later).

### Option B: In-process consumer inside the API
- The `@Processor` is registered in `AppModule`; the API process consumes jobs and spawns ffmpeg.
- **Pros:** Zero extra services; simplest wiring.
- **Cons:** ffmpeg children compete for the API container's CPU, memory and disk, which contradicts "sem impacto na performance". Deploy and scale are coupled, and it diverges from the C4 diagram.

### Option C: Separate subproject (`video-worker/`)
- An independent package with its own `package.json`, Dockerfile and Compose file.
- **Pros:** Hard isolation; could even use another runtime.
- **Cons:** Entities and config must be duplicated or extracted into a shared package, which requires monorepo tooling the repo has not decided on. It is a third subproject for one job type.

**Recommendation:** **Option A.** It gives the isolation the "sem impacto" requirement demands and that the C4 diagram already draws, while reusing the backend's entities, config and storage module unchanged. Option C's extra isolation only pays off once there is shared-package tooling.

**Decision:** A (Same Nest codebase, separate entrypoint and Compose service)

**Notes**: In the future, decide to multi-stage target or a separate subproject.

---

## TD-04: Large-File Upload Protocol (10GB, resumable)

**Scope:** Cross-layer

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** The "Pontos de Atenção" section requires 10GB uploads that do not lock up the system and that **resume after connection failure**. Strict BFF (`next-frontend-config-base/TD-03`) means anything the browser sends to the backend crosses two Node hops (browser → Next Route Handler → Nest). Pushing 10GB through both is the main risk. This decision fixes the handshake that both the BFF and Nest implement.

**Options:**

### Option A: S3 multipart upload with presigned URLs (direct to storage)
- Control plane goes browser → BFF → API: create the draft video and multipart upload, sign each operation, notify completion. Data plane goes browser → object storage over presigned `UploadPart` PUTs (≥ 5 MiB parts, ≤ 10,000 parts, parallel). Resume uses `ListParts`.
- **Pros:** Zero video bytes cross Next or Nest, so the API never sees load. Native resume and parallelism. Strict BFF is preserved (the browser never calls Nest). Uses the S3 API from TD-01 unchanged.
- **Cons:** The size cap can't be enforced byte-by-byte by the signer: it is checked at init (declared size) and verified with `HeadObject` on completion (delete if > 10GB). It needs bucket CORS exposing `ETag`, and the API must strictly constrain what it signs (key bound to the user's draft, allowed methods only).

### Option B: tus protocol served by Nest (`@tus/server` 2.x + `@tus/s3-store`)
- Standard resumable protocol; `tus-js-client`/Uppy talks to a tus endpoint that streams chunks into S3.
- **Pros:** Open standard, robust resume semantics, `onUploadFinish` hook gives a natural place to enqueue processing.
- **Cons:** All 10GB flow through Nest, and under strict BFF also through a Next Route Handler that would have to stream-proxy PATCH bodies. Otherwise strict BFF needs an exception, which reopens `next-frontend-config-base/TD-03`. Either way it puts load on the API.

### Option C: Streaming `multipart/form-data` through BFF → API → S3
- A single POST is streamed by busboy and piped to `@aws-sdk/lib-storage` `Upload`.
- **Pros:** Simplest client; one request.
- **Cons:** No resume, which fails the explicit requirement. A 10GB single request is fragile against proxy and request timeouts, and it doubles the Node hops for every byte.

**Recommendation:** **Option A (presigned S3 multipart).** It is the only option that meets all three constraints at once: resume after failure, no load on the API, and strict BFF unchanged. The BFF and Nest only handle a few small JSON requests per upload while the 10GB goes straight to storage, which is exactly the path `next-frontend-config-base/TD-03` reserved for media.

**Decision:** A (presigned S3 multipart)

---

## TD-05: Browser Upload Client

**Scope:** Frontend

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** Under TD-04 Option A the browser must split the file, request signatures from the BFF, PUT parts in parallel with progress, retry failed parts, resume with `ListParts`, and finally notify the BFF so the API can verify and enqueue. The UI must use the project's shadcn/Tailwind design system. Depends on TD-04.

**Options:**

### Option A: Uppy 6, headless (`@uppy/core` + `@uppy/aws-s3` + `@uppy/react`)
- Uppy 6's rewritten `@uppy/aws-s3` performs every S3 call itself. The app provides one `signRequest({ method, key, uploadId, partNumber })` callback pointing at a BFF route. `@uppy/react` 6 (React 18/19 peer) hooks drive a custom shadcn UI. `@uppy/golden-retriever` can optionally resume after a page reload.
- **Pros:** Battle-tested chunking, concurrency, retry and resume; works with any S3-compatible store; a single signing endpoint keeps the BFF surface small; no Uppy CSS required if headless.
- **Cons:** About 4 new dependencies. The browser (not the API) calls `CompleteMultipartUpload`, so the API must verify with `HeadObject` before trusting the completion notice. The signer must validate each requested operation.

### Option B: Hand-rolled multipart uploader
- `File.slice` + XHR (for upload progress) + a small concurrency pool + retry/backoff. Each S3 step (create, sign part, list, complete, abort) is a typed BFF route.
- **Pros:** No dependencies; the API can own `CompleteMultipartUpload` (server-side completion, stronger trust); every step is visible and MSW-testable.
- **Cons:** Re-implements retry, backoff, parallelism, ETag collection, resume and abort edge cases that Uppy already hardened; more code to test; `fetch` lacks upload progress, so the XHR path must be maintained.

**Recommendation:** **Option A (Uppy 6 headless).** Resumable parallel multipart is exactly the hard, edge-case-heavy code Uppy exists to own. The `signRequest` model maps onto a single BFF route, which fits strict BFF, and the `HeadObject` verification the API needs anyway (TD-04 size cap) also covers the client-side completion trade-off.

**Decision:** Option A (Uppy 6 headless)

---

## TD-06: Video Lifecycle Status Model

**Scope:** Cross-layer

**Capability:** Transversal — covers: Pré-cadastro automático do vídeo como rascunho ao iniciar o upload; Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** The video row is created as a **draft** when the upload starts. It then moves through uploading → processing → ready (or failed). Phase 04 adds draft → published and public/unlisted visibility. The status values are an API contract: the frontend renders them (upload screen, Phase 04 dashboard "status" column) and polls them (TD-11).

**Options:**

### Option A: Single linear `status` enum
- One column: `uploading | processing | ready | failed | published`. A draft is any non-`published` value.
- **Pros:** One field to read; simple queries in Phase 03.
- **Cons:** Conflates two independent concerns (is the media ready? did the owner publish?). Re-processing a published video or unpublishing it creates impossible or ambiguous states, and Phase 04 must re-shape the enum (migration plus contract change for the FE).

### Option B: Two orthogonal fields — `processing_status` + `publication_status`
- `processing_status: awaiting_upload | uploaded | processing | ready | failed` (Phase 03) and `publication_status: draft | published` (created now, defaulting to `draft`; Phase 04 adds the transition). Visibility (public/unlisted) will be a third orthogonal field in Phase 04.
- **Pros:** Each field has one owner (pipeline vs owner action); Phase 04 extends without reshaping; the "can publish only when `ready`" rule is explicit; the FE renders two clear badges.
- **Cons:** Two fields to keep in mind; some combinations need explicit guarding.

**Recommendation:** **Option B.** Phase 03 owns the processing pipeline and Phase 04 owns publication, so separate fields keep those concerns separate. The OpenAPI contract the FE codegen consumes stays stable across phases instead of being reshaped in Phase 04.

**Decision:** B (Two orthogonal fields)

---

## TD-07: Public Video Identifier for Unique URLs

**Scope:** Cross-layer

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** "Pontos de Atenção" asks for a **short** URL that never collides. Phase 05 adds **unlisted** videos reachable only by link, so the ID must be **unguessable** (not enumerable). The ID appears in API paths, frontend routes and share links, so its format is a contract on both sides. Entities already use UUID PKs.

**Options:**

### Option A: UUID primary key in the URL
- Expose the existing `id` (36 chars).
- **Pros:** No new column; unique by construction; unguessable (v4).
- **Cons:** Not short (fails the explicit "URL curta" point). It exposes the internal PK, which couples URLs to storage.

### Option B: Random 11-char base64url `public_id` (64-bit, `node:crypto`)
- A separate unique column generated with `randomBytes(8).toString('base64url')`, YouTube-like (`dQw4w9WgXcQ`). A unique constraint plus retry on collision.
- **Pros:** Short, URL-safe, unguessable (2⁶⁴ space); no dependency (nanoid 6 is ESM-only, which clashes with the CJS build); decoupled from the PK.
- **Cons:** One more indexed column; a theoretical collision path to handle (retry loop).

### Option C: Sqids/Hashids encoding of a sequential integer
- Encode an auto-increment `bigint` into a short string.
- **Pros:** Shortest IDs; no collisions by construction.
- **Cons:** Reversible with the alphabet and sequential, so unlisted videos become **enumerable**. That breaks Phase 05's "somente via link" guarantee and also leaks upload volume.

**Recommendation:** **Option B.** It is the only option that is both short (the "URL curta" requirement) and unguessable, which Phase 05's unlisted videos depend on. `node:crypto` provides it with no dependency and no ESM friction. The UUID PK stays internal.

**Decision:** B (Random 11-char base64url)

---

## TD-08: Playback Format and Processing Scope

**Scope:** Cross-layer

**Capability:** Transversal — covers: Reprodução via streaming (sem necessidade de download completo); Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** "Streaming" means playback starts before the full download. With HTTP Range, a progressive MP4 needs its `moov` atom at the front (`+faststart`) and browser-playable codecs. Arbitrary uploads (MKV, AVI, HEVC from phones, `moov`-at-end MP4s) do not guarantee either. The choice decides worker CPU cost, storage footprint, and what the Phase 05 player needs (plain `<video>` vs an HLS library).

**Options:**

### Option A: Normalize to a single progressive MP4 (remux fast path, transcode fallback)
- ffprobe classifies the upload. If it is H.264/AAC in MP4/MOV, remux (`-c copy -movflags +faststart`, I/O-bound, fast). Otherwise transcode once to H.264/AAC MP4 (no upscaling). The normalized MP4 replaces the original as the stored asset.
- **Pros:** Every accepted video plays in a plain `<video>` with Range seeking; the common case is cheap; one stored rendition (no storage multiplication); download serves the same file.
- **Cons:** The transcode path is CPU-heavy for large non-H.264 files (minutes to hours). It is a single quality, with no adaptive bitrate on slow networks.

### Option B: Remux-only, restrict accepted formats
- Accept only browser-compatible inputs (MP4/MOV H.264/AAC, WebM VP9/AV1). Remux to faststart; reject the rest as `failed`.
- **Pros:** No transcoding CPU at all; fastest processing.
- **Cons:** Rejects common real-world uploads (iPhone HEVC `.mov`, `.mkv`, `.avi`), which is poor UX. The frontend `accept=` list and error messaging become part of the contract.

### Option C: HLS adaptive bitrate (multi-rendition)
- Transcode into several renditions plus `.m3u8` playlists and segments.
- **Pros:** Industry standard for streaming; adaptive quality; CDN-friendly.
- **Cons:** Heavy CPU for every upload (several encodes of up to 10GB). Storage roughly 1.5–3×. The Phase 05 player needs `hls.js` (Chrome/Firefox). Download needs a separate file. This is far beyond the phase's "extração de duração e metadados" scope.

### Option D: Serve the original untouched
- No processing beyond probe and thumbnail.
- **Pros:** Zero processing cost.
- **Cons:** Non-browser codecs don't play, and `moov`-at-end files stall before playback, so the streaming capability isn't reliably met.

**Recommendation:** **Option A.** It makes "streaming without full download" true for every accepted upload. The cost stays low in the common H.264 case (remux only) and the worker absorbs the rare transcode, which is what the background worker exists for. Unlike HLS, it keeps one stored file, which addresses the storage-cost point in "Pontos de Atenção", and lets the Phase 05 player stay a native `<video>`. ABR can be added later as a Revision without changing the upload contract.

**Decision:** A (Normalize to a single progressive MP4)

---

## TD-09: Media Delivery Path and Access (Streaming, Download, Thumbnails)

**Scope:** Cross-layer

**Capability:** Transversal — covers: Reprodução via streaming (sem necessidade de download completo); Download do vídeo pelo usuário; Geração automática de thumbnail a partir de um frame do vídeo

**Context:** The C4 diagram has "Frontend → Object Storage: Streams". Videos must not be readable before the owner may share them (drafts now; public/unlisted rules in Phases 04/05). Thumbnails appear in many lists (dashboard Phase 04, grid Phase 07) and benefit from stable, cacheable URLs and `next/image`. Byte-streaming 10GB through Nest + BFF on every view would put load on the API. Depends on TD-01 and TD-04.

**Options:**

### Option A: Private bucket, presigned GET for everything
- The API issues short-lived presigned GET URLs for video and thumbnail when it serves video data (the BFF passes them to the page). The browser streams with HTTP Range straight from storage. Download uses the same mechanism with `ResponseContentDisposition: attachment`.
- **Pros:** Uniform access control: the API decides per request who gets a URL; no bytes through Nest or Next; Range and resumable downloads come natively from storage.
- **Cons:** Thumbnail URLs change on every response, which defeats browser and `next/image` caching in lists. Video URLs need a TTL longer than a viewing session (a mid-playback expiry breaks further Range requests).

### Option B: Hybrid — private presigned videos, public-read thumbnails
- Same as A for video files and downloads. Thumbnails live under a public-read prefix with stable URLs (unguessable keys) that the API returns as absolute URLs.
- **Pros:** Keeps access control where it matters (video bytes) while thumbnails get stable, cacheable URLs for lists and `next/image` (`remotePatterns` for the storage host); still no bytes through the API.
- **Cons:** Two access policies to configure (bucket policy for the thumbnail prefix). A leaked thumbnail URL for a draft or unlisted video is viewable, which is low sensitivity but not zero.

### Option C: Proxy streaming through Nest (and the BFF)
- A Nest endpoint streams `GetObject` with Range passthrough. Under strict BFF a Next Route Handler proxies it again.
- **Pros:** Storage is never exposed to the browser; full per-byte control and auditing.
- **Cons:** Every viewer byte crosses two Node processes. That contradicts "sem impacto na performance", turns the API into a bandwidth bottleneck, and forces correct Range/206 handling in two layers.

### Option D: Fully public-read bucket
- Stable public URLs for everything; obscurity of keys is the only protection.
- **Pros:** Simplest; maximally cacheable and CDN-ready.
- **Cons:** Drafts and unlisted videos are protected only by key secrecy, with no way to revoke or expire access. That breaks the draft guarantee of this phase and Phase 04's visibility model.

**Recommendation:** **Option B (hybrid).** Video bytes stay behind API-issued presigned URLs, which keeps the draft, published and unlisted guarantees enforceable and keeps the API out of the data path. Thumbnails get the stable URLs that every list screen in Phases 04 and 07 needs for caching. Video presign TTL should exceed a realistic viewing session (hours, not minutes). "Download pelo usuário" means anyone allowed to watch (Phase 05 places the button on the watch page); in Phase 03, only the owner.

**Decision:** B (hybrid)

---

## TD-10: FFmpeg Integration

**Scope:** Backend

**Capability:** Transversal — covers: Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** The worker (TD-03) runs `ffprobe` (duration, dimensions, codecs) and `ffmpeg` (faststart/transcode per TD-08, thumbnail frame). `fluent-ffmpeg`, the historical Node wrapper, was **archived on 2025-05-22** and is documented as no longer working properly with recent ffmpeg versions. The backend image is `node:25.6.0-slim` on Debian 12 (apt ships ffmpeg 5.1).

**Options:**

### Option A: System ffmpeg (apt in the Dockerfile) + thin typed wrapper over `child_process.spawn`
- Install `ffmpeg` in the image. A small service builds argument arrays, parses `ffprobe -print_format json`, and maps exit codes and stderr to domain errors.
- **Pros:** No unmaintained dependency; full control of arguments; easy to unit-test (mock `spawn`) and integration-test (tiny fixture video); ffmpeg runs out of the Node event loop.
- **Cons:** Typed parsing of probe output and progress (`-progress pipe:1`) is hand-written; the binary version is tied to the Debian release.

### Option B: `fluent-ffmpeg` + system ffmpeg
- Use the well-known fluent API.
- **Pros:** Familiar API, many examples.
- **Cons:** Archived and unmaintained, with known incompatibilities with recent ffmpeg. Adopting it now creates immediate debt.

### Option C: `ffmpeg-static` / `ffprobe-static` npm binaries + `spawn`
- Ship pinned static binaries through npm instead of apt.
- **Pros:** Binary version pinned in `package-lock.json`, independent of the base image.
- **Cons:** Downloads large binaries at `npm install` (postinstall), and the binaries are maintained by third parties. Inside Docker, apt already gives a reproducible pinned image, so the benefit is small.

**Recommendation:** **Option A.** The project already runs everything in a controlled Docker image, so apt-installed ffmpeg plus a small typed spawn wrapper is the least-dependency, best-tested path. Option B is dead upstream, and Option C solves a portability problem the project doesn't have.

**Decision:** B (`fluent-ffmpeg` + system ffmpeg)

**Note:** Option B chosen for a easier implementation. Option A in the future.

---

## TD-11: Processing-Status Propagation to the Frontend

**Scope:** Cross-layer

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** After the upload completes, the user waits while the worker processes (seconds for a remux, possibly much longer for a transcode). The upload screen must show `processing → ready/failed` (TD-06 values) and ideally a progress percentage (BullMQ `job.updateProgress`, persisted on the video row). Strict BFF applies: the browser only talks to same-origin `/api/**`. Depends on TD-02 and TD-06.

**Options:**

### Option A: Short polling through the BFF
- A Client Component polls `GET /api/videos/{id}` (BFF → Nest) every few seconds while `processing_status ∈ {uploaded, processing}` and stops at a terminal state.
- **Pros:** Uses existing patterns only (Route Handler + `fetch` + MSW handler); stateless; trivially testable; no long-lived connections through Next.
- **Cons:** Up to one poll interval of latency; some redundant requests (negligible at this scale).

### Option B: Server-Sent Events relayed by the BFF
- Nest exposes `@Sse()` per video. A Next Route Handler opens the upstream stream and re-streams a `ReadableStream` to the browser `EventSource`.
- **Pros:** Push updates with no polling latency; HTTP-only (fits strict BFF).
- **Cons:** Long-lived connections in both Nest and Next, plus auth-refresh handling for open streams (`phase-02-auth-frontend/TD-03` refresh-on-401 doesn't apply mid-stream). A worker → API fan-out channel (Redis pub/sub) and streaming tests for MSW are also needed.

### Option C: WebSocket (`@nestjs/websockets`)
- Socket.IO gateway pushes status events.
- **Pros:** Bidirectional and real-time; reusable for future features.
- **Cons:** Route Handlers can't proxy WebSockets, so the browser would connect to Nest directly, which **reopens strict BFF** (`next-frontend-config-base/TD-03`). It needs CORS, a public backend URL and separate auth.

**Recommendation:** **Option A (polling).** Processing takes seconds to minutes, so a few seconds of polling latency is invisible to the user. Polling reuses the exact Route Handler + MSW patterns already in place. SSE and WebSocket would bring long-lived-connection auth and a pub/sub channel, and WebSocket would also break strict BFF, all for a sub-second improvement nobody notices here.

**Decision:** A (short polling through the BFF)

---

## Notes

**Dependencies between TDs:** TD-03 → TD-02; TD-05 → TD-04; TD-09 → TD-01 and TD-04; TD-10 → TD-08; TD-11 → TD-02 and TD-06.

**Items intentionally not raised as TDs** (fail the (d)+(a) test, so `implement` resolves them with skills and neighboring code):

- Thumbnail frame selection and format (e.g., a frame at ~10% of the duration, JPEG at the source aspect ratio). Single component (worker), no cross-layer contract beyond the URL from TD-09.
- Bucket and object-key layout (`videos/{id}/…`, `thumbnails/{id}.jpg`), the S3 client module shape, and the env key names (`S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `REDIS_HOST`, …). These follow the Phase 01 `registerAs` + Joi pattern once TD-01/TD-02 are decided.
- BullMQ retry/backoff counts and the job-id scheme (`jobId = videoId`). Library defaults plus `nestjs-best-practices`.
- Upload-orchestration endpoint names and BFF route paths. They follow the REST conventions and the existing `app/api/auth/**` pattern.

**Open product questions for `plan-context`** (policy, not technical alternatives):

- **Abandoned uploads:** a bucket lifecycle rule `AbortIncompleteMultipartUpload` (e.g., after 1–3 days) is implied by TD-01/TD-04. Should drafts stuck in `awaiting_upload` be swept as well, and after how long?
- **Max duration / resolution:** besides the 10GB cap, should processing reject or limit very long or very high-resolution inputs (affects TD-08 transcode cost)?
- **C4 diagram update:** once TD-01/TD-02 are decided, `docs/diagrams/software-arch.mermaid` should replace "S3 or MinIO" and "Message Queue — TBD" with the chosen technologies (a separate docs task).

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Backend | Object storage service (dev) and S3 client | B — RustFS + `@aws-sdk/client-s3` v3 | A (MinIO) |
| TD-02 | Backend | Background job queue | A — BullMQ + Redis (`@nestjs/bullmq`) | A (BullMQ + Redis) |
| TD-03 | Backend | Video worker runtime topology | A — Same codebase, separate entrypoint/Compose service | A (Same codebase, separate entrypoint) |
| TD-04 | Cross-layer | Large-file upload protocol | A — Presigned S3 multipart, direct to storage | A (Presigned S3 multipart) |
| TD-05 | Frontend | Browser upload client | A — Uppy 6 headless (`@uppy/aws-s3` `signRequest`) | A (Uppy 6 headless) |
| TD-06 | Cross-layer | Video lifecycle status model | B — `processing_status` + `publication_status` | B (Two orthogonal fields) |
| TD-07 | Cross-layer | Public video identifier for unique URLs | B — Random 11-char base64url `public_id` | B (Random 11-char base64url) |
| TD-08 | Cross-layer | Playback format and processing scope | A — Progressive faststart MP4 (remux, transcode fallback) | A (Progressive MP4) |
| TD-09 | Cross-layer | Media delivery path and access | B — Presigned private videos + public-read thumbnails | B (Hybrid: presigned + public thumbnails) |
| TD-10 | Backend | FFmpeg integration | A — apt ffmpeg + typed `spawn` wrapper | B (fluent-ffmpeg + system ffmpeg) |
| TD-11 | Cross-layer | Processing-status propagation to the frontend | A — Short polling via BFF | A (Short polling via BFF) |
