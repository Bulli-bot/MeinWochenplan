import { RECIPES } from '../data/recipes';
import type { Diet, KidVote, MealPlan, PantryItem, PlanSlot, Protein, Recipe, Settings, Weekday } from '../types';
import { useSoon } from './leftovers';

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

/** Maximale Kochzeit für einen Tag (Sa/So = Wochenende). */
export function minutesFor(settings: Settings, day: number): number {
  const split = day >= 5 ? settings.maxMinutesWeekend : settings.maxMinutesWeekday;
  return split ?? settings.maxMinutes;
}

const maxMinutesAny = (settings: Settings) => Math.max(minutesFor(settings, 0), minutesFor(settings, 6));

/** Harte Ausschlüsse: Ernährung, Allergene, Küchengeräte, Kochzeit, Beilagen, schlecht bewertet. */
export function eligibleRecipes(ctx: PlanContext): Recipe[] {
  const { settings, ratings } = ctx;
  const allowedProteins = DIET_PROTEINS[settings.diet];
  const sides = settings.sides?.length ? settings.sides : null;
  return RECIPES.filter(
    (r) =>
      allowedProteins.includes(r.protein) &&
      !r.allergens.some((a) => settings.allergens.includes(a)) &&
      r.equipment.every((e) => settings.equipment.includes(e)) &&
      r.minutes <= maxMinutesAny(settings) &&
      (!sides || r.carb === 'sonstiges' || sides.includes(r.carb)) &&
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
    // Reste, die bald ablaufen, wiegen deutlich mehr
    const soon = new Set(useSoon(ctx.pantry, 5).map((x) => x.item.name.toLowerCase()));
    score += Math.min(recipe.ingredients.filter((x) => soon.has(x.name.toLowerCase())).length, 2) * 2.5;
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

/**
 * `limits[i]` = Kochzeit-Grenze für das i-te Gericht, `weights[i]` = an wie vielen Tagen es gegessen
 * wird (2 beim Vorkochen) – zählt fürs Budget entsprechend mehrfach.
 */
function buildAttempt(pool: Recipe[], limits: number[], weights: number[], ctx: PlanContext, jitter: number, relaxed: boolean): Attempt | null {
  const { householdSize, weeklyBudget } = ctx.settings;
  const slots = limits.length;
  const base = new Map(pool.map((r) => [r.id, baseScore(r, ctx) + Math.random() * jitter]));
  const cheapest = Math.min(...pool.map((r) => portionCost(r, householdSize)));
  const chosen: Recipe[] = [];
  let cost = 0;
  let score = 0;

  for (let slot = 0; slot < slots; slot++) {
    const remainingWeight = weights.slice(slot + 1).reduce((a, b) => a + b, 0);
    const budgetLeft = weeklyBudget - cost - remainingWeight * cheapest;
    let best: Recipe | null = null;
    let bestScore = -Infinity;
    for (const r of pool) {
      if (r.minutes > limits[slot]) continue;
      if (!passesVariety(r, chosen, slots, relaxed)) continue;
      if (portionCost(r, householdSize) * weights[slot] > budgetLeft) continue;
      const s = (base.get(r.id) ?? 0) + overlapBonus(r, chosen);
      if (s > bestScore) {
        best = r;
        bestScore = s;
      }
    }
    if (!best) return null;
    chosen.push(best);
    cost += portionCost(best, householdSize) * weights[slot];
    score += bestScore;
  }
  // Leichter Bonus für gute Budgetausnutzung, aber nie über Budget.
  score += (cost / weeklyBudget) * 2;
  return { recipes: chosen, score, cost };
}

/**
 * Reihenfolge so legen, dass nicht zweimal hintereinander dasselbe Protein oder dieselbe Beilage kommt.
 * Mit `limits` muss jedes Gericht in die Kochzeit seines Platzes passen; klappt das nicht, bleibt die Reihenfolge.
 */
export function orderAvoidingBackToBack(recipes: Recipe[], limits?: number[]): Recipe[] {
  const rest = [...recipes];
  const ordered: Recipe[] = [];
  while (rest.length) {
    const prev = ordered[ordered.length - 1];
    const limit = limits?.[ordered.length] ?? Infinity;
    const fits = (r: Recipe) => r.minutes <= limit;
    let index = rest.findIndex((r) => fits(r) && (!prev || (r.protein !== prev.protein && r.carb !== prev.carb)));
    if (index === -1) index = rest.findIndex((r) => fits(r) && (!prev || r.protein !== prev.protein));
    if (index === -1) index = rest.findIndex(fits);
    if (index === -1) return recipes;
    ordered.push(rest.splice(index, 1)[0]);
  }
  return ordered;
}

export type GenerateResult = { ok: true; plan: MealPlan; cost: number } | { ok: false; reason: string };

export interface CookDay {
  day: Weekday;
  /** 2 beim Vorkochen: am nächsten Kochtag gibt es Reste */
  servesDays: number;
  resteDay?: Weekday;
}

/** Welche Tage gekocht wird: Restetag fällt raus; beim Vorkochen wird jeder zweite Tag „Reste vom Vortag“. */
export function cookingSchedule(settings: Settings): { cook: CookDay[]; restetag: Weekday | null } {
  const restetag = settings.leftoverDay ?? null;
  const days = [...settings.cookingDays].sort().filter((d) => d !== restetag) as Weekday[];
  const cook: CookDay[] = [];
  for (let i = 0; i < days.length; i++) {
    if (settings.mealPrep && i + 1 < days.length) {
      cook.push({ day: days[i], servesDays: 2, resteDay: days[i + 1] });
      i++;
    } else cook.push({ day: days[i], servesDays: 1 });
  }
  return { cook, restetag: restetag !== null && settings.cookingDays.includes(restetag) ? restetag : null };
}

export function generatePlan(ctx: PlanContext, weekStart?: string): GenerateResult {
  const { cook, restetag } = cookingSchedule(ctx.settings);
  if (cook.length === 0) return { ok: false, reason: 'Bitte mindestens einen Kochtag wählen.' };
  const pool = eligibleRecipes(ctx);
  if (pool.length < cook.length) {
    return { ok: false, reason: `Nur ${pool.length} Rezepte passen zu deinen Einstellungen – für ${cook.length} Kochtage zu wenig.` };
  }
  const limits = cook.map((c) => minutesFor(ctx.settings, c.day));
  const weights = cook.map((c) => c.servesDays);

  let best: Attempt | null = null;
  // Erst mit strengen Abwechslungsregeln, nur wenn das nichts ergibt, gelockert.
  for (const relaxed of [false, true]) {
    for (let n = 0; n < ATTEMPTS; n++) {
      const attempt = buildAttempt(pool, limits, weights, ctx, JITTER, relaxed);
      if (attempt && (!best || attempt.score > best.score)) best = attempt;
    }
    if (best) break;
  }
  if (!best) return { ok: false, reason: 'Mit diesem Budget und diesen Kochzeiten lässt sich kein abwechslungsreicher Plan bauen. Budget erhöhen oder Filter lockern.' };

  // Beim Umsortieren müssten die Reste-Tage mitwandern – deshalb nur ohne Vorkochen.
  const ordered = weights.every((w) => w === 1) ? orderAvoidingBackToBack(best.recipes, limits) : best.recipes;
  const slots: PlanSlot[] = [];
  cook.forEach((c, idx) => {
    slots.push({ day: c.day, recipeId: ordered[idx].id });
    if (c.resteDay !== undefined) slots.push({ day: c.resteDay, recipeId: ordered[idx].id, kind: 'reste' });
  });
  if (restetag !== null) slots.push({ day: restetag, recipeId: '', kind: 'restetag' });
  slots.sort((a, b) => a.day - b.day);
  return { ok: true, plan: { createdAt: new Date().toISOString(), weekStart, slots }, cost: best.cost };
}

/** Zufälliger guter Ersatz für einen Tag, der Budget, Kochzeit und Abwechslung einhält. `skip` = zuletzt schon gezeigte Rezepte. */
export function findSwap(plan: MealPlan, day: number, ctx: PlanContext, skip: string[] = []): string | null {
  const { householdSize, weeklyBudget } = ctx.settings;
  const limit = minutesFor(ctx.settings, day);
  const pool = eligibleRecipes(ctx).filter((r) => r.minutes <= limit);
  const byId = new Map(RECIPES.map((r) => [r.id, r]));
  const current = plan.slots.find((s) => s.day === day)?.recipeId;
  // Der Reste-Tag des getauschten Gerichts wandert mit und zählt nicht als „anderes“ Gericht.
  const othersSlots = plan.slots.filter((s) => s.day !== day && !(s.kind === 'reste' && s.recipeId === current));
  const others = othersSlots.filter((s) => s.kind !== 'reste').map((s) => byId.get(s.recipeId)).filter((r): r is Recipe => !!r);
  const othersCost = othersSlots.reduce((sum, s) => {
    const r = byId.get(s.recipeId);
    return sum + (r ? portionCost(r, householdSize) : 0);
  }, 0);
  const weight = 1 + plan.slots.filter((s) => s.kind === 'reste' && s.recipeId === current && s.day !== day).length;

  const slots = plan.slots.filter((s) => !s.kind).length;
  const fits = (relaxed: boolean) => pool.filter((r) => r.id !== current && passesVariety(r, others, slots, relaxed));
  const strict = fits(false);
  const inBudget = (strict.length ? strict : fits(true)).filter((r) => othersCost + portionCost(r, householdSize) * weight <= weeklyBudget);
  const fresh = inBudget.filter((r) => !skip.includes(r.id));
  const candidates = (fresh.length ? fresh : inBudget)
    .map((r) => ({ r, s: baseScore(r, ctx) + overlapBonus(r, others) + Math.random() * JITTER }))
    .sort((a, b) => b.s - a.s)
    .slice(0, SWAP_TOP);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].r.id;
}

/** Kosten des Plans, wenn an `day` stattdessen `recipe` gekocht wird (inkl. zugehörigem Reste-Tag). */
export function costWithSwap(plan: MealPlan, day: number, recipe: Recipe, householdSize: number, recipes: Record<string, Recipe>): number {
  const current = plan.slots.find((s) => s.day === day)?.recipeId;
  return plan.slots.reduce((sum, s) => {
    const swapped = s.day === day || (s.kind === 'reste' && s.recipeId === current);
    const r = swapped ? recipe : recipes[s.recipeId];
    return sum + (r ? portionCost(r, householdSize) : 0);
  }, 0);
}

export function planCost(plan: MealPlan, householdSize: number, recipes: Record<string, Recipe>): number {
  return plan.slots.reduce((sum, s) => sum + (recipes[s.recipeId] ? portionCost(recipes[s.recipeId], householdSize) : 0), 0);
}
