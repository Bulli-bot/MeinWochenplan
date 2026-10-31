import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ingredientCost } from '../data/prices';
import { applyPantry } from '../logic/pantry';
import { CATEGORY_ORDER, buildShoppingList, formatAmount, isBasic, shoppingListAsText, shoppingTrip, type ShoppingItem } from '../logic/shoppingList';
import type { MealPlan, PantryItem, Settings, ShopExtra } from '../types';
import { Button, Icon, colors, euro, hov, space, styles } from '../ui';

const itemCost = (it: ShoppingItem) => ingredientCost({ name: it.name, amount: it.amount, unit: it.unit, category: it.category }) ?? 0;

export function ShoppingListScreen({ plan, settings, checked, pantry, extras, onToggle, onReset, onHave, onShopped, onAddExtra, onToggleExtra, onRemoveExtra }: {
  plan: MealPlan;
  settings: Settings;
  checked: string[];
  pantry: PantryItem[];
  extras: ShopExtra[];
  onToggle: (key: string) => void;
  onReset: () => void;
  /** „Hab ich noch" → in den Vorrat */
  onHave: (name: string) => void;
  /** Einkauf fertig → weiter zu Ausgaben (Bon fotografieren) */
  onShopped: () => void;
  onAddExtra: (name: string) => void;
  onToggleExtra: (id: string) => void;
  onRemoveExtra: (id: string) => void;
}) {
  const all = useMemo(() => buildShoppingList(plan, settings.householdSize), [plan, settings.householdSize]);
  const basics = all.filter((i) => isBasic(i.name, settings.basics));
  const { toBuy: items, fromPantry } = useMemo(() => applyPantry(all.filter((i) => !isBasic(i.name, settings.basics)), pantry), [all, pantry, settings.basics]);
  const [notice, setNotice] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const done = items.filter((i) => checked.includes(i.key)).length + extras.filter((x) => x.done).length;
  const open = items.filter((i) => !checked.includes(i.key));
  const openCost = open.reduce((s, i) => s + itemCost(i), 0);
  const twoTrips = settings.shopRhythm === 'zweimal';

  const add = () => {
    const name = newItem.trim();
    if (!name) return;
    onAddExtra(name);
    setNewItem('');
  };

  const share = async () => {
    const text = [shoppingListAsText(open), ...extras.filter((x) => !x.done).map((x) => `- ${x.name}`)].join('\n');
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({ title: 'Einkaufsliste', text });
          return;
        } catch {
          // abgebrochen oder nicht erlaubt → kopieren
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        setNotice('Liste kopiert.');
      } catch {
        setNotice('Teilen ist hier nicht verfügbar.');
      }
      return;
    }
    await Share.share({ message: text }).catch(() => setNotice('Teilen ist hier nicht verfügbar.'));
  };

  const renderItem = (it: ShoppingItem) => {
    const isChecked = checked.includes(it.key);
    return (
      <View key={it.key} style={local.item}>
        <Pressable onPress={() => onToggle(it.key)} style={local.itemMain} accessibilityRole="checkbox" accessibilityState={{ checked: isChecked }}>
          <View style={[local.box, isChecked && local.boxOn]}>{isChecked ? <Icon name="check" size={16} color={colors.onAccent} /> : null}</View>
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
  };

  const byCategory = (list: ShoppingItem[]) => CATEGORY_ORDER.map((cat) => {
    const inCat = list.filter((i) => i.category === cat);
    if (!inCat.length) return null;
    return (
      <View key={cat} style={styles.card}>
        <Text style={styles.sectionTitle}>{cat}</Text>
        {inCat.map(renderItem)}
      </View>
    );
  });

  const trip1 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 1);
  const trip2 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 2);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Einkaufsliste</Text>
      <Text style={styles.sub}>{done} von {items.length + extras.length} erledigt · offen ca. {euro(openCost)}</Text>

      <View style={[styles.card, { gap: space.sm }]}>
        <Text style={styles.sectionTitle}>Eigene Artikel</Text>
        <View style={local.addRow}>
          <TextInput value={newItem} onChangeText={setNewItem} onSubmitEditing={add} placeholder="z. B. Toilettenpapier, Kaffee …"
            placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} returnKeyType="done" />
          <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Hinzufügen" style={(s) => [local.addBtn, hov(s) && { backgroundColor: '#72CC96' }]}>
            <Icon name="plus" size={20} color={colors.onAccent} />
          </Pressable>
        </View>
        {extras.map((x) => (
          <View key={x.id} style={local.item}>
            <Pressable onPress={() => onToggleExtra(x.id)} style={local.itemMain} accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }}>
              <View style={[local.box, x.done && local.boxOn]}>{x.done ? <Icon name="check" size={16} color={colors.onAccent} /> : null}</View>
              <View style={local.itemText}>
                <Text style={[local.name, x.done && local.nameDone]}>{x.amount ? `${x.amount} ` : ''}{x.name}</Text>
                {x.from === 'vorrat' ? <Text style={styles.hint}>aus dem Vorrat – bald leer</Text> : null}
              </View>
            </Pressable>
            <Pressable onPress={() => onRemoveExtra(x.id)} accessibilityLabel={`${x.name} entfernen`} style={local.have}>
              <Icon name="trash-2" size={15} color={colors.danger} />
            </Pressable>
          </View>
        ))}
      </View>

      {twoTrips ? <Text style={styles.h2}>Wocheneinkauf</Text> : null}
      {byCategory(trip1)}
      {twoTrips && trip2.length ? (
        <>
          <Text style={styles.h2}>Frische-Einkauf zur Wochenmitte</Text>
          <Text style={styles.hint}>Wird erst ab Donnerstag gebraucht – am Mittwoch oder Donnerstag frisch kaufen.</Text>
          {byCategory(trip2)}
        </>
      ) : null}

      {fromPantry.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Schon im Vorrat</Text>
          <Text style={styles.hint}>Ändern unter Mehr → Vorrat.</Text>
          {fromPantry.map((it) => (
            <Text key={it.key} style={[local.name, { marginTop: 6, color: colors.muted }]}>{formatAmount(it.amount, it.unit)} {it.name}</Text>
          ))}
        </View>
      ) : null}

      {basics.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Grundzutaten – hast du</Text>
          <Text style={styles.hint}>{basics.map((b) => b.name).join(', ')}. Ändern unter Einstellungen → Grundzutaten vorhanden.</Text>
        </View>
      ) : null}

      {notice ? <Text style={styles.hint}>{notice}</Text> : null}
      <Button label="Einkauf erledigt – Bon fotografieren" icon="camera" onPress={onShopped} />
      <Button label="Liste als Text teilen" variant="secondary" icon="share" onPress={share} />
      <Button label="Haken zurücksetzen" variant="ghost" onPress={onReset} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent },
  itemText: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  have: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  haveText: { color: colors.muted, fontSize: 13 },
  addRow: { flexDirection: 'row', gap: space.sm },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
