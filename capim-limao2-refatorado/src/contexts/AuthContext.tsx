import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { requireSupabase, supabase, supabaseConfigured } from '../lib/supabase';
import type { Profile, Role } from '../types/domain';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendRecovery: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(user: User): Promise<Profile | null> {
  const client = requireSupabase();
  const [profileResult, roleResult] = await Promise.all([
    client.from('profiles').select('id,full_name,email,phone,is_active').eq('id', user.id).maybeSingle(),
    client.from('user_roles').select('role_code').eq('user_id', user.id).maybeSingle(),
  ]);
  if (profileResult.error || roleResult.error || !profileResult.data) return null;
  const data = profileResult.data;
  const role = roleResult.data?.role_code as Role | undefined;
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    is_active: data.is_active,
    role: role && ['OWNER','MANAGER','EMPLOYEE'].includes(role) ? role : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = useCallback(async (user: User | null) => {
    if (!user || !supabase) {
      setProfile(null);
      return;
    }
    const nextProfile = await loadProfile(user);
    setProfile(nextProfile);
    if (nextProfile && !nextProfile.is_active) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await syncProfile(data.session?.user ?? null);
      if (alive) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        queueMicrotask(() => void syncProfile(nextSession.user));
      } else {
        setProfile(null);
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [syncProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error('E-mail ou senha inválidos.');
    const next = await loadProfile(data.user);
    if (!next?.is_active || !next.role) {
      await requireSupabase().auth.signOut();
      throw new Error('Este acesso não está ativo. Fale com a administração da loja.');
    }
    setProfile(next);
    setSession(data.session);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut();
    setSession(null);
    setProfile(null);
    if (error) throw new Error('Não foi possível encerrar a sessão.');
  }, []);

  const sendRecovery = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/login?recuperacao=1`,
    });
    if (error) throw new Error('Não foi possível solicitar a recuperação. Verifique o e-mail e tente novamente.');
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    configured: supabaseConfigured,
    signIn,
    signOut,
    sendRecovery,
    refreshProfile: () => syncProfile(session?.user ?? null),
  }), [session, profile, loading, signIn, signOut, sendRecovery, syncProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return context;
}
