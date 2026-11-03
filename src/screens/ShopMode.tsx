import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Icon, colors, euro, hov, radius, space, styles } from '../ui';

/** Eine Zeile im Einkaufsmodus – Plan-Zutat oder eigener Artikel */
export interface ShopRow {
  key: string;
  name: string;
  amount: string;
  /** Geschätzter bzw. bekannter Preis; undefined = ohne Preis */
  price?: number;
  done: boolean;
  /** Abschnitt: Ladenbereich oder Laden */
  section: string;
  toggle: () => void;
}

/** Bildschirm bleibt an, solange der Einkaufsmodus offen ist (Safari ab iOS 16.4, Chrome). */
function useWakeLock(): boolean {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let alive = true;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
        if (alive) setAwake(true);
      } catch {
        if (alive) setAwake(false);
      }
    };
    // Beim Wechsel in eine andere App gibt der Browser die Sperre frei – beim Zurückkommen neu holen
    const onVisible = () => { if (alive && document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
  return awake;
}

/**
 * Einkaufsmodus: Vollbild, große Zeilen zum Abhaken in Laden-Reihenfolge, Erledigtes rutscht nach unten,
 * am Ende direkt „Bon fotografieren“.
 */
export function ShopMode({ rows, sections, onAdd, onShopped, onClose }: {
  rows: ShopRow[];
  /** Reihenfolge der Abschnitte */
  sections: string[];
  onAdd: (name: string) => void;
  onShopped: () => void;
  onClose: () => void;
}) {
  const awake = useWakeLock();
  const [newItem, setNewItem] = useState('');
  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);
  const left = open.reduce((s, r) => s + (r.price ?? 0), 0);
  const unpriced = open.filter((r) => r.price === undefined).length;
  const order = [...sections, ...new Set(open.map((r) => r.section).filter((s) => !sections.includes(s)))];

  const add = () => {
    const name = newItem.trim();
    if (!name) return;
    onAdd(name);
    setNewItem('');
  };

  const row = (r: ShopRow) => (
    <Pressable key={r.key} onPress={r.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: r.done }} accessibilityLabel={`${r.name} ${r.amount}`}
      style={(s) => [local.row, r.done && local.rowDone, hov(s) && !r.done && { backgroundColor: colors.cardHover }]}>
      <View style={[local.check, r.done && local.checkOn]}>
        {r.done ? <Icon name="check" size={18} color={colors.onAccent} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[local.name, r.done && local.nameDone]} numberOfLines={2}>{r.name}</Text>
        {r.amount ? <Text style={local.amount} numberOfLines={1}>{r.amount}</Text> : null}
      </View>
      {r.price !== undefined ? <Text style={[local.price, r.done && { color: colors.faint }]}>{euro(r.price)}</Text> : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={local.head}>
        <View style={local.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h2}>Einkaufen</Text>
            <Text style={styles.hint}>
              {done.length} von {rows.length} im Wagen · noch ca. {euro(left)}{unpriced ? ` (+${unpriced} ohne Preis)` : ''}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Einkaufsmodus beenden" hitSlop={8}
            style={(s) => [local.close, hov(s) && { backgroundColor: colors.cardHover }]}>
            <Text style={local.closeText}>Fertig</Text>
          </Pressable>
        </View>
        <View style={local.progress}><View style={[local.progressFill, { width: `${rows.length ? (done.length / rows.length) * 100 : 0}%` }]} /></View>
        {awake ? <Text style={[styles.hint, { fontSize: 12 }]}><Icon name="sun" size={12} color={colors.faint} /> Bildschirm bleibt an</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={local.content}>
        {order.map((section) => {
          const list = open.filter((r) => r.section === section);
          if (!list.length) return null;
          return (
            <View key={section} style={{ gap: 6 }}>
              <Text style={local.section}>{section}</Text>
              {list.map(row)}
            </View>
          );
        })}

        {!open.length && rows.length ? (
          <View style={[styles.card, { alignItems: 'center', gap: space.sm, borderColor: colors.accent }]}>
            <Icon name="check-circle" size={36} color={colors.accent} />
            <Text style={styles.h2}>Alles im Wagen</Text>
            <Text style={[styles.hint, { textAlign: 'center' }]}>Nach dem Bezahlen den Bon fotografieren – dann landen Preise und Ausgaben in der App.</Text>
            <View style={{ alignSelf: 'stretch', gap: space.sm }}>
              <Button label="Bon fotografieren" icon="camera" onPress={onShopped} />
              <Button label="Einkaufsmodus beenden" variant="ghost" onPress={onClose} />
            </View>
          </View>
        ) : null}
        {!rows.length ? <Text style={styles.hint}>Die Liste ist leer.</Text> : null}

        <View style={local.addRow}>
          <TextInput value={newItem} onChangeText={setNewItem} onSubmitEditing={add} placeholder="Vergessen? Hier dazuschreiben"
            placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} returnKeyType="done" />
          <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Hinzufügen" style={local.addBtn}>
            <Icon name="plus" size={20} color={colors.onAccent} />
          </Pressable>
        </View>

        {done.length ? (
          <View style={{ gap: 6, opacity: 0.8 }}>
            <Text style={local.section}>Im Wagen · {done.length}</Text>
            {done.map(row)}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  close: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  closeText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  progress: { height: 8, borderRadius: 4, backgroundColor: colors.input, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  rowDone: { backgroundColor: colors.surface },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through', fontWeight: '600' },
  amount: { fontSize: 15, color: colors.accent, fontWeight: '600', marginTop: 2 },
  price: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: space.sm },
  addBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
