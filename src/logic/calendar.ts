import type { AppState, CalendarFeed, MealPlan, Settings } from '../types';
import { useSoon } from './leftovers';
import { daysLeft, emptyOn } from './pantry';
import { openShopping } from './shopPrice';

/**
 * Auszug für das Kalender-Abo. Der Server kennt keine Rezepte, darum rechnet die App alles vor
 * (offener Betrag, bald leer, Reste, regelmäßige Artikel) und legt es im Zustand ab.
 * `updated` bleibt außen vor, damit nur echte Änderungen gespeichert werden.
 */
export function buildCalendarFeed(state: AppState, plan: MealPlan | null, settings: Settings | null): Omit<CalendarFeed, 'updated'> | null {
  if (!settings?.shopDays?.length) return null;
  const shop = plan ? openShopping(state, plan, settings) : { cost: 0, count: 0, names: [] as string[] };
  return {
    shopDays: [...settings.shopDays].sort(),
    shopHour: settings.shopHour ?? 10,
    openCost: Math.round(shop.cost * 100) / 100,
    openCount: shop.count,
    items: shop.names.slice(0, 40),
    // Alles, was in den nächsten zwei Wochen leer wird – der Kalender erinnert „remindDays“ vorher
    empty: state.pantry
      .filter((p) => { const d = daysLeft(p); return d !== null && d <= 14; })
      .map((p) => ({ name: p.name, date: emptyOn(p)!.toISOString(), remind: p.remindDays ?? 1 })),
    useBy: useSoon(state.pantry, 7).map(({ item }) => ({ name: item.name, date: item.useBy! })),
    recurring: (state.recurring ?? []).map((r) => ({ name: r.name, date: r.next })),
  };
}

export const sameFeed = (a: Omit<CalendarFeed, 'updated'> | null, b: CalendarFeed | undefined) => {
  if (!a || !b) return !a && !b;
  const { updated: _, ...rest } = b;
  return JSON.stringify(a) === JSON.stringify(rest);
};
