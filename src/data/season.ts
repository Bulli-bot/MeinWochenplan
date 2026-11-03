import type { Recipe } from '../types';

/**
 * Saisonkalender für Obst und Gemüse aus Deutschland (Freiland/Lager), grob nach Monat.
 * Index 0 = Januar. Bewusst einfach: Wörter, die im Zutatennamen vorkommen.
 */
const SEASON: [RegExp, number[]][] = [
  [/kürbis/i, [8, 9, 10, 11]],
  [/lauch|porree/i, [0, 1, 2, 8, 9, 10, 11]],
  [/grünkohl/i, [0, 1, 10, 11]],
  [/rosenkohl/i, [0, 1, 9, 10, 11]],
  [/weißkohl|rotkohl|wirsing|kohl\b|sauerkraut/i, [0, 1, 2, 7, 8, 9, 10, 11]],
  [/karotte|möhre/i, [0, 1, 2, 5, 6, 7, 8, 9, 10, 11]],
  [/kartoffel/i, [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11]],
  [/zwiebel/i, [0, 1, 2, 6, 7, 8, 9, 10, 11]],
  [/rote bete|rote beete/i, [0, 1, 2, 6, 7, 8, 9, 10, 11]],
  [/pastinake|steckrübe|knollensellerie|sellerie/i, [0, 1, 2, 8, 9, 10, 11]],
  [/feldsalat/i, [0, 1, 2, 9, 10, 11]],
  [/spargel/i, [3, 4, 5]],
  [/erdbeer/i, [4, 5, 6]],
  [/rhabarber/i, [3, 4, 5]],
  [/zucchini/i, [5, 6, 7, 8, 9]],
  [/tomate/i, [6, 7, 8, 9]],
  [/gurke/i, [5, 6, 7, 8, 9]],
  [/paprika/i, [6, 7, 8, 9]],
  [/bohne/i, [6, 7, 8, 9]],
  [/erbse/i, [5, 6, 7]],
  [/blumenkohl|brokkoli/i, [5, 6, 7, 8, 9, 10]],
  [/kohlrabi/i, [4, 5, 6, 7, 8, 9]],
  [/spinat/i, [3, 4, 5, 8, 9, 10]],
  [/apfel|äpfel/i, [0, 1, 2, 7, 8, 9, 10, 11]],
  [/birne/i, [7, 8, 9, 10]],
  [/pflaume|zwetschge/i, [7, 8, 9]],
  [/pilz|champignon/i, [8, 9, 10]],
];

/** Liegt die Zutat gerade in der Saison? */
export function inSeason(name: string, month = new Date().getMonth()): boolean {
  return SEASON.some(([re, months]) => re.test(name) && months.includes(month));
}

/** Saisonale Obst-/Gemüse-Zutaten eines Rezepts (Grundzutaten wie Zwiebel und Kartoffel zählen nicht extra). */
export function seasonalIngredients(recipe: Recipe, month = new Date().getMonth()): string[] {
  return [...new Set(recipe.ingredients
    .filter((i) => i.category === 'Obst & Gemüse' && !/zwiebel|kartoffel|knoblauch/i.test(i.name) && inSeason(i.name, month))
    .map((i) => i.name))];
}
