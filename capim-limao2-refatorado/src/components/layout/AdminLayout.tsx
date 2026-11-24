import { useEffect, useState } from 'react';
import { Activity, BarChart3, Boxes, ChevronDown, Command, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, Search, Settings2, ShoppingBag, ShoppingCart, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types/domain';

const links: Array<{ to: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }> = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER', 'EMPLOYEE'] },
  { to: '/admin/produtos', label: 'Produtos', icon: Package, roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/categorias', label: 'Categorias', icon: Boxes, roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/estoque', label: 'Estoque', icon: Activity, roles: ['OWNER', 'MANAGER', 'EMPLOYEE'] },
  { to: '/admin/pdv', label: 'Ponto de venda', icon: ShoppingCart, roles: ['OWNER', 'MANAGER', 'EMPLOYEE'] },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag, roles: ['OWNER', 'MANAGER', 'EMPLOYEE'] },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, roles: ['OWNER', 'MANAGER', 'EMPLOYEE'] },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/funcionarios', label: 'Equipe', icon: Users, roles: ['OWNER'] },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings2, roles: ['OWNER'] },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const visibleLinks = links.filter((item) => profile?.role && item.roles.includes(profile.role));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen((open) => !open); }
      if (event.key === 'Escape') { setSearchOpen(false); setDrawer(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const chooseLink = (path: string) => { navigate(path); setSearchOpen(false); setDrawer(false); setSearch(''); };
  const filteredLinks = visibleLinks.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="admin-shell">
      {drawer && <button className="admin-scrim" aria-label="Fechar navegação" onClick={() => setDrawer(false)} />}
      <aside className={`admin-sidebar ${drawer ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-brand"><Link to="/admin"><span className="admin-brand__mark">✳</span><span>Capim Limão<small>ARMAZÉM NATURAL</small></span></Link><button className="sidebar-collapse" aria-label="Fechar navegação" onClick={() => setDrawer(false)}><PanelLeftClose size={17} /></button></div>
        <div className="admin-workspace"><span className="workspace-dot" /><span>PAINEL DA LOJA</span><ChevronDown size={14} /></div>
        <div className="admin-nav-label">MENU PRINCIPAL</div>
        <nav className="admin-nav" aria-label="Painel administrativo">{visibleLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} end={to === '/admin'} to={to} className={({ isActive }) => `admin-nav__link ${isActive ? 'active' : ''}`} onClick={() => setDrawer(false)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{to === '/admin/pdv' && <small>PDV</small>}</NavLink>)}</nav>
        <div className="admin-sidebar__bottom"><Link to="/" className="admin-store-link">↗ <span>Ver loja pública</span></Link><div className="admin-user"><div className="admin-user__avatar">{profile?.full_name?.slice(0, 1).toUpperCase() || 'C'}</div><div><strong>{profile?.full_name || 'Equipe Capim Limão'}</strong><small>{profile?.role || 'Sem cargo'}</small></div><button type="button" aria-label="Sair" title="Sair" onClick={() => void signOut()}><LogOut size={16} /></button></div></div>
      </aside>
      <div className="admin-main"><header className="admin-topbar"><button className="admin-mobile-menu" aria-label="Abrir navegação" onClick={() => setDrawer(true)}><Menu size={20} /></button><div className="admin-breadcrumb"><span>Capim Limão</span><span>/</span><strong>Painel</strong></div><div className="admin-topbar__actions"><button className="admin-command" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Buscar módulos</span><kbd><Command size={11} /> K</kbd></button><span className="admin-secure"><span /> DADOS DO ARMAZÉM</span></div></header><main className="admin-content"><Outlet /></main></div>
      {searchOpen && <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Busca do painel" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="command-box"><div className="command-input"><Search size={18} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar módulos..." /><kbd>ESC</kbd></div><div className="command-results">{filteredLinks.map(({ to, label, icon: Icon }) => <button key={to} onClick={() => chooseLink(to)}><Icon size={17} />{label}<span>↵</span></button>)}{!filteredLinks.length && <p>Nenhum módulo encontrado.</p>}</div><div className="command-foot">NAVEGAÇÃO · CAPIM LIMÃO</div></div></div>}
    </div>
  );
}
