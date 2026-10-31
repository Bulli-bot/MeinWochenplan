import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Cover } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { shortDate, slotDate, todayIndex } from '../logic/dates';
import { planCost, portionCost } from '../logic/generator';
import type { MealPlan, PhotoRef } from '../types';
import { Button, Card, Eyebrow, Grid, Icon, Tag, WEEKDAYS_LONG, colors, euro, hov, space, styles, useLayout } from '../ui';

export { todayIndex };

export function PlanScreen({ plan, householdSize, budget, favourites, cooked, photos, kidInfo, error, onOpen, onSwap, onChoose, onRegenerate, footer }: {
  plan: MealPlan;
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
  footer?: ReactNode;
}) {
  const { columns } = useLayout();
  const total = planCost(plan, householdSize, RECIPE_BY_ID);
  const today = todayIndex();
  const ratio = budget ? total / budget : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={local.head}>
        <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
          <Text style={styles.h1}>Deine Woche</Text>
          <Text style={styles.sub}>
            {shortDate(slotDate(plan, 0))} – {shortDate(slotDate(plan, 6))} · {plan.slots.length} Gerichte · {householdSize} {householdSize === 1 ? 'Person' : 'Personen'}
          </Text>
        </View>
        <Button label="Neu erstellen" variant="ghost" icon="refresh-cw" onPress={onRegenerate} />
      </View>

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
          const r = RECIPE_BY_ID[slot.recipeId];
          if (!r) return null;
          const kids = kidInfo(r.id);
          const isCooked = cooked.includes(r.id);
          const isToday = slot.day === today;
          return (
            <Card key={slot.day} accent={isToday} onPress={() => onOpen(r.id)} style={local.day}>
              <View style={local.dayHead}>
                <Eyebrow color={isToday ? colors.accent : colors.muted}>{WEEKDAYS_LONG[slot.day]}</Eyebrow>
                <Text style={[styles.hint, isToday && { color: colors.accent }]}>{isToday ? 'heute' : shortDate(slotDate(plan, slot.day))}</Text>
              </View>
              {columns > 1 || photos[r.id]?.[0] ? <Cover id={photos[r.id]?.[0]?.id} height={columns > 1 ? 120 : 170} /> : null}
              <Text style={local.name} numberOfLines={2}>{r.name}{favourites.includes(r.id) ? '  ♥' : ''}</Text>
              <View style={styles.row}>
                {isCooked ? <Tag label="Gekocht" tone="accent" icon="check" /> : <Tag label={`${r.minutes} Min.`} tone="info" icon="clock" />}
                <Tag label={euro(portionCost(r, householdSize))} icon="tag" />
                {kids.up ? <Tag label={`${kids.up}`} tone="accent" icon="thumbs-up" /> : null}
                {kids.down ? <Tag label={`${kids.down}`} tone="danger" icon="thumbs-down" /> : null}
              </View>
              <View style={local.actions}>
                <Pressable onPress={() => onChoose(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                  <Icon name="list" size={15} color={colors.accent} />
                  <Text style={styles.smallText}>Aussuchen</Text>
                </Pressable>
                <Pressable onPress={() => onSwap(slot.day)} accessibilityRole="button" style={(st) => [local.action, hov(st) && local.actionHover]}>
                  <Icon name="shuffle" size={15} color={colors.accent} />
                  <Text style={styles.smallText}>Tauschen</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </Grid>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {footer}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.input, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  day: { gap: space.sm },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, minHeight: 22 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
  action: { flex: 1, flexDirection: 'row', gap: 6, minHeight: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actionHover: { backgroundColor: '#25402F' },
});
