import type { Carb, MealPlan, Protein, Recipe } from '../types';

const PROTEIN: Record<Protein, string> = { huhn: 'Geflügel', rind: 'Rind', schwein: 'Schwein', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan' };
const CARB: Record<Carb, string> = { reis: 'Reis', nudeln: 'Nudeln', kartoffeln: 'Kartoffeln', brot: 'Brot', sonstiges: 'Sonstiges' };

export interface WeekBalance {
  /** z. B. „3× Fleisch“, „1× Fisch“ */
  parts: string[];
  /** Hinweise bei Einseitigkeit */
  hints: string[];
}

/**
 * Ausgewogenheit der Woche aus Eiweiß-Art und Beilage – die Rezepte haben keine Nährwerte,
 * aber das reicht für eine grobe Tendenz. Reste-Tage zählen nicht doppelt.
 */
export function weekBalance(plan: MealPlan, recipes: Record<string, Recipe>): WeekBalance {
  const list = plan.slots.filter((s) => !s.kind).map((s) => recipes[s.recipeId]).filter((r): r is Recipe => !!r);
  if (!list.length) return { parts: [], hints: [] };
  const meat = list.filter((r) => r.protein === 'huhn' || r.protein === 'rind' || r.protein === 'schwein').length;
  const fish = list.filter((r) => r.protein === 'fisch').length;
  const veg = list.filter((r) => r.protein === 'vegetarisch' || r.protein === 'vegan').length;
  const carbs = new Map<Carb, number>();
  for (const r of list) carbs.set(r.carb, (carbs.get(r.carb) ?? 0) + 1);
  const red = list.filter((r) => r.protein === 'rind' || r.protein === 'schwein').length;

  const parts = [`${meat}× Fleisch`, `${fish}× Fisch`, `${veg}× vegetarisch`];
  for (const [c, n] of [...carbs.entries()].sort((a, b) => b[1] - a[1])) if (c !== 'sonstiges') parts.push(`${n}× ${CARB[c]}`);

  const hints: string[] = [];
  if (!fish && list.length >= 5) hints.push('Kein Fisch diese Woche – einmal pro Woche ist eine gute Faustregel.');
  if (meat >= 5) hints.push(`${meat}× Fleisch – ein vegetarischer Tag würde gut tun und spart Geld.`);
  if (red >= 4) hints.push(`${red}× Rind/Schwein – lieber öfter Geflügel oder Fisch.`);
  for (const [c, n] of carbs) if (c !== 'sonstiges' && n >= 4) hints.push(`${n}× ${CARB[c]} – etwas mehr Abwechslung bei den Beilagen?`);
  // Höchstens zwei Hinweise – sonst wird es belehrend
  return { parts, hints: hints.slice(0, 2) };
}

export const proteinLabel = (p: Protein) => PROTEIN[p];
