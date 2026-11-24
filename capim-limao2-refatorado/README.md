# Capim Limão — Armazém Natural

Loja e painel administrativo responsivos para o Capim Limão. A aplicação evita catálogo de demonstração: começa sem produtos, preços, clientes ou estoque fictícios; a equipe os cadastra depois da conexão real ao Supabase.

## Tecnologias e estrutura

- React, TypeScript, Vite, Tailwind, React Router e Vitest.
- Supabase PostgreSQL, Auth, Storage e Edge Functions como backend comercial. O banco gerenciado Manus/WebDev (MySQL) não é usado para os dados da loja.
- `src/`: loja, autenticação, painel, serviços, componentes e regras de interface.
- `supabase/migrations/`: schema e funções SQL transacionais com RLS.
- `supabase/functions/`: operações de pedido, equipe, PDV, estoque, imagens, bootstrap e expiração.
- `TODO.md`: requisitos e estado de conclusão. `plan.md`: decisões técnicas e identidade visual.

## Executar localmente

Requer Node.js 22+ e pnpm 11.25.0.

```bash
pnpm install
cp .env.example .env
# preencher somente URL e anon/publishable key públicas do Supabase
pnpm dev
```

Sem as variáveis Supabase, as rotas e estados de configuração continuam navegáveis, mas o catálogo e as operações persistentes exibem a ausência de conexão. Para testar o HTML de produção e o pré-render, rode `pnpm build` e depois `pnpm preview`.

Rotas públicas: `/`, `/produtos`, `/produto/:slug`, `/carrinho`, `/sobre` e `/contato`. Rotas da equipe sob `/admin`: login, painel, catálogo, categorias, estoque, PDV, pedidos, clientes, funcionários, relatórios e configurações. `/manus-routes.json` lista as rotas da aplicação.

## Conectar um projeto Supabase

Não há credenciais ou projeto remoto conectados neste repositório. Não coloque `service_role`, segredos ou senhas em variáveis `VITE_*`, no cliente, no Git ou em logs.

1. Crie/selecione um projeto Supabase dedicado e instale a CLI oficial. Na raiz, faça `supabase login` e `supabase link --project-ref <project-ref>`.
2. Confira que esse é o projeto correto: a próxima migration cria o schema comercial e políticas RLS; não a execute em um banco com dados não relacionados.
3. Aplique `supabase/migrations/202611170001_core.sql` com `supabase db push`. A migration cria estrutura, estados/papéis, ledger, Storage privado `product-images`, políticas e dados institucionais mínimos. Não semeia produtos, categorias, funcionários nem clientes.
4. No Dashboard Supabase, configure Auth para o domínio HTTPS real da loja e redirects necessários. O cadastro aberto está desligado. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de build/preview do frontend. Configure `VITE_PUBLIC_SITE_URL` somente com a origem pública definitiva (`https://dominio-real`); sem ela canonical e sitemap absolutos são deliberadamente omitidos.
5. Defina no ambiente de Edge Functions os segredos `OWNER_BOOTSTRAP_SECRET` e `RESERVATION_JOB_SECRET` com valores aleatórios fortes, por exemplo com `supabase secrets set OWNER_BOOTSTRAP_SECRET="<valor-forte>" RESERVATION_JOB_SECRET="<outro-valor-forte>" --project-ref "$PROJECT_REF"`. A plataforma fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ao runtime Edge. A chave service-role não é variável `VITE_*`.
6. Publique as funções declaradas em `supabase/config.toml`:

```bash
for file in supabase/functions/*/index.ts; do
  fn="${file%/index.ts}"
  supabase functions deploy "${fn##*/}" --project-ref "$PROJECT_REF"
done
```

7. Faça o primeiro bootstrap **uma vez**, de forma controlada. Envie `POST https://<project-ref>.supabase.co/functions/v1/bootstrap-owner`, o header `x-bootstrap-secret: <OWNER_BOOTSTRAP_SECRET>` e JSON `{"email":"...","password":"...","full_name":"..."}`. A senha deve ter pelo menos 12 caracteres. Guarde as credenciais do OWNER em local seguro; quando a criação for confirmada, remova `OWNER_BOOTSTRAP_SECRET` do projeto. Se a função informar reconciliação pendente, não repita a tentativa antes de verificar Auth e `system_bootstrap`.
8. Configure externamente uma tarefa a cada cinco minutos para `POST https://<project-ref>.supabase.co/functions/v1/expire-reservations`, com `x-reservation-job-secret: <RESERVATION_JOB_SECRET>` e body `{}`. Guarde o valor secreto no cofre do agendador, não em migration, código ou URL. Mesmo antes do job, a disponibilidade de uma reserva vencida deixa de ser considerada pelo horário; o job registra a liberação persistida.
9. Preencha dados reais em `/admin/configuracoes`, cadastre categorias/produtos e confirme unidades, preços, saldo inicial e fotos antes de habilitar a venda.

A criação do pedido salva o pedido e snapshot de preço no banco antes de abrir WhatsApp. WhatsApp não confirma pagamento; estado financeiro é separado do operacional. O PDV e as transições de estoque dependem das Edge Functions e das permissões do cargo, não de atualizações diretas no navegador.

## Verificações disponíveis

```bash
pnpm test        # Vitest: formato, peso/unidade, paginação, retry e recebimentos
pnpm build      # tsc, Vite, HTML SSR público, SEO condicional e build
```

A migration também inclui pgTAP em `supabase/tests/001_numeric_and_weight.sql`; execute `supabase test db` somente num ambiente Supabase local descartável. No workspace de desenvolvimento, 18 testes Vitest passaram em quatro arquivos. Testes de concorrência e integridade transacional precisam de PostgreSQL de verdade; não foram executados apenas pela análise estática. O SQL foi parseado, mas isso não substitui aplicar e testar a migration no projeto real.

## SEO e publicação

O build pré-renderiza HTML para rotas públicas e, se a chave pública permite ler produtos publicados durante o build, também para seus slugs. `VITE_PUBLIC_SITE_URL` precisa ser uma origem HTTPS real: o build não inventa canonical, `og:url` ou sitemap. Rotas administrativas/carrinho não entram no sitemap; `robots.txt` exclui `/admin/` e `/carrinho`. Metadados de produto usam apenas conteúdo público cadastrado.

O `Dockerfile` instala a versão fixada do pnpm, compila o frontend no build da imagem e inicia `server.mjs`, que serve os HTML/assets e responde no endpoint de health `/_app/health`. O listener usa `PORT` (padrão 3000). O projeto WebDev também precisa da declaração de deploy com esse health path antes da publicação.

A publicação do frontend é separada da integração comercial. Este repositório não contém credenciais de produção nem está ligado a um projeto Supabase remoto; configure URL/chave pública e serviços de produção de forma independente. Não copie credenciais de desenvolvimento para produção. Sem essa integração, nenhuma operação comercial real estará disponível; aplique a migration, publique Edge Functions e conclua o bootstrap OWNER antes de operar a loja.
