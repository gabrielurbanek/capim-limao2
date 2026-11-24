import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CompanySettingsProvider } from './contexts/CompanySettingsContext';
import './styles/global.css';
import { StaticProductProvider } from './contexts/StaticProductContext';
import type { Product } from './types/domain';

const root = document.getElementById('root')!;
const initialProduct = (window as Window & { __CAPIM_SSG_PRODUCT__?: Product }).__CAPIM_SSG_PRODUCT__ ?? null;
const tree = (
  <React.StrictMode>
    <BrowserRouter>
      <StaticProductProvider product={initialProduct}>
        <CompanySettingsProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </CompanySettingsProvider>
      </StaticProductProvider>
    </BrowserRouter>
  </React.StrictMode>
);
if (root.hasChildNodes()) hydrateRoot(root, tree);
else createRoot(root).render(tree);
