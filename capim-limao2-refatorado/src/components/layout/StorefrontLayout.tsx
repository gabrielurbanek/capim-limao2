import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { BrandMark } from '../BrandMark';
import { useCart } from '../../contexts/CartContext';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';

function Header() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { count } = useCart();
  const settings = useCompanySettings();
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/produtos${search.trim() ? `?busca=${encodeURIComponent(search.trim())}` : ''}`);
    setOpen(false);
  };

  return <>
    <div className="announcement"><span>{settings.announcement?.trim() || settings.store_name}</span><span>ARMAZÉM NATURAL</span></div>
    <header className="store-header"><div className="store-header__inner">
      <button className="icon-button mobile-menu-button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen((value) => !value)}>{open ? <X size={21} /> : <Menu size={21} />}</button>
      <BrandMark />
      <nav className={`store-nav ${open ? 'store-nav--open' : ''}`} aria-label="Navegação principal"><Link to="/produtos" onClick={() => setOpen(false)}>Catálogo</Link><Link to="/sobre" onClick={() => setOpen(false)}>Sobre</Link><Link to="/contato" onClick={() => setOpen(false)}>Contato</Link></nav>
      <div className="store-header__actions"><form className="header-search" onSubmit={submitSearch} role="search"><Search size={16} aria-hidden="true" /><input aria-label="Buscar no catálogo" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></form><Link className="cart-link" to="/carrinho" aria-label={`Carrinho, ${count} itens`}><ShoppingBag size={19} strokeWidth={1.7} /><span>Carrinho</span>{count > 0 && <b>{count}</b>}</Link></div>
    </div></header>
  </>;
}

function Footer() {
  const settings = useCompanySettings();
  const phone = settings.whatsapp?.replace(/\D/g, '') ?? '';
  return <footer className="store-footer"><div className="store-footer__main">
    <div><BrandMark inverse /><p>{settings.description || 'Informações comerciais publicadas e mantidas pela equipe da loja.'}</p></div>
    <div className="footer-links"><strong>Explore</strong><Link to="/produtos">Catálogo</Link><Link to="/sobre">Sobre o armazém</Link><Link to="/contato">Contato</Link></div>
    <div className="footer-links"><strong>Atendimento</strong>{phone ? <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={15} /></a> : <span>WhatsApp ainda não informado</span>}{settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : <span>E-mail ainda não informado</span>}{settings.address && <span>{settings.address}</span>}</div>
  </div><div className="store-footer__bottom"><span>{settings.footer_text?.trim() || settings.store_name}</span><Link to="/admin/login">Acesso da equipe</Link></div></footer>;
}

export function StorefrontLayout() {
  return <div className="storefront"><Header /><main><Outlet /></main><Footer /></div>;
}
