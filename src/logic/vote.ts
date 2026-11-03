import type { FamilyVote, Recipe, VoteChoice } from '../types';

/** 10 Vorschläge: passend zu den Einstellungen, nicht aus den letzten Wochen, gut gemischt. */
export function voteSuggestions(eligible: Recipe[], recent: string[], count = 10): string[] {
  const fresh = eligible.filter((r) => !recent.includes(r.id));
  const pool = (fresh.length >= count ? fresh : eligible).map((r) => ({ r, k: Math.random() }));
  pool.sort((a, b) => a.k - b.k);
  // Abwechslung: höchstens drei mit derselben Beilage
  const out: Recipe[] = [];
  for (const { r } of pool) {
    if (out.filter((x) => x.carb === r.carb).length >= 3) continue;
    out.push(r);
    if (out.length === count) break;
  }
  return out.map((r) => r.id);
}

export function newVote(eligible: Recipe[], recent: string[]): FamilyVote {
  return { id: `v${Date.now().toString(36)}`, created: new Date().toISOString(), suggestions: voteSuggestions(eligible, recent), ballots: {} };
}

/** Ab so vielen Ja-Stimmen (inkl. Wunsch) ist es ein „Meal-Match“ */
export const MATCH_AT = 3;

/** Punkte je Rezept: Wunsch +1,5, „will ich“ +1, „nein“ −1 */
export function voteScores(vote: FamilyVote | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!vote) return out;
  for (const ballot of Object.values(vote.ballots)) {
    for (const [id, c] of Object.entries(ballot)) out[id] = (out[id] ?? 0) + (c === 2 ? 1.5 : c);
  }
  return out;
}

/** Stimmen eines Rezepts zählen */
export function tally(vote: FamilyVote, id: string): { yes: number; no: number; wish: number } {
  let yes = 0;
  let no = 0;
  let wish = 0;
  for (const b of Object.values(vote.ballots)) {
    const c: VoteChoice | undefined = b[id];
    if (c === 1 || c === 2) yes += 1;
    if (c === 2) wish += 1;
    if (c === -1) no += 1;
  }
  return { yes, no, wish };
}
