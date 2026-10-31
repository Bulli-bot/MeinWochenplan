import { RECIPES } from '../data/recipes';
import type { Diet, KidVote, MealPlan, PantryItem, PlanSlot, Protein, Recipe, Settings } from '../types';

export interface PlanContext {
  settings: Settings;
  favourites: string[];
  ratings: Record<string, number>;
  recentRecipeIds: string[];
  kidVotes?: Record<string, Record<string, KidVote>>;
  pantry?: PantryItem[];
}

/** Daumen der Kinder (nur aktuell eingetragene Kinder zählen). */
export function kidTally(recipeId: string, ctx: Pick<PlanContext, 'kidVotes' | 'settings'>): { up: number; down: number } {
  const votes = ctx.kidVotes?.[recipeId] ?? {};
  const kids = ctx.settings.kids ?? [];
  let up = 0;
  let down = 0;
  for (const k of kids) {
    if (votes[k] === 1) up++;
    if (votes[k] === -1) down++;
  }
  return { up, down };
}

const DIET_PROTEINS: Record<Diet, Protein[]> = {
  alles: ['huhn', 'rind', 'schwein', 'fisch', 'vegetarisch', 'vegan'],
  pescetarisch: ['fisch', 'vegetarisch', 'vegan'],
  vegetarisch: ['vegetarisch', 'vegan'],
  vegan: ['vegan'],
};

/** Höchstens so oft dasselbe Fleisch bzw. derselbe Fisch pro Woche. Pflanzliche Gerichte sind nicht begrenzt. */
const MAX_SAME_ANIMAL_PROTEIN = 2;
const ANIMAL_PROTEINS: Protein[] = ['huhn', 'rind', 'schwein', 'fisch'];
const ATTEMPTS = 25;
/** Zufallsanteil pro Versuch – groß genug, dass nicht jede Woche dieselben Lieblingsgerichte gewinnen. */
const JITTER = 4;
/** Beim Tauschen zufällig aus den besten so vielen Kandidaten wählen statt immer den ersten zu nehmen. */
const SWAP_TOP = 8;

/** Beilagen-Grenze wächst mit der Zahl der Kochtage; „locker" erlaubt eine mehr. */
const maxSameCarb = (slots: number, relaxed: boolean) => Math.max(2, Math.ceil(slots / 3)) + (relaxed ? 1 : 0);

export const portionCost = (recipe: Recipe, householdSize: number) => recipe.pricePerPortion * householdSize;

/** Harte Ausschlüsse: Ernährung, Allergene, Küchengeräte, Kochzeit, schlecht bewertet. */
export function eligibleRecipes(ctx: PlanContext): Recipe[] {
  const { settings, ratings } = ctx;
  const allowedProteins = DIET_PROTEINS[settings.diet];
  return RECIPES.filter(
    (r) =>
      allowedProteins.includes(r.protein) &&
      !r.allergens.some((a) => settings.allergens.includes(a)) &&
      r.equipment.every((e) => settings.equipment.includes(e)) &&
      r.minutes <= settings.maxMinutes &&
      (ratings[r.id] ?? 3) > 1 &&
      // Mögen es alle Kinder nicht, kommt es nicht mehr in den Plan.
      !((settings.kids?.length ?? 0) > 0 && kidTally(r.id, ctx).down === settings.kids!.length),
  );
}

/** Weiche Bewertung: Vorlieben belohnen, Wiederholungen bestrafen. */
function baseScore(recipe: Recipe, ctx: PlanContext): number {
  const { settings, favourites, ratings, recentRecipeIds } = ctx;
  let score = 0;
  score += 3 * recipe.vibes.filter((v) => settings.vibes.includes(v)).length;
  if (settings.proteinLikes.includes(recipe.protein)) score += 2;
  if (favourites.includes(recipe.id)) score += 3;
  if (ratings[recipe.id] !== undefined) score += (ratings[recipe.id] - 3) * 1.5;
  const recentIndex = recentRecipeIds.indexOf(recipe.id);
  if (recentIndex !== -1) score -= recentIndex < 7 ? 5 : 2;
  const kids = kidTally(recipe.id, ctx);
  score += kids.up * 1.5 - kids.down * 2.5;
  // Was im Vorrat ist, soll aufgebraucht werden.
  if (ctx.pantry?.length) {
    const have = new Set(ctx.pantry.map((p) => p.name.toLowerCase()));
    score += Math.min(recipe.ingredients.filter((x) => have.has(x.name.toLowerCase())).length, 3) * 0.8;
  }
  return score;
}

function ingredientNames(recipe: Recipe) {
  return new Set(recipe.ingredients.map((x) => x.name));
}

/** Bonus, wenn Zutaten schon im Plan vorkommen – Packungen werden besser aufgebraucht. */
function overlapBonus(recipe: Recipe, chosen: Recipe[]): number {
  if (chosen.length === 0) return 0;
  const used = new Set(chosen.flatMap((r) => r.ingredients.map((x) => x.name)));
  let shared = 0;
  for (const name of ingredientNames(recipe)) if (used.has(name)) shared++;
  return Math.min(shared, 3) * 0.6;
}

function passesVariety(recipe: Recipe, chosen: Recipe[], slots: number, relaxed = false): boolean {
  if (chosen.some((r) => r.id === recipe.id)) return false;
  if (ANIMAL_PROTEINS.includes(recipe.protein)) {
    const sameProtein = chosen.filter((r) => r.protein === recipe.protein).length;
    if (sameProtein >= MAX_SAME_ANIMAL_PROTEIN + (relaxed ? 1 : 0)) return false;
  }
  const sameCarb = chosen.filter((r) => r.carb === recipe.carb).length;
  return sameCarb < maxSameCarb(slots, relaxed);
}

interface Attempt {
  recipes: Recipe[];
  score: number;
  cost: number;
}

function buildAttempt(pool: Recipe[], slots: number, ctx: PlanContext, jitter: number, relaxed: boolean): Attempt | null {
  const { householdSize, weeklyBudget } = ctx.settings;
  const base = new Map(pool.map((r) => [r.id, baseScore(r, ctx) + Math.random() * jitter]));
  const cheapest = Math.min(...pool.map((r) => portionCost(r, householdSize)));
  const chosen: Recipe[] = [];
  let cost = 0;
  let score = 0;

  for (let slot = 0; slot < slots; slot++) {
    const remainingSlots = slots - slot - 1;
    const budgetLeft = weeklyBudget - cost - remainingSlots * cheapest;
    let best: Recipe | null = null;
    let bestScore = -Infinity;
    for (const r of pool) {
      if (!passesVariety(r, chosen, slots, relaxed)) continue;
      if (portionCost(r, householdSize) > budgetLeft) continue;
      const s = (base.get(r.id) ?? 0) + overlapBonus(r, chosen);
      if (s > bestScore) {
        best = r;
        bestScore = s;
      }
    }
    if (!best) return null;
    chosen.push(best);
    cost += portionCost(best, householdSize);
    score += bestScore;
  }
  // Leichter Bonus für gute Budgetausnutzung, aber nie über Budget.
  score += (cost / weeklyBudget) * 2;
  return { recipes: chosen, score, cost };
}

/** Reihenfolge so legen, dass nicht zweimal hintereinander dasselbe Protein oder dieselbe Beilage kommt. */
export function orderAvoidingBackToBack(recipes: Recipe[]): Recipe[] {
  const rest = [...recipes];
  const ordered: Recipe[] = [];
  while (rest.length) {
    const prev = ordered[ordered.length - 1];
    let index = rest.findIndex((r) => !prev || (r.protein !== prev.protein && r.carb !== prev.carb));
    if (index === -1) index = rest.findIndex((r) => !prev || r.protein !== prev.protein);
    if (index === -1) index = 0;
    ordered.push(rest.splice(index, 1)[0]);
  }
  return ordered;
}

export type GenerateResult = { ok: true; plan: MealPlan; cost: number } | { ok: false; reason: string };

export function generatePlan(ctx: PlanContext): GenerateResult {
  const days = [...ctx.settings.cookingDays].sort();
  if (days.length === 0) return { ok: false, reason: 'Bitte mindestens einen Kochtag wählen.' };
  const pool = eligibleRecipes(ctx);
  if (pool.length < days.length) {
    return { ok: false, reason: `Nur ${pool.length} Rezepte passen zu deinen Einstellungen – für ${days.length} Kochtage zu wenig.` };
  }

  let best: Attempt | null = null;
  // Erst mit strengen Abwechslungsregeln, nur wenn das nichts ergibt, gelockert.
  for (const relaxed of [false, true]) {
    for (let n = 0; n < ATTEMPTS; n++) {
      const attempt = buildAttempt(pool, days.length, ctx, JITTER, relaxed);
      if (attempt && (!best || attempt.score > best.score)) best = attempt;
    }
    if (best) break;
  }
  if (!best) return { ok: false, reason: 'Mit diesem Budget lässt sich kein abwechslungsreicher Plan bauen. Budget erhöhen oder Filter lockern.' };

  const ordered = orderAvoidingBackToBack(best.recipes);
  const slots: PlanSlot[] = days.map((day, idx) => ({ day, recipeId: ordered[idx].id }));
  return { ok: true, plan: { createdAt: new Date().toISOString(), slots }, cost: best.cost };
}

/** Zufälliger guter Ersatz für einen Tag, der Budget und Abwechslung einhält. `skip` = zuletzt schon gezeigte Rezepte. */
export function findSwap(plan: MealPlan, day: number, ctx: PlanContext, skip: string[] = []): string | null {
  const { householdSize, weeklyBudget } = ctx.settings;
  const pool = eligibleRecipes(ctx);
  const byId = new Map(pool.map((r) => [r.id, r]));
  const others = plan.slots.filter((s) => s.day !== day).map((s) => byId.get(s.recipeId)).filter((r): r is Recipe => !!r);
  const current = plan.slots.find((s) => s.day === day)?.recipeId;
  const othersCost = others.reduce((sum, r) => sum + portionCost(r, householdSize), 0);

  const slots = plan.slots.length;
  const fits = (relaxed: boolean) => pool.filter((r) => r.id !== current && passesVariety(r, others, slots, relaxed));
  const strict = fits(false);
  const inBudget = (strict.length ? strict : fits(true)).filter((r) => othersCost + portionCost(r, householdSize) <= weeklyBudget);
  const fresh = inBudget.filter((r) => !skip.includes(r.id));
  const candidates = (fresh.length ? fresh : inBudget)
    .map((r) => ({ r, s: baseScore(r, ctx) + overlapBonus(r, others) + Math.random() * JITTER }))
    .sort((a, b) => b.s - a.s)
    .slice(0, SWAP_TOP);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].r.id;
}

/** Kosten des Plans, wenn an `day` stattdessen `recipe` gekocht wird. */
export function costWithSwap(plan: MealPlan, day: number, recipe: Recipe, householdSize: number, recipes: Record<string, Recipe>): number {
  return plan.slots.reduce((sum, s) => {
    const r = s.day === day ? recipe : recipes[s.recipeId];
    return sum + (r ? portionCost(r, householdSize) : 0);
  }, 0);
}

export function planCost(plan: MealPlan, householdSize: number, recipes: Record<string, Recipe>): number {
  return plan.slots.reduce((sum, s) => sum + (recipes[s.recipeId] ? portionCost(recipes[s.recipeId], householdSize) : 0), 0);
}
