import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCompanySettings } from '../contexts/CompanySettingsContext';
import { useStaticProduct } from '../contexts/StaticProductContext';

const routeCopy: Record<string, { label: string; description: string }> = {
  '/': {
    label: 'Armazém Natural',
    description: 'Explore a loja, consulte o catálogo e encontre informações de atendimento do Capim Limão em Dois Vizinhos, Paraná.',
  },
  '/produtos': {
    label: 'Catálogo',
    description: 'Consulte os produtos publicados pelo Capim Limão, seus preços, unidades de venda e disponibilidade.',
  },
  '/carrinho': {
    label: 'Carrinho',
    description: 'Revise quantidades e envie seu pedido ao Capim Limão. O total final é confirmado pelo sistema da loja.',
  },
  '/sobre': {
    label: 'Sobre a loja',
    description: 'Conheça as informações institucionais publicadas pelo Capim Limão — Armazém Natural.',
  },
  '/contato': {
    label: 'Contato',
    description: 'Encontre os canais comerciais informados pelo Capim Limão — Armazém Natural.',
  },
};

function setMeta(selector: string, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    const separator = attribute.indexOf('=');
    const name = attribute.slice(0, separator);
    const content = attribute.slice(separator + 1);
    element.setAttribute(name, content);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

export function SeoManager() {
  const { pathname } = useLocation();
  const settings = useCompanySettings();
  const staticProduct = useStaticProduct();

  useEffect(() => {
    const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
    const productMatch = pathname.match(/^\/produto\/([^/]+)\/?$/);
    const currentProduct =
      productMatch && staticProduct?.slug === productMatch[1] ? staticProduct : null;

    const page = routeCopy[pathname] ?? (productMatch
      ? {
          label: currentProduct?.name ?? 'Produto',
          description:
            currentProduct?.description?.trim().slice(0, 155) ||
            `Consulte preço, unidade e disponibilidade no catálogo de ${settings.store_name}.`,
        }
      : {
          label: 'Página não encontrada',
          description: 'A página solicitada não está disponível.',
        });

    const title = `${page.label} | ${settings.store_name}`;
    const isIndexable = !isAdmin && Boolean(routeCopy[pathname] || productMatch);

    document.title = title;
    setMeta('meta[name="description"]', 'name=description', page.description);
    setMeta(
      'meta[name="keywords"]',
      'name=keywords',
      'Capim Limão, armazém natural, Dois Vizinhos, produtos naturais, loja local',
    );
    setMeta('meta[name="robots"]', 'name=robots', isIndexable ? 'index,follow' : 'noindex,nofollow');
    setMeta('meta[property="og:type"]', 'property=og:type', productMatch ? 'product' : 'website');
    setMeta('meta[property="og:title"]', 'property=og:title', title);
    setMeta('meta[property="og:description"]', 'property=og:description', page.description);
    setMeta('meta[property="og:site_name"]', 'property=og:site_name', settings.store_name);
    setMeta('meta[name="twitter:card"]', 'name=twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', page.description);

    const configuredOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
    const validOrigin =
      configuredOrigin && /^https:\/\/[^/]+$/.test(configuredOrigin) ? configuredOrigin : '';
    const canonicalSelector = 'link[rel="canonical"]';
    let canonical = document.head.querySelector<HTMLLinkElement>(canonicalSelector);

    if (validOrigin && isIndexable) {
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${validOrigin}${pathname}`;
      setMeta('meta[property="og:url"]', 'property=og:url', canonical.href);
      setMeta('meta[property="og:image"]', 'property=og:image', `${validOrigin}/brand-logo.svg`);
      setMeta('meta[name="twitter:image"]', 'name=twitter:image', `${validOrigin}/brand-logo.svg`);
    } else {
      canonical?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }
  }, [pathname, settings.store_name, staticProduct]);

  return null;
}
