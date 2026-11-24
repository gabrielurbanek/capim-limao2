import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Decimal from 'decimal.js';
import { useCart } from '../../contexts/CartContext';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';
import type { CartItem } from '../../types/domain';
import { money, quantityText, provisionalLineTotal } from '../../lib/format';
import { requireSupabase, supabaseConfigured } from '../../lib/supabase';
import { useImageUrl } from '../../lib/media';
import { checkoutAttemptFingerprint, clearPersistentOrderAttempt, persistentOrderAttempt } from '../../lib/orderAttempt';

const CONFIRMED_WHATSAPP = '554635366291';

interface OrderConfirmation {
  orderNumber: string;
  total: string | number;
  expiresAt: string;
  whatsappUrl: string;
  message: string;
}

export function CartPage() {
  const { items, subtotal, clear } = useCart();
  const company = useCompanySettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setCopyNotice('');
    if (!items.length) return;
    const form = new FormData(event.currentTarget);
    const customer = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || null,
    };
    if (customer.name.length < 2 || customer.phone.replace(/\D/g, '').length < 8) {
      setError('Informe seu nome e um telefone válido.'); return;
    }
    const orderItems = items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));
    const fingerprint = checkoutAttemptFingerprint(customer, orderItems);
    const idempotencyKey = persistentOrderAttempt(fingerprint);
    setLoading(true);
    try {
      const { data, error: functionError } = await requireSupabase().functions.invoke('create-order', {
        body: { items: orderItems, customer, idempotency_key: idempotencyKey },
      });
      if (functionError || !data?.order) throw new Error(data?.error?.message || 'Não foi possível confirmar o registro do pedido. Seus itens continuam no carrinho.');
      const order = data.order;
      const validatedItems = Array.isArray(order.items) ? order.items as Array<{ product_name: string; unit: string; quantity: string | number; line_total: string | number }> : [];
      const lines = validatedItems.map((item) => `• ${item.product_name} — ${quantityText(item.quantity, item.unit as 'un' | 'g' | 'kg')} — ${money(item.line_total)}`).join('\n');
      const message = [
        `Olá! Quero conversar sobre o pedido ${order.order_number}.`,
        lines,
        `Total calculado pela loja: ${money(order.total)}.`,
        'A mensagem não representa confirmação de pagamento.',
      ].filter(Boolean).join('\n');
      const configuredPhone = company.whatsapp?.replace(/\D/g, '') ?? '';
      const whatsapp = configuredPhone.length >= 8 && configuredPhone.length <= 20 ? configuredPhone : CONFIRMED_WHATSAPP;
      const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
      clearPersistentOrderAttempt(idempotencyKey);
      clear();
      setConfirmation({
        orderNumber: String(order.order_number),
        total: order.total,
        expiresAt: String(order.reservation_expires_at),
        whatsappUrl,
        message,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o pedido. Você pode tentar novamente sem criar outra tentativa.');
    } finally { setLoading(false); }
  };

  const copyMessage = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.message);
      setCopyNotice('Mensagem copiada. Você pode colá-la na conversa do WhatsApp.');
    } catch {
      setError('Não foi possível copiar automaticamente. Use o link do WhatsApp para abrir a conversa.');
    }
  };

  if (confirmation) return <section className="order-confirmation section-block" aria-labelledby="order-confirmation-title">
    <span className="order-confirmation__icon"><Check size={24} /></span>
    <div className="eyebrow">PEDIDO SALVO</div>
    <h1 id="order-confirmation-title">Pedido <em>registrado.</em></h1>
    <p className="order-confirmation__reference">Número <strong>#{confirmation.orderNumber}</strong></p>
    <p>O pedido foi gravado pela loja antes de abrir o WhatsApp. O total validado é <strong>{money(confirmation.total)}</strong>; a mensagem não confirma pagamento.</p>
    <p className="order-confirmation__expiry">Os itens ficam reservados até {new Date(confirmation.expiresAt).toLocaleString('pt-BR')} (horário local do seu dispositivo), conforme a janela configurada pela loja.</p>
    {copyNotice && <div className="success-note" role="status">{copyNotice}</div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    <div className="order-confirmation__actions">
      <a className="button button--forest" href={confirmation.whatsappUrl} target="_blank" rel="noopener noreferrer">Continuar no WhatsApp <ArrowRight size={17} /></a>
      <button className="button button--subtle" type="button" onClick={() => void copyMessage()}><Copy size={16} /> Copiar mensagem</button>
    </div>
    <Link to="/produtos" className="back-link">Voltar ao catálogo</Link>
  </section>;

  if (!items.length) return <section className="empty-state cart-empty"><span className="empty-state__mark"><ShoppingBag size={25} /></span><h1>Seu carrinho está vazio.</h1><p>Explore o catálogo e adicione os itens que deseja consultar.</p><Link to="/produtos" className="button button--forest">Ver catálogo <ArrowRight size={17} /></Link></section>;

  return (
    <section className="cart-page section-block">
      <Link to="/produtos" className="back-link"><ArrowLeft size={15} /> Continuar explorando</Link><div className="page-intro"><div className="eyebrow">SUA SELEÇÃO</div><h1>Seu <em>carrinho.</em></h1><p>Confira quantidades e envie o pedido à loja pelo WhatsApp.</p></div>
      <div className="cart-layout"><div className="cart-lines">{items.map((item) => <CartLine item={item} key={item.productId} />)}</div>
      <aside className="checkout-card"><h2>Resumo do pedido</h2><div className="checkout-total"><span>Subtotal estimado</span><strong>{money(subtotal)}</strong></div><p>O total definitivo e a disponibilidade serão recalculados no banco antes de registrar o pedido.</p>
        {!supabaseConfigured && <div className="setup-warning">A loja ainda não está conectada ao Supabase; o envio ficará disponível após a configuração.</div>}
        {error && <div className="inline-error" role="alert">{error}</div>}
        <form onSubmit={submit} className="checkout-form"><label>Seu nome<input name="name" required minLength={2} autoComplete="name" /></label><label>Telefone<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="DDD + telefone" /></label><label>E-mail <span>(opcional)</span><input name="email" type="email" autoComplete="email" /></label><button className="button button--forest button--wide" type="submit" disabled={loading || !supabaseConfigured}>{loading ? 'Registrando pedido…' : 'Registrar pedido'} <ArrowRight size={17} /></button></form>
        <small className="checkout-legal">O pedido será salvo antes de abrir o WhatsApp. Enviá-lo não significa que ele foi pago. Se o aplicativo não abrir, o botão e a mensagem continuarão disponíveis nesta confirmação.</small>
      </aside></div>
    </section>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const image = useImageUrl(item.imagePath);
  const { setQuantity, removeProduct } = useCart();
  const step = item.unit === 'kg' ? 0.05 : 1;
  const precision = item.unit === 'kg' ? 3 : 0;
  return <article className="cart-line"><div className="cart-line__image">{image ? <img src={image} alt="" /> : <span>✳</span>}</div><div className="cart-line__meta"><Link to={`/produto/${item.slug}`}>{item.name}</Link><small>{money(item.unitPrice)} / {item.unit}</small><div className="cart-line__quantity"><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => { const next = new Decimal(item.quantity).minus(step); if (next.gt(0)) setQuantity(item.productId, next.toFixed(precision)); }}><Minus size={14} /></button><span>{quantityText(item.quantity, item.unit)}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => setQuantity(item.productId, new Decimal(item.quantity).plus(step).toFixed(precision))}><Plus size={14} /></button><button className="cart-line__remove" type="button" aria-label={`Remover ${item.name}`} onClick={() => removeProduct(item.productId)}><Trash2 size={15} /></button></div></div><strong>{money(provisionalLineTotal(item.unitPrice, item.quantity))}</strong></article>;
}
