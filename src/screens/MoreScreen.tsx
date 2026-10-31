import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SyncStatus } from '../cloud';
import { helperStatus } from '../pchelper';
import { EMPTY_STATE } from '../storage';
import type { AppState } from '../types';
import { Button, colors, styles } from '../ui';

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

export function MoreScreen({ state, syncStatus, onOpen, onRestore }: {
  state: AppState;
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

  const entries: [MoreView, string, string][] = [
    ['vorrat', 'Vorrat', pantryCount ? `${pantryCount} Sachen zu Hause` : 'Was du schon hast, nicht mehr kaufen'],
    ['preise', 'Preise', ownPrices ? `${ownPrices} eigene Preise` : 'Zutatenpreise ansehen und anpassen'],
    ['cloud', 'Cloud-Sync (PC ↔ iPhone)', syncStatus.text],
    ['einstellungen', 'Einstellungen', 'Haushalt, Budget, Kinder, Kochtage …'],
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Mehr</Text>
      {entries.map(([id, title, sub]) => (
        <Pressable key={id} onPress={() => onOpen(id)} style={[styles.card, local.entry]} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={[styles.hint, id === 'cloud' && syncStatus.kind === 'fehler' && { color: colors.danger }]}>{sub}</Text>
          </View>
          <Text style={local.chev}>›</Text>
        </Pressable>
      ))}
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
  entry: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chev: { fontSize: 26, color: colors.muted },
});
