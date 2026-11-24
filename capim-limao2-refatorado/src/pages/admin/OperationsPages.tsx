import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, RefreshCw, Search, UserPlus } from 'lucide-react';
import { requireSupabase, supabaseConfigured } from '../../lib/supabase';
import { money, quantityText } from '../../lib/format';
import { fetchAllPages } from '../../lib/pagination';
import type { Product, StockMovement, Role } from '../../types/domain';
import { useAuth } from '../../contexts/AuthContext';

function unavailable(title: string) { return <div className="admin-setup"><div className="eyebrow">ADMINISTRAÇÃO</div><h1>{title}<em>.</em></h1><div className="setup-warning">Configure Supabase para acessar os dados persistidos deste módulo.</div></div>; }

export function StockPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'receive' | 'adjust'>('receive');
  const [allowNegative, setAllowNegative] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canManage = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  const isOwner = profile?.role === 'OWNER';
  const refresh = async () => {
    const client = requireSupabase();
    const [p, m] = await Promise.all([
      client.from('products').select('id,name,slug,price,unit,stock_balance,minimum_stock,is_available,is_published,is_featured').order('name'),
      client.from('stock_movements').select('id,product_id,movement_type,quantity,balance_after,reason,actor_id,created_at,products(name,unit)').order('created_at', { ascending: false }).limit(100),
    ]);
    if (p.error || m.error) throw new Error('Falha ao carregar o inventário ou o livro de movimentos.');
    setProducts((p.data ?? []) as unknown as Product[]); setMovements((m.data ?? []) as unknown as StockMovement[]);
  };
  useEffect(() => { if (supabaseConfigured) void refresh().catch((e) => setError(e.message)); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const numeric = Number(quantity.replace(',', '.'));
      if (!Number.isFinite(numeric) || numeric === 0 || (mode === 'receive' && numeric < 0) || !reason.trim()) throw new Error(mode === 'receive' ? 'Informe quantidade positiva e justificativa.' : 'Informe uma variação diferente de zero e justificativa.');
      const functionName = mode === 'receive' ? 'receive-stock' : 'adjust-stock';
      const body = mode === 'receive'
        ? { product_id: productId, quantity: quantity.replace(',', '.'), reason: reason.trim() }
        : { product_id: productId, quantity_delta: quantity.replace(',', '.'), reason: reason.trim(), allow_negative: isOwner && allowNegative };
      const { data, error: functionError } = await requireSupabase().functions.invoke(functionName, { body });
      if (functionError || data?.error) throw new Error(data?.error?.message || 'A movimentação foi recusada pelo backend.');
      setNotice(mode === 'receive' ? 'Entrada registrada no livro-razão.' : 'Ajuste registrado no livro-razão.'); setQuantity(''); setReason(''); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível aplicar a movimentação.'); }
    finally { setBusy(false); }
  };
  if (!supabaseConfigured) return unavailable('Estoque');
  const visible = products.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">INVENTÁRIO</div><h1>Estoque<em>.</em></h1><p>Saldo atual e histórico imutável de movimentações.</p></div><button className="button button--subtle" onClick={() => void refresh()}><RefreshCw size={15} /> Atualizar</button></div>{error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}
    {canManage && <form className="stock-action-card" onSubmit={submit}><div className="stock-action-card__heading"><div><span>REGISTRAR MOVIMENTO</span><h2>{mode === 'receive' ? 'Entrada de mercadorias' : 'Ajuste de saldo'}</h2></div><div className="segmented"><button type="button" className={mode === 'receive' ? 'selected' : ''} onClick={() => { setMode('receive'); setAllowNegative(false); }}><ArrowDownToLine size={14} /> Entrada</button><button type="button" className={mode === 'adjust' ? 'selected' : ''} onClick={() => setMode('adjust')}><ArrowUpFromLine size={14} /> Ajuste</button></div></div><div className="stock-form-grid"><label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · saldo {product.stock_balance} {product.unit}</option>)}</select></label><label>{mode === 'receive' ? 'Quantidade recebida' : 'Variação assinada'}<input required inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ex.: 2,500" /></label><label>Justificativa<input required minLength={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo" /></label><button className="button button--admin" disabled={busy || !productId}>{busy ? 'Registrando…' : 'Registrar movimento'} <Check size={15} /></button></div>{isOwner && mode === 'adjust' && <div className="form-toggles"><label><input type="checkbox" checked={allowNegative} onChange={(event) => setAllowNegative(event.target.checked)} /> Autorizar que este ajuste deixe saldo negativo</label></div>}<p className="form-hint">O saldo só muda por operação transacional. Saldo negativo exige autorização explícita de OWNER e justificativa.</p></form>}
    <div className="inventory-grid"><section className="table-card"><div className="table-card__heading"><div><span>SALDO ATUAL</span><h2>Produtos no inventário</h2></div><label className="table-search"><Search size={15} /><input aria-label="Buscar produto no inventário" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label></div><div className="table-scroll"><table><thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th><th>Disponibilidade</th></tr></thead><tbody>{visible.map((product) => { const low = Number(product.stock_balance) <= Number(product.minimum_stock); return <tr key={product.id}><td>{product.name}</td><td>{quantityText(product.stock_balance, product.unit)}</td><td>{quantityText(product.minimum_stock, product.unit)}</td><td><span className={`status-pill ${low ? 'status-pill--cancelled' : 'status-pill--ready'}`}>{low ? 'Estoque baixo' : 'Regular'}</span></td></tr>; })}{!visible.length && <tr><td colSpan={4} className="empty-row">Nenhum produto cadastrado.</td></tr>}</tbody></table></div></section>
      <section className="table-card"><div className="table-card__heading"><div><span>LIVRO-RAZÃO</span><h2>Movimentações recentes</h2></div></div><div className="movement-list">{movements.map((movement) => <div className="movement-row" key={movement.id}><span className={`movement-icon ${Number(movement.quantity) > 0 ? 'in' : 'out'}`}>{Number(movement.quantity) > 0 ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}</span><div><strong>{movement.movement_type.replaceAll('_', ' ')}</strong><small>{(movement as unknown as { products?: { name?: string } }).products?.name || 'Produto'} · {movement.reason}</small><small>{new Date(movement.created_at).toLocaleString('pt-BR')}</small></div><b>{Number(movement.quantity) > 0 ? '+' : ''}{movement.quantity}</b></div>)}{!movements.length && <p className="empty-row">Nenhuma movimentação registrada.</p>}</div></section></div>
  </section>;
}

const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
const orderLabel: Record<string, string> = { NEW: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparação', READY: 'Pronto', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };
interface OrderRecord { id: string; order_number: string; customer_name: string; customer_phone: string; status: string; payment_status: string | null; total: string | number | null; created_at: string; notes: string | null }

export function OrdersPage() {
  const { profile } = useAuth();
  const canSeeFinance = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    const client = requireSupabase();
    const data = await fetchAllPages<OrderRecord>((from, to) => client.from('orders_staff_read')
      .select('id,order_number,customer_name,customer_phone,status,payment_status,total,created_at,notes')
      .order('created_at', { ascending: false }).range(from, to));
    setOrders(data);
  };
  useEffect(() => { if (supabaseConfigured) void refresh().catch((e) => setError(e.message)); }, []);
  const setStatus = async (order: OrderRecord, status: string) => {
    if (status === 'CANCELLED' && !window.confirm(`Cancelar o pedido ${order.order_number}? O backend registrará a liberação/estorno do estoque.`)) return;
    setBusyId(order.id); setError('');
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('update-order-status', { body: { order_id: order.id, status } });
      if (invokeError || data?.error) throw new Error(data?.error?.message || 'A transição foi recusada. Verifique o cargo e o histórico.');
      setNotice('Status atualizado e transição registrada.'); await refresh(); if (selected?.id === order.id) setSelected({ ...order, status });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha de conexão ao atualizar o pedido.'); }
    finally { setBusyId(''); }
  };
  const setPayment = async (order: OrderRecord, paymentStatus: string) => {
    if (paymentStatus === order.payment_status) return;
    let note = paymentStatus === 'PAID' ? 'Pagamento confirmado manualmente após conferência pela equipe.' : 'Status de pagamento atualizado manualmente.';
    if (paymentStatus === 'REFUNDED') {
      const reason = window.prompt('Informe a justificativa do estorno (mínimo de 4 caracteres):');
      if (reason === null) return;
      if (reason.trim().length < 4) { setError('Informe uma justificativa de estorno válida.'); return; }
      note = reason.trim();
    }
    setBusyId(order.id); setError('');
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('set-order-payment-status', { body: { order_id: order.id, payment_status: paymentStatus, note } });
      if (invokeError || data?.error) throw new Error(data?.error?.message || 'O status de pagamento foi recusado pelo backend.');
      setNotice('Pagamento atualizado e alteração auditada. O estado operacional do pedido permanece separado.'); await refresh(); if (selected?.id === order.id) setSelected({ ...order, payment_status: paymentStatus });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha de conexão ao atualizar o pagamento.'); }
    finally { setBusyId(''); }
  };
  if (!supabaseConfigured) return unavailable('Pedidos');
  const visible = orders.filter((order) => (filter === 'ALL' || order.status === filter) && `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">VENDAS ONLINE</div><h1>Pedidos<em>.</em></h1><p>O status operacional permanece separado do status de pagamento.</p></div><span className="admin-total">{orders.length} registros</span></div>{error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}
    <div className="admin-table-tools"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido ou cliente" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">Todos os status</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{orderLabel[status]}</option>)}</select></div>
    <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Operacional</th>{canSeeFinance && <><th>Pagamento</th><th>Total</th></>}<th>Criado em</th><th>Ação</th></tr></thead><tbody>{visible.map((order) => <tr key={order.id} onClick={() => setSelected(order)} className="clickable-row"><td>#{order.order_number}</td><td>{order.customer_name}<small className="table-subline">{order.customer_phone}</small></td><td><span className={`status-pill status-pill--${order.status.toLowerCase()}`}>{orderLabel[order.status]}</span></td>{canSeeFinance && <><td>{paymentLabel(order.payment_status ?? 'UNPAID')}</td><td>{money(order.total ?? 0)}</td></>}<td>{new Date(order.created_at).toLocaleString('pt-BR')}</td><td><select aria-label={`Alterar status pedido ${order.order_number}`} value={order.status} disabled={busyId === order.id || order.status === 'CANCELLED'} onClick={(event) => event.stopPropagation()} onChange={(event) => void setStatus(order, event.target.value)}>{availableOrderStatuses(order, profile?.role ?? 'EMPLOYEE').map((status) => <option key={status} value={status}>{orderLabel[status]}</option>)}</select></td></tr>)}{!visible.length && <tr><td colSpan={canSeeFinance ? 7 : 5} className="empty-row">Nenhum pedido encontrado.</td></tr>}</tbody></table></div></div>
    {selected && <OrderDetails order={selected} onClose={() => setSelected(null)} onStatus={setStatus} onPayment={setPayment} busy={busyId === selected.id} role={profile?.role ?? 'EMPLOYEE'} />}
  </section>;
}

function OrderDetails({ order, onClose, onStatus, onPayment, busy, role }: { order: OrderRecord; onClose: () => void; onStatus: (order: OrderRecord, status: string) => void; onPayment: (order: OrderRecord, status: string) => void; busy: boolean; role: Role }) {
  const [items, setItems] = useState<Array<{ product_name: string; quantity: string | number; unit: string; unit_price: string | number | null; line_total: string | number | null }>>([]);
  const [timeline, setTimeline] = useState<Array<{ from_status: string | null; to_status: string; note: string | null; created_at: string }>>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      requireSupabase().from('order_items_staff_read').select('product_name,quantity,unit,unit_price,line_total').eq('order_id', order.id),
      requireSupabase().from('order_history_staff_read').select('from_status,to_status,note,created_at').eq('order_id', order.id).order('created_at'),
    ]).then(([itemResult, historyResult]) => { if (!active) return; setItems(itemResult.data ?? []); setTimeline(historyResult.data ?? []); });
    return () => { active = false; };
  }, [order.id]);
  const paymentOptions: Record<string, string[]> = { UNPAID: ['UNPAID','PENDING','PAID'], PENDING: ['PENDING','UNPAID','PAID'], PAID: ['PAID','REFUNDED'], REFUNDED: ['REFUNDED'] };
  const canManagePayment = role === 'OWNER' || role === 'MANAGER';
  const canSeeFinance = canManagePayment;
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal order-modal" role="dialog" aria-modal="true" aria-labelledby="order-title"><div className="admin-modal__heading"><div><span>PEDIDO ONLINE</span><h2 id="order-title">#{order.order_number}</h2></div><button onClick={onClose} aria-label="Fechar"><span>×</span></button></div><div className="order-customer"><strong>{order.customer_name}</strong><span>{order.customer_phone}</span><small>{new Date(order.created_at).toLocaleString('pt-BR')}</small></div><div className="order-snapshot-list">{items.map((item, index) => <div key={index}><span>{quantityText(item.quantity, item.unit as 'un' | 'g' | 'kg')} · {item.product_name}{canSeeFinance && <small>{money(item.unit_price ?? 0)} / {item.unit}</small>}</span>{canSeeFinance && <strong>{money(item.line_total ?? 0)}</strong>}</div>)}{!items.length && <p>Este pedido não possui itens legíveis.</p>}</div>{canSeeFinance && <div className="order-total-line"><span>Total gravado</span><strong>{money(order.total ?? 0)}</strong></div>}
    {canManagePayment && <label className="order-status-select">Pagamento (confirmação manual)<select value={order.payment_status ?? 'UNPAID'} disabled={busy} onChange={(event) => onPayment(order, event.target.value)}>{(paymentOptions[order.payment_status ?? 'UNPAID'] ?? ['UNPAID']).map((status) => <option key={status} value={status}>{paymentLabel(status)}</option>)}</select></label>}
    {canSeeFinance && order.notes && <div className="form-hint">Observação: {order.notes}</div>}<label className="order-status-select">Status operacional<select value={order.status} disabled={busy || order.status === 'CANCELLED'} onChange={(event) => onStatus(order, event.target.value)}>{availableOrderStatuses(order, role).map((status) => <option value={status} key={status}>{orderLabel[status]}</option>)}</select></label>
    <div className="order-history"><strong>Histórico do pedido</strong>{timeline.map((entry, index) => <div key={`${entry.created_at}-${index}`}><span>{entry.from_status ? `${orderLabel[entry.from_status] ?? entry.from_status} → ` : ''}{orderLabel[entry.to_status] ?? entry.to_status}</span><small>{new Date(entry.created_at).toLocaleString('pt-BR')}{entry.note ? ` · ${entry.note}` : ''}</small></div>)}{!timeline.length && <small>Nenhuma transição registrada.</small>}</div><button className="button button--subtle button--wide" onClick={() => window.print()}>Imprimir pedido</button></section></div>;
}
function availableOrderStatuses(order: OrderRecord, role: Role): string[] {
  const next: Record<string, string[]> = { NEW: ['CONFIRMED','CANCELLED'], CONFIRMED: ['PREPARING','CANCELLED'], PREPARING: ['READY','CANCELLED'], READY: ['COMPLETED','CANCELLED'] };
  const allowed = (next[order.status] ?? []).filter((status) => role !== 'EMPLOYEE' || status !== 'CANCELLED');
  return [order.status, ...allowed];
}
function paymentLabel(status: string) { return ({ UNPAID: 'Não pago', PENDING: 'Pendente', PAID: 'Pago', REFUNDED: 'Reembolsado' } as Record<string, string>)[status] ?? status; }

export function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string; email?: string | null; order_count?: number; total_spent?: string | number; last_order_at?: string | null }>>([]);
  const [error, setError] = useState('');
  const isManager = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  useEffect(() => { if (!supabaseConfigured) return; const client = requireSupabase(); const query = isManager ? client.from('customers').select('id,name,phone,email,order_count,total_spent,last_order_at').order('last_order_at', { ascending: false }) : client.from('staff_customer_directory').select('id,name,phone,order_count,last_order_at').order('last_order_at', { ascending: false }); void query.then(({ data, error: queryError }) => { if (queryError) setError('Não foi possível consultar clientes.'); else setCustomers((data ?? []) as typeof customers); }); }, [isManager]);
  if (!supabaseConfigured) return unavailable('Clientes');
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">RELACIONAMENTO</div><h1>Clientes<em>.</em></h1><p>{isManager ? 'Dados de contato e resumo de compras registrados.' : 'Dados de contato mínimos para atendimento operacional.'}</p></div><span className="admin-total">{customers.length} clientes</span></div>{error && <div className="admin-error">{error}</div>}<div className="table-card"><div className="table-scroll"><table><thead><tr><th>Nome</th><th>Telefone</th>{isManager && <><th>E-mail</th><th>Pedidos</th><th>Total de compras</th><th>Último pedido</th></>}</tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.phone}</td>{isManager && <><td>{customer.email || '—'}</td><td>{customer.order_count ?? 0}</td><td>{money(customer.total_spent ?? 0)}</td><td>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString('pt-BR') : '—'}</td></>}</tr>)}{!customers.length && <tr><td colSpan={isManager ? 6 : 2} className="empty-row">Nenhum cliente registrado por pedido.</td></tr>}</tbody></table></div></div></section>;
}

export function StaffPage() {
  const [staff, setStaff] = useState<Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; is_active: boolean; role: string | null }>>([]);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const refresh = async () => { const { data, error: queryError } = await requireSupabase().from('profiles').select('id,full_name,email,phone,is_active,user_roles(role:roles(code))').order('full_name'); if (queryError) throw new Error('Não foi possível consultar a equipe.'); setStaff((data ?? []).map((row: any) => { const membership = Array.isArray(row.user_roles) ? row.user_roles[0] : row.user_roles; const linkedRole = Array.isArray(membership?.role) ? membership.role[0] : membership?.role; return { ...row, role: membership?.role_code ?? linkedRole?.code ?? null }; })); };
  useEffect(() => { if (supabaseConfigured) void refresh().catch((e) => setError(e.message)); }, []);
  const invite = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError(''); setNotice(''); const data = new FormData(formElement); const body = { action: 'invite', email: String(data.get('email')).trim(), full_name: String(data.get('name')).trim(), phone: String(data.get('phone')).trim(), role: String(data.get('role')) }; const result = await requireSupabase().functions.invoke('manage-staff', { body }); if (result.error || result.data?.error) setError(result.data?.error?.message || 'Convite não enviado. Verifique Auth e o provedor de e-mail.'); else { setNotice('Convite enviado. A equipe será ativada após concluir a configuração de acesso.'); formElement.reset(); await refresh(); } setBusy(false); };
  const staffAction = async (id: string, action: 'deactivate' | 'reactivate' | 'change-role', role?: string) => { const response = await requireSupabase().functions.invoke('manage-staff', { body: { action, user_id: id, role } }); if (response.error || response.data?.error) setError(response.data?.error?.message || 'Operação recusada pelo backend.'); else await refresh(); };
  if (!supabaseConfigured) return unavailable('Equipe');
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">ACESSO E CARGOS</div><h1>Equipe<em>.</em></h1><p>Convide, altere o cargo ou desative acessos. OWNER não é atribuído por este formulário.</p></div></div>{error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}<form className="staff-invite-card" onSubmit={invite}><div><UserPlus size={18} /><strong>Convidar funcionário</strong></div><label>Nome<input required name="name" minLength={2} /></label><label>E-mail<input required name="email" type="email" /></label><label>Telefone opcional<input name="phone" /></label><label>Cargo<select name="role"><option value="EMPLOYEE">EMPLOYEE</option><option value="MANAGER">MANAGER</option></select></label><button className="button button--admin" disabled={busy}>{busy ? 'Enviando…' : 'Enviar convite'}</button></form><div className="table-card"><div className="table-scroll"><table><thead><tr><th>Funcionário</th><th>Contato</th><th>Cargo</th><th>Estado</th><th>Permissão</th><th>Ação</th></tr></thead><tbody>{staff.map((person) => <tr key={person.id}><td>{person.full_name || 'Nome não preenchido'}</td><td>{person.email}<small className="table-subline">{person.phone || ''}</small></td><td><select value={person.role || 'EMPLOYEE'} disabled={!person.is_active || person.role === 'OWNER'} onChange={(event) => void staffAction(person.id, 'change-role', event.target.value)}><option value="EMPLOYEE">EMPLOYEE</option><option value="MANAGER">MANAGER</option><option value="OWNER" disabled>OWNER</option></select></td><td><span className={`status-pill ${person.is_active ? 'status-pill--ready' : 'status-pill--cancelled'}`}>{person.is_active ? 'Ativo' : 'Desativado'}</span></td><td>{person.role === 'OWNER' ? 'Acesso total' : person.role === 'MANAGER' ? 'Gestão' : 'Operação'}</td><td><button className="text-action" disabled={person.role === 'OWNER'} onClick={() => void staffAction(person.id, person.is_active ? 'deactivate' : 'reactivate')}>{person.is_active ? 'Desativar' : 'Reativar'}</button></td></tr>)}{!staff.length && <tr><td colSpan={6} className="empty-row">Nenhum perfil encontrado.</td></tr>}</tbody></table></div></div></section>;
}
