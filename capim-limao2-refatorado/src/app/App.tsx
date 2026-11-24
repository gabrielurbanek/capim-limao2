import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { StorefrontLayout } from '../components/layout/StorefrontLayout';
import { SeoManager } from '../components/SeoManager';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/domain';

const HomePage = lazy(() => import('../pages/storefront/HomePage').then((module) => ({ default: module.HomePage })));
const CatalogPage = lazy(() => import('../pages/storefront/CatalogPage').then((module) => ({ default: module.CatalogPage })));
const ProductPage = lazy(() => import('../pages/storefront/ProductPage').then((module) => ({ default: module.ProductPage })));
const CartPage = lazy(() => import('../pages/storefront/CartPage').then((module) => ({ default: module.CartPage })));
const AboutPage = lazy(() => import('../pages/storefront/InfoPages').then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import('../pages/storefront/InfoPages').then((module) => ({ default: module.ContactPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ProductsAdminPage = lazy(() => import('../pages/admin/CatalogAdminPages').then((module) => ({ default: module.ProductsAdminPage })));
const CategoriesAdminPage = lazy(() => import('../pages/admin/CatalogAdminPages').then((module) => ({ default: module.CategoriesAdminPage })));
const StockPage = lazy(() => import('../pages/admin/OperationsPages').then((module) => ({ default: module.StockPage })));
const OrdersPage = lazy(() => import('../pages/admin/OperationsPages').then((module) => ({ default: module.OrdersPage })));
const CustomersPage = lazy(() => import('../pages/admin/OperationsPages').then((module) => ({ default: module.CustomersPage })));
const StaffPage = lazy(() => import('../pages/admin/OperationsPages').then((module) => ({ default: module.StaffPage })));
const PosPage = lazy(() => import('../pages/admin/PosPage').then((module) => ({ default: module.PosPage })));
const ReportsPage = lazy(() => import('../pages/admin/ReportsSettingsPages').then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import('../pages/admin/ReportsSettingsPages').then((module) => ({ default: module.SettingsPage })));

function RequireAdmin({ roles }: { roles?: Role[] }) {
  const { loading, configured, profile } = useAuth();
  if (loading) return <div className="route-loading">Verificando acesso…</div>;
  if (!configured || !profile?.is_active || !profile.role) return <Navigate to="/admin/login" replace />;
  if (roles && !roles.includes(profile.role)) return <div className="access-denied"><h1>Acesso não autorizado</h1><p>Seu cargo não permite abrir este módulo.</p><Link to="/admin">Voltar à visão geral</Link></div>;
  return <Outlet />;
}

function NotFoundPage() {
  return <main className="empty-state section-block"><span className="empty-state__mark">404</span><h1>Não encontramos esta página.</h1><p>Confira o endereço ou volte para o início do Capim Limão.</p><Link to="/" className="button button--forest">Ir para a loja</Link></main>;
}

export function App() {
  return <><SeoManager /><Suspense fallback={<div className="route-loading">Carregando página…</div>}><Routes>
    <Route element={<StorefrontLayout />}>
      <Route index element={<HomePage />} />
      <Route path="produtos" element={<CatalogPage />} />
      <Route path="produto/:slug" element={<ProductPage />} />
      <Route path="carrinho" element={<CartPage />} />
      <Route path="sobre" element={<AboutPage />} />
      <Route path="contato" element={<ContactPage />} />
    </Route>
    <Route path="admin/login" element={<LoginPage />} />
    <Route path="admin" element={<RequireAdmin />}>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="produtos" element={<RequireAdmin roles={['OWNER', 'MANAGER']} />}><Route index element={<ProductsAdminPage />} /></Route>
        <Route path="categorias" element={<RequireAdmin roles={['OWNER', 'MANAGER']} />}><Route index element={<CategoriesAdminPage />} /></Route>
        <Route path="estoque" element={<RequireAdmin />}><Route index element={<StockPage />} /></Route>
        <Route path="pdv" element={<RequireAdmin />}><Route index element={<PosPage />} /></Route>
        <Route path="pedidos" element={<RequireAdmin />}><Route index element={<OrdersPage />} /></Route>
        <Route path="clientes" element={<RequireAdmin />}><Route index element={<CustomersPage />} /></Route>
        <Route path="relatorios" element={<RequireAdmin roles={['OWNER', 'MANAGER']} />}><Route index element={<ReportsPage />} /></Route>
        <Route path="funcionarios" element={<RequireAdmin roles={['OWNER']} />}><Route index element={<StaffPage />} /></Route>
        <Route path="configuracoes" element={<RequireAdmin roles={['OWNER']} />}><Route index element={<SettingsPage />} /></Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense></>;
}
