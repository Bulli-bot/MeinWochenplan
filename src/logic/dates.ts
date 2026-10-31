import type { MealPlan } from '../types';

/** 0 = Montag … 6 = Sonntag */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

/** Montag der Woche, in der der Plan erstellt wurde (00:00 Uhr Ortszeit). */
export function planMonday(plan: MealPlan): Date {
  const d = new Date(plan.createdAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function slotDate(plan: MealPlan, day: number): Date {
  const d = planMonday(plan);
  d.setDate(d.getDate() + day);
  return d;
}

export const shortDate = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/** Kalenderwoche nach ISO 8601 */
export function isoWeek(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend';
}
