import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface PublicCompanySettings {
  store_name: string;
  description: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  opening_hours: unknown;
  social_links: unknown;
  logo_path: string | null;
  banner_path: string | null;
  announcement: string | null;
  footer_text: string | null;
  differentiators: unknown;
}

const defaults: PublicCompanySettings = {
  store_name: 'Capim Limão — Armazém Natural',
  description: null,
  whatsapp: '554635366291',
  email: null,
  address: null,
  opening_hours: null,
  social_links: null,
  logo_path: null,
  banner_path: null,
  announcement: null,
  footer_text: null,
  differentiators: null,
};

const SettingsContext = createContext<PublicCompanySettings>(defaults);

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.from('company_settings')
          .select('store_name,description,whatsapp,email,address,opening_hours,social_links,logo_path,banner_path,announcement,footer_text,differentiators')
          .eq('id', true).maybeSingle();
        if (active && data) setSettings({ ...defaults, ...data });
      } catch { /* Conteúdo neutro confirmado permanece como fallback. */ }
    })();
    return () => { active = false; };
  }, []);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useCompanySettings(): PublicCompanySettings {
  return useContext(SettingsContext);
}
