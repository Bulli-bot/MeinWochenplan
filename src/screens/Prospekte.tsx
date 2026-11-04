import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components';
import type { FlyerLink } from '../types';
import { Button, Icon, colors, hov, radius, space, styles } from '../ui';

/** Offizielle Prospekt-Seiten (geprüft 04.11.2026). Nur Links – die App liest dort nichts aus. */
export const DEFAULT_FLYERS: FlyerLink[] = [
  { id: 'aldi-sued', name: 'ALDI SÜD', url: 'https://www.aldi-sued.de/prospekte' },
  { id: 'edeka', name: 'EDEKA', url: 'https://www.edeka.de/angebote/' },
  { id: 'trinkgut', name: 'trinkgut', url: 'https://www.trinkgut.de/angebote' },
  { id: 'lidl', name: 'Lidl', url: 'https://www.lidl.de/c/online-prospekte/s10005610' },
  { id: 'kaufland', name: 'Kaufland', url: 'https://filiale.kaufland.de/prospekte.html' },
  { id: 'rewe', name: 'REWE', url: 'https://www.rewe.de/angebote/' },
  { id: 'netto', name: 'Netto', url: 'https://www.netto-online.de/ueber-netto/Online-Prospekte.chtm' },
  { id: 'penny', name: 'PENNY', url: 'https://www.penny.de/angebote' },
  { id: 'dm', name: 'dm', url: 'https://www.dm.de/angebote' },
  { id: 'rossmann', name: 'Rossmann', url: 'https://www.rossmann.de/de/angebote/prospekt' },
];

const open = (url: string) => {
  // Im Browser in einem neuen Tab – die Händlerseiten lassen sich nicht in die App einbetten
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else Linking.openURL(url).catch(() => {});
};

const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

/** Reiter „Prospekte“: Links zu den Wochenprospekten der Händler, eigene Links (auch direkt zu PDFs) möglich. */
export function Prospekte({ links, onChange }: { links: FlyerLink[] | undefined; onChange: (links: FlyerLink[]) => void }) {
  const list = links ?? DEFAULT_FLYERS;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const add = () => {
    const u = url.trim();
    if (!name.trim() || !/^https?:\/\/\S+\.\S+/i.test(u)) return setMsg('Bitte Name und vollständigen Link (mit https://) eintragen.');
    onChange([...list, { id: `f${Date.now().toString(36)}`, name: name.trim(), url: u }]);
    setName('');
    setUrl('');
    setMsg(null);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <View style={{ gap: space.md }}>
      <Text style={styles.hint}>Die aktuellen Wochenprospekte direkt beim Händler – öffnet sich in einem neuen Tab. Eigene Links gehen auch, z. B. das PDF deines Markts.</Text>
      <View style={local.grid}>
        {list.map((f, i) => (
          <View key={f.id} style={local.cell}>
            <Pressable onPress={() => open(f.url)} accessibilityRole="link" accessibilityLabel={`Prospekt ${f.name} öffnen`}
              style={(st) => [local.card, hov(st) && local.cardHover]}>
              <View style={local.logo}><Text style={local.logoText}>{f.name.replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sectionTitle} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.hint} numberOfLines={1}>{/\.pdf(\?|$)/i.test(f.url) ? 'PDF · ' : ''}{host(f.url)}</Text>
              </View>
              {editing ? null : <Icon name="external-link" size={18} color={colors.accent} />}
            </Pressable>
            {editing ? (
              <View style={local.editRow}>
                <Pressable onPress={() => move(i, -1)} style={local.small} accessibilityLabel={`${f.name} nach oben`}><Icon name="arrow-up" size={14} color={colors.text} /></Pressable>
                <Pressable onPress={() => move(i, 1)} style={local.small} accessibilityLabel={`${f.name} nach unten`}><Icon name="arrow-down" size={14} color={colors.text} /></Pressable>
                <Pressable onPress={() => onChange(list.filter((x) => x.id !== f.id))} style={local.small} accessibilityLabel={`${f.name} entfernen`}><Icon name="trash-2" size={14} color={colors.danger} /></Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {editing ? (
        <View style={[styles.card, { gap: space.sm }]}>
          <Text style={styles.sectionTitle}>Eigenen Link hinzufügen</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. EDEKA Müller" />
          <Field label="Link (Prospekt-Seite oder PDF)" value={url} onChangeText={setUrl} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" onSubmitEditing={add} />
          {msg ? <Text style={styles.error}>{msg}</Text> : null}
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 140 }}><Button label="Hinzufügen" icon="plus" onPress={add} /></View>
            <View style={{ flex: 1, minWidth: 140 }}><Button label="Fertig" variant="ghost" onPress={() => setEditing(false)} /></View>
          </View>
          {links ? <Pressable onPress={() => onChange(DEFAULT_FLYERS)}><Text style={[styles.hint, { color: colors.accent }]}>Standard-Liste wiederherstellen</Text></Pressable> : null}
        </View>
      ) : (
        <Button label="Liste bearbeiten" variant="ghost" icon="edit-2" onPress={() => setEditing(true)} />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexGrow: 1, flexBasis: 260, gap: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cardHover: { backgroundColor: colors.cardHover, borderColor: colors.borderStrong },
  logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  editRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  small: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
