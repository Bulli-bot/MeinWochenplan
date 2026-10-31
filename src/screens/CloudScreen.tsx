import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Field, Link } from '../components';
import { cloudConfig, newHouseholdCode, saveCloudConfig, testCloud, type CloudConfig, type SyncStatus } from '../cloud';
import { Button, colors, styles } from '../ui';

/** Link, der auf einem anderen Gerät die Cloud-Daten einträgt (steht hinter #, geht also nicht an den Server). */
export function connectLink(cfg: CloudConfig): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const base = window.location.href.split('#')[0];
  return `${base}#verbinden=${encodeURIComponent(btoa(JSON.stringify(cfg)))}`;
}

export function readConnectLink(): CloudConfig | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const m = window.location.hash.match(/verbinden=([^&]+)/);
  if (!m) return null;
  try {
    const cfg = JSON.parse(atob(decodeURIComponent(m[1])));
    history.replaceState(null, '', window.location.href.split('#')[0]);
    return cfg.url && cfg.key && cfg.code ? cfg : null;
  } catch {
    return null;
  }
}

export function CloudScreen({ status, onChanged, onSyncNow, onBack }: {
  status: SyncStatus;
  onChanged: () => void;
  onSyncNow: () => void;
  onBack: () => void;
}) {
  const current = cloudConfig();
  const [url, setUrl] = useState(current?.url ?? '');
  const [key, setKey] = useState(current?.key ?? '');
  const [code, setCode] = useState(current?.code ?? newHouseholdCode());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [remoteExists, setRemoteExists] = useState(false);

  const cfg: CloudConfig = { url: url.trim(), key: key.trim(), code: code.trim() };

  const connect = async (uploadLocal?: boolean) => {
    if (!cfg.url.startsWith('https://') || !cfg.key || cfg.code.length < 16) {
      setMsg({ text: 'Bitte Projekt-URL (https://…), Schlüssel und einen Code mit mind. 16 Zeichen angeben.', error: true });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const found = await testCloud(cfg);
      if (found === 'vorhanden' && uploadLocal === undefined) {
        setRemoteExists(true);
        setMsg({ text: 'Unter diesem Code liegt schon eine Woche. Was soll gelten?' });
        return;
      }
      await saveCloudConfig(cfg, uploadLocal ?? true);
      setRemoteExists(false);
      setMsg({ text: 'Verbunden! Ab jetzt wird automatisch abgeglichen.' });
      onChanged();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const link = current ? connectLink(current) : null;
  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ text: 'Link kopiert. Schick ihn dir aufs iPhone (z. B. per Mail oder WhatsApp an dich selbst) und öffne ihn in Safari.' });
    } catch {
      setMsg({ text: link });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Mehr" onPress={onBack} />
      <Text style={styles.h1}>Cloud-Sync</Text>
      <Text style={[styles.sub, { color: status.kind === 'fehler' ? colors.danger : status.kind === 'ok' ? colors.accent : colors.muted }]}>{status.text}</Text>

      {current ? (
        <View style={[styles.card, { gap: 10 }]}>
          <Text style={styles.sectionTitle}>iPhone verbinden</Text>
          <Text style={styles.hint}>Den Link auf dem iPhone in Safari öffnen – dann ist alles eingetragen. Danach „Teilen → Zum Home-Bildschirm".</Text>
          {link ? <Button label="Verbindungs-Link kopieren" onPress={copyLink} /> : null}
          <Button label="Jetzt abgleichen" variant="secondary" onPress={onSyncNow} />
        </View>
      ) : (
        <View style={[styles.card, { gap: 6 }]}>
          <Text style={styles.sectionTitle}>Einmalig einrichten (ca. 5 Minuten)</Text>
          {[
            'Auf supabase.com kostenlos registrieren und ein neues Projekt anlegen (Region Frankfurt).',
            'Im Projekt links „SQL Editor" öffnen, den Inhalt von supabase-einrichtung.sql (liegt im Ordner D:\\MeinWochenplan) einfügen und „Run" klicken.',
            'Unter „Project Settings → API" die Project URL und den Publishable bzw. anon key kopieren und unten eintragen.',
            '„Verbinden" tippen. Dann hier den Verbindungs-Link fürs iPhone kopieren.',
          ].map((t, i) => <Text key={i} style={styles.hint}>{i + 1}. {t}</Text>)}
        </View>
      )}

      <View style={[styles.card, { gap: 10 }]}>
        <Field label="Project URL" value={url} onChangeText={setUrl} placeholder="https://abcd1234.supabase.co" autoCapitalize="none" autoCorrect={false} />
        <Field label="Publishable / anon key" value={key} onChangeText={setKey} placeholder="sb_publishable_… oder eyJ…" autoCapitalize="none" autoCorrect={false} />
        <Field label="Haushalts-Code (wie ein Passwort – auf allen Geräten gleich)" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
        {remoteExists ? (
          <>
            <Button label="Woche aus der Cloud laden" onPress={() => connect(false)} />
            <Button label="Diesen Stand hochladen (Cloud überschreiben)" variant="secondary" onPress={() => connect(true)} />
          </>
        ) : (
          <Button label={busy ? 'Prüfe …' : current ? 'Speichern' : 'Verbinden'} onPress={() => (busy ? null : connect())} />
        )}
        {msg ? <Text style={msg.error ? styles.error : styles.hint}>{msg.text}</Text> : null}
        {current ? <Button label="Cloud-Sync ausschalten" variant="secondary" onPress={async () => { await saveCloudConfig(null); onChanged(); setMsg({ text: 'Ausgeschaltet. Die Daten bleiben auf diesem Gerät.' }); }} /> : null}
      </View>
    </ScrollView>
  );
}
