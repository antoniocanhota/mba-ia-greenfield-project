---
scope_type: ad-hoc
related_phases: [3]
status: decided
date: 2026-10-13
scope_description: "Phase 03 — how the frontend E2E suite fakes the browser→storage leg of the presigned multipart upload, and whether the shared MSW video handlers keep state across requests so the upload → completion → polling sequence is observable in Playwright."
---

# Technical Decisions — E2E Fixtures for the Video Upload Flow

_Subprojects in scope:_

- `next-frontend/` — owns both TDs: the shared MSW video handlers (`mocks/handlers/videos.ts`, SI-03.18) and the Playwright fixture layer (`tests/fixtures.ts`) consumed by the `/studio/videos/[publicId]` E2E specs (SI-03.30b scenarios 1.1 and 1.3).
- `nestjs-project/` — no open decision: backend E2E and integration tests already run against the real MinIO and Redis of the Compose stack (`testing-guide-nestjs-project` → external systems), so presigned URLs there are real and reachable. Nothing in this document changes the backend.

_Problem statement._ The frontend E2E architecture fakes only the NestJS upstream, server-side, via MSW booted by `instrumentation.ts` (`next-frontend/CLAUDE.md` § "E2E architecture"). The Phase 03 upload adds a second external system the **browser** talks to directly: Object Storage, reached through the presigned URLs returned by `POST /api/videos/{publicId}/upload-signatures` (phase-03-videos/TD-04, TD-05). Two gaps follow:

1. SI-03.18 does not define what URL the MSW `upload-signatures` fixture returns, and `testing-guide-next-frontend` still lists Object Storage as "Fake (deferred) — when added: in-memory/local emulator, never a real bucket". Uppy's `PUT`/`POST` calls to that URL have no defined target in E2E.
2. The MSW handlers follow the reserved-trigger convention: each response depends only on the request. After `upload-completion` returns `uploaded`, the next poll of `GET /videos/{publicId}` for a non-trigger `publicId` returns the default fixture (`awaiting_upload`), so the page would fall back to "Envio interrompido" instead of showing the `uploaded`/`processing` label (SI-03.30b AC #2).

Constraint verified against the docs: MSW's `setupServer` intercepts only the Node.js process it runs in, and Playwright's `page.route()` only affects the browser's traffic, not the Node.js process (mswjs.io, "Comparison → Playwright"). A Playwright test therefore cannot reconfigure the Next server's MSW per test, which is why the project uses reserved triggers instead of `server.use()` in E2E.

---

## TD-01: Storage Target for Presigned Upload URLs in Frontend E2E

**Scope:** Frontend

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** In the Phase 03 upload flow, Uppy (`@uppy/aws-s3` 6, headless) calls `signRequest` → `POST /api/videos/{publicId}/upload-signatures`, then sends the S3 operations itself, straight from the browser: `CreateMultipartUpload` (`POST`, XML response with `UploadId`), `UploadPart` (`PUT`, needs a readable `ETag` response header), `CompleteMultipartUpload` (`POST`, XML response), plus `ListParts`/`AbortMultipartUpload`. In E2E the signature comes from the MSW fixture, so the fixture decides where those browser requests go. Without a defined target, SI-03.30b scenarios 1.1 (progress after redirect) and 1.3 (re-attach after reload) cannot pass. The choice touches the fixture contract in `mocks/handlers/videos.ts` and the Playwright fixture layer, which must agree on the URL shape.

**Options:**

### Option A: Browser-side storage fake via Playwright `page.route()` on a reserved storage origin
- The MSW `upload-signatures` fixture returns URLs on a reserved, non-resolvable origin (e.g., `http://storage.e2e.invalid/videos/{publicId}/original?...`). A small helper under `tests/` (auto-applied by `tests/fixtures.ts`) registers `page.route()` for that origin only and answers the S3 subset Uppy uses: XML for create/complete/list, `200` + `ETag` + `Access-Control-Expose-Headers: ETag` + `Access-Control-Allow-Origin` for parts, `204` for abort.
- **Pros:** No new infrastructure or dependencies; deterministic and isolated per test (each page owns its routes). Playwright answers the CORS preflight for intercepted requests itself (verified in Playwright's Chromium network manager), so no CORS setup is needed. It stays within the E2E hard rule, which forbids intercepting `/api/**` only; storage is a separate external system the browser talks to directly. The helper can also simulate storage failures per test (e.g., a part `PUT` error) without adding MSW triggers.
- **Cons:** The S3 XML subset is hand-written, so real S3/CORS behavior (bucket CORS exposing `ETag`) is not exercised here; that stays covered by the backend integration test of `UploadSigningService` against MinIO (SI-03.8). With interception, upload progress events come per part rather than per byte, so "progress advancing" needs a file of at least 2 parts (5 MiB minimum part size).

### Option B: Local S3 emulator in the frontend Compose stack + real presigning in the MSW fixture
- A storage emulator container (MinIO-compatible) runs next to `next-frontend`, with a bucket and CORS rules bootstrapped for E2E. The MSW `upload-signatures` handler presigns real URLs against it with `@aws-sdk/s3-request-presigner`, using a browser-reachable host port.
- **Pros:** Real S3 protocol, signatures and CORS/`ETag` exposure are exercised from the browser, matching the guide's "local emulator" note.
- **Cons:** Adds a container, a bucket/CORS bootstrap and AWS SDK dev dependencies to the frontend only for mocks. The MSW handler stops being a plain fixture and becomes a signer. Bucket state persists across runs and needs cleanup. Couples frontend E2E to storage infra the backend already covers. Slower and more fragile than a fixture.

### Option C: Do not exercise the byte transfer in E2E
- E2E covers only the page states reachable through stateless triggers (interrupted, `processing`, `failed`, `ready`, 404). The upload → progress → completion sequence stays in the unit tests of `video-studio-view` (provider stubbed, SI-03.30b) and `upload-dropzone` (SI-03.29b).
- **Pros:** Zero new mechanism; the trigger convention stays untouched.
- **Cons:** No browser test proves that the Uppy instance survives the client-side navigation from `/studio/upload` to `/studio/videos/{publicId}` (OQ-6). That wiring is the main integration risk of this flow, and unit tests with a stubbed provider cannot catch it. SI-03.30b ACs #1–#3 lose their E2E evidence, and scenarios 1.1/1.3 must be cut from `video-uploading.plan.md`.

**Recommendation:** Option A — It covers the one risk unit tests cannot (the provider surviving navigation and driving the page), with no new infrastructure. Playwright already handles the CORS preflight for routed requests, and the real S3/CORS contract stays proven where it lives, in the backend's MinIO integration test. Option B pays for a second storage stack to re-prove what SI-03.8 already proves, and Option C drops coverage of the flow's main risk.

**Decision:** Option A

---

## TD-02: State Model of the MSW Video Handlers Across Requests

**Scope:** Frontend

**Capability:** Transversal — covers: Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance; Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** The page's status after an upload comes from a sequence of requests: `POST /videos` (draft) → `upload-completion` (`uploaded`) → polling `GET /videos/{publicId}` every ~3s while `uploaded`/`processing` (phase-03-videos/TD-11). Today's convention is stateless reserved triggers (`next-frontend/CLAUDE.md`; auth handlers): each response depends only on the request. Under that model, the default `GET` cannot know that `upload-completion` already ran for that `publicId`. The E2E server also runs all Playwright workers (`fullyParallel: true`) against **one** Next.js process, so any state must be isolated per test. The same handler module is shared with Vitest (`mocks/setup.ts`), where state must not leak between tests either. Depends on TD-01 only in that both are needed for SI-03.30b scenario 1.1; each can be decided independently.

**Options:**

### Option A: In-memory video store keyed by `publicId` inside `mocks/handlers/videos.ts`
- `POST /videos` generates a unique `publicId` (11 base64url chars, never colliding with the reserved triggers) and records `awaiting_upload`. `upload-completion` moves a stored video to `uploaded`, and `GET`/`media-urls` read the stored record. Reserved triggers (`missingVid1`, `failedVid01`, `readyVid001`, `procVid0001`, `"too-large.mp4"`) stay stateless and take precedence. Unknown non-trigger IDs keep returning the default `awaiting_upload` fixture, which preserves the "Envio interrompido" scenario. The module exports `resetVideoStore()`, called from `mocks/setup.ts` `afterEach`.
- **Pros:** The real request sequence becomes observable end to end (SI-03.30b AC #2), with no change to product code. Per-test isolation comes for free in E2E, because every test creates its own draft and gets a unique `publicId`, so parallel workers never share records. The change stays inside one domain file plus one setup line.
- **Cons:** It is an explicit exception to the "stateless reserved triggers" rule, so `next-frontend/CLAUDE.md` and `.claude/rules/next-frontend-msw-mocks.md` must document it, or the next domain will copy or contest it. The store lives as long as the dev server (harmless, but restarting clears it). Vitest tests must not assume a fixed `publicId` from `POST /videos`; they read it from the response.

### Option B: Keep handlers stateless; narrow the E2E assertion to the completion call
- No state. The E2E scenario asserts that `upload-completion` was sent and answered `200`. The label switching to `uploaded`/`processing` and the polling continuity stay covered only by the unit test `video-studio-view.uploading.test.tsx`, which already lists "video do upload-completion inicia polling e troca o rótulo".
- **Pros:** The convention is untouched; nothing new to document; handlers stay trivially predictable.
- **Cons:** The first poll after completion still receives `awaiting_upload` in E2E, so the page renders "Envio interrompido" moments after a successful upload. Scenario 1.1 then has to stop before the first poll (race-prone) or tolerate a state that would be a bug in production. SI-03.30b AC #2 loses its E2E evidence.

### Option C: Sequence-encoded reserved triggers (stateless, fixed scripted progression)
- A reserved filename on `POST /videos` (e.g., `"e2e-progress.mp4"`) returns a reserved `publicId` whose responses follow a fixed script without per-request memory. For example, `GET` answers `awaiting_upload` only when the request carries no upload hint, and otherwise `processing`.
- **Pros:** No mutable store; keeps the "trigger table" vocabulary.
- **Cons:** A reserved `publicId` is shared by every parallel worker, so concurrent runs collide. Expressing "before vs after completion" without memory needs a side channel the BFF does not send (or time-based behavior, which is flaky). It grows the trigger table, which the convention says to keep small, and it only covers the one scripted path.

**Recommendation:** Option A — It is the only option that makes the real sequence observable without race-prone assertions or shared reserved IDs. Unique `publicId`s give per-test isolation that holds under `fullyParallel` against the single Next process. The cost is one documented exception to the stateless convention, scoped to resources that have a lifecycle (video processing status). Stateless triggers remain the default for everything else.

**Decision:** Option A

**Revisions:**
- 2026-10-13 — `publicId`s generated by the in-memory store are deterministic: a module-level counter rendered as an 11-char base64url-shaped ID (`vid` + zero-padded number, e.g. `vid00000001`), never colliding with the reserved triggers. `resetVideoStore()` (called from `mocks/setup.ts` `afterEach`) clears the records and resets the counter, so every Vitest test sees the same ID sequence and can assert exact values. In E2E all Playwright workers hit one Next.js process, so the shared counter keeps IDs unique across parallel tests. This replaces the Cons clause "Vitest tests must not assume a fixed `publicId`". _Rationale:_ Deterministic counter — keeps `next-frontend-openapi-typing/TD-05` ("determinism over auto-generation") and `next-frontend-msw-foundation/TD-03` ("hand-written deterministic defaults") intact (resolves ICC-1 of phase-03 validation).

---

## Notes

- **Not considered as an option — controlling MSW in the Next process from Playwright.** The installed `msw` (^2.14.6) documents `setupServer` as process-local, and Context7 returned no stable cross-process ("remote") API for that version. A per-test `server.use()` from Playwright is therefore not available, which is the premise of both TDs.
- **Downstream artifacts if the recommendations are accepted:** SI-03.18 (fixture URL shape + store + `resetVideoStore`), `tests/fixtures.ts` (storage route helper auto-applied), `next-frontend/CLAUDE.md` § "E2E architecture" and `.claude/rules/next-frontend-msw-mocks.md` (documented exceptions), `testing-guide-next-frontend` → `references/external-systems.md` (Object Storage row no longer "deferred"), and the `next-frontend/specs/video-uploading.plan.md` scenarios 1.1/1.3 (regenerate via `/plan-test-specs`).
- **Sources:** mswjs.io "Comparison → Playwright" (page.route affects the browser only; setupServer affects the Node.js process); Playwright `route.fulfill` API (status, headers, body); Playwright source/tests "should not get preflight CORS requests when intercepting" and `crNetworkManager.ts` (preflight auto-fulfilled when interception is on); `docs/phases/phase-03-videos/library-refs.md` → `@uppy/aws-s3` 6 `signRequest`; phase-03-videos/TD-04 (bucket CORS must expose `ETag`).

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Frontend | Storage target for presigned upload URLs in frontend E2E | **A** (Playwright `page.route()` storage fake on a reserved origin) | A |
| TD-02 | Frontend | State model of the MSW video handlers across requests | **A** (in-memory store keyed by `publicId` + `resetVideoStore()`) | A |
