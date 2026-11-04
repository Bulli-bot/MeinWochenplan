import { ingredientCost } from '../data/prices';
import { applyPantry } from './pantry';
import { buildShoppingList, isBasic } from './shoppingList';
import type { AppState, MealPlan, Purchase, Settings, ShopPrice } from '../types';

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
export function lastBonPrice(name: string, purchases: Purchase[]): { price: number; deposit: number; store: string; date: string } | null {
  const ws = words(name);
  if (!ws.length) return null;
  const sorted = [...purchases].filter((p) => p.status === 'fertig').sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    const idx = p.items.findIndex((i) => {
      if (!(i.price > 0) || i.category === 'pfand') return false;
      const text = norm(`${i.name} ${i.label ?? ''}`);
      return ws.every((w) => text.includes(w));
    });
    if (idx >= 0) return { price: p.items[idx].price, deposit: depositAfter(p, idx), store: p.store, date: p.date };
  }
  return null;
}

/** Pfand steht auf dem Bon als eigene Zeile direkt unter dem Getränk („Pfand 1,50“). */
function depositAfter(p: Purchase, idx: number): number {
  const next = p.items[idx + 1];
  return next && next.price > 0 && (next.category === 'pfand' || /^pfand/i.test(next.name)) ? next.price : 0;
}

export interface ItemPrice {
  /** Preis je Stück/Packung (ohne Pfand) */
  each: number;
  /** Pfand je Stück/Packung, wenn es auf dem Bon dabeistand */
  deposit: number;
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
  const bon = lastBonPrice(name, purchases);
  // Pfand vom Bon gilt auch, wenn der Preis selbst eingetragen ist (Regalpreis ohne Pfand)
  // Selbst eingetragenes Pfand hat Vorrang (auch 0 = „kein Pfand“)
  const deposit = mine?.deposit !== undefined ? mine.deposit : bon?.deposit ?? 0;
  if (mine) return { each: mine.price, deposit, count, total: (mine.price + deposit) * count, source: 'eigen' };
  if (!bon) return null;
  const day = new Date(bon.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return { each: bon.price, deposit, count, total: (bon.price + deposit) * count, source: 'bon', from: `${bon.store} ${day}`.trim() };
}

export const shopPriceKey = norm;

/**
 * Was beim nächsten Einkauf noch offen ist – Anzahl und Betrag, gerechnet wie in der Einkaufsliste
 * (Plan-Zutaten ohne Vorrat/Grundzutaten/Ausgeblendetes plus eigene Artikel).
 */
export function openShopping(state: AppState, plan: MealPlan, settings: Settings): { count: number; cost: number; unpriced: number; names: string[] } {
  const own = state.shopPrices ?? {};
  const amounts = state.shopAmounts ?? {};
  const hidden = state.shopHidden ?? [];
  const { toBuy } = applyPantry(buildShoppingList(plan, settings.householdSize).filter((i) => !isBasic(i.name, settings.basics)), state.pantry);
  const items = toBuy.filter((i) => !hidden.includes(i.key) && !state.checkedItems.includes(i.key));
  const extras = state.shopExtras.filter((x) => !x.done);
  let cost = 0;
  let unpriced = 0;
  for (const it of items) {
    cost += itemPrice(it.name, amounts[it.key], own, [])?.total
      ?? ingredientCost({ name: it.name, amount: it.amount, unit: it.unit, category: it.category }) ?? 0;
  }
  for (const x of extras) {
    const p = itemPrice(x.name, x.amount, own, state.purchases);
    if (p) cost += p.total;
    else unpriced += 1;
  }
  return { count: items.length + extras.length, cost, unpriced, names: [...extras.map((x) => x.name), ...items.map((i) => i.name)] };
}

// ---------- Preis-Vergleich der Läden ----------

/** „ALDI SÜD“ und „Aldi“ sind derselbe Laden: erstes Wort, klein. */
export const storeKey = (store: string) => norm(store).split(/\s+/)[0] ?? '';

export interface StoreQuote {
  store: string;
  price: number;
  /** €/kg bzw. €/l, wenn auf dem Bon ein Gewicht stand */
  perKg?: number;
  date: string;
}

/**
 * Letzter Preis je Laden für einen Artikel, günstigster zuerst. Plan-Zutaten werden zusätzlich über die
 * beim Bon zugeordnete Zutat gefunden.
 */
export function storeQuotes(name: string, purchases: Purchase[]): StoreQuote[] {
  const ws = words(name);
  if (!ws.length) return [];
  const latest = new Map<string, StoreQuote>();
  for (const p of purchases) {
    if (p.status !== 'fertig' || !p.store.trim()) continue;
    for (const i of p.items) {
      if (!(i.price > 0) || i.category === 'pfand') continue;
      const text = norm(`${i.name} ${i.label ?? ''}`);
      if (!(i.ingredient && norm(i.ingredient) === norm(name)) && !ws.every((w) => text.includes(w))) continue;
      const key = storeKey(p.store);
      const old = latest.get(key);
      if (!old || old.date < p.date) {
        latest.set(key, { store: p.store.trim(), price: i.price, perKg: i.quantity ? i.price / i.quantity : undefined, date: p.date });
      }
    }
  }
  const list = [...latest.values()];
  // Mit Gewicht vergleichbar nur, wenn alle eins haben – sonst Packungspreis
  const byKg = list.length > 1 && list.every((q) => q.perKg);
  return list.sort((a, b) => (byKg ? a.perKg! - b.perKg! : a.price - b.price));
}

/** Günstigster bekannter Laden – für das Aufteilen der Liste. */
export const preferredStore = (name: string, purchases: Purchase[]): string | null => storeQuotes(name, purchases)[0]?.store ?? null;

/**
 * Hinweis, wenn der Artikel zuletzt anderswo teurer gekauft wurde: „bei ALDI 0,30 € günstiger“.
 * Nur bei spürbarem Unterschied (ab 10 Cent und 5 %).
 */
export function cheaperElsewhere(name: string, purchases: Purchase[]): { store: string; saving: number } | null {
  const quotes = storeQuotes(name, purchases);
  if (quotes.length < 2) return null;
  const last = [...quotes].sort((a, b) => b.date.localeCompare(a.date))[0];
  const best = quotes[0];
  if (storeKey(best.store) === storeKey(last.store)) return null;
  const byKg = quotes.every((q) => q.perKg);
  // Ersparnis in Packungspreis des letzten Kaufs umrechnen
  const saving = byKg ? (last.perKg! - best.perKg!) * (last.price / last.perKg!) : last.price - best.price;
  if (saving < 0.1 || saving / last.price < 0.05) return null;
  return { store: best.store, saving };
}

// ---------- Preistrend ----------

/**
 * Preisänderung eines Artikels: letzter Bon gegen den Bon davor (gleiches Wortmuster wie lastBonPrice).
 * null, wenn es keine zwei Bons mit dem Artikel gibt oder der Preis gleich geblieben ist.
 */
export function priceTrend(name: string, purchases: Purchase[]): { now: number; before: number; diff: number; store: string } | null {
  const ws = words(name);
  if (!ws.length) return null;
  const hits: { price: number; store: string; date: string }[] = [];
  const sorted = [...purchases].filter((p) => p.status === 'fertig').sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    const it = p.items.find((i) => i.price > 0 && i.category !== 'pfand' && ws.every((w) => norm(`${i.name} ${i.label ?? ''}`).includes(w)));
    if (it) hits.push({ price: it.price, store: p.store, date: p.date });
    if (hits.length === 2) break;
  }
  if (hits.length < 2) return null;
  const diff = Math.round((hits[0].price - hits[1].price) * 100) / 100;
  return diff ? { now: hits[0].price, before: hits[1].price, diff, store: hits[0].store } : null;
}
