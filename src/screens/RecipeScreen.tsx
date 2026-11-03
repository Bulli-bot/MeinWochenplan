import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigPhoto } from '../components';
import { PRICE_DATE, PRICE_SOURCE } from '../data/prices';
import { RECIPE_BY_ID } from '../data/recipes';
import { portionCost } from '../logic/generator';
import { formatAmount } from '../logic/shoppingList';
import type { KidVote, PhotoRef } from '../types';
import { Button, colors, euro, styles } from '../ui';
import { CookMode } from './CookMode';

export function RecipeScreen({
  recipeId, householdSize, isFavourite, isCooked, rating, photos, kids, votes, isCustom, wishes, onWish,
  onBack, onToggleFavourite, onToggleCooked, onRate, onAddPhoto, onDeletePhoto, onVote, onEdit, onDelete,
}: {
  recipeId: string;
  householdSize: number;
  isFavourite: boolean;
  isCooked: boolean;
  rating: number | undefined;
  photos: PhotoRef[];
  kids: string[];
  votes: Record<string, KidVote>;
  isCustom: boolean;
  /** Wunschessen: Kind → Rezept-ID */
  wishes: Record<string, string>;
  onWish: (kid: string, on: boolean) => void;
  onBack: () => void;
  onToggleFavourite: () => void;
  onToggleCooked: () => void;
  onRate: (stars: number) => void;
  onAddPhoto: () => Promise<void>;
  onDeletePhoto: (id: string) => void;
  onVote: (kid: string, vote: KidVote | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cooking, setCooking] = useState(false);
  const r = RECIPE_BY_ID[recipeId];
  if (!r) return null;

  if (cooking) {
    return (
      <CookMode recipe={r} people={householdSize} isCooked={isCooked} onClose={() => setCooking(false)}
        onDone={(photo) => {
          setCooking(false);
          // Das Foto markiert das Gericht ohnehin als gekocht
          if (photo) addPhoto();
          else if (!isCooked) onToggleCooked();
        }} />
    );
  }

  const addPhoto = async () => {
    setNotice(null);
    try {
      await onAddPhoto();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={local.back}>‹ Zurück</Text>
      </Pressable>
      <Text style={styles.h1}>{r.name}</Text>
      <Text style={styles.sub}>{r.minutes} Min. · {euro(portionCost(r, householdSize))} für {householdSize} {householdSize === 1 ? 'Person' : 'Personen'}</Text>
      <Text style={styles.hint}>
        Preise: {PRICE_SOURCE}, Stand {PRICE_DATE}
        {r.estimatedIngredients.length ? ` · geschätzt: ${r.estimatedIngredients.join(', ')}` : ' · alle Zutaten mit echtem Preis'}
      </Text>

      {photos.length ? <BigPhoto id={photos[0].id} onDelete={() => onDeletePhoto(photos[0].id)} /> : null}
      {photos.length > 1 ? <Text style={styles.hint}>{photos.length} Fotos – ältere unten.</Text> : null}

      <Button label="Kochen starten" icon="play" onPress={() => setCooking(true)} />

      <View style={local.row}>
        <Pressable onPress={addPhoto} style={[local.action, local.primary]} accessibilityRole="button">
          <Text style={local.primaryText}>📷 Foto vom Essen</Text>
        </Pressable>
        <Pressable onPress={onToggleCooked} style={local.action} accessibilityRole="button">
          <Text style={local.actionText}>{isCooked ? '✓ Gekocht' : 'Als gekocht markieren'}</Text>
        </Pressable>
        <Pressable onPress={onToggleFavourite} style={local.action} accessibilityRole="button">
          <Text style={local.actionText}>{isFavourite ? '♥ Favorit' : '♡ Merken'}</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.error}>{notice}</Text> : null}

      {kids.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hat es den Kindern geschmeckt?</Text>
          <Text style={styles.hint}>👍 kommt öfter, 👎 seltener. Mögen es alle nicht, fliegt es aus dem Plan. ⭐ Wunsch = kommt in den nächsten Plan (ein Wunsch pro Kind).</Text>
          {kids.map((kid) => (
            <View key={kid} style={local.kidRow}>
              <Text style={local.kid}>{kid}</Text>
              {([1, -1] as KidVote[]).map((v) => {
                const on = votes[kid] === v;
                return (
                  <Pressable key={v} onPress={() => onVote(kid, on ? null : v)} style={[local.thumb, on && (v === 1 ? local.thumbUp : local.thumbDown)]}
                    accessibilityLabel={`${kid}: ${v === 1 ? 'mag es' : 'mag es nicht'}`}>
                    <Text style={local.thumbText}>{v === 1 ? '👍' : '👎'}</Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => onWish(kid, wishes[kid] !== r.id)} style={[local.thumb, wishes[kid] === r.id && local.thumbUp]}
                accessibilityLabel={`${kid} wünscht sich das`} accessibilityState={{ selected: wishes[kid] === r.id }}>
                <Text style={[local.thumbText, { fontSize: 14, color: wishes[kid] === r.id ? colors.accent : colors.muted }]}>⭐ Wunsch</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Zutaten</Text>
        {r.ingredients.map((ing, idx) => (
          <Text key={`${ing.name}-${idx}`} style={local.line}>
            {formatAmount(Math.round(ing.amount * householdSize * 10) / 10, ing.unit)} {ing.name}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Zubereitung</Text>
        {r.steps.map((step, idx) => (
          <Text key={idx} style={local.line}>{idx + 1}. {step}</Text>
        ))}
        {r.source ? (
          <Pressable onPress={() => Linking.openURL(r.source!)} accessibilityRole="link">
            <Text style={local.source}>Originalrezept mit Tipps: {r.source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} ›</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Wie hat es dir geschmeckt?</Text>
        <Text style={styles.hint}>Gute Bewertungen kommen öfter, 1 Stern sortiert das Rezept aus.</Text>
        <View style={local.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => onRate(n)} accessibilityLabel={`${n} Sterne`}>
              <Text style={[local.star, rating !== undefined && n <= rating && local.starOn]}>★</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {photos.slice(1).map((p) => (
        <View key={p.id} style={{ gap: 4 }}>
          <Text style={styles.hint}>{new Date(p.date).toLocaleDateString('de-DE')}</Text>
          <BigPhoto id={p.id} onDelete={() => onDeletePhoto(p.id)} />
        </View>
      ))}

      {isCustom ? (
        <View style={local.row}>
          <Pressable onPress={onEdit} style={local.action}><Text style={local.actionText}>Rezept bearbeiten</Text></Pressable>
          <Pressable onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))} style={local.action}>
            <Text style={[local.actionText, { color: colors.danger }]}>{confirmDelete ? 'Wirklich löschen?' : 'Rezept löschen'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Button label="Zurück" variant="secondary" onPress={onBack} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  back: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.accentSoft },
  actionText: { color: colors.accent, fontWeight: '600' },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: colors.onAccent, fontWeight: '700' },
  line: { fontSize: 15, color: colors.text, marginTop: 6, lineHeight: 21 },
  source: { fontSize: 14, color: colors.accent, fontWeight: '600', marginTop: 12 },
  star: { fontSize: 30, color: colors.border },
  starOn: { color: colors.warn },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  kid: { flex: 1, fontSize: 16, color: colors.text },
  thumb: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  thumbUp: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  thumbDown: { backgroundColor: '#3A2420', borderColor: colors.danger },
  thumbText: { fontSize: 18 },
});
