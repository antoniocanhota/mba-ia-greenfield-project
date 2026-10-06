---
scope_type: ad-hoc
related_phases: [3]
status: decided
date: 2026-10-06
scope_description: "Phase 03 — which video metadata the worker extracts, when it becomes visible, how it is persisted and exposed in the API contract, how probe failures surface, and where the studio screen gets the values it displays."
---

# Technical Decisions — Video Metadata Extraction and Display

_Subprojects in scope:_

- `nestjs-project/` — the worker's probe step (TD-10 of the phase doc: `fluent-ffmpeg` `ffprobe`), persistence of the extracted values on the `videos` domain, and the fields the video response DTO exposes (and so `openapi.json`). Backend side of TD-01..TD-04.
- `next-frontend/` — rendering duration and quality in `CardVideoConfig` (`components/studio/video-details-card.tsx`), the duration badge on `ThumbUpload`, and the `failed` state of `ProcessingStatus` on `/studio/videos/[publicId]`. Frontend side of TD-01..TD-04, plus TD-05.
- Repo-wide — no open decision. No new service, tool or env key; the probe runs inside the existing `video-worker` service.

**Why a separate document:** `technical-decisions-phase-03-videos.md` is the phase-scope doc for Phase 03 and is fully decided. It names "extração de duração e metadados" in four TDs (TD-03, TD-06, TD-08, TD-10) but never decides *which* metadata, *when* it shows up, or *what shape* it has in the contract. The screen inventory leaves that open too ("Campos dependentes do processamento durante o upload… Definir placeholder/'—'/oculto até `ready`"). This doc is complementary research tied to Phase 03 via `related_phases`, not a new slice.

**Inherited constraints (not reopened):** `processing_status: awaiting_upload | uploaded | processing | ready | failed` (`phase-03-videos/TD-06`); normalize to one progressive faststart MP4, remux fast path, transcode fallback (`phase-03-videos/TD-08`); `fluent-ffmpeg` + system ffmpeg 5.1 from Debian 12 apt (`phase-03-videos/TD-10`); short polling of `GET /api/videos/{id}` through the BFF (`phase-03-videos/TD-11`); BullMQ worker in a separate Compose service (`phase-03-videos/TD-02`, `TD-03`); OpenAPI → `openapi.json` → `types.gen.ts` contract chain (`openapi-docs-nestjs/TD-02`, `next-frontend-openapi-typing/TD-01..05`); HTTP error envelope (`phase-02-auth/TD-07`) — applies to request errors, not to resource state.

**Installed versions checked (2026-10-06):** NestJS 11, TypeORM 0.3.28 + `pg` 8.20 (PostgreSQL `jsonb` and `select: false` column option available), class-validator 0.14; Next 16.2.6, React 19.2.4, Zod 4.4. `fluent-ffmpeg` is not installed yet. Its `ffprobe()` returns the same object as `ffprobe -print_format json -show_streams -show_format` (`streams[]` with `codec_name`, `width`, `height`, `avg_frame_rate`, `duration`, `bit_rate`; `format` with `duration`, `size`, `bit_rate`, `format_name`, all numeric values as strings). Rotation of phone videos lives in the stream's display-matrix side data, not in `width`/`height`.

---

## TD-01: Metadata Set and Persistence Shape

**Scope:** Cross-layer

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** ffprobe returns dozens of fields per stream. The studio screen displays only duration (player "0:00", ThumbUpload badge "15:41") and quality ("1080p HD"); later phases reuse duration in the Phase 04 dashboard and the Phase 07 grid. Whatever set is chosen becomes columns, DTO fields in `openapi.json`, generated FE types and MSW fixtures, so it is a contract on both sides. The question is how much to keep and how much to expose.

**Options:**

### Option A: Minimal typed fields only
- Columns on `videos`: duration, width, height, file size. Nothing else from ffprobe is kept. The DTO exposes the same four fields.
- **Pros:** Exactly what the UI displays; smallest contract and migration; trivial MSW fixtures.
- **Cons:** Anything else (codec, fps, bitrate, audio presence) needs a new migration and a re-probe of existing videos. Debugging a failed or odd transcode means re-running ffprobe by hand.

### Option B: Typed core in the contract + raw probe as internal `jsonb`
- Same four typed columns exposed in the DTO, plus a `jsonb` column with the full ffprobe output (`select: false`, never in the DTO).
- **Pros:** Contract stays minimal; the raw data is there for diagnostics and for deriving new fields later with a data migration instead of re-probing 10GB files; no cost to the FE.
- **Cons:** An untyped blob that can grow into a dumping ground; a few KB per row; needs a rule that nothing reads it for business logic without first promoting a field to a typed column.

### Option C: Rich technical metadata exposed as a nested object
- A `media` object in the DTO with codecs, fps, bitrate, container, audio channels, plus the core fields.
- **Pros:** Supports a "technical details" panel; no future contract change if the UI grows.
- **Cons:** No screen in Phases 03–07 shows these values; widens the contract, types and fixtures for nothing; exposes encoding internals to the client.

**Recommendation:** **Option B.** The contract carries only what screens use, so the FE side is identical to Option A. The worker already holds the full probe object (fluent-ffmpeg returns it in one call), so keeping it costs a column and saves a 10GB re-download whenever someone needs another field or has to explain a failure. Option A is equivalent if you don't value diagnostics. Option C is extrapolation with no consuming screen.

**Decision:** A (Minimal typed fields only)

---

## TD-02: Metadata Extraction Timing and Source of Truth

**Scope:** Cross-layer

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** TD-08 of the phase doc already requires an ffprobe of the *original* upload to choose remux or transcode. After normalization the served MP4 can differ from the original: codecs change (HEVC → H.264), file size changes, duration can move by milliseconds, and remuxed phone videos still carry a rotation matrix. The transcode path for a large non-H.264 file can take a long time, and the screen polls status throughout (TD-11). This decision fixes when metadata fields stop being `null` in the DTO and whether their values can change afterwards, which the FE rendering rule depends on. Depends on TD-01.

**Options:**

### Option A: Probe the normalized output only; metadata appears at `ready`
- The original is probed only for the remux/transcode decision and discarded. After normalization the output MP4 is probed and persisted in the same update that sets `ready`.
- **Pros:** One source of truth that always matches the file being streamed and downloaded; simplest FE rule ("metadata non-null ⇔ `ready`").
- **Cons:** During `processing` (minutes to hours on the transcode path) the card shows placeholders even though the duration has been known since the first seconds.

### Option B: Probe the original only; persist immediately
- The first probe's values are persisted as soon as it runs and never revisited.
- **Pros:** Metadata visible at the start of `processing`; one probe.
- **Cons:** Values can disagree with the served file (size, codec, rotation-adjusted dimensions after a transcode). The download button would show a size that isn't the downloaded file's.

### Option C: Two-stage — provisional from the original, authoritative from the output
- Persist the original's probe as soon as processing starts. Re-probe the normalized output at the end and overwrite the fields in the same update that sets `ready`.
- **Pros:** Duration and quality show during `processing`; final values match the served file. The second probe is cheap (sub-second on a faststart MP4, which only reads the header).
- **Cons:** Values may shift slightly at `ready` (the FE must simply re-render, which polling already does). Two writes per video, and tests must cover the overwrite.

**Recommendation:** **Option C.** Probing the original is already paid for by TD-08, so exposing it costs one write. It answers the inventory's open question with real data instead of placeholders for the whole `processing` window, which matters on the transcode path. The final probe keeps the "what you see is what you download" guarantee. Choose Option A if a single write is preferred and placeholders during processing are acceptable.

**Decision:** C (Two-stage — provisional from the original, authoritative from the output)

---

## TD-03: Metadata Value Contract (duration unit, display dimensions, quality label)

**Scope:** Cross-layer

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** The UI shows "15:41" and "1080p HD"; the API must decide what it sends. Three sub-questions are coupled. (1) **Duration unit:** ffprobe returns a decimal string ("596.458333"); seconds-as-float, integer seconds and integer milliseconds are all common. (2) **Dimensions:** ffprobe `width`/`height` are the *coded* size. A portrait phone video remuxed with `-c copy` keeps a −90° display matrix, so a 1920×1080 stream is shown as 1080×1920. (3) **Quality label:** someone has to turn dimensions into "1080p"/"HD". The same values feed the Phase 04 dashboard, the Phase 05 watch page and the Phase 07 grid. Depends on TD-01.

**Options:**

### Option A: Raw numeric fields; the frontend derives labels
- `durationMs: integer`, `width`/`height` as **display** dimensions (rotation applied in the worker), `sizeBytes`. A single FE util formats duration (`m:ss` / `h:mm:ss`) and derives the label from the short side (≥2160 "4K", ≥720 "HD").
- **Pros:** Locale and copy changes stay in the FE; integers avoid float rounding in JSON and Postgres; display dimensions mean no consumer ever handles rotation; the API remains a data contract.
- **Cons:** The label rule lives in the FE, so a future non-web consumer would re-implement it.

### Option B: Raw numeric fields + server-derived `qualityLabel`
- Same as A, plus a `qualityLabel` string (e.g. `"1080p"`) or enum computed by the worker or the DTO mapper.
- **Pros:** One rule for all consumers; the label is documented in OpenAPI.
- **Cons:** Presentation logic in the backend; an enum change touches the migration/DTO, the codegen and the FE; the "HD" suffix and copy still end up in the FE anyway.

### Option C: Pre-formatted strings
- `duration: "15:41"`, `quality: "1080p HD"`; the FE renders them verbatim.
- **Pros:** Zero FE logic.
- **Cons:** Not sortable or computable (the Phase 05 player needs numbers); locale fixed on the server; every copy tweak is a backend change plus a contract regeneration.

**Recommendation:** **Option A.** It keeps the contract numeric and stable across Phases 03–07 while presentation stays where the copy lives. The two choices that matter for correctness, integer milliseconds and rotation-applied display dimensions, are fixed once at the source in the worker. Option B only pays off with a second non-web client, which the project doesn't have.

**Decision:** A (Raw numeric fields; the frontend derives labels)

---

## TD-04: Processing Failure Reason Contract

**Scope:** Cross-layer

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** Metadata extraction is the first step that can reject an upload: a renamed non-video file has no video stream, a truncated upload fails to probe, and an ffmpeg error during normalization ends in `failed`. The inventory notes that `failed` has no design and no message. Today TD-06 gives the FE only `processing_status = failed`, so the user can't tell "this isn't a video" from "something broke on our side". The HTTP error envelope (`phase-02-auth/TD-07`) doesn't apply: the poll succeeds with 200 and the failure is resource state.

**Options:**

### Option A: Status only
- `failed` with no reason; the FE shows one generic message.
- **Pros:** No contract change.
- **Cons:** The user can't act (re-upload a different file vs. retry later); support has no signal without reading logs.

### Option B: Machine-readable `failureReason` enum
- A nullable enum set by the worker when it marks `failed`, e.g. `not_a_video | unreadable_file | unsupported_media | processing_error`. The FE maps each code to copy. Technical detail (ffmpeg stderr) goes to logs and, under TD-01 B, the internal probe column.
- **Pros:** Actionable messages; stable codes in OpenAPI; copy and i18n stay in the FE; no internals leak.
- **Cons:** One more enum to version; the worker must classify ffprobe/ffmpeg errors into codes (anything unknown → `processing_error`).

### Option C: Free-text error message
- Persist the error message (or a trimmed stderr) and show it.
- **Pros:** Maximum detail with no classification work.
- **Cons:** Leaks paths, codec internals and ffmpeg wording to users; not translatable; not testable as a contract.

**Recommendation:** **Option B.** A small enum makes `failed` actionable for the user. It follows the project's habit of typed contracts flowing through OpenAPI to `types.gen.ts`, and stderr stays server-side. Product policies such as maximum duration or resolution, if adopted, become new codes rather than new mechanisms.

**Decision:** B (Machine-readable `failureReason` enum)

---

## TD-05: Metadata Shown While the Upload Is Still Running

**Scope:** Frontend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados)

**Context:** A 10GB upload can take a long time, and the user waits on `/studio/videos/[publicId]` while the server has no metadata yet (`awaiting_upload`). The browser already holds the `File`, and a `<video>` element pointed at an object URL fires `loadedmetadata` with `duration`, `videoWidth` and `videoHeight` in milliseconds, but only for codecs that browser can decode (MKV/AVI/HEVC vary by browser). The inventory asks what the card shows before processing.

**Options:**

### Option A: Server values only; placeholders until the probe runs
- The card shows "—" (or hides the row) until the DTO fields become non-null (from `processing` under TD-02 C, or at `ready` under TD-02 A).
- **Pros:** One source of truth; no media-element code to test (jsdom doesn't implement `HTMLMediaElement` loading); the behaviour is identical for every format.
- **Cons:** No duration or quality during the upload itself.

### Option B: Local preview from the `File`, replaced by server values
- A client hook reads `loadedmetadata` from an object URL, shows those values while uploading, and switches to the server values once they exist. If the browser can't decode the file, it falls back to placeholders.
- **Pros:** Immediate feedback during long uploads; no dependency and no contract change.
- **Cons:** Two sources of truth that can disagree (rotation, transcode); inconsistent across browsers; lost on reload (the `File` reference is gone, same as the open resume question); extra test seams to mock.

**Recommendation:** **Option A.** It keeps the screen driven by one contract. Paired with TD-02 Option C, the real values appear seconds after the upload completes. Option B is a purely additive FE enhancement that can be added later without touching the backend or the contract.

**Decision:** A (Server values only; placeholders until the probe runs)

---

## Notes

**Dependencies between TDs:** TD-02 → TD-01; TD-03 → TD-01; TD-05 → TD-02 (the placeholder window depends on when the fields become non-null).

**Items intentionally not raised as TDs** (fail the (d)+(a) test; `implement` resolves them with skills and neighbouring code):

- Column names, numeric types (`integer` vs `bigint` for `sizeBytes` — bytes of a 10GB file exceed `int4`, so `bigint` serialized as a string or number is a `typeorm` best-practices call) and the migration.
- How the worker reads the display matrix (ffprobe `side_data_list[].rotation`) and swaps width/height. This is the implementation of TD-03's "display dimensions" rule.
- Duration formatting in the FE (hand-written `m:ss` vs `Intl.DurationFormat`) and the exact label thresholds. These are FE implementation inside TD-03 Option A.
- Owner-only vs public DTO shape for metadata. Phase 03 only has the owner's studio view; the public projection belongs to Phase 05.
- Original filename: captured at draft creation (inventory "Filename block", capability "Pré-cadastro automático…"); not extracted by ffprobe.

**Open product questions for `plan-context`** (policy, not technical alternatives):

- **Max duration / resolution limits** (already raised in the phase doc): if adopted, they are enforced on the first probe and surface as a TD-04 failure code.
- **Copy and placement** of duration and quality while `processing`/`failed`, and the exact failure messages per code. Design gap noted in the inventory.

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|----------------|--------|
| TD-01 | Cross-layer | Metadata set and persistence shape | B — Typed core in contract + raw probe `jsonb` (internal) | A (Minimal typed fields only) |
| TD-02 | Cross-layer | Metadata extraction timing and source of truth | C — Provisional from original, authoritative from output | C (Two-stage: provisional from original, authoritative from output) |
| TD-03 | Cross-layer | Metadata value contract (duration, dimensions, label) | A — `durationMs` + display dimensions; FE derives labels | A (Raw numeric fields; FE derives labels) |
| TD-04 | Cross-layer | Processing failure reason contract | B — `failureReason` enum | B (`failureReason` enum) |
| TD-05 | Frontend | Metadata shown while the upload is running | A — Server values only, placeholders until probe | A (Server values only; placeholders until probe) |
