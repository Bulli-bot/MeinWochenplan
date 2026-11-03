import type { Member, PlanSlot, Recipe } from '../types';

/**
 * Haushaltsmitglieder mit Portionsgröße – wie der Rezeptkatalog einmal pro Render aus den Einstellungen
 * gesetzt (App.tsx), damit Einkaufsliste, Preise und Generator ohne zusätzliche Parameter mitrechnen.
 */
let members: Member[] = [];
export const setMembers = (m: Member[] | undefined) => { members = m ?? []; };
export const getMembers = () => members;

/** Portionen an einem Tag: Gäste-Zahl gewinnt, sonst die anwesenden Mitglieder, sonst die Haushaltsgröße. */
export function slotPeople(slot: Pick<PlanSlot, 'guests' | 'absent'>, householdSize: number): number {
  if (slot.guests) return slot.guests;
  if (!members.length) return householdSize;
  const present = members.filter((m) => !slot.absent?.includes(m.name));
  return Math.round(present.reduce((s, m) => s + m.portion, 0) * 100) / 100;
}

/** Kürzel für die Kreise im Plan: „Kind 1“ → K1, „Anna Beispiel“ → AB, „Sascha“ → SA */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const s = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}

/** 3.25 → „3¼“ */
export function fmtPeople(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 4) / 4;
  const sym = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  return `${whole || (sym ? '' : '0')}${sym}`;
}

/** Wer mag das nicht? (Abneigung als Wortteil im Namen oder in den Zutaten) */
export function dislikedBy(recipe: Recipe): string[] {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  return members.filter((m) => m.dislikes.some((d) => d.trim().length >= 3 && text.includes(d.trim().toLowerCase()))).map((m) => m.name);
}

/** Startwerte aus Haushaltsgröße und Kindernamen */
export function defaultMembers(householdSize: number, kids: string[] | undefined, ownName: string): Member[] {
  const list: Member[] = (kids ?? []).map((k) => ({ name: k, portion: 0.75, dislikes: [] }));
  const adults = Math.max(1, householdSize - list.length);
  const names = [ownName || 'Erwachsene/r 1', ...Array.from({ length: adults - 1 }, (_, i) => `Erwachsene/r ${i + 2}`)];
  return [...names.map((n) => ({ name: n, portion: 1, dislikes: [] })), ...list];
}
