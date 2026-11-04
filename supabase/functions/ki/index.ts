// Supabase Edge Function „ki": KI-Assistent und Bon-Lesen über Google Gemini für unterwegs.
// Nur für angemeldete, vom Besitzer freigegebene Konten. Der Gemini-Schlüssel liegt als Secret
// GEMINI_API_KEY in Supabase (Edge Functions → Secrets) und verlässt den Server nie.
// Optional: GEMINI_MODEL (Standard gemini-3.8-flash).
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

  let body: { mode?: 'chat' | 'bon' | 'bild'; system?: string; messages?: Msg[]; json?: boolean; image?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage' });
  }

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  let payload: Record<string, unknown>;
  // „bon“: Kassenbon; „bild“: beliebiges Foto mit eigener Frage (Rezept vom Kochbuch, Kühlschrank) – Antwort als JSON-Text
  if (body.mode === 'bon' || body.mode === 'bild') {
    const image = String(body.image ?? '');
    if (image.length > 6_000_000) return json(413, { error: 'Foto zu groß' });
    const m = image.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return json(400, { error: 'Kein Bild' });
    payload = {
      contents: [{ role: 'user', parts: [{ text: body.mode === 'bild' ? String(body.prompt ?? '').slice(0, 4000) : BON_PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
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

  // Bei Überlastung (503/500) kurz warten und erneut versuchen, zuletzt mit dem Ausweichmodell (Secret GEMINI_FALLBACK_MODEL)
  const fallback = Deno.env.get('GEMINI_FALLBACK_MODEL');
  const tries = [model, model, ...(fallback && fallback !== model ? [fallback] : [model])];
  let res: Response | null = null;
  let out: any = {};
  let used = model;
  for (let i = 0; i < tries.length; i++) {
    used = tries[i];
    if (i) await new Promise((r) => setTimeout(r, 1500 * i));
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${used}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    });
    out = await res.json().catch(() => ({}));
    if (res.ok || (res.status !== 503 && res.status !== 500)) break;
  }
  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    const msg = status === 429 ? 'Gemini-Tageslimit erreicht – morgen wieder oder am PC fragen.'
      : status === 503 || status === 500 ? 'Gemini ist gerade überlastet. Das Foto bleibt gespeichert – später nochmal „Auslesen“ oder am PC auslesen.'
      : out?.error?.message ?? `Gemini-Fehler ${status}`;
    return json(502, { error: msg });
  }
  const model_ = used;
  const text = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (body.mode !== 'bon') return json(200, { text, model: model_ });

  try {
    const data = JSON.parse(text);
    const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')));
    const artikel = (data.zeilen ?? data.artikel ?? [])
      .map((a: { name?: string; preis?: unknown; kg?: unknown }) => ({ name: String(a.name ?? '').trim(), preis: num(a.preis), kg: a.kg == null ? null : num(a.kg) || null }))
      .filter((a: { name: string; preis: number }) => a.name && Number.isFinite(a.preis));
    return json(200, { model: model_, laden: String(data.laden ?? ''), datum: String(data.datum ?? ''), summe: num(data.summe) || null, artikel });
  } catch {
    return json(502, { error: 'Gemini hat den Bon nicht lesbar beantwortet.' });
  }
});
