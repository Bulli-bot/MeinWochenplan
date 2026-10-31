import { GRAMS_PER_PIECE, priceFor } from '../data/prices';
import type { BonName, Purchase, PurchaseItem, SpendCategory, UserPrice } from '../types';

/** Bon-Kürzel → Zutat aus den Rezepten. Reihenfolge zählt: Spezielles vor Allgemeinem. */
const ALIASES: [RegExp, string][] = [
  [/pizzateig/i, 'Pizzateig'],
  [/paniermehl/i, 'Paniermehl'],
  [/pass(\.|iert)/i, 'Passierte Tomaten'],
  [/dattel|cherry|cocktailtom/i, 'Cherrytomaten'],
  [/tomatenmark/i, 'Tomatenmark'],
  [/gehackte tom|tomaten stück/i, 'Gehackte Tomaten'],
  [/tomate/i, 'Tomate'],
  [/hackfl|hackfleisch|gemischtes hack|gehacktes/i, 'Hackfleisch (gemischt)'],
  [/rinderhack/i, 'Rinderhack'],
  [/h(ä|ae)hn|haehn|huhn|hühn|geflügel|chicken/i, 'Hähnchenbrust'],
  [/pute/i, 'Putenbrust'],
  [/schinkenfl|fleischwurst/i, 'Fleischwurst'],
  [/hinterschink|kochschink|schinke|schinken/i, 'Kochschinken'],
  [/speck/i, 'Speckwürfel'],
  [/würstchen|wiener/i, 'Wiener Würstchen'],
  [/schnitzel/i, 'Schweineschnitzel'],
  [/lachs/i, 'Lachsfilet'],
  [/fischst/i, 'Fischstäbchen'],
  [/creme fra|crème fra|creme fr/i, 'Crème fraîche'],
  [/schmand/i, 'Schmand'],
  [/sahne|cuisine/i, 'Kochsahne'],
  [/schmelzk/i, 'Schmelzkäse'],
  [/salzlake|feta|hirtenk/i, 'Feta'],
  [/mozzarella/i, 'Mozzarella (gerieben)'],
  [/gouda/i, 'Gouda'],
  [/parmes|grana/i, 'Parmesan'],
  [/frischk/i, 'Frischkäse'],
  [/quark/i, 'Kräuterquark'],
  [/joghurt/i, 'Joghurt'],
  [/milch(?!reis)/i, 'Milch'],
  [/markenbutter|butter/i, 'Butter'],
  [/\beier?\b|freiland|bodenhalt/i, 'Eier'],
  [/tortell|gnocchi/i, 'Tortellini'],
  [/spätzle/i, 'Spätzle (Kühlregal)'],
  [/flammkuchen/i, 'Flammkuchenteig'],
  [/spaghetti/i, 'Spaghetti'],
  [/makkaroni|maccheroni/i, 'Makkaroni'],
  [/penne/i, 'Penne'],
  [/fusilli/i, 'Fusilli'],
  [/nudel|bandnud/i, 'Bandnudeln'],
  [/basmati|reis(?!e)/i, 'Basmatireis'],
  [/kartoff/i, 'Kartoffeln'],
  [/zwiebel/i, 'Zwiebel'],
  [/knobl/i, 'Knoblauch'],
  [/karotte|möhre/i, 'Möhre'],
  [/paprika/i, 'Paprika'],
  [/lauch|porree/i, 'Lauch'],
  [/brokkoli|broccoli/i, 'Brokkoli'],
  [/zucchini/i, 'Zucchini'],
  [/gurke/i, 'Gurke'],
  [/champign|pilz/i, 'Champignons'],
  [/mais/i, 'Mais'],
  [/erbsen/i, 'Erbsen'],
  [/brühe|bouillon/i, 'Gemüsebrühe'],
  [/baguette|bag\b|steinofenbag/i, 'Baguette'],
  [/toast|sandwich/i, 'Toastbrot'],
  [/wraps|tortilla/i, 'Tortilla-Wraps'],
  [/pommes/i, 'Pommes frites'],
  [/apfelmus/i, 'Apfelmus'],
  [/mehl/i, 'Mehl'],
];

const VERZICHTBAR = /chips|salzstang|flips|energy|cola|limo|eistee|schoko|gummi|bonbon|keks|riegel|chips|bier|wein|sekt|eis\b|lasagne|fertig|tiefkühlpizza|snack|popcorn|kaugummi|zigar|tabak/i;
const GRUND = /topa|toiletten|klopapier|küchenroll|taschent|spül|wasch|zahnp|duschgel|shampoo|windel|brötchen|brot|toast|sandwich|banane|apfel|obst|margarine|kaffee|tee\b|wasser|zucker|salz|öl\b|knotenbeutel|tüte|tragetasche/i;

export function matchIngredient(name: string): string | undefined {
  return ALIASES.find(([re]) => re.test(name))?.[1];
}

/** Kategorie für einen Bon-Artikel. `planIngredients` = Zutaten der aktuellen Woche. */
export function classify(name: string, planIngredients: Set<string>): { category: SpendCategory; ingredient?: string } {
  if (/pfand/i.test(name)) return { category: 'pfand' };
  if (VERZICHTBAR.test(name)) return { category: 'verzichtbar' };
  const ingredient = matchIngredient(name);
  if (ingredient && planIngredients.has(ingredient)) return { category: 'plan', ingredient };
  if (GRUND.test(name)) return { category: 'grund', ingredient };
  return { category: 'extra', ingredient };
}

/** Packungsgröße aus dem Bon-Text, z. B. „Spaghetti 500g", „Kartoffeln fk2.5kg", „H-Sahne 200g". */
export function packageSize(name: string): { amount: number; unit: 'kg' | 'l' } | null {
  const m = name.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === 'kg') return { amount: n, unit: 'kg' };
  if (u === 'g') return { amount: n / 1000, unit: 'kg' };
  if (u === 'l') return { amount: n, unit: 'l' };
  return { amount: n / 1000, unit: 'l' };
}

/**
 * Aus einer Bon-Zeile einen Zutatenpreis ableiten – nur wenn Menge bzw. Gewicht bekannt ist
 * oder die Zutat ohnehin pro Stück gerechnet wird. Sonst null (lieber kein Preis als ein falscher).
 */
export function learnPrice(item: PurchaseItem, store: string, date: string): [string, UserPrice] | null {
  if (!item.ingredient || item.price <= 0) return null;
  const learned = rawLearn(item, store, date);
  if (!learned) return null;
  // Mehr als Faktor 2,5 Abweichung ist fast immer ein Lesefehler (z. B. „4 x 0,59" als ein Stück)
  const current = priceFor(item.ingredient);
  if (current && current.per === learned[1].per && (learned[1].price > current.price * 2.5 || learned[1].price < current.price / 2.5)) return null;
  return learned;
}

function rawLearn(item: PurchaseItem, store: string, date: string): [string, UserPrice] | null {
  if (!item.ingredient) return null;
  const current = priceFor(item.ingredient);
  const product = `${store} ${item.name}, ${item.price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;
  const size = item.quantity ? { amount: item.quantity, unit: 'kg' as const } : packageSize(item.name);
  if (size) {
    const perUnit = item.price / size.amount;
    if (current?.per === 'Stück' && GRAMS_PER_PIECE[item.ingredient] && size.unit === 'kg') {
      return [item.ingredient, { price: round(perUnit * GRAMS_PER_PIECE[item.ingredient] / 1000), per: 'Stück', product, date }];
    }
    if (current && current.per !== size.unit && current.per !== 'Stück') return null;
    return [item.ingredient, { price: round(perUnit), per: size.unit, product, date }];
  }
  if (current?.per === 'Stück' && /stk|stück/i.test(item.name)) {
    return [item.ingredient, { price: round(item.price), per: 'Stück', product, date }];
  }
  return null;
}

const round = (n: number) => Math.round(n * 100) / 100;

export const CATEGORY_LABEL: Record<SpendCategory, string> = {
  plan: 'Wochenplan', grund: 'Grundbedarf', extra: 'Nicht im Plan', verzichtbar: 'Verzichtbar', pfand: 'Pfand',
};
export const CATEGORY_ORDER: SpendCategory[] = ['plan', 'grund', 'extra', 'verzichtbar', 'pfand'];

/** Montag der Woche als JJJJ-MM-TT – Schlüssel für den Ausgaben-Verlauf. */
export function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumBy(purchases: Purchase[]): Record<SpendCategory, number> {
  const out: Record<SpendCategory, number> = { plan: 0, grund: 0, extra: 0, verzichtbar: 0, pfand: 0 };
  for (const p of purchases) {
    const itemsSum = p.items.reduce((s, i) => s + i.price, 0);
    for (const i of p.items) out[i.category] += i.price;
    // Betrag ohne Einzelposten (manuell eingetragen) zählt als „nicht zugeordnet" → Nicht im Plan
    if (p.items.length === 0) out.extra += p.total;
    else if (Math.abs(p.total - itemsSum) > 0.05) out.extra += p.total - itemsSum;
  }
  return out;
}

/** Schlüssel für gelernte Bon-Kürzel: Kleinbuchstaben, einfache Leerzeichen */
export const bonKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

/** Bon-Zeile mit gelernten Namen und Kategorien anreichern; unbekannt bleibt, was die App nicht zuordnen kann. */
export function classifyWithMemory(name: string, planIngredients: Set<string>, bonNames: Record<string, BonName>): Pick<PurchaseItem, 'category' | 'ingredient' | 'label' | 'known'> {
  const learned = bonNames[bonKey(name)];
  if (learned) {
    const ingredient = learned.ingredient ?? matchIngredient(learned.name);
    const category = ingredient && planIngredients.has(ingredient) ? 'plan' : learned.category === 'plan' && !ingredient ? 'extra' : learned.category;
    return { label: learned.name, category, ingredient, known: true };
  }
  return classify(name, planIngredients);
}

/** Zeilen, bei denen die App nachfragen sollte, was gemeint ist */
export const isUnclear = (it: PurchaseItem) => !it.known && !it.label && !it.ingredient && it.category !== 'pfand' && !/^nicht erkannt/i.test(it.name);
