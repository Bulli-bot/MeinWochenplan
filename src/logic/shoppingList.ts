import { RECIPE_BY_ID } from '../data/recipes';
import type { Category, MealPlan, Unit } from '../types';

export interface ShoppingItem {
  key: string;
  name: string;
  amount: number;
  unit: Unit;
  category: Category;
  recipes: string[];
}

export const CATEGORY_ORDER: Category[] = [
  'Obst & Gemüse', 'Fleisch & Fisch', 'Kühlregal', 'Brot & Backwaren', 'Tiefkühl', 'Vorrat', 'Gewürze & Saucen',
];

/** Auf handelsübliche Schritte runden, damit die Liste wie ein Einkaufszettel aussieht. */
function roundForShop(amount: number, unit: Unit): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return amount <= 100 ? Math.ceil(amount / 25) * 25 : Math.ceil(amount / 50) * 50;
    case 'Stück':
      return Math.max(1, Math.ceil(amount));
    default:
      return Math.ceil(amount);
  }
}

export function buildShoppingList(plan: MealPlan, householdSize: number): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const slot of plan.slots) {
    const recipe = RECIPE_BY_ID[slot.recipeId];
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const key = `${ing.name.toLowerCase()}|${ing.unit}`;
      const existing = items.get(key);
      const amount = ing.amount * householdSize;
      if (existing) {
        existing.amount += amount;
        if (!existing.recipes.includes(recipe.name)) existing.recipes.push(recipe.name);
      } else {
        items.set(key, { key, name: ing.name, amount, unit: ing.unit, category: ing.category, recipes: [recipe.name] });
      }
    }
  }
  return [...items.values()]
    .map((it) => ({ ...it, amount: roundForShop(it.amount, it.unit) }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name, 'de'));
}

export function formatAmount(amount: number, unit: Unit): string {
  if (unit === 'g' && amount >= 1000) return `${(amount / 1000).toLocaleString('de-DE')} kg`;
  if (unit === 'ml' && amount >= 1000) return `${(amount / 1000).toLocaleString('de-DE')} l`;
  return `${amount.toLocaleString('de-DE')} ${unit}`;
}

export function shoppingListAsText(items: ShoppingItem[]): string {
  const lines: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const inCat = items.filter((i) => i.category === cat);
    if (!inCat.length) continue;
    lines.push(cat.toUpperCase());
    for (const it of inCat) lines.push(`- ${formatAmount(it.amount, it.unit)} ${it.name}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * Format für Bring!: ein Artikel pro Zeile, Name zuerst (damit Bring! sein Artikel-Icon findet),
 * keine Überschriften, keine Kommas – Bring! trennt beim Einfügen an Zeilenumbrüchen und Kommas.
 */
export function shoppingListForBring(items: ShoppingItem[]): string {
  return CATEGORY_ORDER.flatMap((cat) => items.filter((i) => i.category === cat))
    .map((it) => `${it.name.replace(/,/g, ' ')} ${it.amount} ${it.unit}`)
    .join('\n');
}
