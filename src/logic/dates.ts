import type { MealPlan, Settings } from '../types';

/** 0 = Montag … 6 = Sonntag */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

/** Montag der Woche von `date`, 00:00 Uhr Ortszeit */
export function mondayOf(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** JJJJ-MM-TT in Ortszeit */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Für welche Woche ein neuer Plan gilt: Geplant und eingekauft wird Freitag/Samstag –
 * ab Freitag ist daher die kommende Woche dran (abschaltbar in den Einstellungen).
 */
export function targetWeekStart(settings: Pick<Settings, 'planWeek'> | null, now = new Date()): string {
  const monday = mondayOf(now);
  const ahead = (settings?.planWeek ?? 'kommend') === 'kommend' && todayIndexOf(now) >= 4;
  return isoDay(ahead ? addDays(monday, 7) : monday);
}

const todayIndexOf = (d: Date) => (d.getDay() + 6) % 7;

/** Montag der Woche, für die der Plan gilt. Alte Pläne ohne weekStart: nach derselben Regel wie heute. */
export function planMonday(plan: MealPlan): Date {
  if (plan.weekStart) return parseDay(plan.weekStart);
  return parseDay(targetWeekStart(null, new Date(plan.createdAt)));
}

export const planWeekKey = (plan: MealPlan) => isoDay(planMonday(plan));

/** Ein Einkauf ab Freitag zählt zur kommenden Woche – dafür wird ja eingekauft. */
export function budgetWeekKey(iso: string, settings: Pick<Settings, 'planWeek'> | null): string {
  const d = new Date(iso);
  return isoDay(mondayOf((settings?.planWeek ?? 'kommend') === 'kommend' ? addDays(d, 3) : d));
}

/** Tag im Plan, der heute ist – oder null, wenn der Plan nicht für diese Woche gilt. */
export function todayInPlan(plan: MealPlan, now = new Date()): number | null {
  const diff = Math.round((mondayOf(now).getTime() - planMonday(plan).getTime()) / 86400000);
  return diff === 0 ? todayIndexOf(now) : null;
}

/** −1 = Woche liegt zurück, 0 = laufende Woche, 1 = kommt noch */
export function weekRelation(plan: MealPlan, now = new Date()): -1 | 0 | 1 {
  const diff = planMonday(plan).getTime() - mondayOf(now).getTime();
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
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
