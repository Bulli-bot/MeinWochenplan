import { supabase } from './supabase';

export interface BringItem {
  name: string;
  /** Zusatz, z. B. Menge – in Bring! der graue Text unter dem Artikel */
  spec?: string;
}

/**
 * Schickt die offene Einkaufsliste an die eigene Bring!-Liste (über die Supabase-Funktion „bring").
 * Die Bring!-Zugangsdaten liegen nur auf dem Server; die App kennt sie nicht.
 */
export async function sendToBring(items: BringItem[]): Promise<{ added: number; list: string }> {
  const { data, error } = await supabase.functions.invoke('bring', { body: { items } });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'Bring! ist gerade nicht erreichbar.');
  }
  return data as { added: number; list: string };
}
