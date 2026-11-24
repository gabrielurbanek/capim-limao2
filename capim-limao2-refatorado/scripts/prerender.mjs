import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

const root = process.cwd();
const env = { ...loadEnv('production', root, ''), ...process.env };
const dist = path.join(root, 'dist');
const baseHtml = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const { render } = await import(pathToFileURL(path.join(root, '.ssr-build', 'entry-server.js')).href);
const pages = [
  { path: '/', folder: '', title: 'Capim Limão — Armazém Natural', description: 'Explore o catálogo do Capim Limão e encontre informações institucionais e comerciais confirmadas pela loja.' },
  { path: '/produtos', folder: 'produtos', title: 'Catálogo | Capim Limão', description: 'Consulte os produtos publicados, seus preços, unidades de venda e disponibilidade atual no Capim Limão.' },
  { path: '/carrinho', folder: 'carrinho', title: 'Carrinho | Capim Limão', description: 'Revise o carrinho e envie um pedido. Preço e estoque são confirmados pelo sistema da loja.' },
  { path: '/sobre', folder: 'sobre', title: 'Sobre a loja | Capim Limão', description: 'Conheça as informações institucionais publicadas pelo Capim Limão — Armazém Natural.' },
  { path: '/contato', folder: 'contato', title: 'Contato | Capim Limão', description: 'Encontre os canais de atendimento comercial confirmados pelo Capim Limão — Armazém Natural.' },
];
const originValue = String(env.VITE_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
const origin = /^https:\/\/[^/]+$/.test(originValue) ? originValue : '';
const imagePath = '/manus-storage/async-images/BQGDY5jcaiL0NijUNzIE9g/image-1.webp';
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function buildHead(page, { noindex = false, absolute = true } = {}) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  let head = baseHtml
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${description}" />`);
  if (noindex) {
    const robots = '<meta name="robots" content="noindex,nofollow" />';
    if (/<meta name="robots"[^>]*>/i.test(head)) head = head.replace(/<meta name="robots"[^>]*>/i, robots);
    else head = head.replace('</head>', `  ${robots}\n</head>`);
  }
  if (absolute && origin) {
    const absoluteUrl = `${origin}${page.path}`;
    head = head.replace('</head>', `  <link rel="canonical" href="${escapeHtml(absoluteUrl)}" />\n  <meta property="og:url" content="${escapeHtml(absoluteUrl)}" />\n  <meta property="og:image" content="${escapeHtml(`${origin}${imagePath}`)}" />\n  <meta name="twitter:image" content="${escapeHtml(`${origin}${imagePath}`)}" />\n</head>`);
  }
  return head;
}

async function writePage(page, product = null) {
  const markup = await render(page.path, product);
  let html = buildHead(page).replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  if (product) {
    const publicSnapshot = JSON.stringify(product).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
    html = html.replace('</body>', `<script>window.__CAPIM_SSG_PRODUCT__=${publicSnapshot}</script>\n</body>`);
  }
  const folder = path.join(dist, page.folder);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'index.html'), html, 'utf8');
}

for (const page of pages) await writePage(page);
const routeManifest = JSON.parse(await fs.readFile(path.join(dist, 'manus-routes.json'), 'utf8'));
const privatePages = routeManifest.routes.filter((route) => route.path === '/admin' || route.path.startsWith('/admin/'));
let privateCount = 0;
for (const route of privatePages) {
  const page = { path: route.path, folder: route.path.slice(1), title: `${route.title} | Administração Capim Limão`, description: 'Área administrativa com acesso restrito à equipe autorizada.' };
  const markup = await render(page.path);
  const html = buildHead(page, { noindex: true, absolute: false }).replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const folder = path.join(dist, page.folder);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'index.html'), html, 'utf8');
  privateCount += 1;
}
const notFound = { path: '/404.html', title: 'Página não encontrada | Capim Limão', description: 'O endereço informado não corresponde a uma página publicada pelo Capim Limão.' };
const notFoundMarkup = await render(notFound.path);
await fs.writeFile(path.join(dist, '404.html'), buildHead(notFound, { noindex: true, absolute: false }).replace('<div id="root"></div>', `<div id="root">${notFoundMarkup}</div>`), 'utf8');

let productCount = 0;
const supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '');
if (supabaseUrl && anonKey) {
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/products`);
    url.search = new URLSearchParams({
      select: 'id,name,slug,description,category_id,price,unit,is_available,is_published,is_featured,created_at,category:categories(id,name,slug),product_images(id,path,alt_text,sort_order)',
      is_published: 'eq.true', is_available: 'eq.true', order: 'name.asc', limit: '1000',
    }).toString();
    const response = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const products = await response.json();
    for (const product of products) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) continue;
      const description = product.description?.trim().slice(0, 155) || `Consulte preço, unidade e disponibilidade de ${product.name} no Capim Limão.`;
      const page = { path: `/produto/${encodeURIComponent(product.slug)}`, folder: path.join('produto', product.slug), title: `${product.name} | Capim Limão`, description };
      await writePage(page, product);
      productCount += 1;
    }
  } catch (error) {
    console.warn(`Pré-render de produtos ignorado; catálogo Supabase indisponível (${error instanceof Error ? error.message : 'falha'}).`);
  }
}
console.log(`HTML inicial gerado para ${pages.length} páginas públicas, ${privateCount} shells administrativos, 1 página 404 e ${productCount} detalhes públicos.`);
