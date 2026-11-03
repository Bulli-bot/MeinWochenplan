import { ScrollView, Text, View } from 'react-native';
import { Cover, Link } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { planMonday } from '../logic/dates';
import { useSoon } from '../logic/leftovers';
import { currentAmount } from '../logic/pantry';
import type { MealPlan, PantryItem, PhotoRef, Purchase } from '../types';
import { Button, Card, Chip, Grid, WEEKDAYS_LONG, colors, euro, space, styles, useLayout } from '../ui';

/** Wochen-Rückblick: was gekocht wurde, was es gekostet hat, was übrig ist – und weiter zur nächsten Woche. */
export function ReviewScreen({ plan, cooked, purchases, budget, photos, ratings, kidUps, pantry, carryOver, onCarry, onOpen, onPlanNext, onSave, onBack }: {
  plan: MealPlan;
  cooked: string[];
  /** Fertige Bons dieser Woche */
  purchases: Purchase[];
  budget: number;
  photos: Record<string, PhotoRef[]>;
  ratings: Record<string, number>;
  kidUps: (recipeId: string) => number;
  pantry: PantryItem[];
  /** In die nächste Woche geschobene Gerichte */
  carryOver: string[];
  onCarry: (recipeId: string) => void;
  onOpen: (recipeId: string) => void;
  onPlanNext: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const { isPhone } = useLayout();
  const meals = plan.slots.filter((s) => !s.kind && RECIPE_BY_ID[s.recipeId]);
  const done = meals.filter((s) => cooked.includes(s.recipeId));
  const open = meals.filter((s) => !cooked.includes(s.recipeId));
  const spent = purchases.reduce((s, p) => s + p.total, 0);
  const monday = planMonday(plan).getTime();
  const weekPhotos = Object.values(photos).flat().filter((p) => {
    const t = new Date(p.date).getTime();
    return t >= monday && t < monday + 7 * 86400000;
  }).length;
  // Liebling: Kinder-Daumen und Sterne zusammen, nur Gekochtes
  const fav = [...done].sort((a, b) => (kidUps(b.recipeId) * 2 + (ratings[b.recipeId] ?? 0)) - (kidUps(a.recipeId) * 2 + (ratings[a.recipeId] ?? 0)))[0];
  const favScore = fav ? kidUps(fav.recipeId) * 2 + (ratings[fav.recipeId] ?? 0) : 0;
  const soon = useSoon(pantry, 7);
  const counted = pantry.filter((p) => p.kind !== 'drogerie' && p.kind !== 'haushalt' && currentAmount(p)).slice(0, 8);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Zurück" onPress={onBack} />
      <Text style={styles.h1}>So war eure Woche</Text>

      <Grid columns={3}>
        <Card><Text style={styles.h2}>{done.length}/{meals.length}</Text><Text style={styles.hint}>gekocht</Text></Card>
        <Card><Text style={[styles.h2, { color: spent > budget ? colors.danger : colors.text }]}>{euro(spent)}</Text><Text style={styles.hint}>von {euro(budget)}</Text></Card>
        <Card><Text style={styles.h2}>{weekPhotos}</Text><Text style={styles.hint}>{weekPhotos === 1 ? 'Foto' : 'Fotos'}</Text></Card>
      </Grid>

      {fav && favScore > 0 ? (
        <Card onPress={() => onOpen(fav.recipeId)} style={{ gap: space.sm }}>
          <Cover id={photos[fav.recipeId]?.[0]?.id} height={isPhone ? 150 : 200} />
          <Text style={[styles.hint, { color: colors.warn, fontWeight: '700' }]}>LIEBLING DER WOCHE</Text>
          <Text style={styles.h2}>{RECIPE_BY_ID[fav.recipeId].name}</Text>
        </Card>
      ) : (
        <Card><Text style={styles.hint}>Noch kein Liebling – nach dem Essen Sterne oder Kinder-Daumen vergeben.</Text></Card>
      )}

      {open.length ? (
        <Card style={{ gap: space.sm }}>
          <Text style={styles.sectionTitle}>Nicht gekocht</Text>
          {open.map((s) => (
            <View key={s.day} style={[styles.row, { alignItems: 'center' }]}>
              <Text style={[styles.hint, { flex: 1, color: colors.text }]}>{WEEKDAYS_LONG[s.day]}: {RECIPE_BY_ID[s.recipeId].name}</Text>
              <Chip icon="corner-down-right" label={carryOver.includes(s.recipeId) ? 'Kommt nächste Woche' : 'Nächste Woche'}
                selected={carryOver.includes(s.recipeId)} onPress={() => onCarry(s.recipeId)} />
            </View>
          ))}
          <Text style={styles.hint}>Die Zutaten sind meist schon gekauft – so wird nichts schlecht.</Text>
        </Card>
      ) : null}

      {soon.length || counted.length ? (
        <Card style={{ gap: space.sm }}>
          <Text style={styles.sectionTitle}>Übrig für nächste Woche</Text>
          <View style={styles.chipRow}>
            {soon.map(({ item, days }) => (
              <Text key={item.name} style={[local.pill, { backgroundColor: colors.warnSoft, color: colors.warn }]}>{item.name} · {days <= 0 ? 'muss weg' : `noch ${days} T.`}</Text>
            ))}
            {counted.filter((p) => !soon.some((s) => s.item === p)).map((p) => (
              <Text key={p.name} style={local.pill}>{p.name} {currentAmount(p)?.toLocaleString('de-DE')} {p.unit ?? ''}</Text>
            ))}
          </View>
          <Text style={styles.hint}>Der nächste Plan baut, was bald weg muss, zuerst ein.</Text>
        </Card>
      ) : null}

      <Button label="Nächste Woche planen" icon="calendar" onPress={onPlanNext} />
      <Button label={plan.saved ? 'Woche ist gemerkt' : 'Diese Woche merken (zum Wiederholen)'} variant="secondary" icon="bookmark" onPress={onSave} />
    </ScrollView>
  );
}

const local = {
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, fontSize: 13, overflow: 'hidden' as const },
};
