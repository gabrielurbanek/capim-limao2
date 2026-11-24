import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const looksConfigured = Boolean(url && anonKey && /^https:\/\//.test(url));

export const supabase: SupabaseClient | null = looksConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabaseConfigured = Boolean(supabase);

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Conexão com Supabase não configurada. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}
