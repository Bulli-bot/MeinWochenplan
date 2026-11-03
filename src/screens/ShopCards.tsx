import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { priceTrend } from '../logic/shopPrice';
import type { Purchase } from '../types';
import { Icon, colors, euro, styles } from '../ui';

/** Pfand je Stück – übliche deutsche Sätze */
const PFAND: { key: string; label: string; each: number }[] = [
  { key: 'kasten', label: 'Leere Kästen (12 × 0,75 l Glas)', each: 3.3 },
  { key: 'kasten20', label: 'Leere Kästen (20 × 0,5 l)', each: 3.1 },
  { key: 'einweg', label: 'Einwegflaschen und Dosen', each: 0.25 },
  { key: 'mehrweg', label: 'Mehrwegflaschen einzeln', each: 0.15 },
];

/** Was gibt das Leergut zurück – und was bleibt an der Kasse übrig? */
export function PfandCard({ openCost }: { openCost: number }) {
  const [count, setCount] = useState<Record<string, number>>({});
  const back = PFAND.reduce((s, p) => s + (count[p.key] ?? 0) * p.each, 0);
  const step = (key: string, d: number) => setCount((c) => ({ ...c, [key]: Math.max(0, (c[key] ?? 0) + d) }));
  return (
    <View style={[styles.card, { gap: 8 }]}>
      <Text style={styles.sectionTitle}>Pfand-Rechner</Text>
      {PFAND.map((p) => (
        <View key={p.key} style={local.row}>
          <Text style={[styles.hint, { flex: 1, color: colors.text }]}>{p.label} <Text style={styles.hint}>· {euro(p.each)}</Text></Text>
          <Pressable onPress={() => step(p.key, -1)} style={local.btn} accessibilityLabel={`${p.label}: eins weniger`}><Icon name="minus" size={14} color={colors.text} /></Pressable>
          <Text style={local.num}>{count[p.key] ?? 0}</Text>
          <Pressable onPress={() => step(p.key, 1)} style={local.btn} accessibilityLabel={`${p.label}: eins mehr`}><Icon name="plus" size={14} color={colors.text} /></Pressable>
        </View>
      ))}
      <View style={local.row}>
        <Text style={[styles.hint, { flex: 1 }]}>Pfand zurück</Text>
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>− {euro(back)}</Text>
      </View>
      <View style={local.row}>
        <Text style={[styles.hint, { flex: 1, color: colors.text }]}>An der Kasse ca.</Text>
        <Text style={[styles.h2]}>{euro(Math.max(0, openCost - back))}</Text>
      </View>
    </View>
  );
}

/** Preistrend-Radar: offene Artikel, deren Preis sich seit dem Bon davor geändert hat */
export function TrendCard({ names, purchases }: { names: string[]; purchases: Purchase[] }) {
  const list = [...new Set(names)]
    .map((name) => ({ name, t: priceTrend(name, purchases) }))
    .filter((x): x is { name: string; t: NonNullable<ReturnType<typeof priceTrend>> } => !!x.t)
    .sort((a, b) => Math.abs(b.t.diff) - Math.abs(a.t.diff))
    .slice(0, 6);
  if (!list.length) return null;
  return (
    <View style={[styles.card, { gap: 6 }]}>
      <Text style={styles.sectionTitle}>Preistrend</Text>
      {list.map(({ name, t }) => (
        <View key={name} style={local.row}>
          <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{name} <Text style={styles.hint}>· {t.store}</Text></Text>
          <Text style={[styles.hint, { fontWeight: '700', color: t.diff > 0 ? colors.danger : colors.accent }]}>
            {t.diff > 0 ? '▲ +' : '▼ '}{euro(Math.abs(t.diff))}
          </Text>
        </View>
      ))}
      <Text style={styles.hint}>Letzter Bon gegen den Bon davor.</Text>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  btn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  num: { minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text },
});

/** Ultrawide: Einkaufszettel als eigene Spalte neben dem Wochenplan */
export function LiveShopPanel({ count, cost, unpriced, names, onGo }: { count: number; cost: number; unpriced: number; names: string[]; onGo: () => void }) {
  return (
    <View style={[styles.card, { gap: 6 }]}>
      <Text style={styles.sectionTitle}>Einkaufszettel</Text>
      <Text style={styles.hint}>{count} offen · ca. {euro(cost)}{unpriced ? ` · ${unpriced} ohne Preis` : ''}</Text>
      {names.slice(0, 18).map((n, i) => (
        <View key={`${n}-${i}`} style={local.row}>
          <Icon name="square" size={14} color={colors.muted} />
          <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{n}</Text>
        </View>
      ))}
      {names.length > 18 ? <Text style={styles.hint}>… und {names.length - 18} weitere</Text> : null}
      <Pressable onPress={onGo} accessibilityRole="button" style={{ paddingVertical: 6 }}>
        <Text style={[styles.hint, { color: colors.accent, fontWeight: '700' }]}>Zur Einkaufsliste ›</Text>
      </Pressable>
    </View>
  );
}
