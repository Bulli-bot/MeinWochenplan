import type { PantryItem } from '../types';
import type { ShoppingItem } from './shoppingList';

const norm = (s: string) => s.trim().toLowerCase();

export function findPantry(pantry: PantryItem[], name: string): PantryItem | undefined {
  return pantry.find((p) => norm(p.name) === norm(name));
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
    if (!p) toBuy.push(it);
    else if (p.amount === undefined || p.unit !== it.unit || p.amount >= it.amount) fromPantry.push(it);
    else {
      fromPantry.push({ ...it, amount: p.amount });
      toBuy.push({ ...it, amount: it.amount - p.amount });
    }
  }
  return { toBuy, fromPantry };
}
