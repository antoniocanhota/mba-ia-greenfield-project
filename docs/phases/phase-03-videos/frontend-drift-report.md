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
