import { RECIPE_BY_ID } from '../data/recipes';
import type { AppState, PantryItem, Purchase, PurchaseItem, UserPrice } from '../types';
import { dueSoon } from './pantry';
import { learnPrice } from './receipt';
import { buildShoppingList } from './shoppingList';

const norm = (s: string) => s.trim().toLowerCase();
const words = (name: string) => norm(name).split(/[^a-zäöüß0-9]+/).filter((w) => w.length >= 3);

/** Passt eine Bon-Zeile zu einem Artikelnamen? Über die zugeordnete Zutat oder alle Wörter des Namens. */
function matches(name: string, item: PurchaseItem): boolean {
  if (item.ingredient && norm(item.ingredient) === norm(name)) return true;
  const ws = words(name);
  const text = norm(`${item.name} ${item.label ?? ''}`);
  return ws.length > 0 && ws.every((w) => text.includes(w));
}

/**
 * Gekocht → Zutaten im Vorrat abziehen (nur Vorrat mit Menge in derselben Einheit; „genug da“ bleibt).
 * Aufgebrauchtes fliegt aus dem Vorrat.
 */
export function consumeCooked(pantry: PantryItem[], recipeId: string, people: number): { pantry: PantryItem[]; used: string[] } {
  const r = RECIPE_BY_ID[recipeId];
  if (!r) return { pantry, used: [] };
  const used: string[] = [];
  const next: PantryItem[] = [];
  for (const p of pantry) {
    const ing = r.ingredients.find((i) => norm(i.name) === norm(p.name) && i.unit === p.unit);
    if (!ing || p.amount === undefined) {
      next.push(p);
      continue;
    }
    const left = Math.round((p.amount - ing.amount * people) * 100) / 100;
    used.push(p.name);
    if (left > 0) next.push({ ...p, amount: left });
  }
  return { pantry: next, used };
}

/**
 * Bon ausgelesen → gekaufte Artikel auf der Liste abhaken, gezählten Vorrat als „aufgefüllt“ markieren
 * und eindeutige Preise für die Rezepte übernehmen.
 */
export function applyReceipt(state: AppState, purchase: Purchase): { state: AppState; summary: string[] } {
  const items = purchase.items.filter((i) => i.price > 0 && i.category !== 'pfand');
  const summary: string[] = [];

  // Plan-Zutaten abhaken
  const planKeys = state.plan && state.settings
    ? buildShoppingList(state.plan, state.settings.householdSize).filter((it) => items.some((i) => matches(it.name, i))).map((it) => it.key)
    : [];
  const newKeys = planKeys.filter((k) => !state.checkedItems.includes(k));
  // Eigene Artikel abhaken
  let ticked = 0;
  const shopExtras = state.shopExtras.map((x) => {
    if (x.done || !items.some((i) => matches(x.name, i))) return x;
    ticked += 1;
    return { ...x, done: true };
  });
  if (newKeys.length + ticked) summary.push(`${newKeys.length + ticked} Artikel abgehakt`);

  // Vorrat mit Menge auffüllen: die eingetragene Menge gilt ab heute wieder
  let refilled = 0;
  const pantry = state.pantry.map((p) => {
    if (p.amount === undefined || !items.some((i) => matches(p.name, i))) return p;
    refilled += 1;
    return { ...p, since: new Date().toISOString() };
  });
  if (refilled) summary.push(`${refilled} im Vorrat aufgefüllt`);

  // Preise übernehmen (gleiche Prüfung wie beim Knopf „Preise übernehmen“)
  const learned: Record<string, UserPrice> = {};
  for (const it of items) {
    const l = learnPrice(it, purchase.store, purchase.date);
    if (l) learned[l[0]] = l[1];
  }
  const nLearned = Object.keys(learned).length;
  if (nLearned) summary.push(`${nLearned} Preise übernommen`);

  return {
    state: {
      ...state,
      checkedItems: [...state.checkedItems, ...newKeys],
      shopExtras,
      pantry,
      userPrices: { ...state.userPrices, ...learned },
    },
    summary,
  };
}

/** Vorrat mit „automatisch auf die Liste“: was bald leer ist, kommt von selbst auf die Einkaufsliste. */
export function applyAutoList(state: AppState): AppState {
  const due = dueSoon(state.pantry).filter(({ item }) => item.autoList
    // auch abgehakte zählen – sonst käme es bis zum Auffüllen immer wieder
    && !state.shopExtras.some((x) => norm(x.name) === norm(item.name)));
  if (!due.length) return state;
  return {
    ...state,
    shopExtras: [...state.shopExtras, ...due.map(({ item }) => ({
      id: `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: item.name, from: 'vorrat' as const,
    }))],
  };
}
