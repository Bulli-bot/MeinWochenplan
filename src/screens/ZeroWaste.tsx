import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { askAI } from '../ai';
import { daysToUseBy } from '../logic/leftovers';
import { currentAmount } from '../logic/pantry';
import type { PantryItem } from '../types';
import { Button, Card, Icon, colors, radius, space, styles, useLayout } from '../ui';

type Level = 'rot' | 'gelb' | 'gruen';
const LEVELS: [Level, string, string, string, string][] = [
  ['rot', 'Dringend', 'bis 2 Tage', colors.dangerSoft, colors.danger],
  ['gelb', 'Demnächst', '3–5 Tage', colors.warnSoft, colors.warn],
  ['gruen', 'Stabil', 'länger haltbar', colors.accentSoft, colors.accent],
];
const levelOf = (days: number): Level => (days <= 2 ? 'rot' : days <= 5 ? 'gelb' : 'gruen');
const left = (d: number) => (d < 0 ? 'abgelaufen' : d === 0 ? 'heute' : d === 1 ? 'morgen' : `${d} Tage`);

/** Zero-Waste-Ampel: Vorrat mit „haltbar bis“ nach Dringlichkeit, dazu ein KI-Blitzrezept aus dem Roten. */
export function ZeroWasteBoard({ pantry }: { pantry: PantryItem[] }) {
  const { isPhone } = useLayout();
  const [idea, setIdea] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = pantry
    .filter((p) => currentAmount(p) !== 0)
    .map((item) => ({ item, days: daysToUseBy(item) }))
    .filter((x): x is { item: PantryItem; days: number } => x.days !== null)
    .sort((a, b) => a.days - b.days);
  if (!items.length) {
    return (
      <Card style={{ gap: 4 }}>
        <View style={styles.row}><Icon name="thermometer" color={colors.accent} /><Text style={styles.sectionTitle}>Zero-Waste-Ampel</Text></View>
        <Text style={styles.hint}>Trag bei Frischem „haltbar bis“ ein (Artikel antippen → Bearbeiten). Dann zeigt die Ampel, was zuerst weg muss: Rot bis 2 Tage, Gelb 3–5 Tage, Grün länger – mit KI-Blitzrezept aus dem Roten.</Text>
      </Card>
    );
  }
  const red = items.filter((x) => levelOf(x.days) === 'rot');

  const blitz = async () => {
    setBusy(true);
    setIdea(null);
    try {
      const list = red.map(({ item }) => `${item.name}${item.amount ? ` (${item.amount} ${item.unit ?? ''})`.replace(' )', ')') : ''}`).join(', ');
      const r = await askAI(
        'Du bist ein Familienkoch in Deutschland. Schlage EIN einfaches, kinderfreundliches Gericht vor, das in höchstens 20 Minuten fertig ist und die genannten Reste verbraucht. Antworte kurz auf Deutsch ohne Markdown: Name, Zutaten als Liste, höchstens 5 Schritte.',
        [{ role: 'user', content: `Diese Reste müssen weg: ${list}` }],
      );
      setIdea(`${r.text.replace(/\*\*/g, '').trim()}\n\n(${r.via === 'PC' ? 'lokal' : 'Gemini'} · ${r.model})`);
    } catch (e) {
      setIdea(`Klappt gerade nicht: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.row}><Icon name="thermometer" color={colors.accent} /><Text style={styles.sectionTitle}>Zero-Waste-Ampel</Text></View>
      <View style={[local.cols, isPhone && { flexDirection: 'column' }]}>
        {LEVELS.map(([lvl, title, sub, bg, fg]) => {
          const list = items.filter((x) => levelOf(x.days) === lvl);
          return (
            <View key={lvl} style={[local.col, { backgroundColor: bg, borderColor: fg }]}>
              <Text style={[styles.sectionTitle, { color: fg }]}>{title}</Text>
              <Text style={styles.hint}>{sub}</Text>
              {list.length ? list.map(({ item, days }) => (
                <View key={item.name} style={local.food}>
                  <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.hint, { color: fg, fontWeight: '700' }]}>{left(days)}</Text>
                </View>
              )) : <Text style={styles.hint}>–</Text>}
            </View>
          );
        })}
      </View>
      {red.length ? (
        <>
          <Button label={busy ? 'KI denkt nach …' : '⚡ KI-Blitzrezept aus dem Roten'} variant="secondary" onPress={() => (busy ? null : blitz())} />
          {idea ? <Text style={[styles.hint, { color: colors.text, lineHeight: 21 }]}>{idea}</Text> : null}
        </>
      ) : <Text style={styles.hint}>Nichts Dringendes – „haltbar bis“ beim Bearbeiten eines Artikels eintragen.</Text>}
    </Card>
  );
}

const local = StyleSheet.create({
  cols: { flexDirection: 'row', gap: space.sm },
  col: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: 4, minWidth: 0 },
  food: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
});
