# Casos de Teste End-to-End — UNITUR

Documento gerado para uso por outro agente de QA. Cobre o painel administrativo (`/admin/*`), o site público e as regras de negócio + segurança do projeto Angular UNITUR (Firebase Firestore + Storage).

## Contexto técnico (referência)

- **Stack**: Angular 17+, Firebase (Auth + Firestore + Storage), Reactive Forms.
- **Storage**: bucket `unitur-e7882.firebasestorage.app`, com pastas estruturadas: `posts/{id}/`, `viagens/{id}/`, `banners/{id}/`, `depoimentos/{id}/`.
- **Coleções Firestore**: `posts`, `trips`, `banners`, `testimonials`, `categories`.
- **Validação de upload**: máx. 5 MB, somente `image/jpeg`, `image/jpg`, `image/png`, `image/webp`.
- **Status semânticos**:
  - Posts: `draft` / `published`
  - Viagens: `active` / `inactive`
  - Banners: `active` / `inactive`
  - Depoimentos: `pending` / `approved` / `rejected`

## Rotas relevantes

### Públicas
- `/` — home (banners, viagens por tipo, depoimentos, posts em destaque)
- `/viagens` — listagem geral
- `/viagens/peregrinacao`, `/viagens/regulares`, `/viagens/curadoria` — listagens filtradas
- `/viagens/:slug` — detalhe da viagem
- `/blog` — listagem do blog (paginação, filtro por categoria)
- `/blog/:slug` — detalhe do post
- `/about` — sobre (estático)
- `/administrador` — login

### Admin (todas protegidas por `authGuard`)
- `/admin/viagens` (lista) · `/admin/viagens/nova` · `/admin/viagens/:id/editar`
- `/admin/posts` (lista) · `/admin/posts/novo` · `/admin/posts/:id/editar`
- `/admin/categorias` (lista + modal CRUD)
- `/admin/banners` (lista + modal CRUD)
- `/admin/depoimentos` (lista + modal CRUD)
- `/admin/dashboard` → redireciona para `/admin/viagens`

---

## Seção 1 — Autenticação & autorização

### TC-AUTH-001 — Acesso direto ao admin sem login deve redirecionar
**Passos**: abrir uma aba anônima e navegar diretamente para `https://<host>/admin/viagens`.
**Esperado**: redireciona para `/administrador?returnUrl=/admin/viagens`.

### TC-AUTH-002 — Login com credenciais válidas
**Passos**: em `/administrador`, preencher e-mail/senha válidos do admin e clicar **Entrar no painel**.
**Esperado**: redireciona para `/admin/viagens` (ou para o `returnUrl` se houver). Sidebar mostra ícone com inicial do nome.

### TC-AUTH-003 — Login com senha errada
**Passos**: em `/administrador`, e-mail correto + senha incorreta.
**Esperado**: alerta vermelho "Erro ao fazer login..." aparece; campos permanecem preenchidos; botão volta ao estado normal.

### TC-AUTH-004 — Login com e-mail mal formatado
**Passos**: digitar `nao-eh-email` no campo e-mail, sair do campo.
**Esperado**: mensagem "E-mail inválido" abaixo do campo; botão "Entrar" desabilitado.

### TC-AUTH-005 — Senha curta
**Passos**: digitar senha com menos de 6 caracteres.
**Esperado**: mensagem "Senha deve ter no mínimo 6 caracteres"; botão desabilitado.

### TC-AUTH-006 — Toggle de mostrar senha
**Passos**: digitar senha, clicar no ícone de olho ao lado do campo.
**Esperado**: senha visível em texto puro; ao clicar novamente, volta a `••••`.

### TC-AUTH-007 — Logout
**Passos**: logado, clicar em **Sair** na topbar; confirmar no `confirm()`.
**Esperado**: redireciona para `/administrador`; tentar voltar para `/admin/viagens` volta a redirecionar pro login.

### TC-AUTH-008 — Sessão preservada após reload
**Passos**: logar, recarregar página.
**Esperado**: continua autenticado e na mesma rota.

---

## Seção 2 — Viagens (admin)

### TC-VIA-001 — Criar viagem mínima
**Passos**:
1. `/admin/viagens` → **+ Nova viagem**.
2. Preencher: Nome `Terra Santa Teste`, Tipo `Peregrinação`, País `Israel`, Período `Junho 2026`, Data embarque `2026-06-10`, Dias `12`, Vagas `10`, Preço `25000`, Chamada curta `Resumo curto`, Descrição completa `Descrição completa do roteiro`.
3. Status `Ativa`. Sem upload de imagem.
4. Clicar **Salvar viagem**.
**Esperado**: redireciona para `/admin/viagens`; viagem nova aparece na tabela com badge "Peregrinação" roxo e status "Ativa" verde; thumbnail mostra placeholder (ícone) por não ter imagem.

### TC-VIA-002 — Criar viagem com imagem principal
**Passos**: igual TC-VIA-001 mas anexar uma imagem (JPG ~500 KB) no campo "Imagem principal da viagem".
**Esperado**: durante o save aparece "Enviando imagens para o Firebase Storage..."; após redirect, a thumb aparece na tabela. No Firebase Storage Console, conferir que existe `viagens/<id-da-viagem>/<timestamp>-<nome>.jpg`.

### TC-VIA-003 — Validação: tentar salvar sem campos obrigatórios
**Passos**: abrir form novo, deixar Nome em branco, tentar submeter.
**Esperado**: botão "Salvar viagem" permanece **desabilitado**; campos com erro mostram borda vermelha ao perderem foco; mensagem "Campo obrigatório".

### TC-VIA-004 — Câmbio automático USD
**Passos**: no form, preencher preço `25000` e selecionar moeda **Dólar turismo (USD)**.
**Esperado**: campo "Valor convertido" preenche automaticamente em USD; abaixo aparece "Câmbio usado: 1 USD = R$ X,XX". Trocar para **Euro** atualiza valor; trocar para "Sem valor estrangeiro" limpa o campo.

### TC-VIA-005 — Câmbio offline (API falha)
**Passos**: bloquear domínios de API de câmbio (ou desligar rede temporariamente após carregar o app), salvar uma viagem com USD selecionado.
**Esperado**: viagem é salva mesmo assim; `foreignPrice` pode ficar vazio mas não bloqueia o save.

### TC-VIA-006 — Editar viagem
**Passos**: na tabela, clicar **Editar** em uma viagem existente.
**Esperado**: form abre pré-preenchido com todos os dados; URL muda para `/admin/viagens/:id/editar`; salvar redireciona para a lista.

### TC-VIA-007 — Editar viagem sem trocar imagem
**Passos**: editar uma viagem que já tem `mainImage`. Não tocar no campo de imagem. Salvar.
**Esperado**: a URL da imagem **não muda** no Firestore (mantém a antiga); nada novo é enviado ao Storage.

### TC-VIA-008 — Trocar imagem principal em edição
**Passos**: editar viagem com imagem, clicar **Trocar** no preview do componente de upload, escolher nova imagem (~1 MB), salvar.
**Esperado**: imagem nova substitui no Storage (`viagens/<id>/`); a antiga permanece no bucket (não é deletada — limitação atual; opcionalmente reportar).

### TC-VIA-009 — Adicionar imagem de experiência
**Passos**: em qualquer viagem, anexar nova imagem em "Imagem da experiência", salvar.
**Esperado**: a imagem é **adicionada** à `experienceImages` e `gallery` existentes (não substitui). Editar de novo: o array continua crescendo a cada upload.

### TC-VIA-010 — Adicionar hotel com nome
**Passos**: editar viagem, anexar imagem em "Imagem do hotel" + digitar `Hotel Galilee Premium` em "Nome do hotel", salvar.
**Esperado**: array `hotels` no Firestore ganha um item `{ name: "Hotel Galilee Premium", image: <url-storage> }`.

### TC-VIA-011 — Hotel sem nome
**Passos**: anexar imagem do hotel sem preencher "Nome do hotel". Salvar.
**Esperado**: hotel é salvo com `name: "Hotel"` (fallback).

### TC-VIA-012 — Listas multiline (incluso, não incluso, pagamento)
**Passos**: editar viagem, preencher cada um com 3 linhas (uma por item). Salvar.
**Esperado**: cada linha vira um item no array correspondente do Firestore. Linhas em branco são ignoradas.

### TC-VIA-013 — Roteiro multiline
**Passos**: preencher campo "Roteiro detalhado" com `Dia 1 | Embarque\nDia 2 | Chegada`. Salvar.
**Esperado**: salva como string única; no detalhe público vira lista de itens.

### TC-VIA-014 — Status "Inativa" oculta do site público
**Passos**: editar viagem ativa, mudar status para **Inativa**, salvar. Abrir `/viagens` no site público (modo anônimo).
**Esperado**: a viagem **não aparece** na home, nem na listagem `/viagens`, nem nos filtros por tipo. Acessar diretamente `/viagens/<slug-dela>` retorna "Viagem não encontrada".

### TC-VIA-015 — Filtros da listagem admin
**Passos**: em `/admin/viagens`, com várias viagens cadastradas:
- digitar parte de um nome no campo busca → só aparecem as que casam (case-insensitive, sem acento)
- selecionar tipo "Peregrinação" → só esse tipo
- selecionar status "Inativa" → só inativas
- clicar **Limpar** → tudo volta

### TC-VIA-016 — Empty state filtros
**Passos**: pesquisar texto que não existe (ex: `xyzabc123`).
**Esperado**: aparece "Nenhuma viagem encontrada" + botão "Limpar filtros".

### TC-VIA-017 — Excluir viagem
**Passos**: clicar **Excluir** em uma viagem, confirmar o `confirm()`.
**Esperado**: viagem some da tabela; verificar no Firestore que o documento foi deletado; abrir `/viagens` público para conferir que sumiu também.

### TC-VIA-018 — Cancelar exclusão
**Passos**: clicar **Excluir**, clicar **Cancelar** no `confirm()`.
**Esperado**: viagem permanece intacta.

---

## Seção 3 — Posts/Blog (admin)

### TC-POST-001 — Criar post rascunho
**Passos**:
1. `/admin/posts` → **+ Novo post**.
2. Título `Como planejar uma viagem`. Conferir que slug `como-planejar-uma-viagem` é gerado automaticamente.
3. Resumo `Resumo de teste com pelo menos 30 caracteres aqui.`.
4. Conteúdo `<p>Conteúdo HTML de teste com pelo menos 50 caracteres para validação do formulário.</p>`.
5. Categoria: selecionar uma existente.
6. Status: **Salvar como rascunho**.
7. Sem imagem destacada.
**Esperado**: redireciona para `/admin/posts`; post aparece com pill amarelo "Rascunho".

### TC-POST-002 — Publicar post com imagem destacada
**Passos**: criar post igual TC-POST-001 + selecionar imagem destacada na sidebar + status **Publicar imediatamente**.
**Esperado**: pill verde "Publicado" na lista; imagem aparece na thumb. No Storage, `posts/<id>/<file>` existe.

### TC-POST-003 — Contador de caracteres do resumo
**Passos**: digitar no campo Resumo.
**Esperado**: contador `X/200` atualiza em tempo real; ao passar de 200, valor não é cortado mas botão fica desabilitado e mensagem de erro aparece.

### TC-POST-004 — Editar slug manualmente
**Passos**: criar novo post, digitar título, slug é gerado. Apagar slug e digitar `meu-slug-customizado`. Salvar.
**Esperado**: slug salvo é o digitado.

### TC-POST-005 — Slug não regenera em edição
**Passos**: editar post existente, mudar o título. Conferir o campo slug.
**Esperado**: slug **não** é regenerado (preserva URL existente).

### TC-POST-006 — Tags separadas por vírgula
**Passos**: digitar `viagem, peregrinação, dicas`. Salvar.
**Esperado**: salva como array `["viagem", "peregrinação", "dicas"]` no Firestore (sem espaços nas pontas).

### TC-POST-007 — Selecionar até 3 viagens relacionadas
**Passos**: no card "Viagens relacionadas", clicar 4 chips diferentes.
**Esperado**: a partir da 4ª, os chips não selecionados ficam desabilitados (visualmente cinza). Contador `3/3` aparece. Desclicar um libera os outros.

### TC-POST-008 — Post rascunho não aparece no site público
**Passos**: criar post com status `draft`. Abrir `/blog` em aba anônima.
**Esperado**: post não aparece na listagem; acessar diretamente `/blog/<slug>` retorna "Post não encontrado".

### TC-POST-009 — Post publicado aparece no blog e na home
**Passos**: criar post publicado. Abrir `/` (home) e `/blog`.
**Esperado**: aparece em ambos. Na home, mostra os 3 mais recentes publicados.

### TC-POST-010 — Filtros admin: busca + categoria + status
**Passos**: em `/admin/posts`, testar combinações.
**Esperado**: filtros aplicam com debounce de 500ms; "Limpar" reseta tudo e volta para página 1.

### TC-POST-011 — Paginação
**Passos**: criar 12+ posts; conferir paginação (10 por página).
**Esperado**: "Anterior" desabilitado na pág. 1; "Próxima" desabilitado na última; informação "Página X de Y · Z posts" correta.

### TC-POST-012 — Excluir post com modal
**Passos**: clicar **Excluir** em um post.
**Esperado**: modal aparece com nome do post em negrito; **Cancelar** fecha sem ação; **Excluir post** confirma e remove.

### TC-POST-013 — Imagem quebrada
**Passos**: editar um post e setar manualmente uma URL inválida no Firestore como `featuredImage`. Voltar para `/admin/posts`.
**Esperado**: thumb mostra ícone placeholder em vez da imagem quebrada (handler `onPostImageError` ativa via `Set<number>`).

---

## Seção 4 — Banners (admin)

### TC-BAN-001 — Criar banner com imagem
**Passos**: `/admin/banners` → **+ Novo banner**. Título `Banner teste`, link `/viagens/terra-santa`, ordem `1`, status `Ativo`, anexar imagem. Salvar.
**Esperado**: aparece na tabela com thumb, status pill verde "Ativo"; no Storage existe `banners/<id>/<file>`.

### TC-BAN-002 — Banner sem imagem
**Passos**: tentar salvar sem imagem.
**Esperado**: botão "Salvar banner" desabilitado (`imageUrl` é required).

### TC-BAN-003 — Ordem afeta carrossel da home
**Passos**: criar dois banners ativos com order `1` e `2`. Abrir `/`.
**Esperado**: no carrossel da home, o de order `1` aparece primeiro; trocar para `2` e `1` inverte a ordem.

### TC-BAN-004 — Banner inativo não aparece no site
**Passos**: criar banner ativo, conferir que aparece na home; mudar para `Inativo`; recarregar a home.
**Esperado**: banner some do carrossel.

### TC-BAN-005 — Editar banner
**Passos**: clicar **Editar**; modal abre pré-preenchido.
**Esperado**: alterações salvam; campos opcionais (subtítulo, link, texto do botão) podem ficar em branco.

### TC-BAN-006 — Excluir banner
**Passos**: clicar **Excluir** → `confirm()` → confirmar.
**Esperado**: banner some da tabela e do Firestore.

---

## Seção 5 — Categorias (admin)

### TC-CAT-001 — Criar categoria de blog
**Passos**: `/admin/categorias` → **+ Nova categoria**. Nome `Dicas de Viagem`, slug auto = `dicas-de-viagem`, tipo `Blog`, cor `#3a75c3`. Descrição opcional. Salvar.
**Esperado**: aparece na tabela com color-dot azul, slug em código monospace, pill azul "Blog".

### TC-CAT-002 — Slug regenera ao digitar nome (somente novo)
**Passos**: criar categoria, digitar nome, ver slug atualizar. Editar uma existente, mudar nome — slug **não** muda.
**Esperado**: comportamento descrito acima.

### TC-CAT-003 — Pattern do slug
**Passos**: criar categoria, apagar slug auto, digitar `slug com espaços e MAIÚSCULAS!`. Tentar salvar.
**Esperado**: botão desabilitado; field inválido (pattern `[a-z0-9-]+`).

### TC-CAT-004 — Categoria "ambos" aparece em blog e em viagens
**Passos**: criar categoria com tipo `Blog e viagens`. Verificar no admin de posts e de viagens (campo categoria).
**Esperado**: categoria aparece em ambos os selects (lembrando que viagens não tem select de categoria visível, mas pode estar implícito na regra).

### TC-CAT-005 — Editar cor e ver propagação
**Passos**: editar categoria, mudar cor para vermelho. Abrir um post dessa categoria no admin de posts.
**Esperado**: pill da categoria na listagem admin de posts usa a nova cor.

### TC-CAT-006 — Excluir categoria com posts associados
**Passos**: tentar excluir categoria que tem posts vinculados.
**Esperado**: posts continuam existindo mas `post.category` fica `undefined` (pill some). Confirmar comportamento esperado (não impede exclusão).

---

## Seção 6 — Depoimentos (admin)

### TC-DEP-001 — Criar depoimento aprovado
**Passos**: `/admin/depoimentos` → **+ Novo depoimento**. Nome `Maria Silva`, e-mail `maria@email.com`, avaliação 5 estrelas (clicar nas estrelas), depoimento com mínimo 10 caracteres, status `Aprovado`. Salvar sem foto.
**Esperado**: aparece na tabela com 5 estrelas amarelas, avatar fallback com inicial "M", pill verde "Aprovado".

### TC-DEP-002 — Validar e-mail
**Passos**: digitar `email-invalido` no campo.
**Esperado**: field inválido; botão desabilitado.

### TC-DEP-003 — Texto curto demais
**Passos**: digitar `oi` (2 chars) no campo depoimento.
**Esperado**: campo inválido (minLength 10); botão desabilitado.

### TC-DEP-004 — Rating clicável
**Passos**: clicar na terceira estrela.
**Esperado**: 3 estrelas amarelas, 2 cinzas; contador `3/5` ao lado.

### TC-DEP-005 — Foto do cliente
**Passos**: anexar foto JPG quadrada (~300 KB). Salvar.
**Esperado**: foto vai para `depoimentos/<id>/<file>` no Storage; aparece como avatar na tabela.

### TC-DEP-006 — Depoimento pendente NÃO aparece no site
**Passos**: criar depoimento com status `Pendente`. Abrir home.
**Esperado**: não aparece no carrossel de depoimentos.

### TC-DEP-007 — Depoimento rejeitado NÃO aparece
**Passos**: criar com status `Rejeitado`. Conferir home.
**Esperado**: idem TC-DEP-006.

### TC-DEP-008 — Apenas aprovados aparecem (limite 6 na home)
**Passos**: criar 8 depoimentos aprovados. Abrir home.
**Esperado**: aparecem no máximo 6.

---

## Seção 7 — Site público (consumo dinâmico)

### TC-PUB-001 — Home reflete cadastros do admin
**Passos**: limpar todas as viagens/banners/posts/depoimentos no admin. Abrir home anônima.
**Esperado**: carrossel sem banner (não trava); seções de viagens vazias; sem depoimentos; sem posts. Site não quebra visualmente.

### TC-PUB-002 — Detalhe de viagem por slug
**Passos**: criar viagem com slug `terra-santa-2026`. Abrir `https://<host>/viagens/terra-santa-2026` direto.
**Esperado**: página de detalhe abre com todos os campos preenchidos; URL não tem query params.

### TC-PUB-003 — Slug inexistente
**Passos**: abrir `/viagens/nao-existe`.
**Esperado**: tela "Viagem não encontrada" com botão "Ver viagens disponíveis" linkando para `/viagens`.

### TC-PUB-004 — Viagem inativa retorna 404 amigável
**Passos**: pegar slug de viagem cadastrada, mudar status para `inactive` no admin, abrir o link público.
**Esperado**: idem TC-PUB-003.

### TC-PUB-005 — Filtros de viagens
**Passos**: `/viagens?destination=israel&startDate=2026-06-01&endDate=2026-12-31`.
**Esperado**: lista filtrada pelos critérios. Busca de destination é case-insensitive e sem acento.

### TC-PUB-006 — Filtro por tipo via rota
**Passos**: abrir `/viagens/peregrinacao`.
**Esperado**: só viagens de peregrinação aparecem; aba "Viagens de Peregrinação" ativa no header.

### TC-PUB-007 — Continentes/destinos na home
**Passos**: cadastrar viagens com diferentes valores de `country`. Abrir home.
**Esperado**: aparecem cards de "continentes" agrupados por destino, mostrando contagem se houver múltiplas viagens para o mesmo país. Clicar leva a `/viagens?destination=<nome>`.

### TC-PUB-008 — Detalhe de post por slug
**Passos**: criar post publicado com slug `dicas-viagem`, abrir `/blog/dicas-viagem`.
**Esperado**: post abre com conteúdo HTML renderizado, imagem destacada, autor, data, tags, posts relacionados (mesma categoria) e viagens relacionadas (se `relatedTrips` foi preenchido).

### TC-PUB-009 — Post draft não acessível por URL
**Passos**: criar post `draft`, copiar slug, abrir `/blog/<slug>`.
**Esperado**: tela de erro "Post não encontrado".

### TC-PUB-010 — Paginação do blog
**Passos**: cadastrar 12 posts publicados. Abrir `/blog`.
**Esperado**: 9 por página; navegação "Anterior/Próxima" funciona; números das páginas refletem o estado.

### TC-PUB-011 — Filtro por categoria no blog
**Passos**: clicar em uma categoria.
**Esperado**: só posts dessa categoria aparecem; voltar para "Todos" volta a mostrar tudo.

### TC-PUB-012 — Compartilhar post
**Passos**: na página de detalhe do post, clicar nos botões de compartilhamento.
**Esperado**: Facebook/Twitter/WhatsApp abrem em nova aba com URL e título corretos; "Copiar link" copia para o clipboard.

### TC-PUB-013 — Origem do blog (footer/home/blog)
**Passos**: clicar em "Blog" no rodapé; ir até um post; clicar em "Voltar".
**Esperado**: volta para `/blog?origin=footer`.

### TC-PUB-014 — Carrossel de banners auto-avança
**Passos**: com 2+ banners ativos, aguardar 5 segundos na home.
**Esperado**: slide avança automaticamente; setas e indicadores funcionam.

### TC-PUB-015 — Reload no detalhe da viagem
**Passos**: estar em `/viagens/terra-santa-2026`, recarregar.
**Esperado**: página re-renderiza igual; nenhum erro de "objeto nulo" no console.

---

## Seção 8 — Upload de imagens

### TC-IMG-001 — Drag and drop
**Passos**: arrastar arquivo PNG para a área de upload em qualquer form.
**Esperado**: borda fica azul ao entrar na área; ao soltar, preview aparece com badge laranja "Pronta — será enviada ao salvar".

### TC-IMG-002 — Click para selecionar
**Passos**: clicar na área de upload, escolher arquivo via dialog.
**Esperado**: idem TC-IMG-001.

### TC-IMG-003 — Hover preview mostra ações
**Passos**: passar mouse sobre a imagem em preview.
**Esperado**: overlay escuro com botões "Trocar" e "Remover" (vermelho) aparece.

### TC-IMG-004 — Trocar imagem
**Passos**: clicar **Trocar** no preview, escolher novo arquivo.
**Esperado**: preview atualiza; objectURL antigo é liberado (sem leak).

### TC-IMG-005 — Remover imagem (antes de salvar)
**Passos**: anexar imagem, clicar **Remover**.
**Esperado**: volta ao estado vazio (dropzone); botão de salvar pode ficar desabilitado se imagem era required (banner, por ex.).

### TC-IMG-006 — Validação formato inválido
**Passos**: tentar enviar `.pdf` ou `.gif`.
**Esperado**: erro vermelho "Formato não suportado. Use JPG, PNG ou WebP."; arquivo não é aceito.

### TC-IMG-007 — Validação tamanho excedido
**Passos**: anexar imagem >5MB.
**Esperado**: erro "Imagem muito grande. Máximo 5MB."; não é aceita.

### TC-IMG-008 — Tamanho exatamente no limite
**Passos**: arquivo de exatos 5MB.
**Esperado**: aceito (limite inclusivo `<= 5 * 1024 * 1024`).

### TC-IMG-009 — Upload em paralelo
**Passos**: criar viagem com mainImage + experienceImage + hotelImage simultaneamente.
**Esperado**: spinner "Enviando imagens para o Firebase Storage..." aparece; os 3 uploads acontecem em sequência; tempo máximo de 45s cada (timeout configurado); todos vão para a pasta `viagens/<id>/`.

### TC-IMG-010 — Falha de upload tratada (timeout/permission)
**Passos**: simular falha (desligar rede no meio do upload OU configurar regras do Storage que bloqueiem).
**Esperado**: alerta vermelho aparece tipo "Viagem salva, mas falhou o upload da imagem: ... Edite a viagem para tentar novamente."; o item permanece salvo (não há rollback) — fluxo permite tentar de novo na edição.

### TC-IMG-011 — Caracteres especiais no nome do arquivo
**Passos**: anexar arquivo chamado `imagem com espaços e ção.jpg`.
**Esperado**: filename normalizado no Storage para algo como `<base36>-imagem-com-espacos-e-cao.jpg`.

### TC-IMG-012 — Object URLs liberados ao desmontar
**Passos**: anexar imagem em form de viagem, navegar para outra rota antes de salvar.
**Esperado**: nenhum leak de memória; `URL.revokeObjectURL` é chamado no `ngOnDestroy`.

---

## Seção 9 — Segurança

### TC-SEC-001 — XSS em campos texto
**Passos**: criar post com título `<script>alert('XSS')</script>` e conteúdo `<img src=x onerror=alert(1)>`.
**Esperado**:
- No admin (listagem/edição): título é exibido como texto literal (Angular escapa por padrão).
- No site público (detalhe): conteúdo HTML é renderizado via `[innerHTML]` (se for o caso). O `<script>` **não** deve executar (Angular sanitiza). O `<img onerror>` **não** deve disparar alert.
- Inspecionar DOM: tags perigosas devem estar neutralizadas.

### TC-SEC-002 — XSS em URL de imagem
**Passos**: tentar setar `featuredImage: "javascript:alert(1)"` direto no Firestore (via console).
**Esperado**: img tag com `src="javascript:..."` não dispara alert; navegador bloqueia.

### TC-SEC-003 — Tentar acessar rotas admin sem token
**Passos**: em DevTools, limpar `localStorage` / sair de sessão; navegar para `/admin/posts/novo`.
**Esperado**: redireciona para login.

### TC-SEC-004 — Token expirado
**Passos**: aguardar expiração do token Firebase (ou forçar manualmente). Tentar carregar `/admin/viagens`.
**Esperado**: ou pede re-login, ou redireciona; nunca mostra dados sem auth.

### TC-SEC-005 — Acesso direto ao Firestore por console (read)
**Passos**: aba anônima sem login, abrir DevTools, tentar ler coleção `posts` direto via Firebase SDK no console.
**Esperado**: regras do Firestore devem permitir read em `posts`/`trips`/`banners`/`testimonials`/`categories` (porque o site público lê sem auth). Documentar essa decisão.

### TC-SEC-006 — Tentar write sem auth
**Passos**: aba anônima, tentar `setDoc` em qualquer coleção via console.
**Esperado**: erro "permission denied". Se permitir, é uma falha grave de regras.

### TC-SEC-007 — Tentar write como user não-admin
**Passos**: se houver papéis (admin vs user comum), logar como user comum e tentar criar viagem.
**Esperado**: bloqueado pelas regras do Firestore.

### TC-SEC-008 — Upload de arquivo executável renomeado
**Passos**: pegar um arquivo `.exe`, renomear para `.jpg`, tentar upload.
**Esperado**: bloqueado pela validação client-side (`file.type` não bate); se passar, regras do Storage devem rejeitar `contentType` não-imagem.

### TC-SEC-009 — Upload de SVG com script
**Passos**: criar SVG com `<script>alert(1)</script>` interno, tentar upload (renomear para .png se preciso).
**Esperado**: SVG não está na lista permitida (`jpeg/jpg/png/webp`); bloqueado. Se passar, ao renderizar no site, script não deve executar (use `<img src>`, nunca `<object>`).

### TC-SEC-010 — Path traversal no Storage
**Passos**: tentar criar viagem com `id` malicioso (via console, forçando) tipo `../../etc/passwd`.
**Esperado**: o `id` é sempre `Date.now()` (gerado internamente), não vem do usuário — confirmar que não há vetor. Se a regra do Storage prefixa o caminho corretamente, é seguro.

### TC-SEC-011 — Vazamento de chave Firebase
**Passos**: inspecionar HTML/JS público (bundle) por chaves.
**Esperado**: `apiKey` do Firebase **é pública por design** — não é segredo. Mas **regras do Firestore/Storage devem estar configuradas** corretamente para que essa chave não dê superpoderes. Confirmar regras.

### TC-SEC-012 — CSRF / cross-origin
**Passos**: tentar fazer fetch do site para o Firestore a partir de outro domínio.
**Esperado**: Firebase não usa cookies de sessão (token Bearer), então CSRF clássico não se aplica. Mas verificar se há CORS aberto demais em endpoints customizados (se houver).

### TC-SEC-013 — Dados sensíveis em URLs
**Passos**: navegar pelo site e admin observando URLs.
**Esperado**: nenhuma URL contém senha, token, e-mail, ou dados pessoais. IDs numéricos em URL admin são esperados (`/admin/posts/1234/editar`).

### TC-SEC-014 — Brute-force no login
**Passos**: tentar 10+ logins com senha errada para o mesmo e-mail.
**Esperado**: Firebase Auth tem rate limiting próprio; após N tentativas, retorna `auth/too-many-requests`. Confirmar mensagem amigável no front (não deve quebrar com erro técnico).

### TC-SEC-015 — Enumeração de usuários
**Passos**: tentar login com e-mails inexistentes vs existentes.
**Esperado**: mensagem de erro **idêntica** para ambos os casos ("credenciais inválidas") — não vazar se o e-mail está cadastrado.

### TC-SEC-016 — Injeção em filtros
**Passos**: na busca do admin de posts, digitar `'; DROP TABLE posts; --` ou `{$ne:null}`.
**Esperado**: tratado como string literal de busca; nenhum efeito malicioso (Firestore não é SQL e queries são parametrizadas).

### TC-SEC-017 — Conteúdo HTML não-confiável no post
**Passos**: criar post com `<iframe src="https://site-malicioso.com"></iframe>` no conteúdo, publicar.
**Esperado**: ao renderizar no site público (`[innerHTML]`), Angular **sanitiza** e remove o iframe. Confirmar no DOM final.

### TC-SEC-018 — Open redirect via returnUrl
**Passos**: abrir `/administrador?returnUrl=https://evil.com`.
**Esperado**: após login, NÃO redireciona para evil.com. Idealmente valida que returnUrl começa com `/` (rota interna).

---

## Seção 10 — Resiliência / regras de negócio

### TC-RES-001 — Cache localStorage não traz "zombies"
**Passos**: cadastrar viagem; deletar diretamente no Firestore Console; recarregar `/admin/viagens`.
**Esperado**: viagem não aparece (o `replaceLocalTrips` substitui o cache pelo que veio do Firestore).

### TC-RES-002 — Comportamento offline (sem Firestore)
**Passos**: desligar rede; navegar pelo admin.
**Esperado**: ainda mostra dados do cache local; criar nova viagem ainda funciona (salva localmente e tenta no Firestore quando voltar). Mensagens "salvou localmente mas não persistiu no Firestore" devem aparecer no console.

### TC-RES-003 — Resposta lenta do Firestore
**Passos**: simular latência alta (DevTools throttle: Slow 3G).
**Esperado**: spinners aparecem; nenhum click duplo causa criação duplicada (botão desabilitado durante save).

### TC-RES-004 — Concorrência: dois admins editando a mesma viagem
**Passos**: abrir mesma viagem em duas abas; editar campos diferentes em cada uma; salvar ambas em sequência.
**Esperado**: última gravação vence (`setDoc` com `merge: true`). Documentar essa regra.

### TC-RES-005 — Slug duplicado entre viagens
**Passos**: criar duas viagens com mesmo título → mesmo slug auto.
**Esperado**: ambas salvam (Firestore não impõe unicidade por slug). Detalhe público `/viagens/<slug>` retorna a primeira que casar. Documentar como limitação OU forçar slug único na validação.

### TC-RES-006 — Slug duplicado entre posts
**Passos**: idem TC-RES-005 mas para posts.

### TC-RES-007 — Imagem deletada do Storage manualmente
**Passos**: deletar arquivo do Storage Console manualmente. Recarregar a página que usa essa imagem.
**Esperado**: `<img>` quebra (404). No admin de posts, handler de error mostra placeholder. No site público, imagem fica quebrada (limitação) — opcionalmente reportar.

### TC-RES-008 — Exclusão de viagem com posts relacionados
**Passos**: criar post com `relatedTrips: [viagem-X.id]`. Excluir viagem-X. Abrir detalhe do post.
**Esperado**: seção "Viagens relacionadas" fica vazia (sem quebrar); array `relatedTrips` no post não é limpo automaticamente — apenas filtra IDs inexistentes.

### TC-RES-009 — Categoria excluída referenciada por post
**Passos**: criar post com categoria X. Excluir categoria X. Abrir admin de posts.
**Esperado**: `post.category` fica `undefined`; pill da categoria some da listagem; post continua editável; `categoryId` ainda existe (referência órfã).

---

## Seção 11 — UI/UX e acessibilidade

### TC-UI-001 — Sidebar fecha em mobile
**Passos**: redimensionar para < 968px.
**Esperado**: sidebar fica oculta; topbar mostra botão hambúrguer para abrir.

### TC-UI-002 — Topbar avatar mostra inicial
**Passos**: logar como usuário com nome `Maria` ou e-mail `maria@x.com`.
**Esperado**: avatar laranja com letra "M".

### TC-UI-003 — Estados de hover/focus
**Passos**: tabular pelos campos do form de viagem.
**Esperado**: foco visível em cada campo (border laranja + box-shadow).

### TC-UI-004 — Inputs com erro ficam vermelhos
**Passos**: deixar campo required vazio e perder foco.
**Esperado**: borda vermelha + background rosa-claro + mensagem abaixo.

### TC-UI-005 — Modal fecha ao clicar fora
**Passos**: abrir modal (banner/categoria/depoimento/exclusão de post), clicar no overlay escuro.
**Esperado**: modal fecha (a menos que esteja salvando).

### TC-UI-006 — Modal não fecha durante save
**Passos**: clicar **Salvar**; durante o spinner, clicar no overlay.
**Esperado**: modal permanece (closeForm é guardado por `if (!this.saving)`).

### TC-UI-007 — Botões disabled têm cursor not-allowed
**Passos**: passar mouse em botão desabilitado.
**Esperado**: cursor proibitivo, opacidade reduzida.

### TC-UI-008 — Mensagens de feedback claras
**Passos**: revisar todos os fluxos.
**Esperado**: cada save/delete tem feedback visual (alerta, redirect ou refresh da lista). Nenhum fluxo termina sem confirmação visual.

### TC-UI-009 — Empty states informativos
**Passos**: navegar para cada listagem admin sem dados.
**Esperado**: card com ícone SVG + título + descrição + botão de ação primária.

### TC-UI-010 — Loading states não travam UI
**Passos**: enquanto uma lista carrega, tentar clicar em filtros.
**Esperado**: nenhum freeze; após carregar, filtros aplicam.

---

## Anexos

### Variáveis de teste sugeridas

| Campo | Valor |
|---|---|
| Admin e-mail | `<usar credencial fornecida>` |
| Imagem teste JPG válida | <500KB, 1600×900 |
| Imagem teste PNG válida | <500KB, transparente |
| Imagem GIF inválida | qualquer .gif |
| Imagem grande inválida | >5MB |
| SVG malicioso | com `<script>` interno |
| Texto XSS | `<script>alert('XSS')</script>` |
| Texto longo | 1000+ caracteres |
| E-mail inválido | `nao-eh-email` |
| Slug inválido | `slug com espaço!` |

### Como reportar bugs encontrados

Para cada falha, descrever:
1. **ID do caso** (ex: TC-VIA-014)
2. **Passos para reproduzir** (incluindo URL e dados usados)
3. **Esperado vs observado**
4. **Severidade**: crítico (bloqueia uso) / alto (regra de negócio quebrada) / médio (UX ruim) / baixo (visual)
5. **Console errors** (se houver)
6. **Screenshot** se possível

### Cobertura

- ✅ Cadastro completo (todas as entidades)
- ✅ Edição (todas as entidades)
- ✅ Exclusão (todas as entidades)
- ✅ Listagem e filtros
- ✅ Validações de formulário
- ✅ Upload de imagens (validações + estrutura no Storage)
- ✅ Regras de status (published/active/approved propagam para o site público)
- ✅ Slug-based routing
- ✅ Autenticação e autorização
- ✅ XSS, injeção, sanitização HTML
- ✅ Permissões de Firestore/Storage
- ✅ Casos de borda (offline, lentidão, dados inconsistentes)
- ✅ Acessibilidade básica e UX
