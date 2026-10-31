import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase-Projekt „MeinWochenplan". Der Publishable Key ist für Web-Apps gedacht und darf öffentlich
 * im Code stehen – geschützt wird über Anmeldung, Freigabe durch den Besitzer und die SQL-Funktionen
 * (supabase-konten.sql). Geheime Schlüssel gehören nie hierher.
 */
export const SUPABASE_URL = 'https://futaviriujnoahzhznoe.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_P0hAfHHtyDt1RLdxgRp7pw_-Qf1XsoY';

/** Kommt die Seite aus einem „Passwort zurücksetzen“-Link? (vor createClient lesen – der entfernt den Hash) */
export const RECOVERY_IN_URL = Platform.OS === 'web' && typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    // „implicit“: Mail-Links funktionieren auch auf einem anderen Gerät als dem, auf dem sie angefordert wurden
    flowType: 'implicit',
  },
});

export interface Profile {
  email: string;
  name: string;
  role: 'owner' | 'member';
  approved: boolean;
  household: string;
  owner_exists: boolean;
}

/** Fehlermeldungen von Supabase auf Deutsch */
export function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/email not confirmed/i.test(message)) return 'Bitte zuerst den Link in der Bestätigungs-Mail öffnen.';
  if (/already registered|already exists/i.test(message)) return 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.';
  if (/password should be at least/i.test(message)) return 'Das Passwort braucht mindestens 6 Zeichen.';
  if (/rate limit|too many/i.test(message)) return 'Zu viele Versuche – bitte kurz warten.';
  if (/failed to fetch|network/i.test(message)) return 'Keine Verbindung – Internet prüfen.';
  if (/nicht freigegeben/i.test(message)) return 'Dein Konto ist noch nicht freigegeben.';
  return message;
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(authError(error.message));
  return data as T;
}
