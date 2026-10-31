import { priceFor } from '../data/prices';
import { knownIngredients } from '../data/recipes';
import type { Category, Ingredient, Unit } from '../types';
import { matchIngredient } from './receipt';

const UNIT_MAP: [RegExp, Unit, number][] = [
  [/^kg$/i, 'g', 1000],
  [/^g(r|ramm)?$/i, 'g', 1],
  [/^l(iter)?$/i, 'ml', 1000],
  [/^ml$/i, 'ml', 1],
  [/^el$|^essl/i, 'EL', 1],
  [/^tl$|^teel/i, 'TL', 1],
  [/^(stk|stück|st|pck|päckchen|packung|pkg|dose|dosen|becher|glas|bund|zehe|zehen|scheibe|scheiben|knolle|kopf|prise)\.?$/i, 'Stück', 1],
];

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** Zutatenname auf einen bekannten Namen (mit Preis) abbilden, z. B. „Zwiebeln, gewürfelt" → „Zwiebel". */
export function matchKnownName(raw: string): { name: string; category: Category } {
  const known = knownIngredients();
  const clean = raw.replace(/\(.*?\)/g, '').split(',')[0].trim();
  const lower = clean.toLowerCase();
  for (const [name, category] of known) if (name.toLowerCase() === lower) return { name, category };
  // Plural/Wortanfang: „Zwiebeln" → „Zwiebel", „Kartoffeln, festkochend" → „Kartoffeln"
  let best: { name: string; category: Category } | null = null;
  for (const [name, category] of known) {
    const n = name.toLowerCase();
    if (lower.startsWith(n) || n.startsWith(lower) || lower.split(/\s+/).includes(n)) {
      if (!best || name.length > best.name.length) best = { name, category };
    }
  }
  if (best) return best;
  // Umgangssprache wie „Gehacktes" oder „Sahne" über dieselbe Zuordnung wie beim Kassenbon
  const alias = matchIngredient(clean);
  if (alias && known.has(alias)) return { name: alias, category: known.get(alias)! };
  return { name: clean || raw.trim(), category: 'Vorrat' };
}

/** „500 g Spaghetti" bzw. „2 Zwiebeln" → Zutat pro Portion. Null für leere Zeilen. */
export function parseIngredientLine(line: string, portions: number): Ingredient | null {
  const text = line.trim().replace(/^[-•*]\s*/, '');
  if (!text) return null;
  const m = text.match(/^([\d.,/½¼¾⅓⅔\s-]*\d[\d.,/]*|[½¼¾⅓⅔])\s*([A-Za-zÄÖÜäöüß.]+)?\s+(.*)$/);
  let amount = 1;
  let unit: Unit = 'Stück';
  let rest = text;
  if (m) {
    const numText = m[1].trim().split(/\s*-\s*/).pop()!; // „2-3" → 3
    amount = FRACTIONS[numText] ?? (numText.includes('/') ? Number(numText.split('/')[0]) / Number(numText.split('/')[1]) : parseFloat(numText.replace(',', '.')));
    const unitHit = m[2] ? UNIT_MAP.find(([re]) => re.test(m[2]!)) : undefined;
    if (unitHit) {
      unit = unitHit[1];
      amount *= unitHit[2];
      rest = m[3];
    } else {
      rest = `${m[2] ?? ''} ${m[3]}`.trim();
    }
  } else {
    // „Salz und Pfeffer", „etwas Öl" → Grundzutat, im Pauschalbetrag enthalten
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0) amount = 1;
  if (/^(salz|pfeffer|wasser|muskat|majoran|öl\b|bratöl|speiseöl|etwas)/i.test(rest)) return null;
  const { name, category } = matchKnownName(rest);
  const per = Math.round((amount / Math.max(1, portions)) * 100) / 100;
  return { name, amount: per, unit, category };
}

/** Zutaten ohne Preis – fürs Formular als Hinweis. */
export const unpricedNames = (ings: Ingredient[]) => ings.filter((i) => !priceFor(i.name)).map((i) => i.name);
