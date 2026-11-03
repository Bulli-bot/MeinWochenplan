import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RECIPES, RECIPE_BY_ID } from '../data/recipes';
import { costWithSwap, eligibleRecipes, portionCost, type PlanContext } from '../logic/generator';
import type { MealPlan, Protein, Recipe } from '../types';
import { Button, Chip, Grid, Icon, Split, WEEKDAYS_LONG, autoColumns, colors, contentWidth, euro, hov, space, styles, useLayout } from '../ui';

type Sort = 'preis' | 'zeit' | 'name';
const SORTS: [Sort, string][] = [['preis', 'Preis'], ['zeit', 'Kochzeit'], ['name', 'Name']];
const PROTEIN_LABELS: Record<Protein, string> = {
  huhn: 'Geflügel', rind: 'Rind', schwein: 'Schwein', fisch: 'Fisch', vegetarisch: 'Vegetarisch', vegan: 'Vegan',
};

/** Filter liegen in App.tsx, damit sie beim Öffnen eines Rezepts erhalten bleiben. */
export interface RecipeFilters {
  query: string;
  protein: Protein | null;
  sort: Sort;
  onlyMatching: boolean;
  onlyKids: boolean;
  /** Aufgeklappte Kategorien */
  openGroups?: string[];
}
export const DEFAULT_FILTERS: RecipeFilters = { query: '', protein: null, sort: 'preis', onlyMatching: false, onlyKids: false, openGroups: [] };

/** Kategorien nach Beilage – Suppen und Süßes bekommen eigene Gruppen. */
export const GROUPS = ['Nudeln', 'Kartoffeln', 'Reis', 'Brot, Pizza & Wraps', 'Suppen & Eintöpfe', 'Süßes', 'Sonstiges'] as const;
export function recipeGroup(r: Recipe): (typeof GROUPS)[number] {
  if (/suppe|minestrone|eintopf|topf|dal/i.test(r.name)) return 'Suppen & Eintöpfe';
  if (/pfannkuchen|milchreis|kaiserschmarrn|waffel|grießbrei/i.test(r.name)) return 'Süßes';
  switch (r.carb) {
    case 'nudeln': return 'Nudeln';
    case 'kartoffeln': return 'Kartoffeln';
    case 'reis': return 'Reis';
    case 'brot': return 'Brot, Pizza & Wraps';
    default: return 'Sonstiges';
  }
}

const compare: Record<Sort, (a: Recipe, b: Recipe) => number> = {
  preis: (a, b) => a.pricePerPortion - b.pricePerPortion || a.name.localeCompare(b.name, 'de'),
  zeit: (a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name, 'de'),
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
};

/** Auswahlmodus: Gericht für einen Tag im Plan selbst aussuchen. */
export interface PickFor {
  plan: MealPlan;
  day: number;
  onPick: (recipeId: string) => void;
  onRandom: () => void;
  onCancel: () => void;
}

export function RecipesScreen({ context, favourites, filters, onFilters, onOpen, pickFor, onNew }: {
  context: PlanContext;
  favourites: string[];
  filters: RecipeFilters;
  onFilters: (f: RecipeFilters) => void;
  onOpen: (recipeId: string) => void;
  pickFor?: PickFor;
  /** „Eigenes Rezept anlegen" */
  onNew?: () => void;
}) {
  const { query, protein, sort, onlyMatching, onlyKids } = filters;
  const openGroups = filters.openGroups ?? [];
  const set = (patch: Partial<RecipeFilters>) => onFilters({ ...filters, ...patch });
  const { householdSize, weeklyBudget } = context.settings;
  const { width, isWide } = useLayout();
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = (protein ? 1 : 0) + (onlyMatching ? 1 : 0) + (onlyKids ? 1 : 0);
  const recipeColumns = isWide ? autoColumns(contentWidth(width) - 340 - space.xl, 320, 3) : width >= 900 ? 2 : 1;

  const matchingIds = useMemo(() => new Set(eligibleRecipes(context).map((r) => r.id)), [context]);
  const prices = RECIPES.map((r) => r.pricePerPortion);
  const needle = query.trim().toLowerCase();
  const currentId = pickFor?.plan.slots.find((s) => s.day === pickFor.day)?.recipeId;
  const inPlan = new Set(pickFor?.plan.slots.map((s) => s.recipeId) ?? []);

  const shown = RECIPES.filter(
    (r) =>
      (!protein || r.protein === protein) &&
      (!onlyMatching || matchingIds.has(r.id)) &&
      (!onlyKids || r.vibes.includes('kinder')) &&
      (!needle || r.name.toLowerCase().includes(needle) || r.ingredients.some((x) => x.name.toLowerCase().includes(needle))),
  ).sort(compare[sort]);

  const renderRecipe = (r: Recipe) => {
    const planTotal = pickFor ? costWithSwap(pickFor.plan, pickFor.day, r, householdSize, RECIPE_BY_ID) : 0;
    const isCurrent = r.id === currentId;
    return (
      <Pressable key={r.id} onPress={() => onOpen(r.id)} style={[styles.card, local.row, isCurrent && local.current]} accessibilityRole="button">
        <View style={local.info}>
          <Text style={local.name}>{r.name}{favourites.includes(r.id) ? ' ♥' : ''}</Text>
          <Text style={styles.hint}>
            {r.minutes} Min. · {PROTEIN_LABELS[r.protein]}{r.vibes.includes('kinder') ? ' · kinderfreundlich' : ''}{matchingIds.has(r.id) ? '' : ' · passt nicht zu deinen Einstellungen'}
          </Text>
          {pickFor ? (
            <Text style={[styles.hint, planTotal > weeklyBudget && local.over]}>
              {isCurrent ? 'Steht schon an diesem Tag' : inPlan.has(r.id) ? 'Steht schon an einem anderen Tag' : `Woche dann: ${euro(planTotal)} von ${euro(weeklyBudget)}`}
            </Text>
          ) : null}
        </View>
        <View style={local.prices}>
          <Text style={local.price}>{euro(r.pricePerPortion)}</Text>
          <Text style={styles.hint}>{euro(portionCost(r, householdSize))}</Text>
          {pickFor && !isCurrent ? (
            <Pressable onPress={() => pickFor.onPick(r.id)} style={local.pick} accessibilityRole="button" accessibilityLabel={`${r.name} nehmen`}>
              <Text style={local.pickText}>Nehmen</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {pickFor ? (
        <>
          <Pressable onPress={pickFor.onCancel} accessibilityRole="button">
            <Text style={local.back}>‹ Zurück zum Plan</Text>
          </Pressable>
          <Text style={styles.h1}>Gericht für {WEEKDAYS_LONG[pickFor.day]}</Text>
          <Text style={styles.sub}>
            Jetzt: {currentId ? RECIPE_BY_ID[currentId]?.name : '–'}. Tippe auf „Nehmen“, um zu tauschen, oder auf das Gericht, um das Rezept anzusehen.
          </Text>
          <Button label="Zufälligen Vorschlag nehmen" variant="secondary" onPress={pickFor.onRandom} />
        </>
      ) : (
        <>
          <Text style={styles.h1}>Rezepte</Text>
          <Text style={styles.sub}>
            {RECIPES.length} Rezepte · {matchingIds.size} passen zu deinen Einstellungen · {euro(Math.min(...prices))} bis {euro(Math.max(...prices))} pro Portion
          </Text>
          {onNew ? <Button label="+ Eigenes Rezept anlegen" variant="secondary" onPress={onNew} /> : null}
        </>
      )}

      <Split
        main={<>
      {(() => {
        const groups = GROUPS.map((g) => [g, shown.filter((r) => recipeGroup(r) === g)] as const).filter(([, list]) => list.length);
        // Beim Suchen und beim Aussuchen für einen Tag alles offen, sonst nur die aufgeklappten Kategorien
        const allOpen = !!needle || !!pickFor || isWide;
        const toggleGroup = (g: string) => set({ openGroups: openGroups.includes(g) ? openGroups.filter((x) => x !== g) : [...openGroups, g] });
        return (
          <>
            {!allOpen ? (
              <View style={styles.row}>
                <Chip label="Alle aufklappen" selected={false} onPress={() => set({ openGroups: groups.map(([g]) => g) })} />
                <Chip label="Alle zuklappen" selected={false} onPress={() => set({ openGroups: [] })} />
              </View>
            ) : null}
            {groups.map(([g, list]) => {
              const open = allOpen || openGroups.includes(g);
              const cheapest = Math.min(...list.map((r) => r.pricePerPortion));
              return (
                <View key={g} style={{ gap: 10 }}>
                  <Pressable onPress={() => toggleGroup(g)} disabled={allOpen} accessibilityRole="button" accessibilityState={{ expanded: open }}
                    style={(st) => [local.group, hov(st) && !allOpen && { backgroundColor: colors.cardHover }]}>
                    <Text style={local.groupTitle}>{g}</Text>
                    <Text style={styles.hint}>{list.length} {list.length === 1 ? 'Rezept' : 'Rezepte'} · ab {euro(cheapest)}</Text>
                    {!allOpen ? <Icon name={open ? 'chevron-up' : 'chevron-down'} /> : null}
                  </Pressable>
                  {open ? <Grid columns={recipeColumns} gap={10}>{list.map(renderRecipe)}</Grid> : null}
                </View>
              );
            })}
          </>
        );
      })()}
        </>}
        side={<View style={[styles.card, { gap: space.sm }]}>
      <TextInput
        value={query}
        onChangeText={(q) => set({ query: q })}
        placeholder="Suchen nach Gericht oder Zutat"
        placeholderTextColor={colors.muted}
        style={local.search}
        accessibilityLabel="Rezepte durchsuchen"
      />

      {!isWide ? (
        <Chip icon="sliders" label={`Filter & Sortierung${activeFilters ? ` (${activeFilters})` : ''}`} selected={showFilters} onPress={() => setShowFilters(!showFilters)} />
      ) : null}
      {isWide || showFilters ? (
        <>
      <Text style={local.label}>Eiweiß</Text>
      <View style={styles.chipRow}>
        <Chip label="Alle" selected={!protein} onPress={() => set({ protein: null })} />
        {(Object.keys(PROTEIN_LABELS) as Protein[]).map((p) => (
          <Chip key={p} label={PROTEIN_LABELS[p]} selected={protein === p} onPress={() => set({ protein: protein === p ? null : p })} />
        ))}
      </View>
      <Text style={local.label}>Sortieren</Text>
      <View style={styles.chipRow}>
        {SORTS.map(([id, label]) => (
          <Chip key={id} label={label} selected={sort === id} onPress={() => set({ sort: id })} />
        ))}
      </View>
      <Text style={local.label}>Nur zeigen</Text>
      <View style={styles.chipRow}>
        <Chip icon="check" label="Passt zu mir" selected={onlyMatching} onPress={() => set({ onlyMatching: !onlyMatching })} />
        <Chip icon="smile" label="Kinderfreundlich" selected={onlyKids} onPress={() => set({ onlyKids: !onlyKids })} />
      </View>
        </>
      ) : null}

      <Text style={styles.hint}>
        {shown.length} angezeigt · Preis pro Portion, rechts für {householdSize} {householdSize === 1 ? 'Person' : 'Personen'}
      </Text>

        </View>}
        sideFirst
        sideWidth={340}
      />
      {shown.length === 0 ? <Text style={styles.hint}>Keine Rezepte gefunden.</Text> : null}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  back: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  groupTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  search: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  current: { borderColor: colors.accent, borderWidth: 2 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  prices: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 16, fontWeight: '700', color: colors.accent },
  over: { color: colors.danger },
  pick: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accent },
  pickText: { color: colors.onAccent, fontWeight: '600' },
});
