/** Zugriff auf pc-helfer.js (läuft nur auf dem PC unter 127.0.0.1:8093). */
const BASE = 'http://127.0.0.1:8093';

async function call<T>(path: string, body?: unknown, timeoutMs = 180000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error('PC-Helfer nicht erreichbar. Am PC „PC-Helfer starten.cmd" doppelklicken (geht nur am PC, nicht am Handy).');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data as T;
}

export interface ReceiptResult {
  model: string;
  laden: string;
  datum: string;
  summe: number | null;
  artikel: { name: string; preis: number; kg: number | null }[];
}

export interface ImportedRecipe {
  name: string;
  portions: number;
  ingredients: string[];
  steps: string[];
  minutes: number;
  source: string;
}

export const readReceipt = (image: string) => call<ReceiptResult>('/bon', { image });
export const importRecipe = (url: string) => call<ImportedRecipe>('/import', { url }, 30000);
export const helperStatus = () => call<{ ok: boolean; ollama: boolean; visionModel: string | null }>('/status', undefined, 5000);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export const helperChat = (body: { system: string; messages: ChatMessage[]; json?: boolean }) =>
  call<{ text: string; model: string }>('/ai', body, 180000);

/** Foto mit eigener Frage lesen (Bildmodell) – Antwort als JSON-Text */
export const helperImage = (image: string, prompt: string) => call<{ text: string; model: string }>('/bild', { image, prompt }, 180000);
