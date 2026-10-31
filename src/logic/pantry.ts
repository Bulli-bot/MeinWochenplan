import type { PantryItem } from '../types';
import type { ShoppingItem } from './shoppingList';

const norm = (s: string) => s.trim().toLowerCase();
const DAY = 86400000;

const midnight = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/**
 * Aktuelle Menge: Bei Vorrat mit Tagesverbrauch wird seit dem Eintragen mitgerechnet
 * (12 Flaschen, 3 am Tag → nach 3 Tagen noch 3). Ohne Verbrauch bleibt die Menge stehen.
 */
export function currentAmount(p: PantryItem, now = new Date()): number | undefined {
  if (p.amount === undefined) return undefined;
  if (!p.perDay || !p.since) return p.amount;
  const days = Math.max(0, Math.round((midnight(now) - midnight(new Date(p.since))) / DAY));
  return Math.max(0, Math.round((p.amount - p.perDay * days) * 100) / 100);
}

/** Wie viele Tage es noch reicht – null, wenn kein Verbrauch eingetragen ist. */
export function daysLeft(p: PantryItem, now = new Date()): number | null {
  const left = currentAmount(p, now);
  if (left === undefined || !p.perDay) return null;
  return Math.floor(left / p.perDay);
}

/** Datum, an dem es leer ist */
export function emptyOn(p: PantryItem, now = new Date()): Date | null {
  const d = daysLeft(p, now);
  if (d === null) return null;
  const x = new Date(midnight(now));
  x.setDate(x.getDate() + d);
  return x;
}

/** Alles, was bald leer ist (Erinnerung „remindDays“ Tage vorher, Standard 1) – das Knappste zuerst. */
export function dueSoon(pantry: PantryItem[], now = new Date()): { item: PantryItem; left: number; days: number }[] {
  return pantry
    .map((item) => ({ item, left: currentAmount(item, now) ?? 0, days: daysLeft(item, now) }))
    .filter((x): x is { item: PantryItem; left: number; days: number } => x.days !== null && x.days <= (x.item.remindDays ?? 1))
    .sort((a, b) => a.days - b.days);
}

export function findPantry(pantry: PantryItem[], name: string): PantryItem | undefined {
  const p = pantry.find((x) => norm(x.name) === norm(name));
  // Rechnerisch aufgebraucht = nicht mehr im Vorrat
  return p && currentAmount(p) === 0 ? undefined : p;
}

/**
 * Vorrat von der Einkaufsliste abziehen. Vorrat ohne Menge = genug da; mit Menge in derselben
 * Einheit wird nur der Rest gekauft.
 */
export function applyPantry(items: ShoppingItem[], pantry: PantryItem[]): { toBuy: ShoppingItem[]; fromPantry: ShoppingItem[] } {
  const toBuy: ShoppingItem[] = [];
  const fromPantry: ShoppingItem[] = [];
  for (const it of items) {
    const p = findPantry(pantry, it.name);
    const amount = p ? currentAmount(p) : undefined;
    if (!p) toBuy.push(it);
    else if (amount === undefined || p.unit !== it.unit || amount >= it.amount) fromPantry.push(it);
    else {
      fromPantry.push({ ...it, amount });
      toBuy.push({ ...it, amount: it.amount - amount });
    }
  }
  return { toBuy, fromPantry };
}
