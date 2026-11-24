import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../../components/storefront/ProductCard';
import { isPortionPreset } from '../../lib/quantityPreset';
import { supabaseConfigured } from '../../lib/supabase';
import { listCategories, listProducts } from '../../services/catalog';
import type { Category, Product } from '../../types/domain';

const PAGE_SIZE = 12;
const MULTIPLE_CATEGORIES = '__selected_categories__';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('busca') ?? '';
  const categoryIds = useMemo(() => [...new Set((params.get('categoria') ?? '').split(',').filter(Boolean))].slice(0, 2), [params]);
  const categoryKey = categoryIds.join(',');
  const portionValue = params.get('porcao');
  const quantityPreset = isPortionPreset(portionValue) ? portionValue : undefined;
  const orderBy = (params.get('ordem') as 'name' | 'price_asc' | 'price_desc' | 'newest' | null) ?? 'name';
  const [draft, setDraft] = useState(query);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setDraft(query); setOffset(0); }, [query, categoryKey, orderBy, portionValue]);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    setLoading(true);
    setError('');
    if (offset === 0) setProducts([]);
    void listProducts({ query, categoryIds, orderBy, limit: PAGE_SIZE + 1, offset })
      .then((rows) => {
        if (!active) return;
        const visible = rows.slice(0, PAGE_SIZE);
        setHasMore(rows.length > PAGE_SIZE);
        setProducts((previous) => offset === 0 ? visible : [...previous, ...visible]);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os produtos.');
      })
      .finally(() => { if (active) setLoading(false); });
    void listCategories().then((rows) => { if (active) { setCategories(rows); setCategoryError(''); } })
      .catch(() => { if (active) setCategoryError('Não foi possível carregar as categorias.'); });
    return () => { active = false; };
  }, [query, categoryKey, orderBy, offset, reloadKey]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const updateCategory = (value: string) => {
    if (value === MULTIPLE_CATEGORIES) return;
    const next = new URLSearchParams(params);
    if (value) next.set('categoria', value); else next.delete('categoria');
    setParams(next);
  };
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); updateParam('busca', draft.trim()); };
  const selectedCategoryLabel = categoryIds.length > 1 ? `${MULTIPLE_CATEGORIES}` : categoryIds[0] ?? '';

  return (
    <section className="catalog-page section-block">
      <div className="page-intro"><div className="eyebrow">CAPIM LIMÃO · CATÁLOGO</div><h1>Escolhas para <em>explorar.</em></h1><p>Consulte os produtos publicados, suas unidades e disponibilidade.</p>{quantityPreset && <p className="form-hint">Porção inicial {quantityPreset} para produtos vendidos por peso; itens por unidade permanecem em 1 un.</p>}</div>
      <div className="catalog-toolbar">
        <form className="catalog-search" onSubmit={submitSearch}><Search size={17} aria-hidden="true" /><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" /><button type="submit" aria-label="Buscar"><span className="sr-only">Buscar</span></button></form>
        <label className="catalog-select"><span>Categoria</span><select value={selectedCategoryLabel} onChange={(event) => updateCategory(event.target.value)}><option value="">Todas</option>{categoryIds.length > 1 && <option value={MULTIPLE_CATEGORIES}>Categorias selecionadas ({categoryIds.length})</option>}{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="catalog-select"><ArrowDownWideNarrow size={15} aria-hidden="true" /><span className="sr-only">Ordenar</span><select value={orderBy} onChange={(event) => updateParam('ordem', event.target.value)}><option value="name">Nome</option><option value="newest">Mais recentes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option></select></label>
      </div>
      {categoryError && <div className="inline-error" role="status">{categoryError}</div>}
      {!supabaseConfigured ? <div className="empty-state"><span className="empty-state__mark">✳</span><h2>Catálogo em preparação</h2><p>Os produtos serão listados assim que a conexão com o banco da loja estiver configurada.</p></div> : error ? <div className="inline-error" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button></div> : products.length > 0 ? <><div className="catalog-count">{products.length}{hasMore ? '+' : ''} itens publicados</div><div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} quantityPreset={quantityPreset} />)}</div>{hasMore && <div className="load-more"><button className="button button--outline" onClick={() => setOffset((value) => value + PAGE_SIZE)} disabled={loading}>{loading ? 'Carregando…' : 'Carregar mais'}</button></div>}{loading && <p className="sr-only" role="status">Carregando produtos…</p>}</> : <div className="empty-state"><span className="empty-state__mark">✳</span><h2>{loading ? 'Buscando no catálogo…' : 'Nenhum produto encontrado'}</h2><p>{loading ? 'Só um instante.' : 'Tente outra busca ou categoria. Apenas produtos publicados são exibidos.'}</p></div>}
    </section>
  );
}
