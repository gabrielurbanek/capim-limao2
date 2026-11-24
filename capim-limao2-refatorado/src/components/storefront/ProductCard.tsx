import { useState } from 'react';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { money, quantityText } from '../../lib/format';
import { quantityForPortion, type PortionPreset } from '../../lib/quantityPreset';
import { useImageUrl } from '../../lib/media';
import type { Product } from '../../types/domain';

export function ProductCard({ product, quantityPreset }: { product: Product; quantityPreset?: PortionPreset }) {
  const image = useImageUrl(product.product_images?.[0]?.path);
  const { addProduct } = useCart();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const quantity = quantityForPortion(quantityPreset, product.unit);
  const quantityLabel = quantityText(quantity, product.unit);

  const handleQuickAdd = () => {
    if (!product.is_available) return;
    setError('');
    try {
      addProduct(product, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar este item.');
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#1E472A]/12 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#1E472A]/30 hover:shadow-editorial">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#FAF8F5]">
        <Link to={`/produto/${product.slug}`} className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#C47A3C]" aria-label={`Ver ${product.name}`}>
          {image ? <img src={image} alt={product.product_images?.[0]?.alt_text || product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F2EFE9] to-[#E6EFDB]"><img src="/capimlimaodvz.jpg" alt="" className="h-14 w-auto opacity-80" style={{ mixBlendMode: 'multiply' }} /></div>}
        </Link>
        {product.is_featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#1E472A] px-3 py-1 text-[10px] font-semibold tracking-wide text-[#FAF8F5]"><span className="h-1.5 w-1.5 rounded-full bg-[#88C540]" aria-hidden="true" />Destaque da loja</span>}
        <Link to={`/produto/${product.slug}`} aria-label={`Detalhes de ${product.name}`} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#1E472A]/15 bg-[#FAF8F5]/95 text-[#1E472A] transition hover:bg-[#1E472A] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]"><ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div><div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2D2D2D]/55"><span className="truncate">{product.category?.name || 'Armazém natural'}</span><span className="shrink-0 text-[#1E472A]/80">{product.is_available ? 'Disponível' : 'Indisponível'}</span></div><Link to={`/produto/${product.slug}`} className="mt-2 block font-serif text-xl font-semibold leading-snug text-[#1E472A] transition-colors group-hover:text-[#2D2D2D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">{product.name}</Link></div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#1E472A]/10 pt-3.5"><div><span className="block text-base font-bold text-[#1E472A]">{money(product.price)}</span><span className="text-[11px] text-[#2D2D2D]/60">por {product.unit}</span></div><button type="button" disabled={!product.is_available} onClick={handleQuickAdd} aria-label={`Adicionar ${quantityLabel} de ${product.name} ao carrinho`} title={product.is_available ? `Adicionar ${quantityLabel}` : 'Produto indisponível'} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C] disabled:cursor-not-allowed disabled:opacity-50 ${added ? 'bg-[#88C540] text-[#1E472A]' : 'bg-[#1E472A] text-[#FAF8F5] hover:bg-[#88C540] hover:text-[#1E472A]'}`}>{added ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}</button></div>
        <p className="sr-only" role="status" aria-live="polite">{added ? `${product.name} adicionado ao carrinho: ${quantityLabel}.` : ''}</p>
        {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
      </div>
    </article>
  );
}
