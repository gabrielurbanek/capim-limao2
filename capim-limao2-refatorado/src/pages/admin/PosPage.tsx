import { useEffect, useMemo, useState } from 'react';
import { Check, Printer, Search, ShoppingCart, Trash2, UserRound } from 'lucide-react';
import Decimal from 'decimal.js';
import { useAuth } from '../../contexts/AuthContext';
import { money, quantityText } from '../../lib/format';
import { requireSupabase, supabaseConfigured } from '../../lib/supabase';
import type { Product, SaleUnit } from '../../types/domain';

interface PosLine { product: Product; quantity: string }
interface Receipt { sale_number: string; id: string; subtotal: string | number; discount: string | number; total: string | number; created_at: string; items: Array<{ product_name: string; unit: string; quantity: string | number; unit_price: string | number; line_total: string | number }> }

export function PosPage() {
  const { profile } = useAuth();
  const canDiscount = profile?.role === 'OWNER' || profile?.role === 'MANAGER';
  const canCancel = canDiscount;
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<PosLine[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; sale_number: string; total: string | number; created_at: string; cancelled_at: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    const client = requireSupabase();
    const [productResult, saleResult] = await Promise.all([
      client.from('products').select('id,name,slug,price,unit,stock_balance,minimum_stock,is_available,is_published,is_featured').eq('is_available', true).order('name'),
      client.from('sales').select('id,sale_number,total,created_at,cancelled_at').order('created_at', { ascending: false }).limit(12),
    ]);
    if (productResult.error || saleResult.error) throw new Error('Não foi possível carregar o PDV.');
    setProducts((productResult.data ?? []) as unknown as Product[]); setRecent(saleResult.data ?? []);
  };
  useEffect(() => { if (supabaseConfigured) void refresh().catch((e) => setError(e.message)); }, []);

  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));
  const subtotal = useMemo(() => lines.reduce((sum, line) => sum.plus(new Decimal(line.product.price).mul(line.quantity)), new Decimal(0)), [lines]);
  const discountAmount = canDiscount ? (() => { try { const v = new Decimal(discount || 0); return v.isNegative() ? new Decimal(0) : Decimal.min(v, subtotal); } catch { return new Decimal(0); } })() : new Decimal(0);
  const total = Decimal.max(subtotal.minus(discountAmount), 0);

  const add = (product: Product) => {
    setLines((previous) => {
      const found = previous.find((line) => line.product.id === product.id);
      if (found) return previous.map((line) => line.product.id === product.id ? { ...line, quantity: new Decimal(line.quantity).plus(product.unit === 'kg' ? '0.050' : 1).toFixed(product.unit === 'kg' ? 3 : 0) } : line);
      return [...previous, { product, quantity: product.unit === 'kg' ? '0.250' : '1' }];
    });
  };
  const setLineQuantity = (productId: string, value: string) => setLines((previous) => previous.map((line) => line.product.id === productId ? { ...line, quantity: value.replace(',', '.') } : line));

  const finalize = async () => {
    setError(''); setNotice('');
    if (!lines.length) { setError('Adicione ao menos um produto.'); return; }
    if (lines.some((line) => !/^\d+(?:\.\d{1,3})?$/.test(line.quantity) || new Decimal(line.quantity).lte(0) || ((line.product.unit === 'un' || line.product.unit === 'g') && !new Decimal(line.quantity).isInteger()))) { setError('Revise as quantidades e unidades.'); return; }
    setBusy(true);
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('create-pos-sale', { body: {
        items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
        discount: canDiscount ? discountAmount.toFixed(2) : '0.00',
        payment_method: paymentMethod,
        customer_phone: customerPhone.trim() || null,
      } });
      if (invokeError || data?.error || !data?.sale) throw new Error(data?.error?.message || 'Venda recusada. Verifique estoque, desconto e autorização.');
      setReceipt(data.sale as Receipt); setNotice('Venda registrada e estoque atualizado na mesma operação transacional.'); setLines([]); setDiscount('0'); setCustomerPhone(''); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a venda.'); }
    finally { setBusy(false); }
  };

  const cancel = async (sale: typeof recent[number]) => {
    if (!window.confirm(`Cancelar venda ${sale.sale_number}? O backend criará movimentos inversos e preservará o histórico.`)) return;
    const { data, error: invokeError } = await requireSupabase().functions.invoke('cancel-sale', { body: { sale_id: sale.id, reason: 'Cancelamento autorizado no PDV' } });
    if (invokeError || data?.error) setError(data?.error?.message || 'Cancelamento recusado pelo backend.'); else { setNotice('Venda cancelada; os movimentos inversos foram registrados.'); await refresh(); }
  };

  if (!supabaseConfigured) return <div className="admin-setup"><div className="eyebrow">PONTO DE VENDA</div><h1>PDV<em>.</em></h1><div className="setup-warning">Configure o Supabase para registrar vendas e movimentações reais.</div></div>;
  return <section className="admin-module pos-page"><div className="admin-page-heading"><div><div className="eyebrow">VENDA PRESENCIAL</div><h1>Ponto de venda<em>.</em></h1><p>Finalização transacional com baixa automática de estoque.</p></div><span className="pos-cashier"><UserRound size={16} /> {profile?.full_name || profile?.role}</span></div>{error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}
    <div className="pos-layout"><div className="pos-product-area"><label className="pos-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto para adicionar…" /></label><div className="pos-product-grid">{filtered.map((product) => <button className="pos-product-tile" type="button" key={product.id} onClick={() => add(product)}><span className="pos-product-tile__category">{product.unit.toUpperCase()}</span><strong>{product.name}</strong><small>{money(product.price)} / {product.unit}</small><span className="pos-product-tile__stock">Saldo: {product.stock_balance} {product.unit}</span></button>)}{!filtered.length && <div className="empty-row">Nenhum produto disponível para venda.</div>}</div><div className="pos-recent"><div className="table-card__heading"><div><span>HISTÓRICO</span><h2>Vendas recentes</h2></div></div>{recent.map((sale) => <div className="pos-recent-row" key={sale.id}><span>#{sale.sale_number}<small>{new Date(sale.created_at).toLocaleString('pt-BR')}</small></span><strong>{money(sale.total)}</strong>{sale.cancelled_at ? <span className="status-pill status-pill--cancelled">Cancelada</span> : canCancel ? <button className="text-action" onClick={() => void cancel(sale)}>Cancelar</button> : <span className="status-pill status-pill--ready">Concluída</span>}</div>)}{!recent.length && <p className="empty-row">Nenhuma venda registrada.</p>}</div></div>
    <aside className="pos-ticket"><div className="pos-ticket__heading"><ShoppingCart size={19} /><h2>Venda atual</h2><span>{lines.length} itens</span></div><div className="pos-ticket__lines">{lines.map(({ product, quantity }) => <div className="pos-ticket-line" key={product.id}><div><strong>{product.name}</strong><small>{money(product.price)} / {product.unit}</small><div className="pos-ticket-line__input"><input aria-label={`Quantidade de ${product.name}`} inputMode="decimal" value={quantity} onChange={(event) => setLineQuantity(product.id, event.target.value)} /><span>{product.unit}</span></div></div><strong>{money(new Decimal(product.price).mul(quantity || 0).toFixed(2))}</strong><button aria-label={`Remover ${product.name}`} onClick={() => setLines((current) => current.filter((line) => line.product.id !== product.id))}><Trash2 size={15} /></button></div>)}{!lines.length && <div className="pos-empty"><ShoppingCart size={24} /><p>Adicione produtos à venda.</p></div>}</div><label className="pos-ticket__label">Telefone do cliente <small>(opcional)</small><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="DDD + telefone" /></label>{canDiscount ? <label className="pos-ticket__label">Desconto autorizado (R$)<input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value.replace(',', '.'))} /></label> : <p className="form-hint">Descontos exigem autorização de MANAGER ou OWNER.</p>}<label className="pos-ticket__label">Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="other">Outra</option></select></label><div className="pos-ticket__totals"><span>Subtotal <b>{money(subtotal.toFixed(2))}</b></span><span>Desconto <b>− {money(discountAmount.toFixed(2))}</b></span><strong>Total <b>{money(total.toFixed(2))}</b></strong></div><button className="button button--admin button--wide" disabled={busy || !lines.length} onClick={() => void finalize()}>{busy ? 'Finalizando…' : 'Finalizar venda'} <Check size={17} /></button><p className="form-hint">Preço definitivo, pagamento e estoque serão validados no PostgreSQL.</p></aside></div>
    {receipt && <div className="modal-scrim" role="presentation"><section className="admin-modal receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-heading"><div className="receipt-paper"><div className="receipt-brand">CAPIM LIMÃO<small>ARMAZÉM NATURAL</small></div><h2 id="receipt-heading">Comprovante de venda</h2><p>Venda #{receipt.sale_number}</p><p>{new Date(receipt.created_at).toLocaleString('pt-BR')}</p><hr />{receipt.items?.map((item, index) => <div className="receipt-item" key={index}><span>{item.product_name} · {quantityText(item.quantity, item.unit as SaleUnit)}</span><b>{money(item.line_total)}</b></div>)}<hr /><div className="receipt-item"><span>Subtotal</span><b>{money(receipt.subtotal)}</b></div><div className="receipt-item"><span>Desconto</span><b>{money(receipt.discount)}</b></div><div className="receipt-item receipt-grand-total"><span>Total</span><b>{money(receipt.total)}</b></div><p className="receipt-foot">Registro operacional · conservar para referência</p></div><div className="admin-modal__actions"><button className="button button--subtle" onClick={() => setReceipt(null)}>Fechar</button><button className="button button--admin" onClick={() => window.print()}><Printer size={15} /> Imprimir comprovante</button></div></section></div>}
  </section>;
}
