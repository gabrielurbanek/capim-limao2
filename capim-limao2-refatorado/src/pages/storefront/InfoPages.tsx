import { ArrowRight, Leaf, MapPin, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCompanySettings } from '../../contexts/CompanySettingsContext';

export function AboutPage() {
  const settings = useCompanySettings();

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:px-10 lg:py-24">
      <div className="lg:col-span-7">
        <div className="eyebrow">QUEM SOMOS</div>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#18361B] sm:text-5xl lg:text-6xl">
          {settings.store_name}
          <br />
          <em className="font-normal text-[#C47A3C]">Informação clara, escolha consciente.</em>
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[#2D2D2D]/80 sm:text-base">
          <p>
            {settings.description ||
              'Este espaço reúne as informações institucionais do armazém. A equipe pode completar a descrição e publicar detalhes confirmados pelo painel.'}
          </p>
          <p>
            {settings.address ||
              'O endereço detalhado, horários e redes sociais serão apresentados quando confirmados pela loja.'}
          </p>
        </div>
        <Link
          to="/produtos"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#18361B] px-7 py-3.5 text-sm font-semibold text-[#F8F9F5] transition hover:bg-[#163018]"
        >
          <span>Explorar catálogo</span>
          <ArrowRight className="h-4 w-4 text-[#8CC63F]" />
        </Link>
      </div>

      <div className="lg:col-span-5">
        <div className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-t-[12rem] rounded-b-3xl border border-[#18361B]/15 bg-gradient-to-br from-[#F2EFE9] to-[#E6EFE0] p-8 shadow-soft">
          <svg
            viewBox="0 0 360 360"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
            aria-hidden="true"
          >
            <path d="M40 360 C110 250, 150 150, 235 45" fill="none" stroke="#18361B" strokeWidth="2.5" />
            <path d="M165 215 C110 185, 95 130, 118 95 C155 115, 175 165, 165 215 Z" fill="#8CC63F" />
            <path d="M225 235 C280 205, 300 150, 275 115 C235 135, 220 185, 225 235 Z" fill="#18361B" fillOpacity="0.25" />
          </svg>
          <img
            src="/brand-logo.svg"
            alt={settings.store_name}
            className="relative z-10 h-28 w-auto object-contain"
          />
          <span className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#18361B]">
            <Leaf className="h-3.5 w-3.5 text-[#8CC63F]" />
            {settings.address || 'Endereço não informado'}
          </span>
        </div>
      </div>
    </section>
  );
}

export function ContactPage() {
  const settings = useCompanySettings();
  const phone = settings.whatsapp?.replace(/\D/g, '') ?? '';
  const whatsappUrl = phone ? `https://wa.me/${phone}` : '';

  return (
    <section className="contact-page section-block">
      <div className="eyebrow">CONTATO</div>
      <h1>
        Vamos <em>conversar?</em>
      </h1>
      <p>Fale diretamente com o Capim Limão pelos canais informados pela loja.</p>

      {phone && (
        <div className="contact-card">
          <div className="contact-card__icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <span>WhatsApp</span>
            <strong>{settings.whatsapp}</strong>
            <small>Número comercial configurado pela loja</small>
          </div>
          <a className="button button--forest" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            Abrir conversa <ArrowRight size={16} />
          </a>
        </div>
      )}

      {settings.email && (
        <div className="contact-card">
          <div className="contact-card__icon">
            <MessageCircle size={22} />
          </div>
          <div>
            <span>E-mail</span>
            <strong>{settings.email}</strong>
          </div>
          <a className="button button--forest" href={`mailto:${settings.email}`}>
            Enviar e-mail <ArrowRight size={16} />
          </a>
        </div>
      )}

      {!phone && !settings.email && (
        <p className="catalog-note">Os canais de atendimento ainda não foram cadastrados.</p>
      )}

      <div className="contact-neutral">
        <MapPin size={18} />
        <span>{settings.address || 'Endereço detalhado ainda não informado.'}</span>
      </div>
    </section>
  );
}
