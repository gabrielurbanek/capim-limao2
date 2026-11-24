import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Leaf, MapPin, PackageCheck, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../../components/storefront/ProductCard';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';
import { supabaseConfigured } from '../../lib/supabase';
import { isPortionPreset, type PortionPreset } from '../../lib/quantityPreset';
import { useImageUrl } from '../../lib/media';
import { listCategories, listProducts } from '../../services/catalog';
import type { Category, Product } from '../../types/domain';

export function HomePage() {
  const settings = useCompanySettings();
  const banner = useImageUrl(settings.banner_path);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedComplement, setSelectedComplement] = useState('');
  const [portion, setPortion] = useState<PortionPreset>('500g');

  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    setProductsLoading(true);
    setCategoriesLoading(true);
    setProductsError('');
    setCategoriesError('');
    void Promise.allSettled([
      listProducts({ orderBy: 'newest', limit: 8 }),
      listCategories(),
    ]).then(([productResult, categoryResult]) => {
      if (!active) return;
      if (productResult.status === 'fulfilled') setProducts(productResult.value);
      else { setProducts([]); setProductsError('Não foi possível carregar os produtos agora.'); }
      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value);
        const validIds = new Set(categoryResult.value.map((category) => category.id));
        setSelectedCategory((current) => validIds.has(current) ? current : categoryResult.value[0]?.id || '');
        setSelectedComplement((current) => validIds.has(current) ? current : '');
      } else {
        setCategories([]); setSelectedCategory(''); setSelectedComplement('');
        setCategoriesError('Não foi possível carregar as categorias agora.');
      }
    }).finally(() => {
      if (active) { setProductsLoading(false); setCategoriesLoading(false); }
    });
    return () => { active = false; };
  }, [reloadKey]);

  const otherCategories = categories.filter((category) => category.id !== selectedCategory);
  const selectedNames = [...new Set([selectedCategory, selectedComplement])]
    .filter(Boolean)
    .map((id) => categories.find((category) => category.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const catalogUrl = useMemo(() => {
    const params = new URLSearchParams();
    const ids = [...new Set([selectedCategory, selectedComplement])].filter(Boolean);
    if (ids.length) params.set('categoria', ids.join(','));
    if (isPortionPreset(portion)) params.set('porcao', portion);
    return `/produtos${params.size ? `?${params.toString()}` : ''}`;
  }, [selectedCategory, selectedComplement, portion]);
  const differentiators = Array.isArray(settings.differentiators)
    ? settings.differentiators.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 3)
    : [];

  return (
    <main className="bg-[#F8F9F5] font-sans text-[#2D2D2D]">
      <section className="relative overflow-hidden border-b border-[#18361B]/10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full bg-[#8CC63F]/15 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-10 lg:py-20">
          <div className="relative z-10 lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#18361B]/15 bg-white/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18361B]"><Leaf size={14} aria-hidden="true" /> Capim Limão · Armazém Natural</span>
            <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-[#18361B] sm:text-6xl">Escolhas para <em className="font-normal text-[#C47A3C]">o seu dia.</em></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#2D2D2D]/80 sm:text-lg">{settings.description || 'Consulte o catálogo da loja, confira preços, unidades de venda e disponibilidade dos itens publicados.'}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/produtos" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#18361B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244b28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">Consultar catálogo <ArrowRight size={16} aria-hidden="true" /></Link>
              <a href="#selecao" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#18361B]/25 bg-white px-6 py-3 text-sm font-semibold text-[#18361B] transition hover:border-[#18361B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">Buscar por categoria <Search size={15} aria-hidden="true" /></a>
            </div>
            {settings.address && <p className="mt-6 flex items-center gap-2 text-xs text-[#2D2D2D]/70"><MapPin size={14} aria-hidden="true" />{settings.address}</p>}
          </div>
          <div className="relative lg:col-span-6"><div className="relative mx-auto flex min-h-[320px] max-w-lg items-center justify-center overflow-hidden rounded-t-[10rem] rounded-b-3xl border border-[#18361B]/15 bg-gradient-to-br from-[#F2EFE9] via-white to-[#E6EFE0] p-6 shadow-editorial sm:min-h-[420px]">
            {banner ? <img src={banner} alt={`Imagem institucional de ${settings.store_name}`} className="absolute inset-0 h-full w-full object-cover" /> : <img src="/capimlimaodvz.jpg" alt="Marca Capim Limão — Armazém Natural" className="relative z-10 h-32 max-w-[75%] object-contain sm:h-40" />}
            {banner && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#18361B]/30 to-transparent" />}
            <span className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#18361B]/10 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#18361B] shadow-sm">{settings.store_name}</span>
          </div></div>
        </div>
        {differentiators.length > 0 && <div className="border-t border-[#18361B]/10 bg-white/80"><div className="mx-auto grid max-w-7xl divide-y divide-[#18361B]/10 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10">{differentiators.map((text) => <div key={text} className="flex items-center gap-3 py-5 md:px-6"><Leaf size={17} className="shrink-0 text-[#6e963d]" aria-hidden="true" /><p className="font-serif text-lg font-semibold text-[#18361B]">{text}</p></div>)}</div></div>}
      </section>

      <section id="selecao" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
        <div className="overflow-hidden rounded-3xl border border-[#18361B]/12 bg-white shadow-soft">
          <div className="border-b border-[#18361B]/10 bg-[#F2EFE9]/70 px-6 py-6 sm:px-9"><span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C47A3C]">Explore o catálogo</span><h2 className="mt-2 font-serif text-3xl font-semibold text-[#18361B] sm:text-4xl">Escolha categorias e quantidade</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#2D2D2D]/70">As categorias vêm do catálogo publicado. A porção selecionada será sugerida no botão de adicionar para produtos vendidos por peso; produtos por unidade continuam em 1 un.</p></div>
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-12">
            <div className="space-y-7 lg:col-span-8">
              <OptionGroup title="Categoria principal" options={categories} selected={selectedCategory} disabled={categoriesLoading} onSelect={(id) => { setSelectedCategory(id); if (id === selectedComplement) setSelectedComplement(''); }} emptyLabel="Nenhuma categoria publicada." />
              <OptionGroup title="Outra categoria (opcional)" options={otherCategories} selected={selectedComplement} disabled={categoriesLoading || !selectedCategory} onSelect={setSelectedComplement} emptyLabel="Nenhuma outra categoria disponível." allowEmpty emptyLabelOption="Sem complemento" />
              <div><h3 className="mb-3 font-serif text-xl font-semibold text-[#18361B]">Porção inicial para itens a granel</h3><div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Escolha uma porção inicial">{(['250g', '500g', '1kg'] as const).map((value) => <button key={value} type="button" aria-pressed={portion === value} onClick={() => setPortion(value)} className={`min-h-11 rounded-xl border px-3 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C] ${portion === value ? 'border-[#18361B] bg-[#18361B]/5 text-[#18361B] ring-1 ring-[#18361B]' : 'border-[#18361B]/15 text-[#2D2D2D] hover:border-[#18361B]/45'}`}>{value}{portion === value && <Check size={14} className="ml-2 inline" aria-hidden="true" />}</button>)}</div></div>
              {categoriesError && <div className="inline-error" role="alert">{categoriesError} <button type="button" className="ml-2 underline" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button></div>}
            </div>
            <aside className="flex flex-col justify-between rounded-2xl bg-[#18361B] p-6 text-white lg:col-span-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C3e18b]"><PackageCheck size={13} aria-hidden="true" />Sua busca</span><h3 className="mt-4 font-serif text-2xl">Veja opções reais no catálogo</h3><dl className="mt-5 space-y-3 border-t border-white/15 pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-white/65">Categorias</dt><dd className="text-right font-semibold">{selectedNames.length ? selectedNames.join(' + ') : 'Todas'}</dd></div><div className="flex justify-between gap-3"><dt className="text-white/65">Porção sugerida</dt><dd className="font-semibold text-[#C3e18b]">{portion}</dd></div></dl></div><div className="mt-6"><p className="text-xs leading-relaxed text-white/70">A seleção não adiciona itens ao carrinho. No catálogo, revise cada produto, preço, unidade e disponibilidade antes de adicionar.</p><Link to={catalogUrl} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#C47A3C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ac6834] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Ver opções no catálogo <ArrowRight size={15} aria-hidden="true" /></Link></div></aside>
          </div>
        </div>
      </section>

      <section className="border-t border-[#18361B]/10 bg-white py-14 sm:py-18"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C47A3C]">Do catálogo Supabase</span><h2 className="mt-2 font-serif text-3xl font-semibold text-[#18361B] sm:text-4xl">Produtos publicados recentemente</h2></div><Link to="/produtos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#18361B] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">Ver catálogo completo <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {!supabaseConfigured ? <div className="empty-state mt-8"><h3>Catálogo em preparação</h3><p>Configure a conexão Supabase para carregar produtos reais; nenhum item de demonstração é exibido.</p></div> : productsError ? <div className="inline-error mt-8" role="alert">{productsError} <button type="button" className="ml-2 underline" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button></div> : productsLoading ? <p className="mt-8" role="status">Carregando produtos publicados…</p> : products.length ? <div className="product-grid mt-8">{products.map((product) => <ProductCard key={product.id} product={product} quantityPreset={portion} />)}</div> : <div className="empty-state mt-8"><h3>Nenhum produto publicado</h3><p>Os produtos aparecerão aqui quando a loja publicar itens disponíveis no catálogo.</p></div>}
      </div></section>

      <section className="border-t border-[#18361B]/10 bg-[#F2EFE9]/70 px-5 py-14 text-center sm:px-8 sm:py-16"><div className="mx-auto max-w-2xl"><span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#18361B] text-[#C3e18b]"><Leaf size={19} aria-hidden="true" /></span><h2 className="mt-4 font-serif text-3xl font-semibold text-[#18361B] sm:text-4xl">Confira as informações antes de comprar</h2><p className="mt-3 text-sm leading-relaxed text-[#2D2D2D]/75">Os valores e a disponibilidade são os apresentados nos produtos publicados. A confirmação final ocorre durante o pedido.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/produtos" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#18361B] px-6 py-3 text-sm font-semibold text-white hover:bg-[#244b28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">Abrir catálogo <ArrowRight size={15} aria-hidden="true" /></Link><Link to="/contato" className="inline-flex min-h-11 items-center rounded-full border border-[#C47A3C] bg-white px-6 py-3 text-sm font-semibold text-[#9a592d] hover:bg-[#C47A3C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C]">Contato da loja</Link></div></div></section>
    </main>
  );
}

function OptionGroup({ title, options, selected, disabled, onSelect, emptyLabel, allowEmpty = false, emptyLabelOption = '' }: {
  title: string; options: Category[]; selected: string; disabled: boolean; onSelect: (id: string) => void;
  emptyLabel: string; allowEmpty?: boolean; emptyLabelOption?: string;
}) {
  return <div><h3 className="mb-3 font-serif text-xl font-semibold text-[#18361B]">{title}</h3>{disabled ? <p className="text-sm text-[#2D2D2D]/65">Carregando categorias…</p> : options.length || allowEmpty ? <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={title}>{allowEmpty && <OptionButton label={emptyLabelOption} active={!selected} onClick={() => onSelect('')} />}{options.map((category) => <OptionButton key={category.id} label={category.name} active={selected === category.id} onClick={() => onSelect(category.id)} />)}</div> : <p className="text-sm text-[#2D2D2D]/65">{emptyLabel}</p>}</div>;
}

function OptionButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C47A3C] ${active ? 'border-[#18361B] bg-[#18361B]/5 text-[#18361B] ring-1 ring-[#18361B]' : 'border-[#18361B]/15 text-[#2D2D2D] hover:border-[#18361B]/45'}`}>{label}{active && <Check size={14} className="ml-2 inline text-[#719845]" aria-hidden="true" />}</button>;
}
