import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Field, Link } from '../components';
import { PRICES, priceFor } from '../data/prices';
import { knownIngredients } from '../data/recipes';
import type { UserPrice } from '../types';
import { Button, Chip, colors, euro, styles } from '../ui';

type Per = UserPrice['per'];
const PERS: Per[] = ['kg', 'l', 'Stück'];
const SOURCE: Record<string, { label: string; tone: 'accent' | 'muted' | 'warn' }> = {
  eigen: { label: 'eigener Preis', tone: 'accent' },
  bon: { label: 'Bon', tone: 'accent' },
  aldi: { label: 'ALDI online', tone: 'muted' },
  'schätzung': { label: 'geschätzt', tone: 'warn' },
};

/** Alle Zutatenpreise ansehen und selbst überschreiben. */
export function PricesScreen({ userPrices, onChange, onBack }: {
  userPrices: Record<string, UserPrice>;
  onChange: (p: Record<string, UserPrice>) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const [onlyEstimated, setOnlyEstimated] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const names = useMemo(() => [...new Set([...Object.keys(PRICES), ...knownIngredients().keys()])].sort((a, b) => a.localeCompare(b, 'de')), []);
  const q = query.trim().toLowerCase();
  const list = names.filter((n) => (!q || n.toLowerCase().includes(q)) && (!onlyEstimated || (priceFor(n)?.source ?? 'schätzung') === 'schätzung'));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Mehr" onPress={onBack} />
      <Text style={styles.h1}>Preise</Text>
      <Text style={styles.sub}>Eigene Preise haben Vorrang und kommen auch automatisch vom Bon. Alle Rezepte rechnen sofort neu.</Text>
      <Field label="Suchen" value={query} onChangeText={setQuery} placeholder="Zutat" />
      <View style={styles.chipRow}>
        <Chip label="Nur geschätzte" selected={onlyEstimated} onPress={() => setOnlyEstimated((v) => !v)} />
      </View>

      <View style={styles.card}>
        {list.map((n) => {
          const p = priceFor(n);
          const src = SOURCE[p?.source ?? 'schätzung'];
          return (
            <View key={n} style={local.row}>
              <Pressable onPress={() => setEdit(edit === n ? null : n)} style={local.head}>
                <View style={{ flex: 1 }}>
                  <Text style={local.name}>{n}</Text>
                  {p?.product ? <Text style={styles.hint} numberOfLines={1}>{p.product}</Text> : null}
                </View>
                <Badge label={p ? src.label : 'kein Preis'} tone={p ? src.tone : 'warn'} />
                <Text style={local.price}>{p ? `${euro(p.price)}/${p.per}` : '–'}</Text>
              </Pressable>
              {edit === n ? (
                <PriceEditor name={n} initial={userPrices[n]} fallbackPer={(p?.per as Per) ?? 'kg'}
                  onSave={(up) => { onChange({ ...userPrices, [n]: up }); setEdit(null); }}
                  onReset={userPrices[n] ? () => { const { [n]: _, ...rest } = userPrices; onChange(rest); setEdit(null); } : undefined} />
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PriceEditor({ name, initial, fallbackPer, onSave, onReset }: {
  name: string; initial?: UserPrice; fallbackPer: Per; onSave: (p: UserPrice) => void; onReset?: () => void;
}) {
  const [price, setPrice] = useState(initial ? String(initial.price).replace('.', ',') : '');
  const [per, setPer] = useState<Per>(initial?.per ?? (PERS.includes(fallbackPer) ? fallbackPer : 'kg'));
  const [product, setProduct] = useState(initial?.product ?? '');
  const value = parseFloat(price.replace(',', '.'));
  return (
    <View style={{ gap: 8, paddingVertical: 8 }}>
      <Field label={`Preis in € pro ${per}`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <View style={styles.chipRow}>{PERS.map((u) => <Chip key={u} label={`pro ${u}`} selected={per === u} onPress={() => setPer(u)} />)}</View>
      <Field label="Produkt/Laden (optional)" value={product} onChangeText={setProduct} placeholder={`z. B. Lidl ${name}`} />
      <Button label="Preis speichern" onPress={() => { if (Number.isFinite(value) && value > 0) onSave({ price: value, per, product: product || 'selbst eingetragen', date: new Date().toISOString() }); }} />
      {onReset ? <Button label="Eigenen Preis entfernen" variant="secondary" onPress={onReset} /> : null}
    </View>
  );
}

const local = StyleSheet.create({
  row: { borderTopWidth: 1, borderTopColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  name: { fontSize: 15, color: colors.text },
  price: { minWidth: 92, textAlign: 'right', color: colors.text, fontVariant: ['tabular-nums'] },
});
