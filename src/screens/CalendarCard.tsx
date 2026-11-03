import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { SUPABASE_URL, rpc } from '../supabase';
import { Button, Card, Icon, colors, space, styles } from '../ui';

const calendarUrl = (token: string) => `${SUPABASE_URL}/functions/v1/kalender?t=${token}`;
/** webcal:// öffnet auf dem iPhone direkt „Kalender abonnieren“ */
const webcal = (url: string) => url.replace(/^https?:/, 'webcal:');

/** Kalender-Abo: Einkaufstag, bald leer und Reste landen als Termine mit Erinnerung im iPhone-Kalender. */
export function CalendarCard({ hasShopDays }: { hasShopDays: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (renew = false) => {
    setBusy(true);
    setMsg(null);
    try {
      setToken(await rpc<string>('wp2_calendar_token', { renew }));
      if (renew) setMsg('Neuer Link – der alte funktioniert nicht mehr. Auf dem iPhone das alte Abo löschen und neu abonnieren.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(text);
      setMsg('Link kopiert.');
    } catch {
      setMsg('Kopieren ging nicht – Link bitte markieren und kopieren.');
    }
  };

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.row}><Icon name="calendar" color={colors.accent} /><Text style={styles.sectionTitle}>Erinnerungen im iPhone-Kalender</Text></View>
      <Text style={styles.hint}>
        Die App liefert einen eigenen Kalender: Einkaufstag mit offenem Betrag (Erinnerung am Vorabend und eine Stunde vorher),
        „bald leer“ aus dem Vorrat und Reste, die weg müssen. Einmal abonnieren – danach aktualisiert er sich von selbst.
      </Text>
      {!hasShopDays ? <Text style={[styles.hint, { color: colors.warn }]}>Oben die Einkaufstage wählen und speichern, sonst fehlt der Einkaufstermin.</Text> : null}
      {token ? (
        <>
          <Text selectable style={[styles.hint, { color: colors.text }]}>{webcal(calendarUrl(token))}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 150 }}><Button label="Im Kalender abonnieren" icon="calendar" onPress={() => Linking.openURL(webcal(calendarUrl(token)))} /></View>
            <View style={{ flex: 1, minWidth: 150 }}><Button label="Link kopieren" variant="secondary" icon="copy" onPress={() => copy(webcal(calendarUrl(token)))} /></View>
          </View>
          <Text style={styles.hint}>
            iPhone: „Im Kalender abonnieren“ antippen → Abonnieren → Hinzufügen. Damit es schnell aktualisiert: Einstellungen → Kalender →
            Accounts → Abonnierte Kalender → MeinWochenplan, oder unter Accounts → „Datenabgleich“ auf „Alle 15 Minuten“/„Stündlich“.
          </Text>
          <Pressable onPress={() => (busy ? null : load(true))}><Text style={[styles.hint, { color: colors.accent }]}>Neuen Link erzeugen (alter wird ungültig)</Text></Pressable>
        </>
      ) : (
        <Button label={busy ? 'Hole Link …' : 'Kalender-Link holen'} variant="secondary" icon="link" onPress={() => (busy ? null : load())} />
      )}
      {msg ? <Text style={styles.hint}>{msg}</Text> : null}
    </Card>
  );
}
