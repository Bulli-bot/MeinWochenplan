// Supabase Edge Function „ki": KI-Assistent und Bon-Lesen über Google Gemini für unterwegs.
// Nur für angemeldete, vom Besitzer freigegebene Konten. Der Gemini-Schlüssel liegt als Secret
// GEMINI_API_KEY in Supabase (Edge Functions → Secrets) und verlässt den Server nie.
// Optional: GEMINI_MODEL (Standard gemini-2.5-flash).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const BON_PROMPT = `Lies diesen deutschen Kassenbon Zeile für Zeile von oben nach unten ab. Antworte nur mit JSON:
{"laden":"","datum":"TT.MM.JJJJ","summe":0.0,"zeilen":[{"name":"...","preis":0.0,"kg":null}]}
Jede gedruckte Preiszeile ist ein eigener Eintrag, auch wenn derselbe Artikel mehrfach untereinander steht. Nichts zusammenfassen.
Artikelnummer weglassen. "preis" ist der Endbetrag der Zeile. Gewichtszeilen wie "0,804 kg x 1,59 EUR/kg" als "kg" der Zeile davor eintragen, nicht als eigene Zeile.
Pfand ist eine eigene Zeile, Storno mit negativem Preis. Keine Summen-, Zahlungs- oder Steuerzeilen.`;

interface Msg { role: 'user' | 'assistant'; content: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Nur POST' });

  // Nur freigegebene Konten
  const auth = req.headers.get('Authorization') ?? '';
  // Öffentlicher Publishable Key als Rückfall, falls die Laufzeit keinen Anon-Key mehr mitgibt
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_P0hAfHHtyDt1RLdxgRp7pw_-Qf1XsoY';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, anon, { global: { headers: { Authorization: auth } } });
  const { data: me, error } = await supabase.rpc('wp2_me');
  if (error || !me?.approved) return json(403, { error: 'Nur für freigegebene Konten.' });

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json(503, { error: 'Gemini ist noch nicht eingerichtet (Secret GEMINI_API_KEY fehlt).' });

  let body: { mode?: 'chat' | 'bon'; system?: string; messages?: Msg[]; json?: boolean; image?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage' });
  }

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  let payload: Record<string, unknown>;
  if (body.mode === 'bon') {
    const image = String(body.image ?? '');
    if (image.length > 6_000_000) return json(413, { error: 'Foto zu groß' });
    const m = image.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return json(400, { error: 'Kein Bild' });
    payload = {
      contents: [{ role: 'user', parts: [{ text: BON_PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    };
  } else {
    const messages = (body.messages ?? []).slice(-12);
    if (!messages.length) return json(400, { error: 'Keine Frage' });
    payload = {
      systemInstruction: { parts: [{ text: String(body.system ?? '').slice(0, 8000) }] },
      contents: messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(x.content).slice(0, 4000) }] })),
      generationConfig: { temperature: 0.6, ...(body.json ? { responseMimeType: 'application/json' } : {}) },
    };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 429 ? 'Gemini-Tageslimit erreicht – morgen wieder oder am PC fragen.' : out?.error?.message ?? `Gemini-Fehler ${res.status}`;
    return json(502, { error: msg });
  }
  const text = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (body.mode !== 'bon') return json(200, { text, model });

  try {
    const data = JSON.parse(text);
    const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')));
    const artikel = (data.zeilen ?? data.artikel ?? [])
      .map((a: { name?: string; preis?: unknown; kg?: unknown }) => ({ name: String(a.name ?? '').trim(), preis: num(a.preis), kg: a.kg == null ? null : num(a.kg) || null }))
      .filter((a: { name: string; preis: number }) => a.name && Number.isFinite(a.preis));
    return json(200, { model, laden: String(data.laden ?? ''), datum: String(data.datum ?? ''), summe: num(data.summe) || null, artikel });
  } catch {
    return json(502, { error: 'Gemini hat den Bon nicht lesbar beantwortet.' });
  }
});
