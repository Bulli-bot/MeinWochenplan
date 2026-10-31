import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SyncStatus } from '../cloud';
import { BigPhoto, Cover } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { greeting, isoWeek, shortDate, slotDate, todayIndex } from '../logic/dates';
import { planCost, portionCost } from '../logic/generator';
import { applyPantry, findPantry } from '../logic/pantry';
import { weekKey } from '../logic/receipt';
import { buildShoppingList } from '../logic/shoppingList';
import type { AppState, MealPlan, Settings } from '../types';
import { Button, Card, Eyebrow, Grid, Icon, Tag, WEEKDAYS, colors, euro, space, styles, useLayout, type IconName } from '../ui';
import { CategoryBar } from './ExpensesScreen';

export type OverviewTarget = 'plan' | 'einkauf' | 'ausgaben' | 'rezepte' | 'ki';

/** Wie viele Zutaten eines Rezepts weder abgehakt noch im Vorrat sind. */
function missingCount(recipeId: string, state: AppState): number {
  const r = RECIPE_BY_ID[recipeId];
  if (!r) return 0;
  return r.ingredients.filter((i) => !state.checkedItems.includes(`${i.name.toLowerCase()}|${i.unit}`) && !findPantry(state.pantry, i.name)).length;
}

function Kpi({ icon, label, value, sub, tone = colors.text }: { icon: IconName; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card style={local.kpi}>
      <View style={local.kpiHead}>
        <View style={local.kpiIcon}><Icon name={icon} size={16} color={colors.accent} /></View>
        <Text style={styles.hint}>{label}</Text>
      </View>
      <Text style={[local.kpiValue, { color: tone }]}>{value}</Text>
      {sub ? <Text style={styles.hint}>{sub}</Text> : null}
    </Card>
  );
}

export function OverviewScreen({ state, settings, plan, name, notice, syncStatus, onOpen, onGo }: {
  /** Einmaliger Hinweis, z. B. nach Übernahme der alten Daten */
  notice?: string | null;
  state: AppState;
  settings: Settings;
  plan: MealPlan;
  /** Anzeigename aus dem Konto, falls vorhanden */
  name?: string;
  syncStatus: SyncStatus;
  onOpen: (recipeId: string) => void;
  onGo: (target: OverviewTarget) => void;
}) {
  const { columns, isPhone } = useLayout();
  const today = todayIndex();
  const total = planCost(plan, settings.householdSize, RECIPE_BY_ID);
  const thisWeek = weekKey(new Date().toISOString());
  const weekPurchases = state.purchases.filter((p) => weekKey(p.date) === thisWeek);
  const spent = weekPurchases.reduce((s, p) => s + p.total, 0);
  const cookedCount = plan.slots.filter((s) => state.cooked.includes(s.recipeId)).length;
  const open = useMemo(() => {
    const { toBuy } = applyPantry(buildShoppingList(plan, settings.householdSize), state.pantry);
    return toBuy.filter((i) => !state.checkedItems.includes(i.key)).length;
  }, [plan, settings.householdSize, state.pantry, state.checkedItems]);

  const sorted = [...plan.slots].sort((a, b) => ((a.day - today + 7) % 7) - ((b.day - today + 7) % 7));
  const next = sorted.find((s) => !state.cooked.includes(s.recipeId));
  const nextRecipe = next ? RECIPE_BY_ID[next.recipeId] : undefined;
  const budgetTone = spent > settings.weeklyBudget ? colors.danger : spent > settings.weeklyBudget * 0.85 ? colors.warn : colors.text;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={local.header}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={styles.h1}>{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.sub}>KW {isoWeek()} · {settings.householdSize} Personen · {plan.slots.length} Gerichte geplant</Text>
        </View>
        <Tag label={syncStatus.kind === 'ok' ? 'Synchron' : syncStatus.kind === 'fehler' ? 'Sync-Fehler' : syncStatus.kind === 'läuft' ? 'Sync läuft' : 'Nur lokal'}
          tone={syncStatus.kind === 'ok' ? 'accent' : syncStatus.kind === 'fehler' ? 'danger' : 'muted'} icon="cloud" />
      </View>

      {notice ? <Card style={{ borderColor: colors.accent }}><Text style={styles.hint}>{notice}</Text></Card> : null}

      <Grid columns={isPhone ? 2 : 4}>
        <Kpi icon="pie-chart" label="Plan diese Woche" value={euro(total)} sub={`von ${euro(settings.weeklyBudget)} Budget`} />
        <Kpi icon="credit-card" label="Ausgegeben" value={euro(spent)} sub={weekPurchases.length === 1 ? "1 Einkauf" : `${weekPurchases.length} Einkäufe`} tone={budgetTone} />
        <Kpi icon="check-circle" label="Gekocht" value={`${cookedCount} / ${plan.slots.length}`} sub="diese Woche" />
        <Kpi icon="shopping-cart" label="Noch kaufen" value={String(open)} sub={`${state.pantry.length} im Vorrat`} />
      </Grid>

      {nextRecipe && next ? (
        <Card accent onPress={() => onOpen(nextRecipe.id)}>
          <View style={[local.hero, isPhone && { flexDirection: 'column' }]}>
            <View style={{ flex: 1.2, minWidth: 0 }}>
              {state.photos[nextRecipe.id]?.[0] ? <BigPhoto id={state.photos[nextRecipe.id][0].id} /> : <Cover id={undefined} height={isPhone ? 140 : 200} />}
            </View>
            <View style={{ flex: 1, gap: space.sm, justifyContent: 'center' }}>
              <Eyebrow color={colors.accent}>{next.day === today ? 'Heute' : `Als Nächstes · ${WEEKDAYS[next.day]} ${shortDate(slotDate(plan, next.day))}`}</Eyebrow>
              <Text style={styles.h2}>{nextRecipe.name}</Text>
              <View style={styles.row}>
                <Tag label={`${nextRecipe.minutes} Min.`} tone="info" icon="clock" />
                <Tag label={euro(portionCost(nextRecipe, settings.householdSize))} icon="tag" />
                {(() => {
                  const m = missingCount(nextRecipe.id, state);
                  return m ? <Tag label={`${m} Zutaten fehlen`} tone="warn" icon="alert-triangle" /> : <Tag label="Alles da" tone="accent" icon="check" />;
                })()}
              </View>
              <Button label="Rezept öffnen" icon="book-open" onPress={() => onOpen(nextRecipe.id)} />
            </View>
          </View>
        </Card>
      ) : (
        <Card><Text style={styles.sectionTitle}>Alles gekocht – stark!</Text><Text style={styles.hint}>Zeit für einen neuen Plan unter „Woche“.</Text></Card>
      )}

      <View style={local.sectionHead}>
        <Text style={styles.h2}>Diese Woche</Text>
        <Button label="Ganze Woche" variant="ghost" icon="calendar" onPress={() => onGo('plan')} />
      </View>
      <Grid columns={columns}>
        {plan.slots.map((slot) => {
          const r = RECIPE_BY_ID[slot.recipeId];
          if (!r) return null;
          const isToday = slot.day === today;
          const cooked = state.cooked.includes(r.id);
          const missing = missingCount(r.id, state);
          return (
            <Card key={slot.day} accent={isToday} onPress={() => onOpen(r.id)} style={[local.day, cooked && { opacity: 0.8 }]}>
              <Eyebrow color={isToday ? colors.accent : colors.muted}>{isToday ? 'Heute · ' : ''}{WEEKDAYS[slot.day]} {shortDate(slotDate(plan, slot.day))}</Eyebrow>
              {columns > 1 ? <Cover id={state.photos[r.id]?.[0]?.id} height={110} /> : null}
              <Text style={local.dayName} numberOfLines={2}>{r.name}</Text>
              <View style={styles.row}>
                {cooked ? <Tag label="Gekocht" tone="accent" icon="check" /> : <Tag label={`${r.minutes} Min.`} tone="info" icon="clock" />}
                {!cooked && missing ? <Tag label={`${missing} fehlen`} tone="warn" /> : null}
              </View>
            </Card>
          );
        })}
      </Grid>

      <Grid columns={isPhone ? 1 : 3}>
        <Card onPress={() => onGo('ki')}>
          <View style={local.sectionHead}>
            <Text style={styles.sectionTitle}>KI-Assistent</Text>
            <Icon name="zap" color={colors.accent} />
          </View>
          <Text style={styles.hint}>„Was koche ich aus meinem Vorrat?“ – Ideen, Rezepte und Spartipps.</Text>
        </Card>
        <Card onPress={() => onGo('einkauf')}>
          <View style={local.sectionHead}>
            <Text style={styles.sectionTitle}>Einkaufsliste</Text>
            <Icon name="chevron-right" />
          </View>
          <Text style={styles.hint}>{open ? `${open} Artikel offen – an Bring! übergeben oder direkt abhaken.` : 'Alles eingekauft.'}</Text>
        </Card>
        <Card onPress={() => onGo('ausgaben')}>
          <View style={local.sectionHead}>
            <Text style={styles.sectionTitle}>Ausgaben KW {isoWeek()}</Text>
            <Icon name="chevron-right" />
          </View>
          {weekPurchases.length ? <CategoryBar purchases={weekPurchases} /> : <Text style={styles.hint}>Noch kein Bon diese Woche – nach dem Einkauf fotografieren.</Text>}
        </Card>
      </Grid>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  kpi: { gap: 6 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kpiIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  hero: { flexDirection: 'row', gap: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  day: { minHeight: 120 },
  dayName: { fontSize: 16, fontWeight: '700', color: colors.text },
});
