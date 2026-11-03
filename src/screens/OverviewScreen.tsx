import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SyncStatus } from '../cloud';
import { BigPhoto, Cover } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { greeting, isoWeek, planMonday, shortDate, slotDate, todayInPlan } from '../logic/dates';
import { eligibleRecipes, planCost, portionCost } from '../logic/generator';
import { leftoverIdeas, useSoon } from '../logic/leftovers';
import { dueSoon, findPantry } from '../logic/pantry';
import { openShopping } from '../logic/shopPrice';
import { isBasic } from '../logic/shoppingList';
import type { AppState, MealPlan, Purchase, Settings } from '../types';
import { Button, Card, Eyebrow, Grid, Icon, Tag, WEEKDAYS, colors, euro, hov, space, styles, useLayout, type IconName } from '../ui';
import { CategoryBar } from './ExpensesScreen';
import { WeekNav, relationLabel, type WeekNavProps } from './PlanScreen';

export type OverviewTarget = 'plan' | 'einkauf' | 'ausgaben' | 'rezepte' | 'ki' | 'vorrat';

/** Wie viele Zutaten eines Rezepts weder abgehakt noch im Vorrat sind. */
function missingCount(recipeId: string, state: AppState, settings: Settings): number {
  const r = RECIPE_BY_ID[recipeId];
  if (!r) return 0;
  return r.ingredients.filter((i) => !isBasic(i.name, settings.basics) && !state.checkedItems.includes(`${i.name.toLowerCase()}|${i.unit}`) && !findPantry(state.pantry, i.name)).length;
}

function Kpi({ icon, label, value, sub, tone = colors.text, onPress }: { icon: IconName; label: string; value: string; sub?: string; tone?: string; onPress?: () => void }) {
  return (
    <Card style={local.kpi} onPress={onPress}>
      <View style={local.kpiHead}>
        <View style={local.kpiIcon}><Icon name={icon} size={16} color={colors.accent} /></View>
        <Text style={styles.hint} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[local.kpiValue, { color: tone }]}>{value}</Text>
      {sub ? <Text style={styles.hint}>{sub}</Text> : null}
    </Card>
  );
}

export function OverviewScreen({ state, settings, plan, isActive, nav, todayPlan, weekPurchases, showExpenses, name, notice, syncStatus, onOpen, onGo, onPlanNext, onToShopping }: {
  state: AppState;
  settings: Settings;
  /** Angezeigte Woche */
  plan: MealPlan;
  isActive: boolean;
  nav: WeekNavProps;
  /** Plan, der heute gilt (kann eine gespeicherte Woche sein, wenn die neue schon geplant ist) */
  todayPlan: MealPlan | null;
  /** Einkäufe, die zur angezeigten Woche zählen */
  weekPurchases: Purchase[];
  /** Ausgaben-Karte zeigen (am Desktop steht sie in der Seitenleiste) */
  showExpenses: boolean;
  /** Anzeigename aus dem Konto, falls vorhanden */
  name?: string;
  /** Einmaliger Hinweis, z. B. nach Übernahme der alten Daten */
  notice?: string | null;
  syncStatus: SyncStatus;
  onOpen: (recipeId: string) => void;
  onGo: (target: OverviewTarget) => void;
  onPlanNext?: { label: string; run: () => void };
  onToShopping: (name: string) => void;
}) {
  const { columns, isPhone } = useLayout();
  const cooked = isActive ? state.cooked : plan.cooked ?? [];
  const total = planCost(plan, settings.householdSize, RECIPE_BY_ID);
  const spent = weekPurchases.reduce((s, p) => s + p.total, 0);
  const meals = plan.slots.filter((s) => !s.kind);
  const cookedCount = meals.filter((s) => cooked.includes(s.recipeId)).length;
  const soon = dueSoon(state.pantry);
  const leftovers = useMemo(() => leftoverIdeas(eligibleRecipes({
    settings, favourites: state.favourites, ratings: state.ratings, recentRecipeIds: state.recentRecipeIds, kidVotes: state.kidVotes, pantry: state.pantry,
  }), state.pantry), [settings, state.favourites, state.ratings, state.recentRecipeIds, state.kidVotes, state.pantry]);
  const shop = useMemo(() => openShopping(state, plan, settings), [state, plan, settings]);
  const open = shop.count;

  // „Heute“ aus dem Plan, der heute gilt; sonst das erste noch nicht gekochte Gericht der angezeigten Woche ab Montag
  const todayIdx = todayPlan ? todayInPlan(todayPlan) : null;
  const heroPlan = todayPlan && todayIdx !== null ? todayPlan : plan;
  const isTodayPlan = heroPlan === todayPlan;
  // Gespeicherte Wochen tragen ihr „gekocht“ selbst, der aktuelle Plan nutzt state.cooked
  const heroCooked = heroPlan.cooked ?? state.cooked;
  const fromDay = isTodayPlan ? todayIdx ?? 0 : 0;
  const next = heroPlan.slots
    .filter((s) => s.kind !== 'restetag' && s.day >= fromDay)
    .find((s) => (isTodayPlan && s.day === todayIdx) || !heroCooked.includes(s.recipeId));
  const todaySlot = isTodayPlan ? heroPlan.slots.find((s) => s.day === todayIdx) : undefined;
  const nextRecipe = next ? RECIPE_BY_ID[next.recipeId] : undefined;
  const budgetTone = spent > settings.weeklyBudget ? colors.danger : spent > settings.weeklyBudget * 0.85 ? colors.warn : colors.text;
  const shownToday = todayInPlan(plan);
  const kw = isoWeek(planMonday(plan));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={local.header}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={styles.h1}>{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.sub}>{settings.householdSize} Personen · {meals.length} Gerichte geplant</Text>
        </View>
        <Tag label={syncStatus.kind === 'ok' ? 'Synchron' : syncStatus.kind === 'fehler' ? 'Sync-Fehler' : syncStatus.kind === 'läuft' ? 'Sync läuft' : 'Nur lokal'}
          tone={syncStatus.kind === 'ok' ? 'accent' : syncStatus.kind === 'fehler' ? 'danger' : 'muted'} icon="cloud" />
      </View>

      {notice ? <Card style={{ borderColor: colors.accent }}><Text style={styles.hint}>{notice}</Text></Card> : null}

      <WeekNav {...nav} />

      {onPlanNext ? (
        <Card accent style={{ gap: space.sm }}>
          <Text style={styles.sectionTitle}>{onPlanNext.label} planen</Text>
          <Text style={styles.hint}>Heute ist Planungstag – neuen Plan erstellen und bis Samstag einkaufen. Die laufende Woche bleibt gespeichert.</Text>
          <Button label={`${onPlanNext.label} planen`} icon="calendar" onPress={onPlanNext.run} />
        </Card>
      ) : null}

      <Grid columns={isPhone ? 2 : 4}>
        <Kpi icon="pie-chart" label={`Plan KW ${kw}`} value={euro(total)} sub={`von ${euro(settings.weeklyBudget)} Budget`} />
        <Kpi icon="credit-card" label={`Ausgegeben KW ${kw}`} value={euro(spent)} sub={weekPurchases.length === 1 ? '1 Einkauf' : `${weekPurchases.length} Einkäufe`} tone={budgetTone} onPress={() => onGo('ausgaben')} />
        <Kpi icon="check-circle" label="Gekocht" value={`${cookedCount} / ${meals.length}`} sub={relationLabel(nav.relation)} />
        <Kpi icon="shopping-cart" label="Noch kaufen" value={open ? `ca. ${euro(shop.cost)}` : '0'}
          sub={open ? `${open} Artikel${shop.unpriced ? ` · ${shop.unpriced} ohne Preis` : ''}` : `${state.pantry.length} im Vorrat`} onPress={() => onGo('einkauf')} />
      </Grid>

      {soon.length ? (
        <Card style={{ borderColor: colors.warn, gap: space.sm }}>
          <View style={styles.row}><Icon name="bell" color={colors.warn} /><Text style={styles.sectionTitle}>Bald leer</Text></View>
          {soon.slice(0, 4).map(({ item, left, days }) => {
            const listed = state.shopExtras.some((x) => !x.done && x.name.toLowerCase() === item.name.toLowerCase());
            return (
              <View key={item.name} style={local.soonRow}>
                <Text style={[styles.hint, { flex: 1, color: colors.text }]}>
                  <Text style={{ fontWeight: '700' }}>{item.name}</Text> · {days === 0 ? 'heute leer' : `noch ${left.toLocaleString('de-DE')} ${item.unit ?? ''}, reicht ${days === 1 ? 'bis morgen' : `${days} Tage`}`}
                </Text>
                {listed ? <Tag label="auf der Liste" tone="accent" icon="check" /> : (
                  <Pressable onPress={() => onToShopping(item.name)} style={styles.small}><Text style={styles.smallText}>Auf die Liste</Text></Pressable>
                )}
              </View>
            );
          })}
          <Pressable onPress={() => onGo('vorrat')}><Text style={[styles.hint, { color: colors.accent }]}>Zum Vorrat ›</Text></Pressable>
        </Card>
      ) : null}

      {leftovers.length ? (
        <Card style={{ gap: space.sm }}>
          <View style={styles.row}><Icon name="refresh-cw" color={colors.accent} /><Text style={styles.sectionTitle}>Reste verwerten</Text></View>
          <Text style={styles.hint}>
            Muss bald weg: {useSoon(state.pantry).map(({ item, days }) => `${item.name} (${days < 0 ? 'abgelaufen' : days === 0 ? 'heute' : days === 1 ? 'morgen' : `${days} Tage`})`).join(', ')}
          </Text>
          {leftovers.map((idea) => (
            <Pressable key={idea.recipe.id} onPress={() => onOpen(idea.recipe.id)} style={(s) => [local.soonRow, hov(s) && { opacity: 0.85 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hint, { color: colors.text, fontWeight: '700' }]}>{idea.recipe.name}</Text>
                <Text style={styles.hint}>
                  verbraucht {idea.urgent.join(', ')}{idea.have.length ? ` · auch da: ${idea.have.slice(0, 3).join(', ')}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" color={colors.muted} />
            </Pressable>
          ))}
          <Text style={styles.hint}>Neue Pläne nehmen solche Gerichte bevorzugt. Für einen Tag: Woche → Tag → „Selbst aussuchen“.</Text>
        </Card>
      ) : null}

      {todaySlot?.kind === 'restetag' ? (
        <Card accent><Eyebrow color={colors.accent}>Heute</Eyebrow><Text style={styles.h2}>Restetag</Text><Text style={styles.hint}>Nichts kochen – Reste und Vorrat aufbrauchen.</Text></Card>
      ) : nextRecipe && next ? (
        <Card accent onPress={() => onOpen(nextRecipe.id)}>
          <View style={[local.hero, isPhone && { flexDirection: 'column' }]}>
            <View style={{ flex: 1.2, minWidth: 0 }}>
              {state.photos[nextRecipe.id]?.[0] ? <BigPhoto id={state.photos[nextRecipe.id][0].id} /> : <Cover id={undefined} height={isPhone ? 140 : 200} />}
            </View>
            <View style={{ flex: 1, gap: space.sm, justifyContent: 'center' }}>
              <Eyebrow color={colors.accent}>{heroPlan === todayPlan && next.day === todayIdx ? 'Heute' : `Als Nächstes · ${WEEKDAYS[next.day]} ${shortDate(slotDate(heroPlan, next.day))}`}</Eyebrow>
              <Text style={styles.h2}>{nextRecipe.name}</Text>
              <View style={styles.row}>
                {heroPlan.slots.find((s) => s.day === next.day)?.kind === 'reste' ? <Tag label="Reste vom Vortag" tone="info" icon="refresh-ccw" /> : null}
                <Tag label={`${nextRecipe.minutes} Min.`} tone="info" icon="clock" />
                <Tag label={euro(portionCost(nextRecipe, settings.householdSize))} icon="tag" />
                {(() => {
                  const m = missingCount(nextRecipe.id, state, settings);
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
        <Text style={styles.h2}>{relationLabel(nav.relation)}</Text>
        <Button label="Ganze Woche" variant="ghost" icon="calendar" onPress={() => onGo('plan')} />
      </View>
      <Grid columns={columns}>
        {plan.slots.map((slot) => {
          const isToday = slot.day === shownToday;
          const head = `${isToday ? 'Heute · ' : ''}${WEEKDAYS[slot.day]} ${shortDate(slotDate(plan, slot.day))}`;
          if (slot.kind === 'restetag') {
            return (
              <Card key={slot.day} accent={isToday} style={[local.day, { borderStyle: 'dashed' }]}>
                <Eyebrow color={isToday ? colors.accent : colors.muted}>{head}</Eyebrow>
                <Text style={local.dayName}>Restetag</Text>
                <Text style={styles.hint}>Reste und Vorrat aufbrauchen</Text>
              </Card>
            );
          }
          const r = RECIPE_BY_ID[slot.recipeId];
          if (!r) return null;
          const isCooked = cooked.includes(r.id);
          const missing = missingCount(r.id, state, settings);
          return (
            <Card key={slot.day} accent={isToday} onPress={() => onOpen(r.id)} style={[local.day, isCooked && { opacity: 0.8 }, slot.kind === 'reste' && { borderStyle: 'dashed' }]}>
              <Eyebrow color={isToday ? colors.accent : colors.muted}>{head}</Eyebrow>
              {columns > 1 && slot.kind !== 'reste' ? <Cover id={state.photos[r.id]?.[0]?.id} height={110} /> : null}
              <Text style={local.dayName} numberOfLines={2}>{r.name}</Text>
              <View style={styles.row}>
                {slot.kind === 'reste' ? <Tag label="Reste" tone="info" icon="refresh-ccw" />
                  : isCooked ? <Tag label="Gekocht" tone="accent" icon="check" /> : <Tag label={`${r.minutes} Min.`} tone="info" icon="clock" />}
                {!isCooked && !slot.kind && missing && isActive ? <Tag label={`${missing} fehlen`} tone="warn" /> : null}
              </View>
            </Card>
          );
        })}
      </Grid>

      <Grid columns={isPhone ? 1 : showExpenses ? 3 : 2}>
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
          <Text style={styles.hint}>{open ? `${open} Artikel offen – im Laden direkt abhaken.` : 'Alles eingekauft.'}</Text>
        </Card>
        {showExpenses ? (
          <Card onPress={() => onGo('ausgaben')}>
            <View style={local.sectionHead}>
              <Text style={styles.sectionTitle}>Ausgaben KW {kw}</Text>
              <Icon name="chevron-right" />
            </View>
            {weekPurchases.length ? <CategoryBar purchases={weekPurchases} /> : <Text style={styles.hint}>Noch kein Bon für diese Woche – nach dem Einkauf fotografieren.</Text>}
          </Card>
        ) : null}
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
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', paddingVertical: 4 },
  day: { minHeight: 120 },
  dayName: { fontSize: 16, fontWeight: '700', color: colors.text },
});
