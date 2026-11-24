import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CompanySettingsProvider } from './contexts/CompanySettingsContext';
import { StaticProductProvider } from './contexts/StaticProductContext';
import type { Product } from './types/domain';

export async function render(location: string, product: Product | null = null): Promise<string> {
  const tree = (
    <StaticRouter location={location}>
      <StaticProductProvider product={product}>
        <CompanySettingsProvider>
          <AuthProvider>
            <CartProvider><App /></CartProvider>
          </AuthProvider>
        </CompanySettingsProvider>
      </StaticProductProvider>
    </StaticRouter>
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const html = renderToString(tree);
    if (!html.includes('Carregando página…')) return html;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return renderToString(tree);
}
