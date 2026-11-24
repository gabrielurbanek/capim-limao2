import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { money, quantityText, convertQuantity, isValidQuantity, provisionalLineTotal } from '../../lib/format';
import { useImageUrl } from '../../lib/media';
import { supabaseConfigured } from '../../lib/supabase';
import { getProductBySlug } from '../../services/catalog';
import type { Product } from '../../types/domain';
import { useStaticProduct } from '../../contexts/StaticProductContext';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';

export function ProductPage() {
  const { slug = '' } = useParams();
  const staticProduct = useStaticProduct();
  const initialProduct = staticProduct?.slug === slug ? staticProduct : null;
  const settings = useCompanySettings();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(Boolean(supabaseConfigured && !initialProduct));
  const [quantity, setQuantity] = useState('1');
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const { addProduct } = useCart();
  const image = useImageUrl(product?.product_images?.[0]?.path);

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    let active = true;
    setError('');
    if (!initialProduct) { setProduct(null); setLoading(true); }
    const applyPageTitle = (item: Product | null) => {
      if (!item) return;
      document.title = `${item.name} | ${settings.store_name}`;
      const description = item.description?.trim().slice(0, 155) || `Consulte preço, unidade e disponibilidade de ${item.name} em ${settings.store_name}.`;
      let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
      meta.content = description;
    };
    if (initialProduct) { setProduct(initialProduct); setLoading(false); applyPageTitle(initialProduct); }
    void getProductBySlug(slug).then((item) => { if (active) { setProduct(item); applyPageTitle(item); } })
      .catch(() => { if (active) setError('Não foi possível carregar este item.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, initialProduct, settings.store_name]);

  if (!supabaseConfigured) return <div className="empty-state product-empty"><h1>Produto indisponível</h1><p>O catálogo será conectado quando as credenciais Supabase forem configuradas.</p><Link to="/produtos" className="text-link">Voltar ao catálogo</Link></div>;
  if (loading) return <div className="loading-block" role="status">Carregando produto…</div>;
  if (error || !product) return <div className="empty-state product-empty"><h1>Não encontramos este produto.</h1><p>{error || 'Ele pode não estar publicado no momento.'}</p><Link to="/produtos" className="text-link"><ArrowLeft size={15} /> Voltar ao catálogo</Link></div>;

  const change = (delta: number) => {
    const next = Number(quantity) + delta;
    if (next > 0) setQuantity(product.unit === 'kg' ? next.toFixed(3) : String(Math.round(next)));
  };
  const add = () => {
    try {
      if (!isValidQuantity(quantity, product.unit)) throw new Error(`Use uma quantidade válida em ${product.unit}.`);
      addProduct(product, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar.'); }
  };
  const quickGramOptions = product.unit === 'kg' ? [250, 500, 750] : [];

  return (
    <section className="product-detail section-block">
      <Link to="/produtos" className="back-link"><ArrowLeft size={15} /> Voltar ao catálogo</Link>
      <div className="product-detail__grid">
        <div className="product-detail__visual">{image ? <img src={image} alt={product.product_images?.[0]?.alt_text || product.name} /> : <div className="product-visual-placeholder"><span>Capim Limão</span><i>✳</i></div>}</div>
        <div className="product-detail__info"><div className="eyebrow">{product.category?.name || 'ARMAZÉM NATURAL'}</div><h1>{product.name}</h1><p className="product-description">{product.description || 'As informações deste produto serão atualizadas pela loja.'}</p><div className="product-detail__price">{money(product.price)} <span>/ {product.unit}</span></div><div className="stock-status"><i /> {product.is_available ? 'Disponível para consulta' : 'Indisponível'}</div>
          <div className="quantity-field"><label htmlFor="product-quantity">Quantidade <small>({product.unit})</small></label><div className="quantity-stepper"><button type="button" aria-label="Diminuir quantidade" onClick={() => change(product.unit === 'kg' ? -0.05 : -1)}><Minus size={16} /></button><input id="product-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(',', '.'))} /><button type="button" aria-label="Aumentar quantidade" onClick={() => change(product.unit === 'kg' ? 0.05 : 1)}><Plus size={16} /></button></div></div>
          {quickGramOptions.length > 0 && <div className="weight-quick"><span>Escolha em gramas:</span>{quickGramOptions.map((grams) => <button type="button" key={grams} onClick={() => setQuantity(convertQuantity(grams, 'g', 'kg'))}>{grams} g</button>)}</div>}
          {isValidQuantity(quantity, product.unit) && <div className="product-subtotal">Subtotal estimado <strong>{money(provisionalLineTotal(product.price, quantity))}</strong></div>}
          {error && <p className="inline-error" role="alert">{error}</p>}<button className="button button--forest button--wide" type="button" onClick={add} disabled={!product.is_available}>{added ? <><Check size={17} /> Adicionado ao carrinho</> : 'Adicionar ao carrinho'}</button><p className="price-disclaimer">Valor provisório. Preço e estoque são validados novamente no envio do pedido.</p><div className="product-unit-note">Venda por {product.unit}. Quantidades e conversões seguem a unidade cadastrada para este produto.</div>
        </div>
      </div>
      <div className="product-detail__foot">{quantityText(quantity, product.unit)} selecionado{Number(quantity) === 1 ? '' : 's'}</div>
    </section>
  );
}
