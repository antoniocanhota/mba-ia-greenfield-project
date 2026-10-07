---
kind: phase
name: phase-03-videos
status: clean
issue_count: 0
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-10-07T15:20:25-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-10-07T15:18:52-03:00"
  docs/decisions/technical-decisions-video-metadata.md: "2026-10-07T14:40:53-03:00"
issues:
  - id: IC-1
    status: resolved
    summary: "phase-03-videos/TD-01 decided MinIO but Recommendation argues for RustFS"
    resolved_by: phase-03-videos/TD-01
  - id: IC-2
    status: resolved
    summary: "phase-03-videos/TD-10 decided fluent-ffmpeg, which its Recommendation calls dead"
    resolved_by: phase-03-videos/TD-10
  - id: IC-3
    status: resolved
    summary: "video-metadata/TD-01 decided A but Recommendation prose prescribes a probe column"
    resolved_by: video-metadata/TD-01
  - id: IC-4
    status: resolved
    summary: "Phase 03 TDs decide libraries (BullMQ, Uppy, fluent-ffmpeg) but Libraries is empty"
    resolved_by: phase-03-videos/TD-01, phase-03-videos/TD-02, phase-03-videos/TD-05, phase-03-videos/TD-10
  - id: AMB-1
    status: resolved
    summary: "Lifecycle of abandoned drafts and incomplete multipart uploads is undefined"
    resolved_by: phase-03-videos/TD-04
  - id: AMB-2
    status: resolved
    summary: "Fate of the original upload object after normalization (and on failure) undefined"
    resolved_by: phase-03-videos/TD-08
  - id: MD-1
    status: resolved
    summary: "No TD picks the client-side polling mechanism for TD-11 (hook vs SWR vs TanStack)"
    resolved_by: phase-03-videos/TD-11
  - id: OQ-1
    status: resolved
    summary: "Inventory: Phase 04 metadata-form components must not be bootstrapped in Phase 03"
    resolved_by: clarification
  - id: OQ-2
    status: resolved
    summary: "Inventory: confirm all Phase 03 (new) components are materialized by plan-build"
    resolved_by: clarification
  - id: OQ-3
    status: resolved
    summary: "Inventory: processing states (uploaded/processing/failed/draft) have no design"
    resolved_by: clarification
  - id: OQ-4
    status: resolved
    summary: "Inventory: /studio/upload error and interaction states have no design"
    resolved_by: clarification
  - id: OQ-5
    status: resolved
    summary: "Inventory: single vs multiple files (copy is plural, flow is single)"
    resolved_by: clarification
  - id: OQ-6
    status: resolved
    summary: "Inventory: upload continuity across routes and after reload (golden-retriever?)"
    resolved_by: clarification
  - id: OQ-7
    status: resolved
    summary: "Inventory: heading copy on /studio/videos/[publicId] says 'Channel Settings'"
    resolved_by: clarification
  - id: OQ-8
    status: resolved
    summary: "Inventory: player has no controls in Figma — confirm native <video controls>"
    resolved_by: clarification
  - id: OQ-9
    status: resolved
    summary: "Inventory: DownloadButton has no design (position, label, icon)"
    resolved_by: clarification
  - id: OQ-10
    status: resolved
    summary: "Inventory: placeholders for processing-dependent fields during upload"
    resolved_by: clarification
  - id: OQ-11
    status: resolved
    summary: "Inventory: VideoLink points to /v/... (Phase 05) — disabled, hidden or text?"
    resolved_by: clarification
  - id: OQ-12
    status: resolved
    summary: "Inventory: app chrome, SideNav future links and /studio auth behavior"
    resolved_by: clarification
  - id: OQ-13
    status: resolved
    summary: "Inventory: Figma layer names and sample-data inconsistencies (designer)"
    resolved_by: clarification
  - id: UIG-1
    status: resolved
    summary: "Capability 'Serviço de armazenamento de arquivos' has TD but no UI verb"
    resolved_by: non_ui_capability
  - id: UIG-2
    status: resolved
    summary: "Capability 'Serviço de processamento em segundo plano' has TD but no UI verb"
    resolved_by: non_ui_capability
  - id: AMB-3
    status: resolved
    summary: "Re-attach after reload: resume the existing multipart upload or restart it?"
    resolved_by: phase-03-videos/TD-04
  - id: AMB-4
    status: resolved
    summary: "Can a file be re-attached to a draft the sweep marked failed (upload_abandoned)?"
    resolved_by: phase-03-videos/TD-06
  - id: AMB-5
    status: resolved
    summary: "TD-04: how to abort the old multipart after reload when uploadId isn't persisted"
    resolved_by: phase-03-videos/TD-04
advisories: []
---

# phase-03-videos — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

_None._

### Missing Decisions

_None._

### Dependency Gaps

_None._

### Inherited Constraint Conflicts

_None._

### Unresolved Open Questions

_None._

### UI Coverage Gaps

_None._

## Resolved Issues

- **MD-1** _(resolved_by phase-03-videos/TD-11)_ — No TD picks the client-side polling mechanism for TD-11 (hook vs SWR vs TanStack). Closed by the 2026-10-06 `**Revisions:**` entry on TD-11 (applied via `/decide`): hand-rolled hook (setTimeout chain + `fetch` to the BFF), no SWR/TanStack, ~3s interval, stops at `ready`/`failed`.
- **IC-1** _(resolved_by phase-03-videos/TD-01)_ — phase-03-videos/TD-01 decided MinIO but Recommendation argues for RustFS. MinIO kept; revision 2026-10-07 appended: archived image accepted for dev use, the last community image tag is pinned in Compose, and RustFS/SeaweedFS remain drop-in fallbacks.
- **IC-2** _(resolved_by phase-03-videos/TD-10)_ — phase-03-videos/TD-10 decided fluent-ffmpeg, which its Recommendation calls dead. fluent-ffmpeg kept; revision 2026-10-07 appended: unmaintained-dependency risk accepted, usage limited to ffprobe plus remux, transcode and thumbnail commands, and the Option A spawn wrapper stays the planned replacement.
- **IC-3** _(resolved_by video-metadata/TD-01)_ — video-metadata/TD-01 decided A but Recommendation prose prescribes a probe column. Option A kept; revision 2026-10-07 appended: no raw-probe column is persisted, and diagnostics come from worker logs plus `failureReason`.
- **IC-4** _(resolved_by phase-03-videos/TD-01, TD-02, TD-05, TD-10)_ — Phase 03 TDs decide libraries but Libraries is empty. `**Libraries:**` filled in: TD-01 `@aws-sdk/client-s3, @aws-sdk/s3-request-presigner`; TD-02 `bullmq, @nestjs/bullmq`; TD-05 `@uppy/core, @uppy/aws-s3`; TD-10 `fluent-ffmpeg`. Docs cached in `library-refs.md`.
- **AMB-1** _(resolved_by phase-03-videos/TD-04)_ — Lifecycle of abandoned drafts and incomplete multipart uploads is undefined. Revision 2026-10-07 on TD-04: a bucket lifecycle rule `AbortIncompleteMultipartUpload` after 1 day, plus a BullMQ repeatable sweep that marks drafts still uploading after 24h as `failed` (`failureReason: upload_abandoned`). A companion revision on `video-metadata/TD-04` adds the `upload_abandoned` code.
- **AMB-2** _(resolved_by phase-03-videos/TD-08)_ — Fate of the original upload object after normalization (and on failure) undefined. Revision 2026-10-07 on TD-08: the original is deleted once processing reaches a terminal state (`ready` or `failed`), and only the normalized MP4 is retained.
- **OQ-1** _(resolved_by clarification)_ — Phase 04 metadata-form components are excluded from Phase 03: no B2.6 bootstrap SIs for `components/ui/textarea.tsx`, `components/ui/select.tsx` or `components/studio/privacy-option.tsx`, and the Title/Description/Change Thumbnail/Category/Visibility/Cancel/Save Changes rows stay out of the Phase 03 UI Contracts.
- **OQ-2** _(resolved_by clarification)_ — All listed Phase 03 (new) components are materialized **except** `components/layout/subscriptions-channel-list.tsx` (subscriptions belong to a later phase). SideNav renders without the subscriptions block.
- **OQ-3** _(resolved_by clarification)_ — Processing states are inferred in implement from the `UploadStatusLabel`/`ProcessingStatus` styles. Copy maps to the TD-06 status values, `failed` shows a message keyed by the `failureReason` enum (video-metadata/TD-04), and the "Checks complete. No issues found." copy is not used.
- **OQ-4** _(resolved_by clarification)_ — `/studio/upload` states are inferred in implement: highlighted dropzone border on drag-over, inline error text inside the dropzone for over 10GB, unsupported type and draft pre-registration failure, and a disabled dropzone with a spinner while the draft is created and until the redirect.
- **OQ-5** _(resolved_by clarification)_ — One file per upload (Uppy `maxNumberOfFiles: 1`); copy becomes singular ("Drag and drop a video file" / "Select file").
- **OQ-6** _(resolved_by clarification)_ — The Uppy instance lives in a provider in the `/studio` layout, so the upload survives client-side navigation and resume works within the session. After a reload or direct access mid-upload, the screen shows an "Envio interrompido — selecione o arquivo novamente" state that re-attaches a file to the same draft. No new library (`@uppy/golden-retriever` not adopted).
- **OQ-7** _(resolved_by clarification)_ — The `/studio/videos/[publicId]` heading is the static text "Video details".
- **OQ-8** _(resolved_by clarification)_ — Native `<video controls>` with the generated thumbnail as `poster` and the presigned URL as `src` once `ready`.
- **OQ-9** _(resolved_by clarification)_ — DownloadButton is a secondary button inside CardVideoConfig below VideoLink, labeled "Download" with a download icon, disabled until `ready`; its href is a presigned URL obtained via the BFF.
- **OQ-10** _(resolved_by clarification)_ — Metadata fields show "—" until the server returns values (provisional after the first probe, per video-metadata/TD-02 C and TD-05 A); ThumbUpload shows a skeleton until the thumbnail exists.
- **OQ-11** _(resolved_by clarification)_ — VideoLink shows the full `/v/{publicId}` URL (real 11-char base64url ID) as copyable text with the copy-link button, without navigation, until Phase 05.
- **OQ-12** _(resolved_by clarification)_ — Anonymous users on `/studio/**` are redirected to `/login` (Phase 02 pattern). SideNav links to future-phase routes (Home, Subscriptions, Your videos, Liked videos) render disabled, and there is no top header/app bar this phase.
- **OQ-13** _(resolved_by clarification)_ — Figma layer-name and sample-data inconsistencies are ignored in implement: component names follow the inventory, sample data is not copied, and the progress bar and text share one value. A note goes to the designer outside the pipeline.
- **UIG-1** _(resolved_by non_ui_capability)_ — "Serviço de armazenamento de arquivos (vídeos e thumbnails)" marked non-ui. Rationale: backend_service.
- **UIG-2** _(resolved_by non_ui_capability)_ — "Serviço de processamento em segundo plano (filas)" marked non-ui. Rationale: backend_service.
- **AMB-3** _(resolved_by phase-03-videos/TD-04)_ — Re-attach after reload: resume the existing multipart upload or restart it? Revision 2026-10-07 on TD-04: resume is limited to the browser session. Re-attaching a file after a reload starts a new multipart upload for the draft's object key, the old one is aborted best-effort, and the 1-day lifecycle rule is the backstop. `uploadId` is not persisted and there is no list-parts BFF read.
- **AMB-4** _(resolved_by phase-03-videos/TD-06)_ — Can a file be re-attached to a draft the sweep marked failed (upload_abandoned)? Revision 2026-10-07 on TD-06: `failed` is terminal for every `failureReason`. Re-uploading creates a new draft from `/studio/upload`, the failed draft remains until Phase 04, and its page shows the `failureReason` message plus a link to `/studio/upload`. Re-attaching is allowed only while `processing_status = awaiting_upload`.
- **AMB-5** _(resolved_by phase-03-videos/TD-04)_ — TD-04: how to abort the old multipart after reload when uploadId isn't persisted. Third 2026-10-07 revision on TD-04 replaces the unexecutable "best-effort via `signRequest`" clause. When the API signs a `CreateMultipartUpload` for a draft's key, it first calls `ListMultipartUploads` (Prefix = key) and aborts every in-progress upload. This is server-side only, with no `uploadId` persisted, and the lifecycle rule stays as the backstop.
