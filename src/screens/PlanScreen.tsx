import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Cover, Field } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { addDays, isoDay, isoWeek, mondayOf, planMonday, shortDate, slotDate, todayIndex, todayInPlan } from '../logic/dates';
import { planCost, portionCost } from '../logic/generator';
import type { MealPlan, PhotoRef, FamilyVote } from '../types';
import { seasonalIngredients } from '../data/season';
import { weekBalance } from '../logic/balance';
import { dislikedBy, fmtPeople, getMembers, initials, slotPeople } from '../logic/people';
import { shiftTime } from '../logic/mealtime';
import { Button, Card, Chip, Eyebrow, Grid, Icon, Split, Tag, WEEKDAYS, WEEKDAYS_LONG, autoColumns, colors, euro, hov, space, splitMainWidth, styles, useLayout } from '../ui';

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
function MonthView({ plans, startAt, onOpen }: { plans: MealPlan[]; startAt: Date; onOpen: (recipeId: string) => void }) {
  const { isPhone } = useLayout();
  // Startet beim Monat der angezeigten Woche (Plan für Anfang November → November)
  const [month, setMonth] = useState(() => new Date(startAt.getFullYear(), startAt.getMonth(), 1));
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
  onOpen, onSwap, onChoose, onMove, onGuests, onAbsent, mealTime, onEatAt, shopPanel, wishes, vote, onVote, onReview, onRegenerate, onPlanNext, onSaveWeek, onReuse, onUnsave, footer,
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
  /** Zwei Tage tauschen (Gericht wandert mit) */
  onMove: (from: number, to: number) => void;
  /** Personen an einem Tag (undefined = wie Haushalt) */
  onGuests: (day: number, guests: number | undefined) => void;
  /** Mitglied isst an diesem Tag (nicht) mit */
  onAbsent: (day: number, name: string) => void;
  /** Übliche Essenszeit „HH:MM“ */
  mealTime: string;
  /** Eigene Essenszeit an einem Tag (undefined = Standard) */
  onEatAt: (day: number, time: string | undefined) => void;
  /** Ultrawide: Live-Einkaufszettel als eigene Spalte */
  shopPanel?: ReactNode;
  /** Wunschessen der Kinder: Kind → Rezept-ID */
  wishes: Record<string, string>;
  /** Laufende Familien-Abstimmung */
  vote: FamilyVote | undefined;
  onVote: () => void;
  onReview: () => void;
  onRegenerate: () => void;
  /** Gesetzt, wenn schon die kommende Woche dran ist, aber noch kein Plan dafür existiert */
  onPlanNext?: { label: string; run: () => void };
  onSaveWeek: (name: string) => void;
  onReuse: (p: MealPlan) => void;
  onUnsave: (p: MealPlan) => void;
  footer?: ReactNode;
}) {
  const { columns: baseColumns, width, isWide, isDesktop } = useLayout();
  // Neben der Seitenspalte so viele Tage nebeneinander, wie hineinpassen (Ultrawide: alle 7)
  const columns = isDesktop ? autoColumns(splitMainWidth(width, 380, !!shopPanel), 175, 7) : baseColumns;
  const [mode, setMode] = useState<'woche' | 'monat'>('woche');
  /** Tag, der gerade verschoben wird – der nächste angetippte Tag tauscht mit ihm */
  const [moving, setMoving] = useState<number | null>(null);
  /** Tag, bei dem die Personenzahl gerade geändert wird */
  const [guestDay, setGuestDay] = useState<number | null>(null);
  /** Tag, dessen Essenszeit gerade geändert wird */
  const [timeDay, setTimeDay] = useState<number | null>(null);
  const tapDay = (day: number, open: () => void) => {
    if (moving === null) return open();
    if (moving !== day) onMove(moving, day);
    setMoving(null);
  };
  const [naming, setNaming] = useState<string | null>(null);
  const total = planCost(plan, householdSize, RECIPE_BY_ID);
  const today = todayInPlan(plan);
  const todaySlot = plan.slots.find((x) => x.day === today && !x.kind);
  const todayRecipe = todaySlot ? RECIPE_BY_ID[todaySlot.recipeId] : undefined;
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

      {mode === 'monat' ? <MonthView plans={allPlans} startAt={planMonday(plan)} onOpen={onOpen} /> : (
        <>
          <WeekNav {...nav} />

          {onPlanNext ? (
            <Card accent style={{ gap: space.sm }}>
              <Text style={styles.sectionTitle}>{onPlanNext.label} ist noch nicht geplant</Text>
              <Text style={styles.hint}>Jetzt planen, dann bis Samstag einkaufen. Diese Woche bleibt gespeichert.</Text>
              <Button label={`${onPlanNext.label} planen`} icon="calendar" onPress={onPlanNext.run} />
            </Card>
          ) : null}

          <Split sideFirst extra={shopPanel}
            side={<>
              {isWide && isActive && todaySlot && todayRecipe ? (
                <Card accent style={{ gap: space.sm }}>
                  <Tag label="Heute" tone="accent" icon="sun" />
                  <Text style={local.name}>{todayRecipe.name}</Text>
                  <Text style={styles.hint}>{todayRecipe.minutes} Min. · Essen um {todaySlot.eatAt ?? mealTime} · {fmtPeople(slotPeople(todaySlot, householdSize))} Port.</Text>
                  <Button label="Rezept und Kochmodus" icon="play" onPress={() => onOpen(todayRecipe.id)} />
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

            {(() => {
              const bal = weekBalance(plan, RECIPE_BY_ID);
              const wishList = Object.entries(wishes).filter(([, id]) => RECIPE_BY_ID[id]);
              if (!bal.parts.length && !wishList.length) return null;
              return (
                <Card style={{ gap: 6 }}>
                  <View style={styles.row}><Icon name="activity" color={colors.accent} /><Text style={styles.sectionTitle}>Ausgewogenheit</Text></View>
                  <Text style={styles.hint}>{bal.parts.join(' · ')}</Text>
                  {bal.hints.map((h) => <Text key={h} style={[styles.hint, { color: colors.warn }]}>{h}</Text>)}
                  {wishList.length ? (
                    <Text style={styles.hint}>
                      Wunschessen: {wishList.map(([kid, id]) => `${kid} → ${RECIPE_BY_ID[id].name}${plan.slots.some((s) => s.recipeId === id) ? ' ✓' : ''}`).join(' · ')}
                    </Text>
                  ) : null}
                </Card>
              );
            })()}

            {/* Ab Freitag oder für vergangene Wochen: Rückblick */}
            {!isActive || (todayInPlan(plan) ?? 0) >= 4 ? (
              <Card onPress={onReview} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <Icon name="award" color={colors.warn} />
                  <Text style={[styles.sectionTitle, { flex: 1 }]}>Wochen-Rückblick</Text>
                  <Icon name="chevron-right" color={colors.muted} />
                </View>
                <Text style={styles.hint}>Was gekocht wurde, was es gekostet hat, was übrig ist.</Text>
              </Card>
            ) : null}

            {isActive ? (
              <Card onPress={onVote} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <Icon name="check-square" color={colors.accent} />
                  <Text style={[styles.sectionTitle, { flex: 1 }]}>Familien-Abstimmung</Text>
                  <Icon name="chevron-right" color={colors.muted} />
                </View>
                <Text style={styles.hint}>
                  {vote ? `Läuft · ${Object.keys(vote.ballots).length} haben abgestimmt – Ergebnis fließt in den nächsten Plan` : 'Alle wählen aus 10 Vorschlägen, was nächste Woche auf den Tisch kommt.'}
                </Text>
              </Card>
            ) : null}
            </>}
            main={<>
              {moving !== null ? (
                <Card style={{ borderColor: colors.accent, gap: space.sm }}>
                  <Text style={styles.sectionTitle}>{WEEKDAYS_LONG[moving]} verschieben</Text>
                  <Text style={styles.hint}>Tippe auf den Tag, mit dem getauscht werden soll.</Text>
                  <Pressable onPress={() => setMoving(null)}><Text style={[styles.hint, { color: colors.accent }]}>Abbrechen</Text></Pressable>
                </Card>
              ) : null}

              <Grid columns={columns}>
                {plan.slots.map((slot) => {
                  const isToday = slot.day === today;
                  const dateText = isToday ? 'heute' : shortDate(slotDate(plan, slot.day));
                  if (slot.kind === 'restetag') {
                    return (
                      <Card key={slot.day} accent={isToday || moving === slot.day} onPress={moving !== null ? () => tapDay(slot.day, () => {}) : undefined}
                        style={[local.day, local.dashed, moving !== null && moving !== slot.day && local.target]}>
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
                  const source = isReste ? plan.slots.find((x) => x.recipeId === r.id && !x.kind) : undefined;
                  const people = slotPeople(slot, householdSize);
                  const disliked = dislikedBy(r);
                  // Gekochte Tage (außer heute) kompakt und blasser – die kommenden stechen hervor
                  const compact = isCooked && !isToday;
                  return (
                    <Card key={slot.day} accent={isToday || moving === slot.day} onPress={() => tapDay(slot.day, () => onOpen(r.id))}
                      style={[local.day, isReste && local.dashed, compact && moving === null && local.done, moving !== null && moving !== slot.day && local.target]}>
                      <View style={local.dayHead}>
                        <Eyebrow color={isToday ? colors.accent : colors.muted}>{WEEKDAYS_LONG[slot.day]}</Eyebrow>
                        <Text style={[styles.hint, isToday && { color: colors.accent }]}>{dateText}</Text>
                      </View>
                      {!isReste && !compact && (columns > 1 || photos[r.id]?.[0]) ? <Cover id={photos[r.id]?.[0]?.id} height={columns > 1 ? 120 : 170} /> : null}
                      {isReste && source ? <Text style={[styles.hint, { color: colors.info }]}>← vom {WEEKDAYS_LONG[source.day]}, dort doppelt gekocht</Text> : null}
                      <Text style={local.name} numberOfLines={2}>{r.name}{favourites.includes(r.id) ? '  ♥' : ''}</Text>
                      <View style={styles.row}>
                        {isReste ? <Tag label="Reste vom Vortag" tone="info" icon="refresh-ccw" />
                          : isCooked ? <Tag label="Gekocht" tone="accent" icon="check" /> : <Tag label={`${r.minutes} Min.`} tone="info" icon="clock" />}
                        {!isReste ? <Tag label={euro(portionCost(r, people) * (plan.slots.some((s) => s.kind === 'reste' && s.recipeId === r.id) ? 2 : 1))} icon="tag" /> : null}
                        {kids.up ? <Tag label={`${kids.up}`} tone="accent" icon="thumbs-up" /> : null}
                        {kids.down ? <Tag label={`${kids.down}`} tone="danger" icon="thumbs-down" /> : null}
                        {!isReste && !compact && seasonalIngredients(r).length ? <Tag label="Saison" tone="accent" icon="sun" /> : null}
                        {isActive && !compact ? (
                          <Pressable onPress={() => setTimeDay(timeDay === slot.day ? null : slot.day)} accessibilityRole="button" accessibilityLabel={`Essenszeit am ${WEEKDAYS_LONG[slot.day]}: ${slot.eatAt ?? mealTime} Uhr`}>
                            <Tag label={slot.eatAt ?? mealTime} tone={slot.eatAt ? 'accent' : 'muted'} icon="bell" />
                          </Pressable>
                        ) : null}
                        {!isReste && isActive ? (
                          <Pressable onPress={() => setGuestDay(guestDay === slot.day ? null : slot.day)} accessibilityRole="button" accessibilityLabel={`Personen am ${WEEKDAYS_LONG[slot.day]}: ${people}`}>
                            <Tag label={fmtPeople(people)} tone={slot.guests || slot.absent?.length ? 'warn' : 'muted'} icon="users" />
                          </Pressable>
                        ) : null}
                      </View>
                      {disliked.length && !compact ? <Text style={[styles.hint, { color: colors.warn }]}>Mag nicht: {disliked.join(', ')}</Text> : null}
                      {isActive && !compact && !slot.guests && getMembers().length ? (
                        <View style={local.people}>
                          {getMembers().map((m) => {
                            const off = !!slot.absent?.includes(m.name);
                            return (
                              <Pressable key={m.name} onPress={() => onAbsent(slot.day, m.name)} accessibilityRole="switch" accessibilityState={{ checked: !off }}
                                accessibilityLabel={`${m.name} isst am ${WEEKDAYS_LONG[slot.day]} ${off ? 'nicht ' : ''}mit`}
                                style={(st) => [local.person, off && local.personOff, hov(st) && { borderColor: colors.accent }]}>
                                <Text style={[local.personText, off && local.personTextOff]}>{initials(m.name)}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                      {timeDay === slot.day ? (
                        <View style={local.guestRow}>
                          <Text style={[styles.hint, { flex: 1 }]}>Essen um</Text>
                          <Pressable onPress={() => onEatAt(slot.day, shiftTime(slot.eatAt ?? mealTime, -15))} style={local.stepBtn} accessibilityLabel="15 Minuten früher">
                            <Icon name="minus" size={14} color={colors.text} />
                          </Pressable>
                          <Text style={[styles.sectionTitle, { minWidth: 52, textAlign: 'center' }]}>{slot.eatAt ?? mealTime}</Text>
                          <Pressable onPress={() => onEatAt(slot.day, shiftTime(slot.eatAt ?? mealTime, 15))} style={local.stepBtn} accessibilityLabel="15 Minuten später">
                            <Icon name="plus" size={14} color={colors.text} />
                          </Pressable>
                          {slot.eatAt ? (
                            <Pressable onPress={() => onEatAt(slot.day, undefined)} accessibilityRole="button"><Text style={[styles.hint, { color: colors.accent }]}>Standard</Text></Pressable>
                          ) : null}
                        </View>
                      ) : null}
                      {guestDay === slot.day ? (
                        <View style={local.guestRow}>
                          <Text style={[styles.hint, { flex: 1 }]}>{slot.guests ? 'Personen (mit Gästen)' : 'Gäste dazu?'}</Text>
                          <Pressable onPress={() => onGuests(slot.day, slot.guests && slot.guests - 1 > slotPeople({ absent: slot.absent }, householdSize) ? slot.guests - 1 : undefined)} style={local.stepBtn} accessibilityLabel="Eine Person weniger">
                            <Icon name="minus" size={14} color={colors.text} />
                          </Pressable>
                          <Text style={[styles.sectionTitle, { minWidth: 20, textAlign: 'center' }]}>{fmtPeople(people)}</Text>
                          <Pressable onPress={() => onGuests(slot.day, Math.min(20, Math.ceil(people) + 1))} style={local.stepBtn} accessibilityLabel="Eine Person mehr">
                            <Icon name="plus" size={14} color={colors.text} />
                          </Pressable>
                        </View>
                      ) : null}
                      {isActive && moving === null && !compact ? (
                        <View style={local.actions}>
                          <Pressable onPress={() => onChoose(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                            <Icon name="list" size={15} color={colors.accent} />
                            <Text style={styles.smallText}>{isReste ? 'Doch kochen' : 'Aussuchen'}</Text>
                          </Pressable>
                          {!isReste ? (
                            <Pressable onPress={() => onSwap(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                              <Icon name="shuffle" size={15} color={colors.accent} />
                              <Text style={styles.smallText}>Zufällig</Text>
                            </Pressable>
                          ) : null}
                          <Pressable onPress={() => setMoving(slot.day)} accessibilityRole="button" accessibilityLabel={`${WEEKDAYS_LONG[slot.day]} mit anderem Tag tauschen`}
                            style={(st) => [local.action, hov(st) && local.actionHover]}>
                            <Icon name="move" size={15} color={colors.accent} />
                            <Text style={styles.smallText}>Verschieben</Text>
                          </Pressable>
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
            </>} />
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
  done: { opacity: 0.6 },
  target: { borderColor: colors.accent, borderStyle: 'dashed' },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  person: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  personOff: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  personText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  personTextOff: { color: colors.faint, textDecorationLine: 'line-through' },
  stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  restIcon: { height: 64, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, minHeight: 22 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 96, paddingHorizontal: 8, flexDirection: 'row', gap: 6, minHeight: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
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
