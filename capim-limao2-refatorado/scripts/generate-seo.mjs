import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

const root = process.cwd();
const dist = path.join(root, 'dist');
const env = { ...loadEnv('production', root, ''), ...process.env };
const candidate = String(env.VITE_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
const origin = /^https:\/\/[^/]+$/.test(candidate) ? candidate : '';
if (!origin) {
  console.log('SEO absoluto: VITE_PUBLIC_SITE_URL ausente; canonical e sitemap foram omitidos em vez de presumir domínio.');
  process.exit(0);
}

const paths = ['/', '/produtos', '/sobre', '/contato'];
const supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '');
if (supabaseUrl && anonKey) {
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/products`);
    url.search = new URLSearchParams({ select: 'slug', is_published: 'eq.true', is_available: 'eq.true', order: 'name.asc', limit: '10000' }).toString();
    const response = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const products = await response.json();
    for (const product of products) if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) paths.push(`/produto/${encodeURIComponent(product.slug)}`);
  } catch (error) {
    console.warn(`SEO: catálogo Supabase indisponível; URLs de produto omitidas (${error instanceof Error ? error.message : 'falha'}).`);
  }
}
const xmlEscape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const entries = paths.map((route) => `  <url><loc>${xmlEscape(`${origin}${route}`)}</loc></url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
await fs.writeFile(path.join(dist, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /carrinho\nSitemap: ${origin}/sitemap.xml\n`, 'utf8');
console.log(`SEO: sitemap gerado com ${paths.length} URLs públicas.`);
