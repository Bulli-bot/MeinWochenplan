// Supabase Edge Function „bring": schickt die offene Einkaufsliste an die eigene Bring!-Liste.
// Nur für angemeldete, vom Besitzer freigegebene Konten. Die Bring!-Zugangsdaten liegen als Secrets
// in Supabase (Edge Functions → Secrets) und verlassen den Server nie; die App sieht sie nicht.
//
// Nutzt die inoffizielle, aber seit Jahren stabile Bring!-Schnittstelle (dieselbe wie die
// Home-Assistant-Integration), ausschließlich für das EIGENE Konto und die EIGENE Liste.
//
// Secrets:
//   BRING_EMAIL, BRING_PASSWORD  – Zugang zum eigenen Bring!-Konto (Pflicht)
//   BRING_LIST_UUID              – optional: bestimmte Liste; sonst die Standardliste des Kontos
//   BRING_COUNTRY                – optional: Länderkürzel, Standard DE
//   BRING_API_KEY                – optional: überschreibt den öffentlichen Client-Schlüssel
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const BRING_REST = 'https://api.getbring.com/rest';
// Öffentlicher Client-Schlüssel der Bring!-App – identisch in den quelloffenen Community-Bibliotheken.
// Kein Nutzer- oder Partner-Geheimnis; nur damit der allgemeine Login funktioniert.
const DEFAULT_API_KEY = 'cof4Nc6D8saplXjE3h3HXqnNHZjVrqDtKEmX';

interface ShopItem { name: string; spec?: string }

function bringHeaders(apiKey: string, country: string, token?: string, uuid?: string): Record<string, string> {
  const h: Record<string, string> = {
    'X-BRING-API-KEY': apiKey,
    'X-BRING-CLIENT': 'webApp',
    'X-BRING-CLIENT-SOURCE': 'webApp',
    'X-BRING-COUNTRY': country,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (uuid) h['X-BRING-USER-UUID'] = uuid;
  return h;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Nur POST' });

  // Nur freigegebene Konten (gleiche Prüfung wie bei der KI-Funktion)
  const auth = req.headers.get('Authorization') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_P0hAfHHtyDt1RLdxgRp7pw_-Qf1XsoY';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, anon, { global: { headers: { Authorization: auth } } });
  const { data: me, error } = await supabase.rpc('wp2_me');
  if (error || !me?.approved) return json(403, { error: 'Nur für freigegebene Konten.' });

  const email = Deno.env.get('BRING_EMAIL');
  const password = Deno.env.get('BRING_PASSWORD');
  if (!email || !password) return json(503, { error: 'Bring! ist noch nicht eingerichtet (BRING_EMAIL / BRING_PASSWORD fehlen).' });
  const apiKey = Deno.env.get('BRING_API_KEY') || DEFAULT_API_KEY;
  const country = Deno.env.get('BRING_COUNTRY') || 'DE';

  let body: { items?: ShopItem[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage' });
  }
  const items = (body.items ?? [])
    .map((i) => ({ name: String(i.name ?? '').trim(), spec: String(i.spec ?? '').trim() }))
    .filter((i) => i.name);
  if (!items.length) return json(400, { error: 'Keine Artikel zum Senden.' });
  if (items.length > 200) return json(413, { error: 'Zu viele Artikel auf einmal.' });

  // 1) Anmelden
  const loginRes = await fetch(`${BRING_REST}/v2/bringauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...bringHeaders(apiKey, country) },
    body: new URLSearchParams({ email, password }),
  });
  const login = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !login.access_token) {
    const msg = loginRes.status === 401 || loginRes.status === 403
      ? 'Bring!-Anmeldung fehlgeschlagen – E-Mail oder Passwort in den Secrets prüfen.'
      : `Bring! nicht erreichbar (${loginRes.status}).`;
    return json(502, { error: msg });
  }
  const token: string = login.access_token;
  const userUuid: string = login.uuid;
  const listUuid = Deno.env.get('BRING_LIST_UUID') || login.bringListUUID;
  if (!listUuid) return json(502, { error: 'Keine Bring!-Liste gefunden. BRING_LIST_UUID als Secret setzen.' });

  // 2) Name der Liste für die Rückmeldung (optional, bricht nichts ab)
  let listName = 'deine Bring!-Liste';
  try {
    const d = await fetch(`${BRING_REST}/bringlists/${listUuid}`, { headers: bringHeaders(apiKey, country, token, userUuid) });
    const dj = await d.json().catch(() => ({}));
    if (dj?.name) listName = dj.name;
  } catch { /* egal */ }

  // 3) Artikel in einem Rutsch auf die Liste setzen (TO_PURCHASE = „noch kaufen")
  const changes = items.map((i) => ({ itemId: i.name, spec: i.spec, operation: 'TO_PURCHASE' }));
  const putRes = await fetch(`${BRING_REST}/v2/bringlists/${listUuid}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...bringHeaders(apiKey, country, token, userUuid) },
    body: JSON.stringify({ changes, sender: '' }),
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    return json(502, { error: `Artikel konnten nicht übertragen werden (${putRes.status}).`, detail: t.slice(0, 200) });
  }

  return json(200, { added: items.length, list: listName });
});
