import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ingredientCost } from '../data/prices';
import { applyPantry } from '../logic/pantry';
import { CATEGORY_ORDER, buildShoppingList, formatAmount, shoppingListAsText, shoppingListForBring, type ShoppingItem } from '../logic/shoppingList';
import type { MealPlan, PantryItem } from '../types';
import { Button, colors, euro, styles } from '../ui';

const itemCost = (it: ShoppingItem) => ingredientCost({ name: it.name, amount: it.amount, unit: it.unit, category: it.category }) ?? 0;

export function ShoppingListScreen({ plan, householdSize, checked, pantry, onToggle, onReset, onHave, onShopped }: {
  plan: MealPlan;
  householdSize: number;
  checked: string[];
  pantry: PantryItem[];
  onToggle: (key: string) => void;
  onReset: () => void;
  /** „Hab ich noch" → in den Vorrat */
  onHave: (name: string) => void;
  /** Einkauf fertig → weiter zu Ausgaben (Bon fotografieren) */
  onShopped: () => void;
}) {
  const all = useMemo(() => buildShoppingList(plan, householdSize), [plan, householdSize]);
  const { toBuy: items, fromPantry } = useMemo(() => applyPantry(all, pantry), [all, pantry]);
  const [notice, setNotice] = useState<string | null>(null);
  const done = items.filter((i) => checked.includes(i.key)).length;
  const open = items.filter((i) => !checked.includes(i.key));
  const openCost = open.reduce((s, i) => s + itemCost(i), 0);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${what} kopiert. In Bring! oben ins Eingabefeld tippen → Einfügen: jede Zeile wird ein Artikel.`);
      return true;
    } catch {
      return false;
    }
  };

  const toBring = async () => {
    const text = shoppingListForBring(open);
    if (Platform.OS === 'web') {
      if (!(await copy(text, `${open.length} Artikel`))) setNotice('Kopieren hat nicht geklappt.');
      return;
    }
    await Share.share({ message: text }).catch(() => setNotice('Teilen ist hier nicht verfügbar.'));
  };

  const share = async () => {
    const text = shoppingListAsText(open);
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({ title: 'Einkaufsliste', text });
          return;
        } catch {
          // abgebrochen oder nicht erlaubt → kopieren
        }
      }
      if (!(await copy(text, 'Liste'))) setNotice('Teilen ist hier nicht verfügbar.');
      return;
    }
    await Share.share({ message: text }).catch(() => setNotice('Teilen ist hier nicht verfügbar.'));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Einkaufsliste</Text>
      <Text style={styles.sub}>{done} von {items.length} erledigt · offen ca. {euro(openCost)}</Text>

      <Button label="An Bring! übergeben" onPress={toBring} />
      {notice ? <Text style={styles.hint}>{notice}</Text> : null}

      {CATEGORY_ORDER.map((cat) => {
        const inCat = items.filter((i) => i.category === cat);
        if (!inCat.length) return null;
        return (
          <View key={cat} style={styles.card}>
            <Text style={styles.sectionTitle}>{cat}</Text>
            {inCat.map((it) => {
              const isChecked = checked.includes(it.key);
              return (
                <View key={it.key} style={local.item}>
                  <Pressable onPress={() => onToggle(it.key)} style={local.itemMain} accessibilityRole="checkbox" accessibilityState={{ checked: isChecked }}>
                    <View style={[local.box, isChecked && local.boxOn]}>{isChecked ? <Text style={local.tick}>✓</Text> : null}</View>
                    <View style={local.itemText}>
                      <Text style={[local.name, isChecked && local.nameDone]}>{formatAmount(it.amount, it.unit)} {it.name}</Text>
                      <Text style={styles.hint} numberOfLines={1}>ca. {euro(itemCost(it))} · {it.recipes.join(', ')}</Text>
                    </View>
                  </Pressable>
                  {!isChecked ? (
                    <Pressable onPress={() => onHave(it.name)} style={local.have} accessibilityLabel={`${it.name} ist noch da`}>
                      <Text style={local.haveText}>hab ich</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      {fromPantry.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Schon im Vorrat</Text>
          <Text style={styles.hint}>Wird nicht an Bring! übergeben. Ändern unter Mehr → Vorrat.</Text>
          {fromPantry.map((it) => (
            <Text key={it.key} style={[local.name, { marginTop: 6, color: colors.muted }]}>{formatAmount(it.amount, it.unit)} {it.name}</Text>
          ))}
        </View>
      ) : null}

      <Button label="Einkauf erledigt – Bon fotografieren" variant="secondary" onPress={onShopped} />
      <Button label="Liste als Text teilen" variant="secondary" onPress={share} />
      <Button label="Haken zurücksetzen" variant="secondary" onPress={onReset} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent },
  tick: { color: colors.onAccent, fontWeight: '700' },
  itemText: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  have: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  haveText: { color: colors.muted, fontSize: 13 },
});
