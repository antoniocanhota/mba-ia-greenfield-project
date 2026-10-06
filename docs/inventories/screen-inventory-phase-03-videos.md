# phase-03-videos — Screen Inventory

> **Phase:** 03 — Upload e Processamento de Vídeos
> **Status:** Validated
> **Date:** 2026-10-06
> **Screens in scope:** 3

---

## Screen: Tela de upload de vídeo

**Route:** `/studio/upload`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2728-2142 (node `dfxpXk5c5urLHMh4axx5cq:2728:2142`)
**Purpose (from project-plan.md):** "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance".

### Component inventory

| Component (Figma node)                                   | Type              | In DS? | Reuse?                                         | Notes |
|----------------------------------------------------------|-------------------|--------|------------------------------------------------|-------|
| Body (2728:2142)                                         | Presentational    | ✗      | new                                            | Layout raiz do frame (SideNav + Main content); provável `app/studio/layout.tsx` |
| SideNav (154:1725)                                       | Local-interactive | ✗      | `components/layout/side-nav.tsx (new)`         | App chrome. Componente DS do Figma "SideNav" com variantes collapsed/expanded. Decisão do usuário: construído nesta fase só com links (sem dados do servidor) |
| SideNavItem "Home" (I154:1725;62:1620)                   | Local-interactive | ✗      | `components/layout/side-nav-item.tsx (new)`    | Navegação client-side (Next.js `<Link>`); estado ativo/selecionado no Figma |
| SideNavItem "Subscriptions" (I154:1725;62:1630)          | Local-interactive | ✗      | `components/layout/side-nav-item.tsx (new)`    | Navegação client-side para rota de fase futura |
| SideNavDivider (I154:1725;62:1635)                       | Presentational    | ✗      | new                                            | `<hr>` puro-DOM |
| SideNavSectionHeading "You" (I154:1725;62:1638)          | Presentational    | ✗      | new                                            | Heading puro-DOM |
| SideNavItem "Your videos" (I154:1725;62:1653)            | Local-interactive | ✗      | `components/layout/side-nav-item.tsx (new)`    | Navegação client-side; destino da listagem de vídeos do studio |
| SideNavItem "Liked videos" (I154:1725;62:1664)           | Local-interactive | ✗      | `components/layout/side-nav-item.tsx (new)`    | Navegação client-side para rota de fase futura (likes) |
| SideNavSectionHeading "Subscriptions" (I154:1725;62:1671)| Presentational    | ✗      | new                                            | Heading puro-DOM |
| SideNavSubscriptionList (I154:1725;62:1672)              | Presentational    | ✗      | `components/layout/subscriptions-channel-list.tsx (new)` | 6 itens com avatar (imagem) + nome do canal. Decisão do usuário: lista mock estática na fase 03, sem backend; dados reais de inscrições na Fase 06 |
| SideNavDivider (I154:1725;62:1697)                       | Presentational    | ✗      | new                                            | `<hr>` puro-DOM |
| Main content (2728:2141)                                 | Presentational    | ✗      | new                                            | Container da área principal |
| Heading "Upload Video" (154:1728)                        | Presentational    | ✗      | new                                            | `<h1>` puro-DOM (Inter/Heading/H1) |
| UploadDropzone (154:1730)                                | Server-connected  | ✗      | `components/studio/upload-dropzone.tsx (new)`  | Camada nomeada "Channel card" no Figma. Área de drag-and-drop dirigida pelo Uppy headless (TD-05); ao receber o arquivo, pré-cadastra o rascunho e inicia o upload multipart presigned (TD-04) |
| Card (154:1731)                                          | Presentational    | ✓      | `components/ui/card.tsx`                       | Fundo/borda da dropzone; State-layer (I154:1731;143:1247) sugere hover/drag-over |
| UploadIconBadge (154:1901)                               | Presentational    | ✗      | new                                            | Camada nomeada "upload form" no Figma, mas é só o círculo decorativo do ícone |
| UploadIcon (154:1907)                                    | Presentational    | ✗      | `components/icons/upload-icon.tsx (new)`       | Ícone SVG de upload (48px) |
| DropzoneTitle "Drag and drop video files to upload" (154:1911) | Presentational | ✗  | new                                            | `<p>`/`<h2>` puro-DOM (Inter/Heading/H2) |
| DropzoneHelper "Your videos will be private until you publish them." (154:1912) | Presentational | ✗ | new                     | Helper text puro-DOM; reflete `publication_status: draft` (TD-06) |
| SelectFilesButton "Select files" (154:1915)              | Server-connected  | ✓      | `components/ui/button.tsx`                     | Abre o seletor de arquivos nativo; a seleção dispara o pré-cadastro + upload (mesmo fluxo da dropzone) |

### Verbs of intent

| Verb                                                                 | Component                                      | Capability (project-plan.md)                                                    |
|----------------------------------------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------|
| Pré-cadastrar o vídeo como rascunho ao selecionar ou soltar o arquivo | UploadDropzone + SelectFilesButton (154:1915)  | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload"            |
| Iniciar o envio do arquivo de vídeo (até 10GB) para o armazenamento  | UploadDropzone + SelectFilesButton (154:1915)  | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" |
| Obter o identificador público único do vídeo recém-criado para redirecionar à sua página | UploadDropzone (154:1730) | "URL única por vídeo, sem conflito com outros vídeos"                           |

### Observations

- A camada da dropzone se chama "Channel card" (154:1730) e o círculo do ícone se chama "upload form" (154:1901) no Figma. Os dois nomes não batem com a função. Os nomes do inventário (UploadDropzone, UploadIconBadge) refletem a função real.
- UploadDropzone e SelectFilesButton são classificados como Server-connected pelo mesmo critério do SubmitButton da fase 02: a ação do usuário (soltar ou selecionar o arquivo) dispara direto o pré-cadastro do rascunho e o início do upload. Não há etapa intermediária de confirmação. Abrir o seletor de arquivos nativo, por si só, é local.
- Depois do pré-cadastro, a tela navega para `/studio/videos/[publicId]` (TD-07), onde ficam progresso de upload, status de processamento, reprodução e download. Por isso esta tela não tem barra de progresso, status nem player. As capabilities "Processamento automático do vídeo após upload (extração de duração e metadados)", "Geração automática de thumbnail a partir de um frame do vídeo", "Reprodução via streaming (sem necessidade de download completo)" e "Download do vídeo pelo usuário" devem ser cobertas por aquela tela.
- As capabilities "Serviço de armazenamento de arquivos (vídeos e thumbnails)" e "Serviço de processamento em segundo plano (filas)" são infraestrutura sem affordance de UI. Não geram verbo nesta tela.
- Nenhum campo de metadados (título/descrição) aparece no frame, o que bate com a decisão de não coletar metadados nesta fase.
- App chrome: o SideNav (Home, Subscriptions, You → Your videos / Liked videos, lista de inscrições com 6 canais mockados) não é capability da fase 03. Inscrições e likes são de fases futuras. É preciso decidir se a lista de inscrições fica oculta, como stub ou mockada. O item "Your videos" pode apontar para a listagem do studio, que não faz parte desta tela.
- O frame não tem top header/app bar (logo, busca, avatar ou menu do usuário). Pode ser que o shell do studio venha de outro frame ou que falte no design. Também não há indicação visual de que a rota exige autenticação, nem estado para usuário anônimo.
- Estados ausentes no frame: drag-over/hover da dropzone (o State-layer I154:1731;143:1247 está vazio e só sugere o estado); erro de arquivo acima de 10GB; erro de tipo de arquivo não suportado (não-vídeo); falha no pré-cadastro do rascunho; estado de carregamento/desabilitado entre a seleção e o redirecionamento.
- O texto usa plural ("video files", "Select files"), mas o fluxo decidido navega para uma única página `/studio/videos/[publicId]`. Falta decidir se o upload aceita um único arquivo por vez (restrição `maxNumberOfFiles` no Uppy, TD-05) ou vários, e então ajustar o texto.
- Nenhum componente visível no screenshot ausente de `get_design_context`.

---

## Screen: Tela do vídeo no studio — upload em andamento

**Route:** `/studio/videos/[publicId]`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2140 (node `dfxpXk5c5urLHMh4axx5cq:2734:2140`)
**Purpose (from project-plan.md):** "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance". Esta tela mostra o estado de envio em andamento do vídeo pré-cadastrado como rascunho.

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|------------------------|------|--------|--------|-------|
| SideNav (156:2111) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Tela de upload de vídeo |
| SideNavItem "Home" / "Subscriptions" (I156:2111;62:1620, I156:2111;62:1630) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | Navegação client-side (Next.js `<Link>`). As rotas de destino não fazem parte da Fase 03 |
| SideNav section heading "You" (I156:2111;62:1638) | Presentational | ✗ | new | Título de seção puro-DOM |
| SideNavItem "Your videos" / "Liked videos" (I156:2111;62:1653, I156:2111;62:1664) | Local-interactive | ✗ | `components/layout/side-nav-item.tsx (new)` | Navegação client-side. "Your videos" leva ao painel da Fase 04 e "Liked videos" a um recurso da Fase 06 |
| SideNav section heading "Subscriptions" (I156:2111;62:1671) | Presentational | ✗ | new | Título de seção puro-DOM |
| SubscriptionsChannelList (I156:2111;62:1672) | Presentational | ✗ | `components/layout/subscriptions-channel-list.tsx (new)` | Itens com avatar (I156:2111;62:1675 etc.) + nome do canal. Decisão do usuário: lista mock estática na fase 03, sem backend (Fase 06). see screen: Tela de upload de vídeo |
| Page heading "Channel Settings" (156:2114) | Presentational | ✗ | new | `<h1>` puro-DOM. O texto parece herdado de outro template (ver Observations) |
| Channel card container (156:2136) | Presentational | ✗ | new | Wrapper de layout da área principal |
| Card (156:2137) | Presentational | ✓ | `components/ui/card.tsx` | see screen: Tela de upload de vídeo; fundo/borda do container principal |
| UploadProgressPanel (157:1931) | Server-connected | ✗ | `components/studio/upload-progress-panel.tsx (new)` | Painel de envio em andamento: nome do arquivo + "Uploading... 84%" + rótulo de status + barra de progresso. É alimentado pela instância Uppy headless (TD-05) que envia as partes direto ao storage via multipart pré-assinado (TD-04) |
| VideoFileIcon "video_file" (157:1933) | Presentational | ✗ | `components/icons/video-file-icon.tsx (new)` | Ícone DS "video_file" |
| UploadFileName (157:1936) | Presentational | ✗ | new | Texto puro-DOM com o nome do arquivo em envio |
| UploadProgressText "Uploading... 84%" (157:1937) | Presentational | ✗ | new | Helper text puro-DOM. O percentual vem do estado do Uppy |
| UploadStatusLabel "Uploading" (157:1938) | Presentational | ✗ | `components/studio/video-status-badge.tsx (new)` | Slot do status do vídeo (TD-06). No Figma é um `<p>` com a cor `--link`, não um badge |
| ProgressLinear (157:1939) | Presentational | ✗ | `components/ui/progress.tsx (new)` | Primitivo DS determinado (Track I157:1939;2924:253 + Indicator I157:1939;2924:254) |
| Section heading "Details" (156:3150) | Presentational | ✗ | new | `<h2>` puro-DOM |
| Title field group (2774:2087) | Presentational | ✗ | new | Composição Label + Input. **Fora do escopo da Fase 03**: nenhum metadado é coletado nesta fase (decisão do usuário). Pertence à Fase 04 |
| FormLabel "Title" (2175:273) | Presentational | ✓ | `components/ui/label.tsx` | Fora do escopo da Fase 03 (Fase 04) |
| TextField "Title" (156:3151) | Local-interactive | ✓ | `components/ui/input.tsx` | Fora do escopo da Fase 03 (Fase 04) |
| Description field group (2774:2088) | Presentational | ✗ | new | Composição Label + Textarea. Fora do escopo da Fase 03 (Fase 04) |
| FormLabel "Description" (2175:285) | Presentational | ✓ | `components/ui/label.tsx` | Fora do escopo da Fase 03 (Fase 04) |
| Textarea "Description" (156:3152) | Local-interactive | ✗ | `components/ui/textarea.tsx (new)` | Primitivo DS "Textarea". Fora do escopo da Fase 03 (Fase 04) |
| CardVideoConfig (156:3170) | Server-connected | ✗ | `components/studio/video-details-card.tsx (new)` | Painel lateral com os dados do rascunho pré-cadastrado: preview, link único, nome do arquivo e qualidade. Lido do backend pelo `publicId` da rota |
| VideoPreview (I156:3170;156:3089) | Presentational | ✗ | `components/studio/video-player.tsx (new)` | Neste frame é um placeholder preto com ícone de play e "0:00". Ainda não há mídia reproduzível durante o upload. A reprodução aparece no frame concluído (2734:2196) |
| VideoLink "streamtube.com/v/tech2024" (I156:3170;156:3107) | Local-interactive | ✗ | new | Âncora inline para a URL pública única (TD-07). O valor vem do CardVideoConfig |
| CopyLinkButton (I156:3170;156:3108) | Local-interactive | ✗ | `components/studio/copy-link-button.tsx (new)` | Copia o link para a área de transferência (só no client). No Figma é um `i` > svg, não uma instância de "Icon button" |
| VideoFilenameRow "Filename" (I156:3170;156:3112) | Presentational | ✗ | new | Par rótulo/valor puro-DOM |
| VideoQualityRow "Video Quality / 1080p HD" (I156:3170;156:3117) | Presentational | ✗ | new | Par rótulo/valor puro-DOM. Esse metadado só existe depois do processamento (ver Observations) |
| SectionHeader "Thumbnail" (2390:2258) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Componente DS "SectionHeader" (Title + Description) |
| ThumbUpload (156:2612) | Presentational | ✗ | `components/studio/thumb-upload.tsx (new)` | Placeholder de thumbnail (descrição DS: "shown on upload screens before processing completes"). O overlay de duração (156:2610) está posicionado fora da área visível e foi recortado |
| Button "Change Thumbnail" (156:2616) | Local-interactive | ✓ | `components/ui/button.tsx` | Primitivo DS Button (outline, sm). **Omitido na fase 03** (decisão do usuário: formulário de metadados fora). Vira Server-connected na Fase 04 (thumbnail customizada) |
| SectionHeader "Category" (2390:2261) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Fora do escopo da Fase 03 (Fase 04) |
| Select "Category" (2096:2223) | Local-interactive | ✗ | `components/ui/select.tsx (new)` | Primitivo DS "Select". Fora do escopo da Fase 03: "Categorias de vídeo disponíveis na plataforma" e a edição de categoria são da Fase 04 |
| SectionHeader "Visibility" (2390:2264) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Fora do escopo da Fase 03 (Fase 04) |
| PrivacyOption "Public" (156:2728) / "Unlisted" (156:2717) | Local-interactive | ✗ | `components/studio/privacy-option.tsx (new)` | Radio item (selecionado / não selecionado). Fora do escopo da Fase 03: "Visibilidade do vídeo: público … ou unlisted" é da Fase 04 |
| Footer "upload form" (156:2769) | Presentational | ✗ | new | Wrapper do rodapé do formulário |
| CheckStatus "Checks complete. No issues found." (2769:2088) | Presentational | ✗ | new | Ícone check_circle (156:2786) + caption. Não corresponde a nenhum estado de TD-06 (ver Observations) |
| Button "Cancel" (156:2772) | Local-interactive | ✓ | `components/ui/button.tsx` | Primitivo DS Button (outline, sm). **Omitido na fase 03** (decisão do usuário): pertence ao formulário de metadados (Fase 04); não aborta o upload. Sem cancelamento explícito de upload nesta fase; a retomada é automática |
| Button "Save Changes" (156:2771) | Local-interactive | ✓ | `components/ui/button.tsx` | Primitivo DS Button (default, sm). **Omitido na fase 03** (decisão do usuário: formulário de metadados fora). Vira Server-connected na Fase 04 |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|------|-----------|------------------------------|
| Enviar o arquivo do vídeo direto ao armazenamento em partes, de forma retomável | UploadProgressPanel (157:1931) | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" |
| Exibir o progresso do envio do arquivo de vídeo | UploadProgressPanel (157:1931) | "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance" |
| Concluir o envio e marcar o vídeo como enviado para processamento | UploadProgressPanel (157:1931) | "Processamento automático do vídeo após upload (extração de duração e metadados)" |
| Acompanhar o status de processamento do vídeo após o envio | UploadProgressPanel (157:1931), slot UploadStatusLabel (157:1938) | "Processamento automático do vídeo após upload (extração de duração e metadados)" |
| Exibir os dados do rascunho do vídeo pré-cadastrado | CardVideoConfig (156:3170) | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload" |
| Exibir a URL única do vídeo | CardVideoConfig (156:3170), VideoLink (I156:3170;156:3107) | "URL única por vídeo, sem conflito com outros vídeos" |

### Observations

- **Resoluções do usuário (2026-10-06):** (1) o formulário de metadados (Details, Thumbnail "Change Thumbnail", Category, Visibility e o rodapé Cancel/Save Changes) é **omitido por inteiro** na fase 03. As linhas ficam no inventário só como registro e serão retomadas na Fase 04. (2) "Cancel" não aborta o upload e é omitido; a fase 03 não tem cancelamento explícito de upload. (3) A SideNav é construída só com links, e a lista de inscrições é um mock estático.

- **Frame com conteúdo fora do escopo da fase:** o frame mostra o formulário completo de metadados: Title (156:3151), Description (156:3152), Thumbnail + "Change Thumbnail" (156:2616), Category (2096:2223), Visibility Public/Unlisted (156:2728, 156:2717) e "Save Changes" (156:2771). O usuário confirmou que nenhum metadado é coletado na Fase 03. Esses itens correspondem às capabilities da Fase 04 ("Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada", "Visibilidade do vídeo: público … ou unlisted", "Categorias de vídeo disponíveis na plataforma"). Eles estão inventariados para o registro ficar completo, mas não devem ser implementados nesta fase. Para a Fase 03 sobram o UploadProgressPanel, o CardVideoConfig e o ThumbUpload. Flag para Open questions: confirmar se a Fase 03 entrega a tela sem as seções Details/Thumbnail/Category/Visibility e sem o rodapé de ações.
- **Título da página "Channel Settings" (156:2114):** parece reaproveitado do template de configurações do canal. Não descreve a tela de um vídeo no studio. Confirmar o copy correto (open question).
- **Moldura do app:** a SideNav (156:2111), com Home, Subscriptions, You/Your videos/Liked videos e a lista de canais inscritos, não é capability da Fase 03. A lista de inscrições depende da Fase 06 e "Your videos" leva ao painel da Fase 04. Nenhum header/topbar aparece neste frame.
- **Estados de TD-06 representados:** só o envio em andamento aparece, pelo rótulo "Uploading" (157:1938) e pela barra de progresso, que corresponde a `processing_status = awaiting_upload` durante o envio. Não há variantes visuais para `uploaded`, `processing`, `failed` nem `ready` neste frame. `ready` presumivelmente corresponde ao frame concluído 2734:2196, inventariado por outro agente. Também não há badge de `publication_status` (draft/published). A transição pós-envio (`uploaded` → `processing`, com polling via BFF segundo TD-11) e o estado de falha não têm design. Open question: quais textos e cores usar nesses estados e onde exibi-los.
- **Pause/resume/cancel:** não há controles de pausar nem retomar no frame, embora TD-04/TD-05 prevejam upload retomável. O único "Cancel" (156:2772) está no rodapé do formulário de metadados, ao lado de "Save Changes", e não no painel de progresso. Resolvido: Cancel é omitido na fase 03 e não aborta o upload. Open question: o upload retomável será automático (retomada transparente após falha de rede) ou terá affordances explícitas que ainda precisam de design?
- **Continuidade da instância Uppy (interaction / TD-05):** o envio começa em `/studio/upload` e continua nesta rota depois da navegação client-side. A instância Uppy e o `File` em memória precisam sobreviver à troca de rota, por exemplo num provider de layout acima das duas rotas. Num reload ou acesso direto à URL durante o envio, a referência ao arquivo se perde. Não há design para retomar com nova seleção do arquivo nem para o estado "envio interrompido". Flag para Open questions.
- **VideoQualityRow "1080p HD" (I156:3170;156:3117):** é um metadado extraído pelo processamento. Durante o upload ainda não existe. Definir se a linha fica oculta, aparece com placeholder ou com "—" até o processamento terminar.
- **VideoPreview (I156:3170;156:3089):** neste estado é só um placeholder ("0:00"). A reprodução via streaming e o download pertencem ao estado concluído (2734:2196). Nenhum componente deste frame cobre "Reprodução via streaming" nem "Download do vídeo pelo usuário".
- **ThumbUpload (156:2612):** a descrição do DS diz que é um placeholder exibido antes do fim do processamento, mas o asset do frame é uma imagem real (thumbnail de exemplo). Na Fase 03 a thumbnail é gerada automaticamente ("Geração automática de thumbnail a partir de um frame do vídeo") e só existe depois do processamento. Durante o upload deve ser um placeholder genérico. O overlay de duração (156:2610) está fora da área recortada, então não aparece.
- **CheckStatus "Checks complete. No issues found." (2769:2088):** não corresponde a nenhuma capability nem estado de TD-06. Parece herdado do fluxo de referência (estilo YouTube). Sugestão: remover ou trocar por um indicador do status do vídeo.
- **Inconsistências nos dados de exemplo (other):** o nome do arquivo no painel de progresso ("my_awesome_video_final_v2.mp4", 157:1936) é diferente do nome no CardVideoConfig ("my_awesome_tech_review_final_v2.mp4"). O link de exemplo "streamtube.com/v/tech2024" não segue o formato de 11 caracteres base64url de TD-07. O indicador da barra ocupa 320/400 px (80%) enquanto o texto diz 84%.
- **VideoLink (I156:3170;156:3107):** aponta para a rota pública de visualização (`/v/...`), que é escopo da Fase 05 ("Página de Visualização do Vídeo"). Durante o upload o vídeo ainda é rascunho e não está processado. Definir se o link aparece desabilitado ou oculto até `ready`/publicação (open question).
- **a11y:** a barra ProgressLinear (157:1939) precisa de `role="progressbar"` com `aria-valuenow`/`aria-valuemin`/`aria-valuemax` e um anúncio por live region das mudanças de status. O CopyLinkButton (I156:3170;156:3108) é só ícone e precisa de `aria-label`.
- **Reuse:** os "Button" (156:2616, 156:2772, 156:2771) são instâncias dos primitivos DS Button (outline/default, sm), mapeados para `components/ui/button.tsx`. FormLabel e TextField reaproveitam `components/ui/label.tsx` e `components/ui/input.tsx` da Fase 02.
- Nenhum componente visível no screenshot está ausente de `get_design_context`.

---

## Screen: Tela do vídeo no studio — upload concluído (player + download)

**Route:** `/studio/videos/[publicId]`
**Figma:** https://www.figma.com/design/dfxpXk5c5urLHMh4axx5cq/FC-Tube?node-id=2734-2196 (node `dfxpXk5c5urLHMh4axx5cq:2734:2196`)
**Purpose (from project-plan.md):** "Reprodução via streaming (sem necessidade de download completo)".

### Component inventory

| Component (Figma node) | Type | In DS? | Reuse? | Notes |
|---|---|---|---|---|
| SideNav (156:2791) | Local-interactive | ✗ | `components/layout/side-nav.tsx (new)` | see screen: Tela de upload de vídeo |
| SideNav subscriptions list (I156:2791;62:1669) | Presentational | ✗ | `components/layout/subscriptions-channel-list.tsx (new)` | Avatares e nomes de canais; heading "Subscriptions" (I156:2791;62:1671). Decisão do usuário: mock estático na fase 03 (Fase 06). see screen: Tela de upload de vídeo |
| Main content (2734:2195) | Presentational | ✗ | new | Container de layout da área principal |
| Heading "Channel Settings" (156:2794) | Presentational | ✗ | new | `<h1>` puro-DOM. O texto diz "Channel Settings" numa tela de vídeo, o que parece copy herdada da tela de configurações |
| Channel card / Card (156:2796 / 156:2797) | Presentational | ✓ | `components/ui/card.tsx` | Container principal do formulário |
| Content row (2777:2085) | Presentational | ✗ | new | Layout em duas colunas: Details à esquerda, CardVideoConfig à direita |
| Heading "Details" (156:2814) | Presentational | ✗ | new | Título de seção puro-DOM |
| Title field group (2774:2091) | Presentational | ✗ | new | Composição Label + Input |
| FormLabel "Title" (2175:297) | Presentational | ✓ | `components/ui/label.tsx` | — |
| TextField "Title" (156:2815) | Local-interactive | ✓ | `components/ui/input.tsx` | Edição de título fica fora do escopo da fase 03 (metadados não são coletados agora; "Edição das informações do vídeo" é da Fase 04) |
| Description field group (2774:2092) | Presentational | ✗ | new | Composição Label + Textarea |
| FormLabel "Description" (2175:309) | Presentational | ✓ | `components/ui/label.tsx` | — |
| Textarea "Description" (156:2816) | Local-interactive | ✗ | `components/ui/textarea.tsx (new)` | Fora do escopo da fase 03 (Fase 04) |
| CardVideoConfig (156:3122) | Server-connected | ✗ | `components/studio/video-details-card.tsx (new)` | Painel de prévia com dados do vídeo vindos do servidor: link único, nome do arquivo, qualidade e duração |
| Video player (I156:3122;156:3089) | Server-connected | ✗ | `components/studio/video-player.tsx (new)` | `<video>` simples com HTTP Range (TD-08), servido por presigned GET emitida pela API (TD-09). No Figma só aparece um placeholder estático: fundo preto, ícone de play e "0:00", sem barra de progresso nem controles |
| Player media icon (I156:3122;156:3095) | Presentational | ✗ | new | Ícone de imagem no canto superior esquerdo do player. Significado incerto: talvez indique o poster/thumbnail |
| Player play icon (I156:3122;156:3091) | Local-interactive | ✗ | new | Play/pause no cliente. Faz parte do player, não é instância de Icon button do DS |
| Player duration "0:00" (I156:3122;156:3100) | Presentational | ✗ | new | Tempo do player. A duração vem do processamento |
| Label "Video link" (I156:3122;156:3104) | Presentational | ✗ | new | Caption puro-DOM |
| VideoLink "streamtube.com/v/tech2024" (I156:3122;156:3107) | Local-interactive | ✗ | new | Âncora para a URL pública do vídeo (TD-07). O destino `/v/...` é a página de visualização da Fase 05, que ainda não existe |
| CopyLinkIcon (I156:3122;156:3108) | Local-interactive | ✗ | `components/studio/copy-link-button.tsx (new)` | Copia para o clipboard no cliente. No Figma é um ícone solto (`i > svg > Frame`), não uma instância de Icon button |
| Filename block (I156:3122;156:3112) | Presentational | ✗ | new | Nome original do arquivo enviado |
| Video Quality row (I156:3122;156:3117) | Presentational | ✗ | new | "1080p HD": resolução do MP4 normalizado (TD-08) |
| SectionHeader "Thumbnail" (2390:2267) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | Título + descrição "Select or upload a picture…" |
| Thumbnail row (2777:2086) | Presentational | ✗ | new | Layout: ThumbUpload + botão |
| ThumbUpload (156:2612) | Server-connected | ✗ | `components/studio/thumb-upload.tsx (new)` | Mostra a thumbnail gerada automaticamente, com URL estável public-read (TD-09). Pela descrição do Figma, é um "placeholder shown on upload screens before processing completes" |
| ThumbUpload duration badge (156:2610) | Presentational | ✗ | new | Badge "15:41". No Figma está posicionado fora da área visível (left 368 / top 207 num frame de 266×151) |
| Button "Change Thumbnail" (156:2812) | Local-interactive | ✓ | `components/ui/button.tsx` | Variante outline com ícone de upload. **Omitido na fase 03** (decisão do usuário: formulário de metadados fora). Vira Server-connected na Fase 04 (thumbnail customizada) |
| SectionHeader "Category" (2390:2270) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | — |
| Category select (2096:2238) | Local-interactive | ✗ | `components/ui/select.tsx (new)` | Valor "Science & Technology". **Omitido na fase 03** (decisão do usuário). Categorias são capability da Fase 04 |
| SectionHeader "Visibility" (2390:2273) | Presentational | ✗ | `components/ui/section-header.tsx (new)` | — |
| PrivacyOption "Public" (156:2822) | Local-interactive | ✗ | `components/studio/privacy-option.tsx (new)` | Radio selecionado. Visibilidade pública/unlisted é da Fase 04 |
| PrivacyOption "Unlisted" (156:2821) | Local-interactive | ✗ | `components/studio/privacy-option.tsx (new)` | Radio não selecionado. Fora do escopo da fase 03 |
| publish form footer (156:2798) | Presentational | ✗ | new | Container com Status + Actions |
| ProcessingStatus (2771:2088) | Server-connected | ✗ | `components/studio/processing-status.tsx (new)` | Ícone check_circle (156:2802) + "Checks complete. No issues found." (156:2801). Mostra o status de processamento do servidor via short polling no BFF (TD-11) |
| Button "Cancel" (156:2800) | Local-interactive | ✓ | `components/ui/button.tsx` | Descarta edições ou volta. Pertence ao formulário de edição, que é da Fase 04. **Omitido na fase 03** (decisão do usuário) |
| Button "Save Changes" (156:2799) | Local-interactive | ✓ | `components/ui/button.tsx` | Variante primary. **Omitido na fase 03** (decisão do usuário: formulário de metadados fora). Vira Server-connected na Fase 04 |
| DownloadButton (sem node — ausente no Figma) | Server-connected | ✓ | `components/ui/button.tsx` | **Adicionado por decisão do usuário** (2026-10-06): download nesta tela, implementado sem design. Fica no CardVideoConfig, habilitado só em `ready`; usa presigned GET com disposition `attachment` (TD-09). Exclusivo do dono na fase 03 |

### Verbs of intent

| Verb | Component | Capability (project-plan.md) |
|---|---|---|
| Reproduzir o vídeo via streaming na prévia do studio | Video player (I156:3122;156:3089) in CardVideoConfig | "Reprodução via streaming (sem necessidade de download completo)" |
| Exibir a URL única do vídeo para compartilhamento | CardVideoConfig (VideoLink I156:3122;156:3107) | "URL única por vídeo, sem conflito com outros vídeos" |
| Exibir metadados extraídos do vídeo (duração e qualidade) | CardVideoConfig (I156:3122;156:3100, I156:3122;156:3117) | "Processamento automático do vídeo após upload (extração de duração e metadados)" |
| Exibir o nome original do arquivo do vídeo pré-cadastrado | CardVideoConfig (Filename block I156:3122;156:3112) | "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload" |
| Exibir a thumbnail gerada automaticamente | ThumbUpload (156:2612) | "Geração automática de thumbnail a partir de um frame do vídeo" |
| Acompanhar o status de processamento do vídeo até um estado terminal | ProcessingStatus (2771:2088) | "Processamento automático do vídeo após upload (extração de duração e metadados)" |
| Baixar o arquivo do vídeo processado | DownloadButton (sem node) in CardVideoConfig | "Download do vídeo pelo usuário" |

### Observations

- **Resoluções do usuário (2026-10-06):** o formulário de metadados (Details, Thumbnail "Change Thumbnail", Category, Visibility e o rodapé Cancel/Save Changes) é **omitido por inteiro** na fase 03. As linhas ficam no inventário só como registro e saem da tabela de verbs; serão retomadas na Fase 04. A SideNav é construída só com links, e a lista de inscrições é um mock estático (see screen: Tela de upload de vídeo).
- **Download sem design.** O frame não tem nenhum botão, ícone ou link de download, nem em `get_design_context` nem no screenshot. Decisão do usuário (2026-10-06): implementar sem design. O DownloadButton (DS `components/ui/button.tsx`) entra no CardVideoConfig, habilitado só em `ready`, usando presigned URL com disposition attachment (TD-09). O posicionamento exato é inferido no `/implement`.
- **Estado retratado.** O frame mostra um estado concluído, não um upload em andamento. Não há barra de progresso nem percentual, e aparecem player, link, nome do arquivo, qualidade "1080p HD", thumbnail real e "Checks complete. No issues found.". Mesmo assim, o player é só um placeholder estático (play + "0:00"), e a descrição do componente ThumbUpload no Figma diz "shown on upload screens before processing completes", o que se contradiz com a imagem real exibida.
- **Estados do TD-06.** Só aparece visualmente um estado terminal de sucesso (equivalente a `ready`), e a copy "Checks complete. No issues found." não corresponde aos valores do TD-06. Os estados `awaiting_upload`, `uploaded`, `processing` e `failed` não têm representação neste frame (sem spinner, sem mensagem de erro, sem retry). Também não há badge de `publication_status` (`draft`/`published`). Os radios Public/Unlisted da seção Visibility são outro conceito (visibilidade, Fase 04) e não correspondem ao par `draft | published`.
- **Thumbnail e URL única aparecem.** A thumbnail aparece em ThumbUpload (156:2612). A URL única aparece em VideoLink (I156:3122;156:3107) com ícone de copiar (I156:3122;156:3108). O exemplo "streamtube.com/v/tech2024" tem 8 caracteres e um slug legível, diferente do id aleatório de 11 caracteres em base64url do TD-07; trato como copy placeholder. O destino `/v/...` (página pública de visualização) só existe na Fase 05.
- **Escopo do formulário.** A maior parte do frame é um formulário de edição de metadados: Title, Description, Change Thumbnail, Category, Visibility, Cancel e Save Changes. Tudo isso corresponde a capabilities da Fase 04 ("Edição das informações do vídeo…", "Categorias…", "Visibilidade…", "Fluxo de rascunho → publicação") e contradiz a decisão de que nenhum metadado é coletado na fase 03. Resolvido: o formulário é omitido por inteiro na fase 03 (ver Resoluções do usuário acima).
- **Chrome do app.** A SideNav (156:2791) traz Home, Subscriptions, You (Your videos, Liked videos) e a lista de canais inscritos. Nenhuma capability da fase 03 cobre esse chrome: likes e inscrições são da Fase 06, a home é da Fase 07. O link "Your videos" deve apontar para o painel de vídeos do canal (Fase 04). Não há header/topbar nem brand neste frame, embora a descrição do componente SideNav mencione "brand".
- **Heading inconsistente.** O título da página é "Channel Settings" (156:2794), copy de outra tela; para `/studio/videos/[publicId]` provavelmente deveria ser um título de vídeo.
- **Ícones soltos.** O ícone de play do player (I156:3122;156:3091) e o de copiar link (I156:3122;156:3108) são SVGs soltos (`i > svg > Frame`), não instâncias do componente Icon button do DS (`components/ui/icon-button.tsx`). Na implementação, vale reusar o Icon button.
- **Badge fora da área visível.** O badge de duração da ThumbUpload (156:2610, "15:41") existe em `get_design_context`, mas não aparece no screenshot porque está posicionado fora dos 266×151 do componente.
- Nenhum componente visível no screenshot ausente de `get_design_context`.
- **Capabilities sem cobertura neste frame:** "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance", "Serviço de armazenamento de arquivos (vídeos e thumbnails)" e "Serviço de processamento em segundo plano (filas)". As duas últimas são infraestrutura, sem affordance visual. O upload em si deve ficar coberto pelo frame 2734:2140.

---

## Reconciliation summary

| Capability (project-plan.md)                                                       | Covered by                                                        | Screens                                              |
|------------------------------------------------------------------------------------|-------------------------------------------------------------------|------------------------------------------------------|
| "Serviço de armazenamento de arquivos (vídeos e thumbnails)"                       | (backend; infraestrutura sem affordance de UI)                    | — (capability backend; sem UI direta)                |
| "Serviço de processamento em segundo plano (filas)"                                | (backend; infraestrutura sem affordance de UI)                    | — (capability backend; sem UI direta)                |
| "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance"   | UploadDropzone + SelectFilesButton; UploadProgressPanel           | /studio/upload, /studio/videos/[publicId]            |
| "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload"               | UploadDropzone + SelectFilesButton; CardVideoConfig               | /studio/upload, /studio/videos/[publicId]            |
| "Processamento automático do vídeo após upload (extração de duração e metadados)"  | UploadProgressPanel (UploadStatusLabel); CardVideoConfig (duração/qualidade); ProcessingStatus | /studio/videos/[publicId] |
| "Geração automática de thumbnail a partir de um frame do vídeo"                    | ThumbUpload                                                       | /studio/videos/[publicId] (concluído)                |
| "URL única por vídeo, sem conflito com outros vídeos"                              | UploadDropzone (redirect por publicId); CardVideoConfig (VideoLink) | /studio/upload, /studio/videos/[publicId]          |
| "Reprodução via streaming (sem necessidade de download completo)"                  | Video player (CardVideoConfig)                                    | /studio/videos/[publicId] (concluído)                |
| "Download do vídeo pelo usuário"                                                   | DownloadButton (sem design no Figma; CardVideoConfig)             | /studio/videos/[publicId] (concluído)                |

## Open questions

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
