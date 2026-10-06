# phase-03-videos — Screen Inventory Progress

**Status:** completed
**Screens:** 3/3 completed

## Reconciled screen list

| # | Screen name                                         | URL (fileKey:nodeId)             | Status  |
|---|-----------------------------------------------------|----------------------------------|---------|
| 1 | Tela de upload de vídeo                             | dfxpXk5c5urLHMh4axx5cq:2728:2142 | completed |
| 2 | Tela do vídeo no studio — upload em andamento       | dfxpXk5c5urLHMh4axx5cq:2734:2140 | completed |
| 3 | Tela do vídeo no studio — upload concluído (player + download) | dfxpXk5c5urLHMh4axx5cq:2734:2196 | completed |

## Screens removed as out-of-scope

- ~~Prévia / player do vídeo processado (tela própria)~~ — user: "Only 'tela de upload de vídeo'"; playback e download ficam no frame 2734:2196 (rota `/studio/videos/[publicId]`).

## Decisions log

- ✓ [DECISION A: upload — uma tela com estados, rotas separadas ou modal?] — resolved: rotas separadas. `/studio/upload` (2728:2142) → `/studio/videos/[publicId]` (2734:2140 upload em andamento; 2734:2196 concluído com player + download).
- ✓ [DECISION B: "Reprodução via streaming" — superfície de playback na Fase 03?] — resolved: playback na tela de upload após conclusão (frame 2734:2196).
- ✓ [DECISION C: "Download do vídeo pelo usuário" — botão na Fase 03?] — resolved: download na mesma tela do playback (frame 2734:2196).
- ✓ [DECISION D: upload coleta metadados (título/descrição)?] — resolved: não coleta metadados nesta fase.
- ✓ [DECISION: SideNav (154:1725) — Local-interactive (lista de inscrições stub/oculta) ou Server-connected?] — resolved: SideNav construída, Local-interactive (só links) (applied to screens 1–3)
- ✓ [DECISION: SideNavSubscriptionList (I154:1725;62:1672) — Server-connected ou Presentational/stub nesta fase?] — resolved: mock estático, Presentational, sem backend (Fase 06)
- ✓ [DECISION: SideNav subscriptions list (I156:2791;62:1669) — Server-connected ou stub/omitir?] — resolved: mock estático, Presentational, sem backend (Fase 06)
- ✓ [DECISION: Button "Change Thumbnail" (156:2812) — Server-connected ou omitir/desabilitar na fase 03 (thumbnail customizada = Fase 04)?] — resolved: formulário de metadados omitido por inteiro na fase 03 (Fase 04)
- ✓ [DECISION: Category select (2096:2238) — Server-connected ou omitir na fase 03 (categorias = Fase 04)?] — resolved: formulário de metadados omitido por inteiro na fase 03 (Fase 04)
- ✓ [DECISION: Button "Save Changes" (156:2799) — Server-connected ou omitir na fase 03 (edição de metadados = Fase 04)?] — resolved: formulário de metadados omitido por inteiro na fase 03 (Fase 04)
- ✓ [DECISION: Download ausente no frame 2734:2196 — adicionar ao Figma, implementar sem design, ou outro frame?] — resolved: implementar sem design (DownloadButton DS no CardVideoConfig, screen 3)
- ✓ [DECISION: SubscriptionsChannelList (I156:2111;62:1672) — stub/omitir ou Server-connected?] — resolved: mock estático, Presentational, sem backend (Fase 06)
- ✓ [DECISION: Button "Change Thumbnail" (156:2616) — omitir ou Server-connected?] — resolved: formulário de metadados omitido por inteiro na fase 03 (Fase 04)
- ✓ [DECISION: Button "Cancel" (156:2772) — aborta upload multipart (Server-connected) ou ação do form de metadados (fora do escopo)?] — resolved: omitido na fase 03; não aborta upload
- ✓ [DECISION: Button "Save Changes" (156:2771) — omitir ou Server-connected?] — resolved: formulário de metadados omitido por inteiro na fase 03 (Fase 04)
