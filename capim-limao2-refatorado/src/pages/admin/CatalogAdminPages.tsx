import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Archive, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { requireSupabase, supabaseConfigured } from '../../lib/supabase';
import { slugify, money } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import type { Category, Product, SaleUnit } from '../../types/domain';

const productSchema = z.object({
  name: z.string().min(2, 'Informe o nome.').max(120),
  slug: z.string().min(2, 'Informe a URL.').max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens.'),
  description: z.string().max(3000).optional(),
  category_id: z.string().optional(),
  price: z.string().regex(/^\d{1,10}(?:[.,]\d{1,2})?$/, 'Informe um preço com até duas casas decimais.'),
  unit: z.enum(['un', 'g', 'kg']),
  minimum_stock: z.string().regex(/^\d{1,9}(?:[.,]\d{1,3})?$/, 'Informe um limite de estoque válido.'),
  is_available: z.boolean(),
  is_published: z.boolean(),
  is_featured: z.boolean(),
});
type ProductFormData = z.infer<typeof productSchema>;

export function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [productResult, categoryResult] = await Promise.all([
        requireSupabase().from('products').select('*,category:categories(id,name,slug),product_images(id,path,alt_text,sort_order)').order('created_at', { ascending: false }),
        requireSupabase().from('categories').select('id,name,slug,description,is_active,sort_order').eq('is_active', true).order('sort_order'),
      ]);
      if (productResult.error) throw productResult.error;
      if (categoryResult.error) throw categoryResult.error;
      setProducts((productResult.data ?? []) as unknown as Product[]); setCategories((categoryResult.data ?? []) as Category[]);
    } catch { setError('Não foi possível carregar os produtos. Verifique as permissões.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (supabaseConfigured) void refresh(); }, []);

  const archive = async (product: Product) => {
    if (!window.confirm(`Despublicar “${product.name}”? O histórico existente será preservado.`)) return;
    const { error: updateError } = await requireSupabase().from('products').update({ is_published: false, is_available: false }).eq('id', product.id);
    if (updateError) setError('Não foi possível arquivar.'); else { setNotice('Produto despublicado.'); await refresh(); }
  };
  const visible = products.filter((item) => `${item.name} ${item.slug}`.toLowerCase().includes(search.toLowerCase()));

  if (!supabaseConfigured) return <AdminUnavailable title="Produtos" />;
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">CATÁLOGO</div><h1>Produtos<em>.</em></h1><p>Cadastre e publique os itens reais do armazém.</p></div><button className="button button--admin" onClick={() => setEditing('new')}><Plus size={17} /> Novo produto</button></div>
    {error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}
    <div className="admin-table-tools"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" /></label><span>{products.length} produtos cadastrados</span></div>
    <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço / unidade</th><th>Estoque</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{visible.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small className="table-subline">/{product.slug}</small></td><td>{product.category?.name || '—'}</td><td>{money(product.price)} / {product.unit}</td><td>{String(product.stock_balance)} {product.unit}</td><td><span className={`status-pill ${product.is_published ? 'status-pill--ready' : 'status-pill--neutral'}`}>{product.is_published ? 'Publicado' : 'Rascunho'}</span></td><td><div className="row-actions"><button title="Editar produto" aria-label={`Editar ${product.name}`} onClick={() => setEditing(product)}><Pencil size={15} /></button><button title="Despublicar produto" aria-label={`Despublicar ${product.name}`} onClick={() => void archive(product)}><Archive size={15} /></button></div></td></tr>)}{loading && <tr><td colSpan={6} className="empty-row">Carregando…</td></tr>}{!loading && !visible.length && <tr><td colSpan={6} className="empty-row">Nenhum produto encontrado. Não há itens fictícios no catálogo.</td></tr>}</tbody></table></div></div>
    {editing && <ProductModal product={editing === 'new' ? null : editing} categories={categories} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); setNotice('Alterações salvas.'); await refresh(); }} />}
  </section>;
}

function ProductModal({ product, categories, onClose, onSaved }: { product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingImage, setDeletingImage] = useState('');
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '', slug: product?.slug ?? '', description: product?.description ?? '', category_id: product?.category_id ?? '', price: String(product?.price ?? ''), unit: product?.unit ?? 'un', minimum_stock: String(product?.minimum_stock ?? '0'), is_available: product?.is_available ?? true, is_published: product?.is_published ?? false, is_featured: product?.is_featured ?? false,
    },
  });

  const save = async (values: ProductFormData) => {
    setSaving(true); setError('');
    const payload = {
      name: values.name.trim(), slug: values.slug.trim(), description: values.description?.trim() || null,
      category_id: values.category_id || null, price: values.price.replace(',', '.'), unit: values.unit as SaleUnit,
      minimum_stock: values.minimum_stock.replace(',', '.'), is_available: values.is_available,
      is_published: values.is_published, is_featured: values.is_featured,
    };
    try {
      const client = requireSupabase();
      let productId = product?.id;
      if (productId) {
        const { error: updateError } = await client.from('products').update(payload).eq('id', productId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await client.from('products').insert(payload).select('id').single();
        if (insertError || !data) throw insertError ?? new Error('Produto não criado.');
        productId = data.id;
      }
      if (file && productId) {
        if (!user) throw new Error('Sessão da equipe não encontrada.');
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
        const path = `${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw new Error('Produto salvo, mas o upload da imagem falhou: verifique bucket e permissões.');
        const { error: imageError } = await client.from('product_images').insert({ product_id: productId, path, alt_text: values.name.trim(), sort_order: product?.product_images?.length ?? 0 });
        if (imageError) throw new Error('Produto salvo e imagem enviada, mas não foi possível vincular a imagem.');
      }
      await onSaved();
    } catch (reason) { setError(reason instanceof Error && reason.message ? reason.message : 'Falha ao salvar produto.'); }
    finally { setSaving(false); }
  };

  const removeImage = async (imageId: string) => {
    if (!window.confirm('Remover esta imagem do produto? A imagem deixa de ser pública e o Storage será limpo.')) return;
    setDeletingImage(imageId); setError('');
    try {
      const { data, error: invokeError } = await requireSupabase().functions.invoke('delete-product-image', { body: { image_id: imageId } });
      if (invokeError || data?.error) throw new Error(data?.error?.message || 'Não foi possível remover a imagem.');
      await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao remover imagem.'); }
    finally { setDeletingImage(''); }
  };

  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title"><div className="admin-modal__heading"><div><span>CATÁLOGO</span><h2 id="product-modal-title">{product ? 'Editar produto' : 'Novo produto'}</h2></div><button onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>{error && <div className="admin-error">{error}</div>}
    {product?.product_images?.length ? <div className="image-management-list"><strong>Imagens armazenadas</strong>{product.product_images.map((image) => <div className="image-management-row" key={image.id}><span>{image.alt_text || image.path.split('/').at(-1)}</span><button type="button" aria-label="Remover imagem" disabled={Boolean(deletingImage)} onClick={() => void removeImage(image.id)}><Trash2 size={15} />{deletingImage === image.id ? 'Removendo…' : 'Remover'}</button></div>)}</div> : null}
    <form className="admin-form-grid" onSubmit={form.handleSubmit(save)}><label className="span-2">Nome do produto<input {...form.register('name', { onChange: (event) => { if (!product) form.setValue('slug', slugify(event.target.value)); } })} />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label><label>Slug<input {...form.register('slug')} />{form.formState.errors.slug && <small className="field-error">{form.formState.errors.slug.message}</small>}</label><label>Categoria<select {...form.register('category_id')}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Preço por unidade<input inputMode="decimal" placeholder="0,00" {...form.register('price')} />{form.formState.errors.price && <small className="field-error">{form.formState.errors.price.message}</small>}</label><label>Unidade de venda<select {...form.register('unit')}><option value="un">unidade (un)</option><option value="g">grama (g)</option><option value="kg">quilograma (kg)</option></select></label><label>Alerta de estoque mínimo<input inputMode="decimal" {...form.register('minimum_stock')} /></label><label className="span-2">Descrição<textarea rows={3} {...form.register('description')} /></label><label className="image-picker span-2"><ImagePlus size={17} />{file ? file.name : 'Adicionar imagem (JPEG, PNG ou WebP, até 5 MB)'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && (selected.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type))) { setError('Imagem inválida: use JPEG, PNG ou WebP de até 5 MB.'); return; } setError(''); setFile(selected); }} /></label><div className="form-toggles span-2"><label><input type="checkbox" {...form.register('is_available')} /> Disponível</label><label><input type="checkbox" {...form.register('is_published')} /> Publicado</label><label><input type="checkbox" {...form.register('is_featured')} /> Destaque</label></div><div className="form-hint span-2">O saldo de estoque não pode ser editado neste formulário. Registre entradas ou ajustes no módulo Estoque.</div><div className="admin-modal__actions span-2"><button type="button" className="button button--subtle" onClick={onClose}>Cancelar</button><button className="button button--admin" disabled={saving}>{saving ? 'Salvando…' : 'Salvar produto'}</button></div></form></section></div>;
}

const categorySchema = z.object({ name: z.string().min(2, 'Informe o nome.').max(100), description: z.string().max(500).optional() });

export function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const form = useForm<z.infer<typeof categorySchema>>({ resolver: zodResolver(categorySchema), defaultValues: { name: '', description: '' } });
  const refresh = async () => {
    const { data, error: queryError } = await requireSupabase().from('categories').select('id,name,slug,description,is_active,sort_order').order('sort_order').order('name');
    if (queryError) setError('Não foi possível consultar as categorias.'); else setCategories((data ?? []) as Category[]);
  };
  useEffect(() => { if (supabaseConfigured) void refresh(); }, []);
  const create = async (values: z.infer<typeof categorySchema>) => {
    setBusy(true); setError('');
    const { error: insertError } = await requireSupabase().from('categories').insert({ name: values.name.trim(), slug: slugify(values.name), description: values.description?.trim() || null, sort_order: categories.length });
    if (insertError) setError('Não foi possível criar a categoria. Verifique se o slug já existe.');
    else { form.reset(); setNotice('Categoria criada.'); await refresh(); }
    setBusy(false);
  };
  const startEdit = (category: Category) => { setEditingId(category.id); setEditName(category.name); setEditDescription(category.description ?? ''); setError(''); };
  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    const parsed = categorySchema.safeParse({ name: editName.trim(), description: editDescription.trim() });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Revise nome e descrição.'); return; }
    const slug = slugify(parsed.data.name);
    if (!slug) { setError('O nome não gerou um slug válido.'); return; }
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await requireSupabase().from('categories')
      .update({ name: parsed.data.name, slug, description: parsed.data.description?.trim() || null }).eq('id', editingId);
    if (updateError) setError(updateError.code === '23505' ? 'Esse nome já gera um slug usado por outra categoria.' : 'Não foi possível salvar a categoria. Verifique as permissões.');
    else { setNotice('Categoria atualizada.'); setEditingId(null); await refresh(); }
    setBusy(false);
  };
  const toggle = async (category: Category) => {
    const { error: updateError } = await requireSupabase().from('categories').update({ is_active: !category.is_active }).eq('id', category.id);
    if (updateError) setError('Não foi possível alterar o estado da categoria.'); else await refresh();
  };
  const reorder = async (category: Category, delta: number) => {
    const index = categories.findIndex((item) => item.id === category.id); const other = categories[index + delta];
    if (!other) return;
    const client = requireSupabase();
    const results = await Promise.all([
      client.from('categories').update({ sort_order: other.sort_order }).eq('id', category.id),
      client.from('categories').update({ sort_order: category.sort_order }).eq('id', other.id),
    ]);
    if (results.some((result) => result.error)) setError('Não foi possível reordenar.'); else await refresh();
  };

  if (!supabaseConfigured) return <AdminUnavailable title="Categorias" />;
  return <section className="admin-module"><div className="admin-page-heading"><div><div className="eyebrow">ORGANIZAÇÃO</div><h1>Categorias<em>.</em></h1><p>Crie, edite, arquive e ordene categorias publicadas na loja.</p></div></div>{error && <div className="admin-error">{error}</div>}{notice && <div className="success-note">{notice}</div>}
    <div className="category-admin-grid"><form className="admin-form-card" onSubmit={form.handleSubmit(create)}><h2>Nova categoria</h2><label>Nome<input {...form.register('name')} /></label>{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}<label>Descrição opcional<textarea rows={3} {...form.register('description')} /></label><button className="button button--admin" disabled={busy}><Plus size={16} /> Criar categoria</button></form><div className="table-card category-admin-list"><div className="table-card__heading"><div><span>ORDEM DA VITRINE</span><h2>Categorias cadastradas</h2></div></div>{categories.map((category, index) => <div className="category-admin-entry" key={category.id}><div className="category-admin-row"><span className="category-order">{String(index + 1).padStart(2, '0')}</span><div><strong>{category.name}</strong><small>/{category.slug}</small></div><span className={`status-pill ${category.is_active ? 'status-pill--ready' : 'status-pill--neutral'}`}>{category.is_active ? 'Ativa' : 'Inativa'}</span><div className="row-actions"><button type="button" onClick={() => void reorder(category, -1)} aria-label={`Mover ${category.name} para cima`} disabled={index === 0}>↑</button><button type="button" onClick={() => void reorder(category, 1)} aria-label={`Mover ${category.name} para baixo`} disabled={index === categories.length - 1}>↓</button><button type="button" onClick={() => startEdit(category)} aria-label={`Editar ${category.name}`}><Pencil size={13} /></button><button type="button" onClick={() => void toggle(category)} aria-label={`${category.is_active ? 'Desativar' : 'Ativar'} ${category.name}`}>{category.is_active ? '−' : '+'}</button></div></div>{editingId === category.id && <form className="category-edit-form" onSubmit={saveEdit}><label>Nome<input autoFocus minLength={2} maxLength={100} value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>Descrição<textarea rows={2} maxLength={500} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label><div><button type="button" className="button button--subtle" onClick={() => setEditingId(null)}>Cancelar</button><button type="submit" className="button button--admin" disabled={busy}>{busy ? 'Salvando…' : 'Salvar categoria'}</button></div></form>}</div>)}{!categories.length && <p className="empty-row">Nenhuma categoria cadastrada.</p>}</div></div></section>;
}
function AdminUnavailable({ title }: { title: string }) { return <div className="admin-setup"><div className="eyebrow">ADMINISTRAÇÃO</div><h1>{title}<em>.</em></h1><div className="setup-warning">Configure a conexão Supabase para trabalhar com dados persistidos.</div></div>; }
