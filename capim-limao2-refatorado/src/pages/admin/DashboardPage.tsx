import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Boxes, CircleDollarSign, ClipboardList, Package, RefreshCw, ShoppingBag } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Decimal from 'decimal.js';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { money } from '../../lib/format';
import { fetchAllPages } from '../../lib/pagination';
import { aggregateConfirmedReceipts } from '../../lib/receipts';
import { createDashboardWindow, createTrendBuckets, localDateInput, trendDateKey, type DashboardPeriod } from '../../lib/dashboardDates';
import { supabase, supabaseConfigured } from '../../lib/supabase';

interface OrderRow { id: string; order_number: string; status: string; payment_status: string | null; total: string | number | null; created_at: string; customer_name: string }
interface SalePayment { amount: string | number; status: string }
interface SaleRow { id: string; sale_number: string; created_at: string; sale_payments: SalePayment[] | null }
interface ProductRow { id: string; is_available: boolean; stock_balance: string | number; minimum_stock: string | number }
interface SoldItemRow { id: string; product_name: string; unit: string; quantity: string | number }
interface TrendPoint { label: string; pedidos: number; vendasPresenciais: number; recebimentos: number }
interface TopProduct { label: string; quantity: number; unit: string }

export function DashboardPage() {
  const { profile } = useAuth();
  const canSeeFinance = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  const [period, setPeriod] = useState<DashboardPeriod>('7');
  const [customStart, setCustomStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return localDateInput(date); });
  const [customEnd, setCustomEnd] = useState(() => localDateInput(new Date()));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [soldItems, setSoldItems] = useState<SoldItemRow[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const dateWindow = useMemo(() => createDashboardWindow(period, customStart, customEnd), [period, customStart, customEnd]);
  const startDate = dateWindow?.start.toISOString() ?? '';
  const endDate = dateWindow?.end.toISOString() ?? '';

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const clearData = () => {
      setOrders([]); setSales([]); setSoldItems([]);
      setProductCount(0); setUnavailableCount(0); setLowStock(0);
    };
    if (!dateWindow) {
      clearData(); setError('Informe datas válidas e uma data inicial anterior ou igual à final.'); setLoading(false);
      return () => { active = false; };
    }
    setLoading(true); setError(''); clearData();
    const productsQuery = fetchAllPages<ProductRow>((from, to) => client.from('products')
      .select('id,is_available,stock_balance,minimum_stock').order('id').range(from, to));
    void Promise.all([
      fetchAllPages<OrderRow>((from, to) => client.from('orders_staff_read')
        .select('id,order_number,status,payment_status,total,created_at,customer_name')
        .gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: false }).order('id').range(from, to)),
      canSeeFinance ? fetchAllPages<SaleRow>((from, to) => client.from('sales')
        .select('id,sale_number,created_at,sale_payments(amount,status)').is('cancelled_at', null)
        .gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: false }).order('id').range(from, to)) : Promise.resolve([] as SaleRow[]),
      canSeeFinance ? fetchAllPages<SoldItemRow>((from, to) => client.from('sale_items')
        .select('id,product_name,unit,quantity,sales!inner(created_at,cancelled_at)')
        .gte('sales.created_at', startDate).lte('sales.created_at', endDate).is('sales.cancelled_at', null)
        .order('id').range(from, to)) : Promise.resolve([] as SoldItemRow[]),
      productsQuery,
    ]).then(([orderRows, saleRows, itemRows, productRows]) => {
      if (!active) return;
      setOrders(orderRows); setSales(saleRows); setSoldItems(itemRows);
      setProductCount(productRows.length);
      setUnavailableCount(productRows.filter((item) => !item.is_available).length);
      setLowStock(productRows.filter((item) => new Decimal(item.stock_balance).lte(item.minimum_stock)).length);
    }).catch(() => {
      if (active) { clearData(); setError('Não foi possível carregar os dados do painel. Verifique a conexão e tente novamente.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [startDate, endDate, canSeeFinance, reloadKey, dateWindow]);

  const metrics = useMemo(() => {
    const pending = orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)).length;
    const receipts = aggregateConfirmedReceipts(orders, sales);
    const monthly = Boolean(dateWindow && dateWindow.days > 90);
    const byPeriod = new Map<string, TrendPoint>(dateWindow ? createTrendBuckets(dateWindow).map(({ key, label }) => [key, { label, pedidos: 0, vendasPresenciais: 0, recebimentos: 0 }]) : []);
    for (const order of orders) {
      const key = trendDateKey(new Date(order.created_at), monthly); const point = byPeriod.get(key); if (point) point.pedidos++;
    }
    for (const sale of sales) {
      const key = trendDateKey(new Date(sale.created_at), monthly); const point = byPeriod.get(key); if (point) point.vendasPresenciais++;
    }
    const receiptByPeriod = new Map<string, Decimal>();
    for (const receipt of receipts.rows) {
      const key = trendDateKey(new Date(receipt.createdAt), monthly);
      receiptByPeriod.set(key, (receiptByPeriod.get(key) ?? new Decimal(0)).plus(receipt.amount));
    }
    for (const [key, point] of byPeriod) point.recebimentos = Number((receiptByPeriod.get(key) ?? new Decimal(0)).toFixed(2));
    const productMap = new Map<string, { quantity: Decimal; unit: string }>();
    for (const item of soldItems) {
      const label = `${item.product_name} · ${item.unit}`;
      const previous = productMap.get(label) ?? { quantity: new Decimal(0), unit: item.unit };
      productMap.set(label, { quantity: previous.quantity.plus(item.quantity), unit: previous.unit });
    }
    const topProducts: TopProduct[] = [...productMap.entries()].map(([label, data]) => ({ label, quantity: data.quantity.toNumber(), unit: data.unit }))
      .sort((left, right) => right.quantity - left.quantity).slice(0, 5);
    return { pending, receivedTotal: receipts.total, registeredSales: sales.length, trend: [...byPeriod.values()], topProducts };
  }, [orders, sales, soldItems, dateWindow]);

  if (!supabaseConfigured) return <div className="admin-setup"><div className="eyebrow">VISÃO GERAL</div><h1>Painel do <em>armazém.</em></h1><div className="setup-warning">Configure o projeto Supabase para consultar indicadores reais. Nenhum número demonstrativo é exibido.</div></div>;
  const showData = !loading && !error;

  return <div className="dashboard-page">
    <div className="admin-page-heading"><div><div className="eyebrow">RESUMO OPERACIONAL</div><h1>Visão geral do <em>armazém.</em></h1><p>Pedidos, vendas registradas e recebimentos confirmados são indicadores separados.</p><p className="form-hint">O período financeiro usa a data de criação do pedido/venda registrada no modelo atual; não representa necessariamente a data de liquidação.</p></div><div className="dashboard-period"><label htmlFor="period">Período</label><select id="period" value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}><option value="today">Hoje</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="custom">Personalizado</option></select>{period === 'custom' && <div className="dashboard-period__range"><label>De<input type="date" aria-label="Data inicial" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Até<input type="date" aria-label="Data final" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}</div></div>
    {error && <div className="admin-error" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button></div>}{loading && <p className="admin-loading" role="status"><RefreshCw size={15} /> Atualizando dados…</p>}
    <div className="metric-grid"><Metric icon={ClipboardList} label="Pedidos criados" value={showData ? orders.length : '—'} foot="No período selecionado" /><Metric icon={ShoppingBag} label="Pedidos pendentes" value={showData ? metrics.pending : '—'} foot="Ainda não concluídos" />{canSeeFinance && <><Metric icon={ShoppingBag} label="Vendas presenciais" value={showData ? metrics.registeredSales : '—'} foot="Registradas e não canceladas" /><Metric icon={CircleDollarSign} label="Pagamentos confirmados" value={showData ? money(metrics.receivedTotal) : '—'} foot="Classificados pela data de criação" /></>}<Metric icon={Package} label="Produtos cadastrados" value={showData ? productCount : '—'} foot={`${showData ? unavailableCount : '—'} indisponíveis`} /><Metric icon={Boxes} label="Estoque baixo" value={showData ? lowStock : '—'} foot="No limite mínimo ou abaixo" /></div>
    <div className="dashboard-charts"><section className="chart-card"><div className="chart-card__heading"><div><span>REGISTROS OPERACIONAIS</span><h2>Pedidos online × vendas PDV</h2></div><div className="chart-legend"><i /> Registros</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.trend} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#26352B" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b9a8f', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8b9a8f', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#141D18', border: '1px solid #223028', borderRadius: 12, color: '#f5f5f0' }} /><Bar dataKey="pedidos" name="Pedidos online criados" fill="#88C540" radius={[4, 4, 0, 0]} /><Bar dataKey="vendasPresenciais" name="Vendas PDV registradas" fill="#5C9772" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
      {canSeeFinance && <section className="chart-card"><div className="chart-card__heading"><div><span>RECEBIMENTOS · DATA DE REGISTRO</span><h2>Pagamentos confirmados por período</h2></div><div className="chart-legend chart-legend--lime"><i /> R$</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.trend} margin={{ top: 12, right: 8, left: -7, bottom: 0 }}><CartesianGrid stroke="#26352B" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b9a8f', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b9a8f', fontSize: 11 }} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: '#141D18', border: '1px solid #223028', borderRadius: 12, color: '#f5f5f0' }} /><Bar dataKey="recebimentos" name="Recebimentos confirmados por data de criação" fill="#88C540" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section>}
      {canSeeFinance && <section className="chart-card"><div className="chart-card__heading"><div><span>DESTAQUES DE VENDA</span><h2>Produtos mais vendidos</h2></div><div className="chart-legend chart-legend--lime"><i /> Quantidade</div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.topProducts} layout="vertical" margin={{ top: 8, right: 14, left: 8, bottom: 4 }}><CartesianGrid stroke="#26352B" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8b9a8f', fontSize: 11 }} /><YAxis type="category" dataKey="label" width={120} axisLine={false} tickLine={false} tick={{ fill: '#c6d0c9', fontSize: 11 }} /><Tooltip formatter={(value, _name, item) => [`${value} ${item.payload.unit}`, 'Quantidade']} contentStyle={{ background: '#141D18', border: '1px solid #223028', borderRadius: 12, color: '#f5f5f0' }} /><Bar dataKey="quantity" name="Quantidade vendida" fill="#5C9772" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>{showData && !metrics.topProducts.length && <p className="empty-row">Ainda não há vendas no período selecionado.</p>}</div></section>}</div>
    <section className="table-card"><div className="table-card__heading"><div><span>ACOMPANHAMENTO</span><h2>Pedidos recentes</h2></div><Link to="/admin/pedidos">Ver todos <ArrowUpRight size={15} /></Link></div><div className="table-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Status operacional</th>{canSeeFinance && <th>Total</th>}<th>Data</th></tr></thead><tbody>{showData && orders.slice(0, 6).map((order) => <tr key={order.id}><td>#{order.order_number}</td><td>{order.customer_name}</td><td><span className={`status-pill status-pill--${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></td>{canSeeFinance && <td>{order.total === null ? 'Não disponível' : money(order.total)}</td>}<td>{new Date(order.created_at).toLocaleDateString('pt-BR')}</td></tr>)}{(!showData || !orders.length) && <tr><td colSpan={canSeeFinance ? 5 : 4} className="empty-row">{error ? 'Os pedidos não foram atualizados.' : loading ? 'Consultando pedidos…' : 'Ainda não há pedidos no período selecionado.'}</td></tr>}</tbody></table></div></section>
  </div>;
}

function Metric({ icon: Icon, label, value, foot }: { icon: typeof Package; label: string; value: string | number; foot: string }) {
  return <article className="metric-card"><div className="metric-card__top"><span>{label}</span><i><Icon size={17} /></i></div><strong>{value}</strong><small>{foot}</small></article>;
}
function statusLabel(value: string) { return ({ NEW: 'Novo', CONFIRMED: 'Confirmado', PREPARING: 'Em preparação', READY: 'Pronto', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' } as Record<string, string>)[value] ?? value; }
