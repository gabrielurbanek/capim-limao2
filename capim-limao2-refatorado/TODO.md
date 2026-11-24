# Entregas e critérios

## Loja pública, catálogo e carrinho — implementada localmente; aguarda Supabase real
- Implementar `/`, `/produtos`, `/produto/:slug`, `/carrinho`, `/sobre` e `/contato` com navegação responsiva, busca, filtro por categoria, ordenação, disponibilidade, destaques, preço, imagem, unidade e paginação/carregamento progressivo.
- Página de produto mostra nome, imagens, descrição, categoria, preço, unidade, disponibilidade, quantidade e ação adicionar.
- Carrinho adiciona/remove itens, altera quantidades, mostra subtotal/total provisórios e persiste localmente; validação definitiva de preço/estoque é no backend.
- Loja apresenta aviso, cabeçalho/logo/busca/carrinho, hero/CTA, diferenciais, categorias, destaques, institucional e rodapé. Não inventar avaliações, depoimentos, produtos, preços, estatísticas nem dados nutricionais.

## Pedidos online/WhatsApp — código implementado; Edge Function e conexão remota pendentes
- Checkout coleta somente dados mínimos; backend valida itens, preço, quantidade e disponibilidade, calcula total no PostgreSQL, preserva snapshots, persiste pedido antes do WhatsApp e cria reserva de estoque.
- WhatsApp comercial `554635366291`; idempotência impede duplicação. Pedido continua gravado se WhatsApp não abrir. Abrir WhatsApp não significa pagamento; estados operacional e financeiro separados; não marcar pago automaticamente.
- Reserva inicial de 24 horas configurável; disponibilidade considera saldo menos reservas ativas; expiração libera disponibilidade e baixa definitiva ocorre na confirmação; cancelamento depois da baixa registra inversão. Operações concorrentes não consomem a mesma unidade.

## Modelo PostgreSQL, unidades, estoque e auditoria — migration pronta; ainda não aplicada a um projeto remoto
- Criar migrations versionadas com UUID, FKs, constraints, índices, timestamps, valores `numeric(12,2)` e quantidades `numeric(12,3)`, snapshots de pedido/venda e integridade referencial.
- Unidades `un`, `g`, `kg`; unidade inteira aceita apenas quantidades inteiras; grama aceita gramas inteiras; kg aceita até três casas decimais. Estoque usa a mesma unidade de comercialização e converte corretamente; exemplo R$40/kg: 250g=R$10, 500g=R$20, 750g=R$30, 1,250kg=R$50. Total final `round(preco * quantidade, 2)` no PostgreSQL.
- `stock_movements` é ledger imutável para usuários comuns com produto, tipo, quantidade assinada, saldo posterior, motivo, responsável, vínculo e timestamp; inclui entradas, venda PDV, baixa online, ajuste, estorno e devolução. Só função SQL aplica movimentação/saldo; sem escrita direta do cliente; restrição a saldo negativo salvo exceção OWNER justificada. Reconciliação entre saldo e soma do ledger.
- Bloqueio transacional `SELECT ... FOR UPDATE` e ordenação consistente em operações mult-produto; uma única venda concorrente do último item é aprovada. Movimentos/auditoria não podem ser alterados ou removidos por usuários comuns; logs críticos com ator/cargo/ação/tabela/registro/snapshots, sem segredos ou dados pessoais desnecessários.

## PDV — código implementado; operações dependem de Supabase conectado
- Interface própria com busca, múltiplos produtos, quantidades, venda por peso, subtotal/total, cliente opcional, finalização, funcionário identificado, histórico, comprovante e impressão.
- Tabelas `sales`, `sale_items`, `sale_payments`; snapshots de produto, unidade, preço, quantidade, desconto e total. Finalização transacional grava venda/itens/pagamento/movimentos e atualiza saldos.
- EMPLOYEE/MANAGER/OWNER podem vender; desconto/cancelamento de venda/entrada/ajuste exigem MANAGER ou OWNER; permitir saldo negativo em ajuste somente OWNER.
- Cancelamento preserva venda e histórico, registra responsável e movimentos inversos; devolução é registrada, não apaga histórico.

## Autenticação, cargos, RLS e Storage — implementação pronta; integração remota pendente
- Supabase Auth e-mail/senha com persistência e refresh, login/logout, mostrar senha, recuperação, erros e estados de carregamento; sem cadastro público.
- Cargos OWNER/MANAGER/EMPLOYEE vêm de fonte única de verdade no backend, nunca de `user_metadata` editável. Edge Functions consultam usuário real via `auth.getUser()`, cargo e status ativo antes de executar. Desativação bloqueia novas operações e sessões conforme estratégia documentada.
- OWNER gerencia pessoas/configurações críticas/produtos/estoque/relatórios/pedidos/PDV/permissões. MANAGER gerencia produtos/categorias/pedidos/clientes/relatórios operacionais/estoque/descontos/cancelamentos, mas não OWNER/configurações críticas/operações OWNER-only. EMPLOYEE consulta dados autorizados, estoque, pedidos/status permitidos, dados mínimos de cliente e PDV; não altera preço, exclui pedido, gerencia pessoal, cargos, configurações ou relatórios financeiros sensíveis.
- RLS granular por SELECT/INSERT/UPDATE/DELETE, funções `SECURITY DEFINER` apenas necessárias, `search_path` fixo e privilégios mínimos; sem recursão. `product-images`: leitura pública só do catálogo publicado; upload/alteração/exclusão OWNER/MANAGER com validação MIME, tamanho e caminho.

## Bootstrap, Edge Functions e operações protegidas — código pronto; não publicado em projeto Supabase
- Primeiro OWNER com segredo apenas servidor, nunca `VITE_`, navegador, logs ou Git. `system_bootstrap` usa identificador fixo, tentativa UUID, timestamps, OWNER vinculado, estados PENDING/PROVISIONING/COMPLETED/FAILED, aquisição atômica/idempotente, prevenção de dois owners, detecção de órfãos e Saga compensatória/reconciliação; não declarar ACID distribuído nem liberar PROVISIONING apenas por tempo.
- Edge Functions: `bootstrap-owner`, `manage-staff`, `create-order`, `create-pos-sale`, `cancel-sale`, `adjust-stock`, `receive-stock`, `update-order-status`, `set-order-payment-status`, `expire-reservations` e `delete-product-image`. Cada uma valida entrada e JWT quando necessário, consulta identidade real, cargo e estado ativo, aplica a regra comercial autorizada, retorna erro consistente e não expõe detalhes internos; `service_role` fica somente no servidor. O cron de reservas usa segredo fora do navegador.

## Administração, relatórios e configurações — telas prontas; dados persistidos dependem da integração Supabase
- Dashboard com dados reais: pedidos, pendentes, vendas presenciais, pagamentos confirmados, produtos, indisponíveis, estoque baixo, pedidos recentes e mais vendidos; gráficos por período para pedidos online versus PDV, recebimentos confirmados e produtos mais vendidos. Filtros hoje/7/30/90 dias ou intervalo personalizado com data inicial e final. Valores financeiros só para OWNER/MANAGER e sem incluir pendências/estornos como recebimento; distinguir pedidos criados/concluídos, vendas registradas e pagamentos confirmados; não inventar crescimento sem comparação válida.
- CRUD de produtos: nome, slug, descrição, categoria, preço, unidade, estoque, mínimo, imagens, disponibilidade, publicação e destaque. Categorias: criar/editar/excluir ou arquivar, ativar/desativar e reordenar, preservando integridade referencial.
- Pedidos: lista, filtro, busca, detalhes, histórico, notas e impressão; status Novo, Confirmado, Em preparação, Pronto, Concluído, Cancelado; transições preservadas e pagamento separado.
- Clientes guardam apenas nome, telefone, e-mail opcional, histórico, total e último pedido. Funcionários: criar/editar cargo, desativar/reativar e consulta básica.
- PDFs A4 de pedidos/vendas por período, mais vendidos, faturamento, pedidos por estado e movimentos. Configurações editáveis de nome/logo/descrição/WhatsApp/e-mail/endereço/horários/redes/banner/textos institucionais/rodapé/avisos/diferenciais, sem inventar valores.

## Qualidade, documentação e entrega — build e testes locais passaram; PostgreSQL remoto ainda não validado
- Vitest para peso/unidade, conversão, precisão/arredondamento, estoque insuficiente/quantidade inválida, concorrência, reservas/expiração/conversão/estorno, PDV/desconto/cancelamento/devolução, pedidos/preço/estoque/idempotência/status/WhatsApp, auth/usuário inativo, bootstrap e permissões/RLS. Testes de concorrência exigem PostgreSQL real; se indisponível, entregar scripts e marcar não executados. Nunca declarar teste não executado como aprovado.
- Validação local executada: `pnpm build` concluiu TypeScript/Vite/SSR/prerender; `pnpm test` passou 18 testes em quatro arquivos (formatação/unidades, paginação, idempotência de retry e recebimentos/estornos). `pglast` parseou a migration e o SQL pgTAP; isso não aplica a migration, executa o pgTAP, nem valida transações, RLS ou concorrência num PostgreSQL real.
- Implementar metadados SEO, URLs/slugs, Open Graph, sitemap, robots, lazy images, loading/vazio/erro, acessibilidade básica, teclado e responsividade. Build e testes locais devem ser executados e resultados registrados.
- Entregar `.env.example` e README com instalação, Supabase, migrations, Auth, Storage, deploy Edge Functions, env, bootstrap, testes, build e deploy frontend. Sem credenciais reais no repositório.
- Critério geral: páginas não bastam; loja/catálogo/carrinho/pedido/WhatsApp, login/permissões backend/admin conectado, CRUD, estoque/ledger, PDV/venda por peso, relatórios com dados reais, Storage, RLS, testes executados e build devem estar implementados. Identificar precisamente qualquer integração externa que ainda dependa de configuração.


## Refatoração da vitrine e catálogo — em andamento
- Incorporar seletivamente o redesign do ZIP, preservando a arquitetura, autenticação, catálogo, carrinho, checkout e serviços já existentes; manter as consultas do catálogo limitadas a produtos publicados/disponíveis e categorias ativas, sem dados de produto/preço inventados.
- Os seletores da vitrine precisam modificar de fato a navegação e a busca no catálogo: categorias devem vir do Supabase; a porção escolhida deve pré-selecionar quantidade válida para itens vendidos em g/kg; itens vendidos por unidade mantêm quantidade 1. Explicar essa diferença e não sugerir que um pedido foi montado antes da confirmação no carrinho.
- A vitrine deve ter estados de carregamento/erro/vazio, links e botões acessíveis por teclado, estados de seleção anunciados, foco visível, movimento reduzido respeitado e layout responsivo. Remover alegações de venda/qualidade/frescor/benefícios que não sejam comprovadas por dados ou conteúdo confirmado pela loja.

## Dashboard e relatórios — em andamento
- O dashboard usa consultas reais do Supabase, mantém indicadores financeiros restritos a OWNER/MANAGER e RLS intacta, e alinha o intervalo consultado aos pontos exibidos (inclusive intervalo personalizado longo); falha de consulta não pode exibir números anteriores como se fossem atuais. A janela “Últimos N dias” deve cobrir exatamente N datas-calendário.
- Os relatórios existentes devem continuar gerando PDF e também exportar CSV para os seis tipos disponíveis, reutilizando os mesmos dados reais e intervalo; CSV deve escapar delimitadores/aspas/quebras de linha e neutralizar conteúdo que possa ser interpretado como fórmula por planilhas. Valores financeiros mascarados/indisponíveis não devem ser convertidos em zero.
- Relatórios e dashboard devem declarar que pagamentos confirmados são classificados pelo timestamp de criação do pedido/venda disponível no schema atual, não pela data de liquidação bancária; nenhuma migration será alterada para inventar essa data.

## Integração, qualidade e entrega desta refatoração — em andamento
- Preservar cargos/guards/RLS, armazenamento, rotas e persistência; atualizar o manifesto de rotas apenas se as rotas mudarem. Não sobrescrever cegamente arquivos do ZIP, não incluir código morto, não introduzir dependência npm desnecessária, não expor credenciais e não reescrever migrations/Edge Functions sem necessidade demonstrada.
- Executar os testes existentes e os novos testes focados, TypeScript, build e verificação de rotas/integridade do manifesto. Informar o que foi realmente testado localmente e o que depende de configuração/integração externa; entregar resumo e código completo dos arquivos alterados.
