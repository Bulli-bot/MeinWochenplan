import type { Purchase, ShopPrice } from '../types';

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Anzahl aus einer Mengenangabe: „3 Packungen“ → 3, „2x“ → 2. Gewichte und Volumen
 * („500 g“, „1,5 l“) zählen als ein Artikel, ebenso eine leere Angabe.
 */
export function countFromAmount(amount?: string): number {
  const m = amount?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(\S*)/);
  if (!m) return 1;
  if (/^(g|kg|gramm|ml|l|liter|el|tl)$/i.test(m[2])) return 1;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Wörter eines Artikelnamens, die auf dem Bon vorkommen müssen (kurze Füllwörter zählen nicht). */
const words = (name: string) => norm(name).split(/[^a-zäöüß0-9]+/).filter((w) => w.length >= 3);

/**
 * Zuletzt bezahlter Preis vom Bon: Alle Wörter des Namens müssen im Bon-Text (oder dem
 * verständlichen Namen) stehen – „Eistee“ findet „G&G Eistee 6x1,5l“, „stilles Wasser“
 * aber nicht „Gerol.Med.“.
 */
export function lastBonPrice(name: string, purchases: Purchase[]): { price: number; store: string; date: string } | null {
  const ws = words(name);
  if (!ws.length) return null;
  const sorted = [...purchases].filter((p) => p.status === 'fertig').sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    const hit = p.items.find((i) => {
      if (!(i.price > 0)) return false;
      const text = norm(`${i.name} ${i.label ?? ''}`);
      return ws.every((w) => text.includes(w));
    });
    if (hit) return { price: hit.price, store: p.store, date: p.date };
  }
  return null;
}

export interface ItemPrice {
  /** Preis je Stück/Packung */
  each: number;
  count: number;
  total: number;
  source: 'eigen' | 'bon';
  /** z. B. „trinkgut 26.10.“ */
  from?: string;
}

/** Preis für einen Einkaufsartikel: eigener Preis vor dem letzten Bon. */
export function itemPrice(name: string, amount: string | undefined, own: Record<string, ShopPrice>, purchases: Purchase[]): ItemPrice | null {
  const count = countFromAmount(amount);
  const mine = own[norm(name)];
  if (mine) return { each: mine.price, count, total: mine.price * count, source: 'eigen' };
  const bon = lastBonPrice(name, purchases);
  if (!bon) return null;
  const day = new Date(bon.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return { each: bon.price, count, total: bon.price * count, source: 'bon', from: `${bon.store} ${day}`.trim() };
}

export const shopPriceKey = norm;
