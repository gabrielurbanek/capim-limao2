import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Imagens no bucket privado só são assinadas pelo Storage após as políticas RLS permitirem leitura. */
export function useImageUrl(path: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => path && /^(https?:|\/)/.test(path) ? path : undefined);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(undefined); return () => { active = false; }; }
    if (/^(https?:|\/)/.test(path)) { setUrl(path); return () => { active = false; }; }
    setUrl(undefined);
    if (!supabase) return () => { active = false; };
    void supabase.storage.from('product-images').createSignedUrl(path, 60 * 60 * 12)
      .then(({ data, error }) => { if (active) setUrl(error ? undefined : data?.signedUrl); })
      .catch(() => { if (active) setUrl(undefined); });
    return () => { active = false; };
  }, [path]);
  return url;
}
