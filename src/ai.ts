import { RECIPE_BY_ID } from './data/recipes';
import { helperChat, helperImage, helperStatus, readReceipt, type ChatMessage, type ReceiptResult } from './pchelper';
import { supabase } from './supabase';
import type { AppState, Settings } from './types';

/**
 * KI für den Assistenten und das Bon-Lesen: am PC das lokale Ollama über den PC-Helfer,
 * sonst Gemini über die Supabase-Funktion „ki" (nur angemeldet und freigegeben).
 */
export type AiVia = 'PC' | 'Gemini';

let helperOk: { ok: boolean; at: number } | null = null;
/** Ist der PC-Helfer mit Ollama erreichbar? (eine Minute zwischengespeichert) */
export async function pcAvailable(): Promise<boolean> {
  if (helperOk && Date.now() - helperOk.at < 60000) return helperOk.ok;
  const ok = await helperStatus().then((s) => s.ollama).catch(() => false);
  helperOk = { ok, at: Date.now() };
  return ok;
}

async function gemini<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ki', { body });
  if (error) {
    // Fehlertext der Funktion durchreichen statt „Edge Function returned a non-2xx status code"
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'Gemini ist gerade nicht erreichbar.');
  }
  return data as T;
}

export async function askAI(system: string, messages: ChatMessage[], json = false): Promise<{ text: string; via: AiVia; model: string }> {
  if (await pcAvailable()) {
    try {
      const r = await helperChat({ system, messages, json });
      return { ...r, via: 'PC' };
    } catch {
      helperOk = null; // dann Gemini
    }
  }
  const r = await gemini<{ text: string; model: string }>({ mode: 'chat', system, messages, json });
  return { ...r, via: 'Gemini' };
}

/** Bon lesen: am PC lokal, unterwegs über Gemini. */
export async function readReceiptAny(image: string): Promise<ReceiptResult & { via: AiVia }> {
  if (await pcAvailable()) {
    try {
      return { ...(await readReceipt(image)), via: 'PC' };
    } catch {
      helperOk = null;
    }
  }
  return { ...(await gemini<ReceiptResult>({ mode: 'bon', image })), via: 'Gemini' };
}

/** Foto mit eigener Frage lesen (Rezept vom Kochbuch, Kühlschrank): am PC lokal, unterwegs über Gemini. Antwort als JSON. */
export async function askImage<T>(image: string, prompt: string): Promise<T & { via: AiVia }> {
  let text: string | null = null;
  let via: AiVia = 'PC';
  if (await pcAvailable()) {
    try {
      text = (await helperImage(image, prompt)).text;
    } catch {
      helperOk = null;
    }
  }
  if (text === null) {
    text = (await gemini<{ text: string }>({ mode: 'bild', image, prompt })).text;
    via = 'Gemini';
  }
  try {
    return { ...(JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()) as T), via };
  } catch {
    throw new Error('Die KI hat das Foto nicht lesbar beantwortet – noch einmal mit mehr Licht versuchen.');
  }
}

/** Was die KI über den Haushalt wissen soll – ohne Namen und E-Mail-Adressen. */
export function householdContext(state: AppState, settings: Settings): string {
  const plan = state.plan?.slots.map((s) => RECIPE_BY_ID[s.recipeId]?.name).filter(Boolean).join(', ') || 'noch keiner';
  const pantry = state.pantry.map((p) => (p.amount ? `${p.name} (${p.amount} ${p.unit})` : p.name)).join(', ') || 'nichts eingetragen';
  const disliked = Object.entries(state.kidVotes)
    .filter(([, v]) => Object.values(v).includes(-1))
    .map(([id]) => RECIPE_BY_ID[id]?.name)
    .filter(Boolean)
    .join(', ');
  return [
    `Haushalt: ${settings.householdSize} Personen, davon ${settings.kids?.length ?? 0} Kinder.`,
    `Wochenbudget für Hauptgerichte: ${settings.weeklyBudget} €. Maximale Kochzeit: ${settings.maxMinutes} Minuten.`,
    `Ernährung: ${settings.diet}. Allergien: ${settings.allergens.join(', ') || 'keine'}. Küchengeräte: ${settings.equipment.join(', ')}.`,
    `Wochenplan: ${plan}.`,
    `Im Vorrat: ${pantry}.`,
    disliked ? `Mögen die Kinder nicht: ${disliked}.` : '',
    'Eingekauft wird meist bei ALDI SÜD, Lidl oder EDEKA.',
  ].filter(Boolean).join('\n');
}

export const SYSTEM_PROMPT = (context: string) => `Du bist der Küchen-Assistent der App „MeinWochenplan" für eine Familie in Deutschland.
Antworte immer auf Deutsch, kurz, freundlich und praktisch. Nutze Aufzählungen statt langer Absätze.
Schlage einfache, günstige, kinderfreundliche Gerichte vor, die mit Discounter-Zutaten funktionieren. Beachte Allergien strikt.
Was du über den Haushalt weißt:
${context}`;

export const RECIPE_JSON_PROMPT = `Schlage genau EIN passendes Rezept vor und antworte NUR mit JSON in dieser Form:
{"name":"…","minutes":25,"portions":4,"protein":"huhn|rind|schwein|fisch|vegetarisch|vegan","carb":"nudeln|kartoffeln|reis|brot|sonstiges","kinder":true,
"ingredients":["500 g Spaghetti","2 Zwiebeln"],"steps":["…","…"]}
Mengen für die angegebenen Portionen, Einheiten g, ml, EL, TL oder Stück. Salz, Pfeffer und Öl weglassen.`;
