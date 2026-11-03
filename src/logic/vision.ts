import { askAI, askImage } from '../ai';
import type { PantryItem, Recipe } from '../types';
import { isBasic } from './shoppingList';
import type { Basic } from '../types';

/** Rezept, wie es aus Foto oder Text kommt (Zutaten noch als Textzeilen) */
export interface RawRecipe {
  name: string;
  portionen?: number;
  minuten?: number;
  zutaten: string[];
  schritte: string[];
}

const RECIPE_JSON = `Antworte nur mit JSON:
{"name":"","portionen":4,"minuten":30,"zutaten":["500 g Spaghetti","1 Zwiebel"],"schritte":["…"]}
Zutaten mit Menge und Einheit auf Deutsch, eine pro Eintrag. Schritte kurz und vollständig. Gibt es kein Rezept, antworte {"name":"","zutaten":[],"schritte":[]}.`;

const clean = (r: Partial<RawRecipe>): RawRecipe => {
  if (!r.name || !r.zutaten?.length) throw new Error('Kein Rezept erkannt – bitte deutlicher fotografieren oder den Text ergänzen.');
  return {
    name: String(r.name).trim(),
    portionen: Number(r.portionen) || 4,
    minuten: Number(r.minuten) || 30,
    zutaten: r.zutaten.map((z) => String(z).trim()).filter(Boolean),
    schritte: (r.schritte ?? []).map((z) => String(z).trim()).filter(Boolean),
  };
};

/** Foto vom Kochbuch oder Zettel → Rezept */
export async function recipeFromPhoto(image: string): Promise<RawRecipe> {
  return clean(await askImage<Partial<RawRecipe>>(image, `Lies das Rezept auf diesem Foto (Kochbuch, Zeitschrift oder Zettel). ${RECIPE_JSON}`));
}

/** Freier Text (Video-Beschreibung, diktiert, abgetippt) → Rezept */
export async function recipeFromText(text: string): Promise<RawRecipe> {
  const r = await askAI(`Mach aus dem Text des Nutzers ein Rezept. ${RECIPE_JSON}`, [{ role: 'user', content: text.slice(0, 6000) }], true);
  try {
    return clean(JSON.parse(r.text.replace(/^```(?:json)?|```$/g, '').trim()));
  } catch (e) {
    throw e instanceof SyntaxError ? new Error('Die KI hat kein lesbares Rezept geliefert.') : e;
  }
}

export interface FridgeItem { name: string; menge?: string; sicher: boolean }

/** Foto vom Kühlschrank/Vorratsschrank → erkannte Lebensmittel */
export async function fridgeFromPhoto(image: string): Promise<FridgeItem[]> {
  const r = await askImage<{ lebensmittel?: { name?: string; menge?: string; sicher?: boolean }[] }>(image,
    `Welche Lebensmittel siehst du auf diesem Foto (Kühlschrank oder Vorratsschrank)? Antworte nur mit JSON:
{"lebensmittel":[{"name":"Milch","menge":"1 l","sicher":true}]}
Einfache deutsche Namen wie auf einem Einkaufszettel (z. B. „Feta“, „Lauch“, „Joghurt“), keine Marken. „sicher“ = false, wenn du raten musst.`);
  return (r.lebensmittel ?? [])
    .filter((x) => x.name && String(x.name).trim())
    .map((x) => ({ name: String(x.name).trim(), menge: x.menge ? String(x.menge) : undefined, sicher: x.sicher !== false }));
}

/** Was sich jetzt aus dem Vorrat kochen lässt: möglichst wenig fehlt (Grundzutaten zählen als da). */
export function cookableNow(recipes: Recipe[], pantry: PantryItem[], basics: Basic[] | undefined, limit = 3): { recipe: Recipe; missing: string[] }[] {
  const have = new Set(pantry.map((p) => p.name.trim().toLowerCase()));
  return recipes
    .map((recipe) => ({
      recipe,
      missing: [...new Set(recipe.ingredients.filter((i) => !isBasic(i.name, basics) && !have.has(i.name.toLowerCase())).map((i) => i.name))],
    }))
    .filter((x) => x.missing.length <= 2)
    .sort((a, b) => a.missing.length - b.missing.length || a.recipe.minutes - b.recipe.minutes)
    .slice(0, limit);
}
