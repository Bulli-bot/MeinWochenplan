import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SyncStatus } from '../cloud';
import { helperStatus } from '../pchelper';
import { EMPTY_STATE } from '../storage';
import type { AppState } from '../types';
import { Button, Card, Icon, colors, hov, styles, type IconName } from '../ui';

/** Sicherung als JSON-Datei herunterladen (ohne Fotos – die liegen in der Cloud). */
function downloadBackup(state: AppState) {
  const blob = new Blob([JSON.stringify({ savedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wochenplan-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Sicherung einlesen – auch die alte data/sync-state.json ({ state: … }). */
function pickBackup(): Promise<AppState | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const data = JSON.parse(await file.text());
        const state = data.state ?? data;
        if (!state || typeof state !== 'object' || !('plan' in state)) throw new Error('Das ist keine Wochenplan-Sicherung.');
        resolve({ ...EMPTY_STATE, ...state });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

export type MoreView = 'einstellungen' | 'vorrat' | 'preise' | 'cloud';

export function MoreScreen({ state, syncStatus, onOpen, onRestore, onExpenses }: {
  state: AppState;
  /** Nur auf dem Handy: Ausgaben haben dort keinen eigenen Tab */
  onExpenses?: () => void;
  syncStatus: SyncStatus;
  onOpen: (v: MoreView) => void;
  onRestore: (s: AppState) => void;
}) {
  const [helper, setHelper] = useState<string>('wird geprüft …');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AppState | null>(null);
  const pantryCount = state.pantry.length;
  const ownPrices = Object.keys(state.userPrices).length;
  useEffect(() => {
    helperStatus()
      .then((s) => setHelper(!s.ollama ? 'läuft, aber Ollama ist aus (Docker starten)' : s.visionModel ? `bereit (${s.visionModel})` : 'läuft, aber kein Bildmodell in Ollama'))
      .catch(() => setHelper('aus – nur am PC nötig (Bons auslesen, Rezept-Links)'));
  }, []);

  const entries: [MoreView | 'ausgaben', string, string, IconName][] = [
    ...(onExpenses ? [['ausgaben', 'Ausgaben', 'Bons, Wochenverlauf, Budget', 'credit-card'] as [MoreView | 'ausgaben', string, string, IconName]] : []),
    ['vorrat', 'Vorrat', pantryCount ? `${pantryCount} Sachen zu Hause` : 'Was du schon hast, nicht mehr kaufen', 'archive'],
    ['preise', 'Preise', ownPrices ? `${ownPrices} eigene Preise` : 'Zutatenpreise ansehen und anpassen', 'tag'],
    ['cloud', 'Cloud-Sync', syncStatus.text, 'cloud'],
    ['einstellungen', 'Einstellungen', 'Haushalt, Budget, Kinder, Kochtage …', 'sliders'],
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Mehr</Text>
      <Card style={{ padding: 0, gap: 0 }}>
        {entries.map(([id, title, sub, icon], i) => (
          <Pressable key={id} onPress={() => (id === 'ausgaben' ? onExpenses?.() : onOpen(id))} accessibilityRole="button"
            style={(st) => [local.entry, i > 0 && local.divider, hov(st) && { backgroundColor: colors.cardHover }]}>
            <View style={local.iconBox}><Icon name={icon} size={18} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={local.title}>{title}</Text>
              <Text style={[styles.hint, id === 'cloud' && syncStatus.kind === 'fehler' && { color: colors.danger }]} numberOfLines={1}>{sub}</Text>
            </View>
            <Icon name="chevron-right" />
          </Pressable>
        ))}
      </Card>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PC-Helfer</Text>
        <Text style={styles.hint}>{helper}</Text>
      </View>
      {Platform.OS === 'web' ? (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.sectionTitle}>Sicherung</Text>
          <Text style={styles.hint}>Woche, Rezepte, Preise und Ausgaben als Datei (Fotos nicht).</Text>
          <Button label="Sicherung herunterladen" variant="secondary" onPress={() => downloadBackup(state)} />
          {confirm ? (
            <>
              <Text style={styles.hint}>Sicherung mit {confirm.plan?.slots.length ?? 0} Gerichten gefunden. Ersetzt alles auf diesem Gerät.</Text>
              <Button label="Ja, einspielen" onPress={() => { onRestore(confirm); setConfirm(null); setMsg('Sicherung eingespielt.'); }} />
            </>
          ) : (
            <Button label="Sicherung einspielen" variant="secondary" onPress={() => pickBackup().then((s) => s && setConfirm(s)).catch((e) => setMsg((e as Error).message))} />
          )}
          {msg ? <Text style={styles.hint}>{msg}</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 68, borderRadius: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 0 },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
});
