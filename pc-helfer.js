// PC-Helfer für MeinWochenplan – läuft nur auf diesem PC (127.0.0.1), nicht im Netz erreichbar.
//   POST /bon     { image: "data:image/jpeg;base64,…" }  → Kassenbon mit lokalem Ollama-Bildmodell auslesen
//   POST /import  { url: "https://…" }                   → Rezept (schema.org/Recipe) von einer Webseite holen
//   POST /ai      { system, messages: [{role, content}], json? } → Antwort vom lokalen Textmodell (KI-Assistent)
//   POST /bild    { image, prompt }                      → Foto mit dem Bildmodell lesen (Rezept, Kühlschrank), Antwort als JSON-Text
//   GET  /status                                          → läuft? welches Bildmodell?
// Start: Doppelklick auf "PC-Helfer starten.cmd" oder `node pc-helfer.js`.
const http = require('http');

const PORT = Number(process.env.HELFER_PORT || 8093);
const OLLAMA = (process.env.OLLAMA_URL || 'http://127.0.0.1:11435').replace(/\/+$/, '');
const MAX_BODY = 8 * 1024 * 1024;

/** Textmodell für den KI-Assistenten (qwen3:14b passt komplett in die Grafikkarte, Denkmodus aus) */
const AI_MODEL = process.env.KI_MODELL || 'qwen3:14b';

async function chat({ system, messages, json }) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: AI_MODEL,
      stream: false,
      think: false,
      ...(json ? { format: 'json' } : {}),
      options: { temperature: 0.6, num_ctx: 8192 },
      messages: [{ role: 'system', content: String(system || '') }, ...(messages || []).slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }))],
    }),
  });
  if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`);
  return { text: (await res.json()).message.content.trim(), model: AI_MODEL };
}

let visionModel = process.env.BON_MODELL ? { name: process.env.BON_MODELL, thinking: false } : null;
/** Reihenfolge nach Test mit echten Bons: qwen2.5vl liest lange Bons am genauesten und schnellsten. */
const PREFERRED = [/qwen2\.5vl/, /qwen3-vl/, /minicpm-v/, /gemma/, /llava/];

async function findVisionModel() {
  if (visionModel) return visionModel;
  const tags = await (await fetch(`${OLLAMA}/api/tags`)).json();
  const rank = (n) => { const i = PREFERRED.findIndex((re) => re.test(n)); return i === -1 ? PREFERRED.length : i; };
  for (const m of [...(tags.models || [])].sort((a, b) => rank(a.name) - rank(b.name))) {
    try {
      const info = await (await fetch(`${OLLAMA}/api/show`, { method: 'POST', body: JSON.stringify({ model: m.name }) })).json();
      const caps = info.capabilities || [];
      if (caps.includes('vision')) return (visionModel = { name: m.name, thinking: caps.includes('thinking') });
    } catch {
      // nächstes Modell
    }
  }
  return null;
}

const BON_PROMPT = `Lies diesen deutschen Kassenbon Zeile für Zeile von oben nach unten ab. Antworte nur mit JSON:
{"laden":"","datum":"TT.MM.JJJJ","summe":0.0,"zeilen":[{"name":"...","preis":0.0,"kg":null}]}
WICHTIG: Jede gedruckte Preiszeile ist ein eigener Eintrag in "zeilen". Steht derselbe Artikel zwei- oder dreimal untereinander, kommt er auch zwei- oder dreimal vor. Nichts zusammenfassen, nichts weglassen.
Artikelnummer weglassen. "preis" ist der Endbetrag der Zeile (Punkt als Dezimaltrennzeichen). Bei Gewichtszeilen wie "0,804 kg x 1,59 EUR/kg" das Gewicht als "kg" eintragen.
Pfand ist eine eigene Zeile, Storno mit negativem Preis. Keine Summen-, Zahlungs- oder Steuerzeilen.`;

async function readReceipt(image) {
  const model = await findVisionModel();
  if (!model) throw Object.assign(new Error('Kein Bildmodell in Ollama gefunden (z. B. qwen2.5vl).'), { status: 503 });
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: model.name,
      stream: false,
      format: 'json',
      // Denkmodus würde das Antwortbudget aufbrauchen (nur bei Modellen, die ihn haben)
      ...(model.thinking ? { think: false } : {}),
      options: { temperature: 0, num_ctx: 16384, num_predict: 4000 },
      messages: [{ role: 'user', content: BON_PROMPT, images: [String(image).replace(/^data:[^,]+,/, '')] }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`);
  const data = JSON.parse((await res.json()).message.content);
  const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')));
  const rows = (data.zeilen || data.artikel || [])
    .map((a) => ({ name: String(a.name || '').trim(), preis: num(a.preis), kg: a.kg == null ? null : num(a.kg) || null }))
    .filter((a) => a.name && Number.isFinite(a.preis));
  // Mengen-/Gewichtszeilen („0,804 kg x 1,59 EUR/kg", „4 x 0,59") gehören zur Zeile davor bzw. danach – nicht doppelt zählen
  const artikel = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const weight = r.name.match(/^(\d+[.,]\d+)\s*kg\s*x/i);
    if (weight) {
      const prev = artikel[artikel.length - 1];
      if (prev) prev.kg = num(weight[1]);
      continue;
    }
    if (/^\d+\s*x\s*\d/i.test(r.name)) continue;
    artikel.push(r);
  }
  return { model: model.name, laden: String(data.laden || ''), datum: String(data.datum || ''), summe: num(data.summe) || null, artikel };
}

/** Beliebiges Foto mit eigener Frage lesen – Antwort als JSON-Text (Rezept vom Kochbuch, Kühlschrank-Inhalt). */
async function readImage(image, prompt) {
  const model = await findVisionModel();
  if (!model) throw Object.assign(new Error('Kein Bildmodell in Ollama gefunden (z. B. qwen2.5vl).'), { status: 503 });
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: model.name,
      stream: false,
      format: 'json',
      ...(model.thinking ? { think: false } : {}),
      options: { temperature: 0.1, num_ctx: 16384, num_predict: 3000 },
      messages: [{ role: 'user', content: String(prompt || '').slice(0, 4000), images: [String(image).replace(/^data:[^,]+,/, '')] }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama antwortet mit ${res.status}`);
  return { text: (await res.json()).message.content, model: model.name };
}

const RECIPE_FROM_TEXT = `Aus dem folgenden Text (Webseite, Video-Beschreibung oder Notiz) ein Rezept machen. Antworte nur mit JSON:
{"name":"","portionen":4,"minuten":30,"zutaten":["500 g Spaghetti","1 Zwiebel"],"schritte":["…"]}
Zutaten mit Menge und Einheit auf Deutsch, Schritte kurz. Steht kein Rezept im Text, antworte {"name":""}.`;

/** Seiten ohne schema.org-Rezept (Instagram, TikTok, YouTube, Blogs): Titel, Beschreibung und Text an das Textmodell */
async function recipeFromPage(url, html) {
  const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, 'i')) || [])[1] || '';
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const input = [meta('og:title'), meta('og:description') || meta('description'), text.slice(0, 6000)].filter(Boolean).join(' | ');
  if (input.length < 40) throw Object.assign(new Error('Die Seite gibt ohne Anmeldung nichts preis – Beschreibung kopieren und als Text einfügen.'), { status: 422 });
  const { text: out } = await chat({ system: RECIPE_FROM_TEXT, messages: [{ role: 'user', content: input }], json: true });
  const r = JSON.parse(out);
  if (!r.name || !(r.zutaten || []).length) throw Object.assign(new Error('Auf der Seite wurde kein Rezept gefunden – Beschreibung kopieren und als Text einfügen.'), { status: 422 });
  return {
    name: String(r.name).trim(),
    portions: parseInt(r.portionen, 10) || 4,
    ingredients: r.zutaten.map((s) => String(s).trim()),
    steps: (r.schritte || []).map((s) => String(s).trim()),
    minutes: parseInt(r.minuten, 10) || 30,
    source: url,
  };
}

function isPublicUrl(raw) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return false;
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(u.hostname);
  } catch {
    return false;
  }
}

function isoMinutes(d) {
  const m = String(d || '').match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? Number(m[1] || 0) * 60 + Number(m[2] || 0) : 0;
}

function steps(instr) {
  if (!instr) return [];
  if (typeof instr === 'string') return instr.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return instr.flatMap((s) => (typeof s === 'string' ? [s] : s.itemListElement ? steps(s.itemListElement) : [s.text || s.name || ''])).filter(Boolean);
}

async function importRecipe(url) {
  if (!isPublicUrl(url)) throw Object.assign(new Error('Bitte einen normalen Rezept-Link (https://…) angeben.'), { status: 400 });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 MeinWochenplan', 'Accept-Language': 'de-DE' } });
  if (!res.ok) throw new Error(`Seite antwortet mit ${res.status}`);
  const html = await res.text();
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const flat = (x) => (Array.isArray(x) ? x.flatMap(flat) : x && x['@graph'] ? flat(x['@graph']) : [x]);
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b.trim());
    } catch {
      continue;
    }
    const recipe = flat(parsed).find((o) => o && [].concat(o['@type']).includes('Recipe'));
    if (!recipe) continue;
    const yieldRaw = [].concat(recipe.recipeYield || [])[0];
    return {
      name: String(recipe.name || '').trim(),
      portions: parseInt(String(yieldRaw || '4'), 10) || 4,
      ingredients: [].concat(recipe.recipeIngredient || []).map((s) => String(s).replace(/\s+/g, ' ').trim()),
      steps: steps(recipe.recipeInstructions).map((s) => String(s).replace(/\s+/g, ' ').trim()),
      minutes: isoMinutes(recipe.totalTime) || isoMinutes(recipe.cookTime) + isoMinutes(recipe.prepTime) || 30,
      source: url,
    };
  }
  // Kein Rezept-Baustein auf der Seite → KI liest Titel, Beschreibung und Text
  return recipeFromPage(url, html);
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Chrome fragt bei Zugriff aus dem Internet auf diesen PC nach („Private Network Access")
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Zu groß'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Ungültige Daten'), { status: 400 }));
      }
    });
  });
}

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204);
    const path = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && path === '/status') {
        let model = null;
        let ollama = true;
        try {
          model = (await findVisionModel())?.name ?? null;
        } catch {
          ollama = false;
        }
        return send(res, 200, { ok: true, ollama, visionModel: model, textModel: AI_MODEL });
      }
      if (req.method === 'POST' && path === '/bon') return send(res, 200, await readReceipt((await readBody(req)).image));
      if (req.method === 'POST' && path === '/ai') return send(res, 200, await chat(await readBody(req)));
      if (req.method === 'POST' && path === '/import') return send(res, 200, await importRecipe((await readBody(req)).url));
      if (req.method === 'POST' && path === '/bild') {
        const b = await readBody(req);
        return send(res, 200, await readImage(b.image, b.prompt));
      }
      send(res, 404, { error: 'Unbekannt' });
    } catch (e) {
      const offline = e.cause && e.cause.code === 'ECONNREFUSED';
      send(res, e.status || (offline ? 503 : 500), { error: offline ? 'Ollama läuft nicht (Docker gestartet?)' : e.message });
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`MeinWochenplan PC-Helfer läuft: http://127.0.0.1:${PORT}  (Ollama: ${OLLAMA})`));
