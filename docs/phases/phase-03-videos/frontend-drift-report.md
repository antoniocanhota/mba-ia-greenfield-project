---
kind: drift-report
phase: phase-03-videos
plan_mtime: "2026-10-14T09:54:41-0300"
---

# phase-03-videos — Drift Report

## Screen: upload — audited at SI-03.30.0 (2026-10-14)

**Quick scan:** 3 alinhado · 0 drift menor · 3 drift relevante · 0 ausente

- SideNav (`side-nav.tsx`) → `drift relevante` (5 changes)
- SideNavItem (`side-nav-item.tsx`) → `drift relevante` (5 changes)
- UploadDropzone (`upload-dropzone.tsx`) → `drift relevante` (9 changes)
- Card (`card.tsx`) → `alinhado`
- UploadIcon (`upload-icon.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`

### next-frontend/components/layout/side-nav.tsx — SideNav

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune width: base — w-60 → w-64
  - retune padding: base — p-3 → p-4
  - retune typography: "You" heading — text-label-lg → text-h3
  - +border-right 'border-r border-border' from Figma demand (with `bg-background`; the SideNav surface has a right divider, the code has none)
  - +border-bottom 'border-b border-border' under the primary section (Home / Subscriptions) from Figma demand; the Subscriptions channel block is ignored (OQ-2)
- **Prior:** _(none)_

### next-frontend/components/layout/side-nav-item.tsx — SideNavItem

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune radius: base — rounded-[var(--radius-3)] → rounded-[var(--radius-2)]
  - retune gap: base — gap-4 → gap-7 (icon → label)
  - retune padding: base — px-3 py-2 → px-3.5 py-2.5 (Figma row is 46px high; no spacing token gives 11px, so py-2.5 → 44px is the nearest)
  - retune typography: base — text-label-md → text-body-lg (16/24 regular)
  - retune background: active — bg-muted → bg-card (Figma active row uses `--card`; token family differs from `--muted`)
- **Prior:** _(none)_

### next-frontend/components/studio/upload-dropzone.tsx — UploadDropzone

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune border: base — border-dashed → border-solid
  - retune radius: base — rounded-[var(--radius-4)] → rounded-[var(--radius-2)]
  - +background 'bg-card' from Figma demand (Card surface)
  - retune padding: base — px-6 py-12 → px-6 pt-16 pb-10
  - retune gap: base — gap-4 → gap-6
  - +icon container 'rounded-full bg-background p-10' (128px circle) around the upload icon from Figma demand; icon stays `size-12`
  - retune color: icon — text-muted-foreground → text-foreground
  - retune typography: heading — text-h3 → text-h2 (20/28 semibold); text gap-1 → gap-2
  - retune size: Button — md → sm (Figma Button: radius-3, px-4, label-md); copy stays singular per OQ-5
- **Prior:** _(none)_

### next-frontend/components/ui/card.tsx — Card

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/upload-icon.tsx — UploadIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

## Screen: video-uploading — audited at SI-03.31.0 (2026-10-14)

**Quick scan:** 3 alinhado · 4 drift menor · 5 drift relevante · 0 ausente

- SideNav (`side-nav.tsx`) → `alinhado`
- SideNavItem (`side-nav-item.tsx`) → `alinhado`
- Card (`card.tsx`) → `alinhado`
- UploadProgressPanel (`upload-progress-panel.tsx`) → `drift menor` (7 changes)
- VideoFileIcon (`video-file-icon.tsx`) → `drift relevante`
- UploadStatusLabel (`video-status-badge.tsx`) → `drift menor`
- ProgressLinear (`progress.tsx`) → `drift relevante` (4 changes)
- CardVideoConfig (`video-details-card.tsx`) → `drift menor` (5 changes)
- VideoPreview (`video-player.tsx`) → `drift relevante` (5 changes)
- CopyLinkButton (`copy-link-button.tsx`) → `drift relevante`
- SectionHeader (`section-header.tsx`) → `drift menor`
- ThumbUpload (`thumb-upload.tsx`) → `drift relevante` (3 changes)

### next-frontend/components/layout/side-nav.tsx — SideNav

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (w-64, p-4, border-r, border-b, "You" in text-h3) at SI-03.30.0 honored"

### next-frontend/components/layout/side-nav-item.tsx — SideNavItem

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (radius-2, gap-7, px-3.5 py-2.5, text-body-lg, active bg-card) at SI-03.30.0 honored"

### next-frontend/components/ui/card.tsx — Card

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-03.30.0 honored"

### next-frontend/components/studio/upload-progress-panel.tsx — UploadProgressPanel

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune gap: base — gap-3 → gap-2
  - retune gap: row — gap-3 → gap-2
  - retune alignment: row — items-center → items-start
  - retune size: icon — size-8 → size-6
  - retune color: icon — text-muted-foreground → text-foreground
  - retune typography: filename — text-label-md → text-body-md
  - +border-bottom 'border-b border-border' on the panel (divider below the progress bar) from Figma demand
- **Prior:** _(none)_

### next-frontend/components/icons/video-file-icon.tsx — VideoFileIcon

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune glyph: base — filled Material "video_file" path → outlined "video_file" path from the Figma asset (24px, viewBox 0 0 24 24; keeps `fill="currentColor"`)
- **Prior:** _(none)_

### next-frontend/components/studio/video-status-badge.tsx — UploadStatusLabel

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune typography: base — text-label-md → text-caption (12/18 regular, `--link` color stays)
- **Prior:** _(none)_

### next-frontend/components/ui/progress.tsx — ProgressLinear

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +token 'progress-track' in `app/globals.css` `@theme inline`: `--color-progress-track: var(--progress-track)` (the raw `--progress-track` exists in `:root` and dark mode, the utility mapping does not)
  - retune track: base — bg-muted → bg-progress-track
  - retune radius: track — rounded-full → rounded-[var(--radius-0-5)]
  - retune radius: indicator — (none) → rounded-[var(--radius-0-5)]
- **Prior:** _(none)_

### next-frontend/components/studio/video-details-card.tsx — CardVideoConfig

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune radius: Card — rounded-[var(--radius-2)] → rounded-[var(--radius-3)]
  - retune typography: Filename value — text-body-md text-foreground → text-caption text-muted-foreground
  - +border-top 'border-t border-border' on the Filename and Video Quality rows from Figma demand
  - retune layout: Video Quality row — stacked label/value → label left and value right on one line (justify-between), value text-caption text-foreground
  - retune label: "Video quality" → "Video Quality" (Figma capitalization); the extra Duration row has no Figma counterpart and is kept (OQ-10)
- **Prior:** _(none)_

### next-frontend/components/studio/video-player.tsx — VideoPreview

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune radius: placeholder — rounded-[var(--radius-3)] → rounded-t-[var(--radius-2)]
  - retune color: placeholder time label — text-white/70 → text-neutral-100
  - retune position: placeholder time label — centered → absolute bottom-right (about 12px from each edge)
  - +icon 'play' from Figma demand (27×36 glyph centered in the placeholder; new `components/icons/play-icon.tsx`)
  - +icon 'image' from Figma demand (16×16 glyph at the top-left, about 12px from the edges; new `components/icons/image-icon.tsx`)
- **Prior:** _(none)_

### next-frontend/components/studio/copy-link-button.tsx — CopyLinkButton

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune glyph: CopyIcon (`components/icons/copy-icon.tsx`) — Material "content_copy" path → Figma "copy" glyph (16×16, viewBox 0 0 16 16); the IconButton `sm` box stays
- **Prior:** _(none)_

### next-frontend/components/ui/section-header.tsx — SectionHeader

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune size: md — text-h3 → text-h2 (Figma title is 20/28 semibold; the 4px gap already matches; Figma has a single configuration, mapped to the default `md`; no other consumer exists yet)
- **Prior:** _(none)_

### next-frontend/components/studio/thumb-upload.tsx — ThumbUpload

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +prop 'duration' from Figma demand (optional string, default hidden)
  - +badge 'duration' at the bottom-right from Figma demand: bg-neutral-alpha-50, text-neutral-100, text-label-md, rounded-[var(--radius-1)], p-1
  - retune radius: base — rounded-[var(--radius-3)] → rounded-[var(--radius-4)]
- **Prior:** _(none)_
