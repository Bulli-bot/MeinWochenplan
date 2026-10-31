import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, BigPhoto, Thumb } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { planCost, portionCost } from '../logic/generator';
import type { MealPlan, PhotoRef } from '../types';
import { Button, WEEKDAYS_LONG, colors, euro, styles } from '../ui';

/** 0 = Montag … 6 = Sonntag */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

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
  const total = planCost(plan, householdSize, RECIPE_BY_ID);
  const today = todayIndex();
  // „Als Nächstes": heute, sonst der nächste Kochtag, der noch nicht gekocht ist
  const upcoming = [...plan.slots]
    .sort((a, b) => ((a.day - today + 7) % 7) - ((b.day - today + 7) % 7))
    .find((s) => !cooked.includes(s.recipeId));
  const next = upcoming ? RECIPE_BY_ID[upcoming.recipeId] : undefined;
  const nextPhoto = next ? photos[next.id]?.[0]?.id : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Dein Wochenplan</Text>
      <Text style={styles.sub}>
        {plan.slots.length} Gerichte · ca. {euro(total)} von {euro(budget)} · {householdSize} {householdSize === 1 ? 'Person' : 'Personen'}
      </Text>

      {next && upcoming ? (
        <Pressable onPress={() => onOpen(next.id)} style={[styles.card, local.next]} accessibilityRole="button">
          <Text style={local.day}>{upcoming.day === today ? 'Heute' : `Als Nächstes · ${WEEKDAYS_LONG[upcoming.day]}`}</Text>
          <Text style={local.nextName}>{next.name}</Text>
          <Text style={styles.hint}>{next.minutes} Min. · {euro(portionCost(next, householdSize))}</Text>
          {nextPhoto ? <BigPhoto id={nextPhoto} /> : <Text style={styles.hint}>Noch kein Foto – nach dem Kochen im Rezept „Foto vom Essen" tippen.</Text>}
        </Pressable>
      ) : null}

      {plan.slots.map((slot) => {
        const r = RECIPE_BY_ID[slot.recipeId];
        if (!r) return null;
        const kids = kidInfo(r.id);
        const isCooked = cooked.includes(r.id);
        return (
          <Pressable key={slot.day} onPress={() => onOpen(r.id)} style={[styles.card, isCooked && local.done]} accessibilityRole="button">
            <View style={local.top}>
              <Thumb id={photos[r.id]?.[0]?.id} />
              <View style={{ flex: 1 }}>
                <Text style={local.day}>{WEEKDAYS_LONG[slot.day]}{slot.day === today ? ' · heute' : ''}</Text>
                <Text style={local.name}>{r.name}{favourites.includes(r.id) ? ' ♥' : ''}</Text>
                <View style={local.badges}>
                  <Text style={styles.hint}>{r.minutes} Min. · {euro(portionCost(r, householdSize))}</Text>
                  {isCooked ? <Badge label="gekocht ✓" tone="accent" /> : null}
                  {kids.up ? <Badge label={`👍 ${kids.up}`} tone="accent" /> : null}
                  {kids.down ? <Badge label={`👎 ${kids.down}`} tone="danger" /> : null}
                </View>
              </View>
            </View>
            <View style={local.row}>
              <Pressable onPress={() => onChoose(slot.day)} style={styles.small} accessibilityRole="button">
                <Text style={styles.smallText}>Selbst aussuchen</Text>
              </Pressable>
              <Pressable onPress={() => onSwap(slot.day)} style={styles.small} accessibilityRole="button">
                <Text style={styles.smallText}>Zufällig tauschen</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Ganzen Plan neu erstellen" variant="secondary" onPress={onRegenerate} />
      {footer}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  next: { borderColor: colors.accent, gap: 6 },
  nextName: { fontSize: 22, fontWeight: '700', color: colors.text },
  day: { fontSize: 13, fontWeight: '600', color: colors.accent, textTransform: 'uppercase' },
  name: { fontSize: 18, fontWeight: '600', color: colors.text, marginVertical: 2 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  done: { opacity: 0.75 },
});
