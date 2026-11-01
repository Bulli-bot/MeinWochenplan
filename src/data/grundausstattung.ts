import type { PantryItem, PantryKind } from '../types';

/**
 * Grundausstattung: die Dinge, die in diesem Haushalt immer da sein sollten – mit sinnvollen
 * Mengen und Tagesverbrauch, damit die „Bald leer"-Erinnerung im Vorrat greift.
 * Abgeleitet aus den regelmäßigen Monatseinkäufen (ALDI, trinkgut, Rossmann).
 */
export interface PresetItem {
  name: string;
  amount: number;
  unit: string;
  kind: PantryKind;
  /** Verbrauch pro Tag in derselben Einheit */
  perDay: number;
  /** So viele Tage vor „leer" erinnern */
  remindDays: number;
}

export const GRUNDAUSSTATTUNG: PresetItem[] = [
  // Lebensmittel
  { name: 'H-Milch', amount: 12, unit: 'Flaschen', kind: 'lebensmittel', perDay: 0.4, remindDays: 3 },
  // Getränke
  { name: 'Wasser', amount: 4, unit: 'Kisten', kind: 'getraenke', perDay: 0.2, remindDays: 2 },
  { name: 'Eistee', amount: 3, unit: 'Kisten', kind: 'getraenke', perDay: 0.15, remindDays: 1 },
  { name: 'Cola / Pepsi', amount: 2, unit: 'Kisten', kind: 'getraenke', perDay: 0.1, remindDays: 1 },
  { name: 'Capri Sun', amount: 2, unit: 'Packungen', kind: 'getraenke', perDay: 0.1, remindDays: 1 },
  // Drogerie
  { name: 'Toilettenpapier', amount: 2, unit: 'Packungen', kind: 'drogerie', perDay: 0.07, remindDays: 2 },
  { name: 'Duschgel', amount: 4, unit: 'Stück', kind: 'drogerie', perDay: 0.1, remindDays: 1 },
  { name: 'Shampoo', amount: 2, unit: 'Stück', kind: 'drogerie', perDay: 0.05, remindDays: 2 },
  { name: 'Zahnpasta', amount: 2, unit: 'Stück', kind: 'drogerie', perDay: 0.04, remindDays: 3 },
  { name: 'Deo', amount: 2, unit: 'Stück', kind: 'drogerie', perDay: 0.04, remindDays: 3 },
  { name: 'Feuchttücher', amount: 2, unit: 'Packungen', kind: 'drogerie', perDay: 0.07, remindDays: 2 },
  // Haushalt
  { name: 'WC-Reiniger', amount: 1, unit: 'Stück', kind: 'haushalt', perDay: 0.03, remindDays: 3 },
  { name: 'Spülmaschinentabs', amount: 1, unit: 'Packungen', kind: 'haushalt', perDay: 0.03, remindDays: 3 },
  { name: 'Einweghandschuhe', amount: 1, unit: 'Packungen', kind: 'haushalt', perDay: 0.03, remindDays: 3 },
];

const norm = (s: string) => s.trim().toLowerCase();

/** Fehlende Grundausstattung dem Vorrat hinzufügen – Vorhandenes bleibt unangetastet. */
export function mergeGrundausstattung(pantry: PantryItem[]): { pantry: PantryItem[]; added: number } {
  const have = new Set(pantry.map((p) => norm(p.name)));
  const now = new Date().toISOString();
  const toAdd: PantryItem[] = GRUNDAUSSTATTUNG
    .filter((p) => !have.has(norm(p.name)))
    .map((p) => ({ name: p.name, amount: p.amount, unit: p.unit, kind: p.kind, perDay: p.perDay, remindDays: p.remindDays, since: now }));
  return { pantry: [...pantry, ...toAdd], added: toAdd.length };
}

/** Wie viele Artikel der Grundausstattung noch nicht im Vorrat sind. */
export function missingGrundausstattung(pantry: PantryItem[]): number {
  const have = new Set(pantry.map((p) => norm(p.name)));
  return GRUNDAUSSTATTUNG.filter((p) => !have.has(norm(p.name))).length;
}
