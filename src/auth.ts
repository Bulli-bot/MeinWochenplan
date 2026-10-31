import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { claimLegacy, legacyCode } from './cloud';
import { RECOVERY_IN_URL, authError, rpc, supabase, type Profile } from './supabase';

export interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Hinweis nach der Übernahme alter Daten (z. B. „Du bist jetzt Besitzer") */
  notice: string | null;
  /** Über den Link aus der Mail angemeldet → neues Passwort festlegen */
  recovery: boolean;
  finishRecovery: () => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Anmeldung, Profil und – einmalig – die Übernahme der Daten aus der Zeit vor den Konten. */
export function useAuth(): AuthState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(RECOVERY_IN_URL);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    let me = await rpc<Profile | null>('wp2_me').catch(() => null);
    const code = await legacyCode();
    if (me && code) {
      try {
        const result = await claimLegacy(code);
        setNotice(result === 'besitzer'
          ? 'Deine bisherigen Daten sind übernommen – und du bist Besitzer der App.'
          : 'Deine bisherigen Daten sind in dein Konto übernommen.');
        me = await rpc<Profile | null>('wp2_me').catch(() => me);
      } catch (e) {
        setNotice(`Alte Daten konnten nicht übernommen werden: ${(e as Error).message}`);
      }
    }
    setProfile(me);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') loadProfile(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  return {
    loading,
    session,
    profile,
    notice,
    recovery,
    finishRecovery: () => setRecovery(false),
    refresh: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setNotice(null);
    },
  };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authError(error.message));
}

/** Gibt true zurück, wenn erst die Bestätigungs-Mail geöffnet werden muss. */
export async function signUp(email: string, password: string, name: string): Promise<boolean> {
  const redirect = typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: redirect },
  });
  if (error) throw new Error(authError(error.message));
  return !data.session;
}

export async function resetPassword(email: string) {
  const redirect = typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
  if (error) throw new Error(authError(error.message));
}
