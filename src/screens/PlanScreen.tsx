import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Cover, Field } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { addDays, isoDay, isoWeek, mondayOf, planMonday, shortDate, slotDate, todayIndex, todayInPlan } from '../logic/dates';
import { planCost, portionCost } from '../logic/generator';
import type { MealPlan, PhotoRef } from '../types';
import { Button, Card, Chip, Eyebrow, Grid, Icon, Tag, WEEKDAYS, WEEKDAYS_LONG, colors, euro, hov, space, styles, useLayout } from '../ui';

export { todayIndex };

export interface WeekNavProps {
  plan: MealPlan;
  relation: -1 | 0 | 1;
  onPrev?: () => void;
  onNext?: () => void;
}

export const relationLabel = (r: -1 | 0 | 1) => (r === 0 ? 'Diese Woche' : r === 1 ? 'Kommende Woche' : 'Vergangene Woche');

/** Zwischen gespeicherten Wochen blättern: ‹ KW 45 · 02.11.–08.11. › */
export function WeekNav({ plan, relation, onPrev, onNext }: WeekNavProps) {
  const monday = planMonday(plan);
  const arrow = (icon: 'chevron-left' | 'chevron-right', onPress?: () => void, label?: string) => (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}
      style={(s) => [local.navBtn, !onPress && { opacity: 0.3 }, hov(s) && onPress && { backgroundColor: colors.cardHover }]}>
      <Icon name={icon} size={20} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={local.nav}>
      {arrow('chevron-left', onPrev, 'Woche davor')}
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={local.navTitle}>KW {isoWeek(monday)} · {shortDate(monday)} – {shortDate(addDays(monday, 6))}</Text>
        <Text style={[styles.hint, relation === 0 && { color: colors.accent }, relation === 1 && { color: colors.info }]}>
          {relationLabel(relation)}{plan.saved ? ` · gespeichert${plan.name ? `: ${plan.name}` : ''}` : ''}
        </Text>
      </View>
      {arrow('chevron-right', onNext, 'Woche danach')}
    </View>
  );
}

/** Kalender eines Monats mit allen geplanten Gerichten (aktuelle und gespeicherte Wochen). */
function MonthView({ plans, onOpen }: { plans: MealPlan[]; onOpen: (recipeId: string) => void }) {
  const { isPhone } = useLayout();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // Tag (JJJJ-MM-TT) → Gericht; der erste Plan in der Liste gewinnt (aktueller vor gespeicherten)
  const byDay = useMemo(() => {
    const map = new Map<string, { recipeId: string; kind?: string }>();
    for (const p of plans) {
      for (const s of p.slots) {
        const key = isoDay(slotDate(p, s.day));
        if (!map.has(key)) map.set(key, { recipeId: s.recipeId, kind: s.kind });
      }
    }
    return map;
  }, [plans]);
  const today = isoDay(new Date());
  const start = mondayOf(month);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const title = month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const label = (key: string) => {
    const e = byDay.get(key);
    if (!e) return null;
    if (e.kind === 'restetag') return 'Restetag';
    const name = RECIPE_BY_ID[e.recipeId]?.name ?? '–';
    return e.kind === 'reste' ? `Reste: ${name}` : name;
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={local.nav}>
        <Pressable onPress={() => shift(-1)} style={local.navBtn} accessibilityLabel="Monat davor"><Icon name="chevron-left" size={20} color={colors.text} /></Pressable>
        <Text style={[local.navTitle, { flex: 1, textAlign: 'center' }]}>{title}</Text>
        <Pressable onPress={() => shift(1)} style={local.navBtn} accessibilityLabel="Monat danach"><Icon name="chevron-right" size={20} color={colors.text} /></Pressable>
      </View>
      {isPhone ? (
        // Auf dem Handy als Liste – sieben Spalten wären zu schmal zum Lesen
        <View>
          {days.filter((d) => d.getMonth() === month.getMonth()).map((d) => {
            const key = isoDay(d);
            const text = label(key);
            const e = byDay.get(key);
            return (
              <Pressable key={key} disabled={!e?.recipeId} onPress={() => e?.recipeId && onOpen(e.recipeId)}
                style={[local.monthRow, key === today && { backgroundColor: colors.accentSoft }, d.getDay() === 1 && { borderTopColor: colors.borderStrong }]}>
                <Text style={[local.monthDay, key === today && { color: colors.accent }]}>{WEEKDAYS[(d.getDay() + 6) % 7]} {shortDate(d)}</Text>
                <Text style={[local.monthText, !text && { color: colors.faint }]} numberOfLines={1}>{text ?? '–'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View>
          <View style={local.calRow}>{WEEKDAYS.map((w) => <Text key={w} style={[local.calHead]}>{w}</Text>)}</View>
          {Array.from({ length: days.length / 7 }, (_, w) => (
            <View key={w} style={local.calRow}>
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const key = isoDay(d);
                const text = label(key);
                const e = byDay.get(key);
                const inMonth = d.getMonth() === month.getMonth();
                return (
                  <Pressable key={key} disabled={!e?.recipeId} onPress={() => e?.recipeId && onOpen(e.recipeId)}
                    style={(s) => [local.calCell, !inMonth && { opacity: 0.35 }, key === today && { borderColor: colors.accent }, hov(s) && !!e?.recipeId && { backgroundColor: colors.cardHover }]}>
                    <Text style={[local.calNum, key === today && { color: colors.accent }]}>{d.getDate()}</Text>
                    {text ? <Text style={[local.calText, e?.kind && { color: colors.muted }]} numberOfLines={3}>{text}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <Text style={styles.hint}>Zeigt den aktuellen Plan und alle gespeicherten Wochen. Antippen öffnet das Rezept.</Text>
    </Card>
  );
}

export function PlanScreen({
  plan, isActive, nav, allPlans, savedPlans, householdSize, budget, favourites, cooked, photos, kidInfo, error,
  onOpen, onSwap, onChoose, onRegenerate, onPlanNext, onSaveWeek, onReuse, onUnsave, footer,
}: {
  /** Angezeigte Woche */
  plan: MealPlan;
  /** Der aktuelle Plan (bearbeitbar); gespeicherte Wochen sind nur zum Ansehen und Wiederverwenden */
  isActive: boolean;
  nav: WeekNavProps;
  allPlans: MealPlan[];
  savedPlans: MealPlan[];
  householdSize: number;
  budget: number;
  favourites: string[];
  cooked: string[];
  photos: Record<string, PhotoRef[]>;
  kidInfo: (recipeId: string) => { up: number; down: number };
  error: string | null;
  onOpen: (recipeId: string) => void;
  onSwap: (day: number) => void;
  onChoose: (day: number) => void;
  onRegenerate: () => void;
  /** Gesetzt, wenn schon die kommende Woche dran ist, aber noch kein Plan dafür existiert */
  onPlanNext?: { label: string; run: () => void };
  onSaveWeek: (name: string) => void;
  onReuse: (p: MealPlan) => void;
  onUnsave: (p: MealPlan) => void;
  footer?: ReactNode;
}) {
  const { columns } = useLayout();
  const [mode, setMode] = useState<'woche' | 'monat'>('woche');
  const [naming, setNaming] = useState<string | null>(null);
  const total = planCost(plan, householdSize, RECIPE_BY_ID);
  const today = todayInPlan(plan);
  const ratio = budget ? total / budget : 0;
  const cookedCount = plan.slots.filter((s) => !s.kind && cooked.includes(s.recipeId)).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={local.head}>
        <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
          <Text style={styles.h1}>{mode === 'monat' ? 'Monat' : isActive ? 'Deine Woche' : 'Gespeicherte Woche'}</Text>
          {mode === 'woche' ? (
            <Text style={styles.sub}>{plan.slots.filter((s) => !s.kind).length} Gerichte · {householdSize} {householdSize === 1 ? 'Person' : 'Personen'} · {cookedCount} gekocht</Text>
          ) : null}
        </View>
        <View style={styles.row}>
          <Chip label="Woche" selected={mode === 'woche'} onPress={() => setMode('woche')} />
          <Chip label="Monat" selected={mode === 'monat'} onPress={() => setMode('monat')} />
        </View>
      </View>

      {mode === 'monat' ? <MonthView plans={allPlans} onOpen={onOpen} /> : (
        <>
          <WeekNav {...nav} />

          {onPlanNext ? (
            <Card accent style={{ gap: space.sm }}>
              <Text style={styles.sectionTitle}>{onPlanNext.label} ist noch nicht geplant</Text>
              <Text style={styles.hint}>Jetzt planen, dann bis Samstag einkaufen. Diese Woche bleibt gespeichert.</Text>
              <Button label={`${onPlanNext.label} planen`} icon="calendar" onPress={onPlanNext.run} />
            </Card>
          ) : null}

          <Card>
            <View style={local.budgetRow}>
              <Text style={styles.sectionTitle}>Budget</Text>
              <Text style={[styles.sectionTitle, { color: ratio > 1 ? colors.danger : colors.text }]}>{euro(total)} <Text style={styles.hint}>von {euro(budget)}</Text></Text>
            </View>
            <View style={local.track}>
              <View style={[local.fill, { width: `${Math.min(100, ratio * 100)}%`, backgroundColor: ratio > 1 ? colors.danger : ratio > 0.85 ? colors.warn : colors.accent }]} />
            </View>
          </Card>

          <Grid columns={columns}>
            {plan.slots.map((slot) => {
              const isToday = slot.day === today;
              const dateText = isToday ? 'heute' : shortDate(slotDate(plan, slot.day));
              if (slot.kind === 'restetag') {
                return (
                  <Card key={slot.day} accent={isToday} style={[local.day, local.dashed]}>
                    <View style={local.dayHead}>
                      <Eyebrow color={isToday ? colors.accent : colors.muted}>{WEEKDAYS_LONG[slot.day]}</Eyebrow>
                      <Text style={styles.hint}>{dateText}</Text>
                    </View>
                    <View style={local.restIcon}><Icon name="refresh-ccw" size={22} color={colors.accent} /></View>
                    <Text style={local.name}>Restetag</Text>
                    <Text style={styles.hint}>Nichts kochen – Reste und Vorrat aufbrauchen.</Text>
                  </Card>
                );
              }
              const r = RECIPE_BY_ID[slot.recipeId];
              if (!r) return null;
              const kids = kidInfo(r.id);
              const isCooked = cooked.includes(r.id);
              const isReste = slot.kind === 'reste';
              return (
                <Card key={slot.day} accent={isToday} onPress={() => onOpen(r.id)} style={[local.day, isReste && local.dashed]}>
                  <View style={local.dayHead}>
                    <Eyebrow color={isToday ? colors.accent : colors.muted}>{WEEKDAYS_LONG[slot.day]}</Eyebrow>
                    <Text style={[styles.hint, isToday && { color: colors.accent }]}>{dateText}</Text>
                  </View>
                  {!isReste && (columns > 1 || photos[r.id]?.[0]) ? <Cover id={photos[r.id]?.[0]?.id} height={columns > 1 ? 120 : 170} /> : null}
                  <Text style={local.name} numberOfLines={2}>{r.name}{favourites.includes(r.id) ? '  ♥' : ''}</Text>
                  <View style={styles.row}>
                    {isReste ? <Tag label="Reste vom Vortag" tone="info" icon="refresh-ccw" />
                      : isCooked ? <Tag label="Gekocht" tone="accent" icon="check" /> : <Tag label={`${r.minutes} Min.`} tone="info" icon="clock" />}
                    {!isReste ? <Tag label={euro(portionCost(r, householdSize) * (plan.slots.some((s) => s.kind === 'reste' && s.recipeId === r.id) ? 2 : 1))} icon="tag" /> : null}
                    {kids.up ? <Tag label={`${kids.up}`} tone="accent" icon="thumbs-up" /> : null}
                    {kids.down ? <Tag label={`${kids.down}`} tone="danger" icon="thumbs-down" /> : null}
                  </View>
                  {isActive ? (
                    <View style={local.actions}>
                      <Pressable onPress={() => onChoose(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                        <Icon name="list" size={15} color={colors.accent} />
                        <Text style={styles.smallText}>{isReste ? 'Doch kochen' : 'Aussuchen'}</Text>
                      </Pressable>
                      {!isReste ? (
                        <Pressable onPress={() => onSwap(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                          <Icon name="shuffle" size={15} color={colors.accent} />
                          <Text style={styles.smallText}>Tauschen</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </Grid>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Card style={{ gap: space.sm }}>
            <Text style={styles.sectionTitle}>Woche speichern</Text>
            {naming !== null ? (
              <>
                <Field label="Name (optional)" value={naming} onChangeText={setNaming} placeholder="z. B. Kinder-Lieblingswoche" onSubmitEditing={() => { onSaveWeek(naming); setNaming(null); }} />
                <View style={styles.row}>
                  <View style={{ flex: 1, minWidth: 140 }}><Button label="Speichern" icon="bookmark" onPress={() => { onSaveWeek(naming); setNaming(null); }} /></View>
                  <View style={{ flex: 1, minWidth: 120 }}><Button label="Abbrechen" variant="ghost" onPress={() => setNaming(null)} /></View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.hint}>Jede Woche wird automatisch aufgehoben. Gespeicherte Wochen bleiben dauerhaft und lassen sich später mit einem Tipp wieder einplanen.</Text>
                <View style={styles.row}>
                  {!plan.saved ? <View style={{ flex: 1, minWidth: 160 }}><Button label="Diese Woche speichern" variant="secondary" icon="bookmark" onPress={() => setNaming(plan.name ?? '')} /></View> : null}
                  {plan.saved ? <View style={{ flex: 1, minWidth: 160 }}><Button label="Nicht mehr merken" variant="ghost" icon="x" onPress={() => onUnsave(plan)} /></View> : null}
                  {!isActive ? <View style={{ flex: 1, minWidth: 160 }}><Button label="Wieder einplanen" icon="copy" onPress={() => onReuse(plan)} /></View> : null}
                  {isActive ? <View style={{ flex: 1, minWidth: 160 }}><Button label="Neu würfeln" variant="ghost" icon="refresh-cw" onPress={onRegenerate} /></View> : null}
                </View>
              </>
            )}
          </Card>

          {savedPlans.length ? (
            <Card style={{ gap: 0 }}>
              <Text style={[styles.sectionTitle, { marginBottom: space.sm }]}>Gespeicherte Wochen</Text>
              {savedPlans.map((p) => (
                <View key={p.createdAt} style={local.savedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={local.savedName}>{p.name || `KW ${isoWeek(planMonday(p))}`}</Text>
                    <Text style={styles.hint} numberOfLines={1}>{p.slots.filter((s) => !s.kind).map((s) => RECIPE_BY_ID[s.recipeId]?.name).filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pressable onPress={() => onReuse(p)} style={styles.small}><Text style={styles.smallText}>Einplanen</Text></Pressable>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      )}
      {footer}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  navBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  navTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.input, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  day: { gap: space.sm },
  dashed: { borderStyle: 'dashed' },
  restIcon: { height: 64, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, minHeight: 22 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  action: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actionHover: { backgroundColor: '#25402F' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  savedName: { fontSize: 15, fontWeight: '700', color: colors.text },
  calRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  calHead: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 1 },
  calCell: { flex: 1, minHeight: 92, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 6, gap: 4 },
  calNum: { fontSize: 12, fontWeight: '700', color: colors.muted },
  calText: { fontSize: 12, lineHeight: 16, color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 6 },
  monthDay: { width: 84, fontSize: 13, fontWeight: '700', color: colors.muted },
  monthText: { flex: 1, fontSize: 14, color: colors.text },
});
