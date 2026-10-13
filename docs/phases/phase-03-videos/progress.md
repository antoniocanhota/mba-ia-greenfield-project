# phase-03-videos — Progress

**Status:** in_progress
**SIs:** 2/44 completed

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
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.0.4 — Custom-business simple group: download-icon + upload-icon + video-file-icon + side-nav-item + side-nav
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.0.5 — Custom-business simple group: copy-link-button + processing-status + thumb-upload + upload-dropzone + upload-progress-panel
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.0.6 — Custom-business simple group: video-details-card + video-player + video-status-badge
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.1 — Infra: dependências, namespaces de config e serviços de storage e fila no Compose
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.2 — Entidade Video e migration CreateVideos
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.3 — Módulo de storage S3 (clients, keys, presign e configuração do bucket)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.4 — Módulo de fila BullMQ (conexão Redis e fila `videos`)
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.5 — VideosService: rascunho, ownership e mapeamento de resposta
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.6 — Endpoint POST /videos
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.7 — Endpoint GET /videos/{publicId}
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.8 — Endpoint POST /videos/{publicId}/upload-signatures
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.9 — Endpoint POST /videos/{publicId}/upload-completion
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.10 — Endpoint GET /videos/{publicId}/media-urls
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.11 — Entrypoint do worker e serviço `video-worker` no Compose
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.12 — Adapter FFmpeg (probe, normalização e thumbnail)
- **Status:** pending
- **Tests:** —
- **Observations:** none

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
