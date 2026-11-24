import { requireSupabase } from '../lib/supabase';
import type { Category, Product, ProductFilters } from '../types/domain';

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const client = requireSupabase();
  let query = client
    .from('products')
    .select('id,name,slug,description,category_id,price,unit,is_available,is_published,is_featured,created_at,category:categories(id,name,slug),product_images(id,path,alt_text,sort_order)')
    .eq('is_published', true)
    .eq('is_available', true);

  const categoryIds = filters.categoryIds?.filter(Boolean) ?? [];
  if (categoryIds.length) query = query.in('category_id', categoryIds);
  else if (filters.category) query = query.eq('category_id', filters.category);
  if (filters.query?.trim()) query = query.ilike('name', `%${filters.query.trim().replace(/[%_]/g, '')}%`);
  if (filters.orderBy === 'price_asc') query = query.order('price', { ascending: true });
  else if (filters.orderBy === 'price_desc') query = query.order('price', { ascending: false });
  else if (filters.orderBy === 'newest') query = query.order('created_at', { ascending: false });
  else query = query.order('name', { ascending: true });
  if (filters.limit) query = query.range(filters.offset ?? 0, (filters.offset ?? 0) + filters.limit - 1);

  const { data, error } = await query;
  if (error) throw new Error('Não foi possível carregar o catálogo. Tente novamente.');
  return (data ?? []) as unknown as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await requireSupabase()
    .from('products')
    .select('id,name,slug,description,category_id,price,unit,is_available,is_published,is_featured,created_at,category:categories(id,name,slug),product_images(id,path,alt_text,sort_order)')
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('is_available', true)
    .maybeSingle();
  if (error) throw new Error('Não foi possível carregar este item.');
  return data as unknown as Product | null;
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('id,name,slug,description,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error('Não foi possível carregar as categorias.');
  return (data ?? []) as Category[];
}
