import type { PlanSlot, Settings } from '../types';

/** Standard-Essenszeit, wenn in den Einstellungen nichts steht */
export const DEFAULT_MEAL_TIME = '18:30';

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (n: number) => {
  const v = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** „18:30“ + 15 → „18:45“ */
export const shiftTime = (t: string, minutes: number) => fromMin(toMin(t) + minutes);

export const mealTime = (settings: Pick<Settings, 'mealTime'> | null | undefined) => settings?.mealTime ?? DEFAULT_MEAL_TIME;

/** Essenszeit an einem Tag: eigene Zeit des Tages, sonst die Standardzeit */
export const slotEatAt = (slot: Pick<PlanSlot, 'eatAt'> | undefined, settings: Pick<Settings, 'mealTime'> | null | undefined) =>
  slot?.eatAt ?? mealTime(settings);

/** Uhrzeit heute als Date */
export function todayAt(t: string): Date {
  const d = new Date();
  const n = toMin(t);
  d.setHours(Math.floor(n / 60), n % 60, 0, 0);
  return d;
}
