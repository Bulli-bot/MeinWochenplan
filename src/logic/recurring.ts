import type { AppState, RecurringItem, ShopExtra } from '../types';

const DAY = 86400000;
const norm = (s: string) => s.trim().toLowerCase();

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (iso: string | Date, days: number) => {
  const d = dayStart(new Date(iso));
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const RECURRING_CHOICES: [number, string][] = [[0, 'nie'], [7, '1 Wo.'], [14, '2 Wo.'], [30, '1 Mon.']];

export const findRecurring = (list: RecurringItem[] | undefined, name: string) => list?.find((r) => norm(r.name) === norm(name));

/** Regelmäßigkeit setzen (0 = aus). Das nächste Mal ist ab heute gerechnet, weil es gerade auf der Liste steht. */
export function setRecurring(list: RecurringItem[] | undefined, name: string, amount: string | undefined, everyDays: number, now = new Date()): RecurringItem[] {
  const rest = (list ?? []).filter((r) => norm(r.name) !== norm(name));
  if (!everyDays) return rest;
  const old = findRecurring(list, name);
  return [...rest, {
    id: old?.id ?? `r${Date.now().toString(36)}`,
    name: name.trim(),
    amount: amount?.trim() || undefined,
    everyDays,
    next: old && old.everyDays === everyDays ? old.next : addDays(now, everyDays),
  }];
}

/**
 * Fällige regelmäßige Artikel auf die Liste setzen und das nächste Mal weiterschieben.
 * Gibt den unveränderten Zustand zurück, wenn nichts fällig ist (kein unnötiges Speichern/Abgleichen).
 */
export function applyRecurring(state: AppState, now = new Date()): AppState {
  const today = dayStart(now).getTime();
  const due = (state.recurring ?? []).filter((r) => dayStart(new Date(r.next)).getTime() <= today);
  if (!due.length) return state;
  const extras: ShopExtra[] = [...state.shopExtras];
  for (const r of due) {
    if (extras.some((x) => !x.done && norm(x.name) === norm(r.name))) continue;
    extras.push({ id: `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: r.name, amount: r.amount, from: 'regelmaessig' });
  }
  return {
    ...state,
    shopExtras: extras,
    recurring: (state.recurring ?? []).map((r) => {
      if (!due.includes(r)) return r;
      // Bei längerer Pause nicht mehrfach nachholen: ab heute weiterrechnen
      let next = new Date(r.next).getTime();
      while (next <= today) next += r.everyDays * DAY;
      return { ...r, next: dayStart(new Date(next)).toISOString() };
    }),
  };
}
