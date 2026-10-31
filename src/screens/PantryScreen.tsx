import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, Link } from '../components';
import { knownIngredients } from '../data/recipes';
import type { PantryItem, Unit } from '../types';
import { Chip, colors, styles } from '../ui';

const UNITS: Unit[] = ['g', 'ml', 'Stück'];

/** Vorrat: was zu Hause ist, fliegt von der Einkaufsliste und wird im Plan bevorzugt verbraucht. */
export function PantryScreen({ pantry, onChange, onBack }: { pantry: PantryItem[]; onChange: (p: PantryItem[]) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const names = useMemo(() => [...knownIngredients().keys()].sort((a, b) => a.localeCompare(b, 'de')), []);
  const suggestions = name.trim().length >= 2 ? names.filter((n) => n.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 8) : [];

  const add = (n = name) => {
    const clean = n.trim();
    if (!clean) return;
    const value = parseFloat(amount.replace(',', '.'));
    const item: PantryItem = Number.isFinite(value) && value > 0 ? { name: clean, amount: value, unit } : { name: clean };
    onChange([...pantry.filter((p) => p.name.toLowerCase() !== clean.toLowerCase()), item]);
    setName('');
    setAmount('');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Mehr" onPress={onBack} />
      <Text style={styles.h1}>Vorrat</Text>
      <Text style={styles.sub}>Was hier steht, kommt nicht auf die Einkaufsliste. Ohne Menge heißt „genug da". Gerichte mit Vorratszutaten werden im Plan bevorzugt.</Text>

      <View style={[styles.card, { gap: 10 }]}>
        <Field label="Zutat" value={name} onChangeText={setName} placeholder="z. B. Spaghetti" onSubmitEditing={() => add()} />
        {suggestions.length ? (
          <View style={styles.chipRow}>{suggestions.map((s) => <Chip key={s} label={s} selected={false} onPress={() => setName(s)} />)}</View>
        ) : null}
        <Field label="Menge (leer lassen = genug da)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="z. B. 1500" />
        <View style={styles.chipRow}>{UNITS.map((u) => <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />)}</View>
        <Pressable onPress={() => add()} style={[styles.button]}><Text style={styles.buttonText}>Hinzufügen</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Zu Hause ({pantry.length})</Text>
        {pantry.length === 0 ? <Text style={styles.hint}>Noch leer. Tipp: In der Einkaufsliste bei Dingen, die noch da sind, auf „hab ich" tippen.</Text> : null}
        {[...pantry].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((p) => (
          <View key={p.name} style={local.row}>
            <Text style={local.name}>{p.name}</Text>
            <Text style={styles.hint}>{p.amount !== undefined ? `${p.amount.toLocaleString('de-DE')} ${p.unit}` : 'genug da'}</Text>
            <Pressable onPress={() => onChange(pantry.filter((x) => x !== p))} accessibilityLabel={`${p.name} aufgebraucht`}>
              <Text style={local.remove}>aufgebraucht</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  name: { flex: 1, fontSize: 16, color: colors.text },
  remove: { color: colors.danger, fontSize: 13 },
});
