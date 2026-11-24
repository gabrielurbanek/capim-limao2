# Plano de implementação — Capim Limão

## Abordagem

Aplicação SPA responsiva com React, TypeScript e Vite. React Router organiza as rotas públicas e administrativas. Tailwind CSS implementa a identidade visual e os estados responsivos. A integração persistente será Supabase PostgreSQL/Auth/Storage/Edge Functions, escolhida explicitamente pelo briefing; o banco gerenciado WebDev (MySQL) não será usado para dados comerciais. O frontend acessa o Supabase com chave anon/public e chama funções para qualquer operação privilegiada. `service_role` e segredo de bootstrap existem apenas no ambiente servidor das Edge Functions.

Migrations SQL versionadas em `supabase/migrations/` concentram o modelo, restrições, RLS, funções transacionais, snapshots e regras de estoque/peso. Edge Functions verificam JWT por `auth.getUser()`, cargo e situação ativa antes de operações administrativas, e usam o cliente privilegiado apenas depois da autorização. Funções públicas de pedidos validam entradas e calculam preços no PostgreSQL. O carrinho local é apenas conveniência e nunca autoridade de preço/estoque.

A estrutura separa `src/app`, `components`, `contexts`, `hooks`, `lib`, `services`, `types`, `utils` e `pages/{storefront,admin,auth}`; `supabase/functions` recebe operações de domínio; `tests` cobre conversão, arredondamento e fluxos sem PostgreSQL, enquanto testes concorrentes de banco serão identificados como não executados se não houver instância PostgreSQL real.

Sem credenciais fornecidas do projeto Supabase não é possível afirmar integração remota já conectada. A aplicação terá configuração por `.env`, estado de conexão explícito, schema e funções prontos para aplicar, e README com a configuração externa pendente; não será preenchida com produtos, preços ou clientes fictícios. Os dados institucionais ausentes ficarão neutros/editáveis.

## Estrutura principal

- `src/app`: composição da aplicação, rotas, providers e guards.
- `src/components/ui`, `layout`, `storefront`, `dashboard`: controles reutilizáveis e navegação visual.
- `src/pages/storefront`, `admin`, `auth`: telas segmentadas por domínio.
- `src/services` e `src/lib`: consultas Supabase, validação, formatação, pedidos e domínio.
- `supabase/migrations`: schema PostgreSQL, RLS, auditoria e operações transacionais.
- `supabase/functions`: autenticação/autorizações e orquestração de operações confiáveis.
- `tests`: testes Vitest para regras determinísticas e contratos locais.
- `public`: manifestos SEO e rotas declaradas; fotos editoriais usam caminhos do armazenamento gerenciado da plataforma.

## Direção visual

**Movimento:** editorial botânico premium, com clareza de empório natural contemporâneo.

**Princípios:** conteúdo comercial somente quando confirmado; contraste e legibilidade primeiro; ritmo editorial assimétrico com respiro; ferramentas administrativas compactas e orientadas a tarefas.

**Cor:** creme e cinzas quentes dão luz de papel natural; verde-floresta ancora confiança e origem; verde-lima é acento econômico para ação/estado; carvão sustenta textos. No painel, base verde-carvão escura, superfícies verde profundo e acento lima.

**Layout:** loja com faixas editoriais e imagens deslocadas em vez de um mosaico genérico; catálogo é organizado e filtrável; painel de desktop com sidebar fixa e conteúdo operacional, adaptado a drawer no mobile.

**Assinaturas:** marca tipográfica com símbolo de folha/ramo em traço simples; divisores curvos discretos inspirados em folhas; pílulas de categoria e badges de estado com contraste contido.

**Interação/animação:** feedback imediato em adição ao carrinho, skeleton/estados vazios, transições curtas e suaves; animação não mascara carregamento nem bloqueia teclado. Respeitar `prefers-reduced-motion`.

**Tipografia:** Cormorant Garamond em títulos editoriais e Plus Jakarta Sans em navegação, preços, formulários e dados, conforme a proposta visual do ZIP; hierarquia fluida e legível em telas pequenas.

**Essência:** armazém natural para quem procura uma experiência de compra serena, clara e botânica; personalidade acolhedora, criteriosa e contemporânea.

**Tom:** objetivo e sensorial sem prometer benefícios não comprovados. Exemplos: “Escolhas naturais, no seu ritmo.” e “Explore o catálogo do Capim Limão.”

**Wordmark:** nome em serif editorial acompanhado de um ramo linear de capim-limão; sem inventar selo de certificação.

**Cor proprietária:** verde-floresta `#1E472A`; paleta oficial adicional `#88C540`, `#2D2D2D`, `#FAF8F5`, `#F2EFE9`.

## Refatoração incremental em andamento

Manter o stack React/TypeScript/Vite, providers/contextos, rotas atuais, serviços Supabase e migrations/Edge Functions existentes. Incorporar seletivamente os componentes de marca e a Home revisada, mas substituir controles sem efeito por filtros reais do catálogo e quantidades válidas do carrinho; usar somente conteúdo confirmado e dados de vendas persistidos. Dashboard e relatórios devem explicitar que o recorte financeiro é por data de criação do pedido/venda, pois o modelo atual não fornece um timestamp canônico de liquidação; não inferir essa data. Exportar os mesmos conjuntos de dados em PDF e CSV, respeitando RLS e guards de cargo. Corrigir janelas de data/estados de erro; cobrir helpers alterados com Vitest; manter o manifesto de rotas sincronizado. Não alterar migrations ou Edge Functions sem evidência de requisito que o schema atual não consiga atender.

## Restrições relevantes

Não criar publicação pública, conectar serviço externo, enviar mensagens comerciais, inventar conteúdo de catálogo, criar credenciais ou alegar que testes PostgreSQL/integração foram executados. Auto-publicação está desligada. Usar somente as imagens botânicas de uso editorial planejado.
