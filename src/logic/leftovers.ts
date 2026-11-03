import type { PantryItem, Recipe } from '../types';
import { currentAmount } from './pantry';

const DAY = 86400000;
const norm = (s: string) => s.trim().toLowerCase();

const midnight = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/** Tage bis „haltbar bis“ (0 = heute, negativ = abgelaufen); null ohne Datum. */
export function daysToUseBy(p: PantryItem, now = new Date()): number | null {
  if (!p.useBy) return null;
  return Math.round((midnight(new Date(p.useBy)) - midnight(now)) / DAY);
}

/** Vorrat, der in den nächsten `within` Tagen weg muss – das Dringendste zuerst. */
export function useSoon(pantry: PantryItem[], within = 4, now = new Date()): { item: PantryItem; days: number }[] {
  return pantry
    .filter((p) => currentAmount(p, now) !== 0)
    .map((item) => ({ item, days: daysToUseBy(item, now) }))
    .filter((x): x is { item: PantryItem; days: number } => x.days !== null && x.days <= within)
    .sort((a, b) => a.days - b.days);
}

/** Datum „haltbar bis“ aus Tagen ab heute */
export function useByIn(days: number, now = new Date()): string {
  const d = new Date(midnight(now));
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export interface LeftoverIdea {
  recipe: Recipe;
  /** Zutaten aus dem Vorrat, die bald weg müssen */
  urgent: string[];
  /** Weitere Zutaten, die schon da sind */
  have: string[];
}

/**
 * Gerichte, die Reste aufbrauchen: Erst zählen die Zutaten, die bald ablaufen, dann alles andere aus dem
 * Vorrat. Ohne bald ablaufende Zutat kein Vorschlag.
 */
export function leftoverIdeas(recipes: Recipe[], pantry: PantryItem[], limit = 3, now = new Date()): LeftoverIdea[] {
  const soon = new Set(useSoon(pantry, 4, now).map((x) => norm(x.item.name)));
  if (!soon.size) return [];
  const have = new Set(pantry.filter((p) => currentAmount(p, now) !== 0).map((p) => norm(p.name)));
  return recipes
    .map((recipe) => {
      const names = [...new Set(recipe.ingredients.map((i) => i.name))];
      return {
        recipe,
        urgent: names.filter((n) => soon.has(norm(n))),
        have: names.filter((n) => have.has(norm(n)) && !soon.has(norm(n))),
      };
    })
    .filter((x) => x.urgent.length > 0)
    .sort((a, b) => b.urgent.length - a.urgent.length || b.have.length - a.have.length || a.recipe.minutes - b.recipe.minutes)
    .slice(0, limit);
}
