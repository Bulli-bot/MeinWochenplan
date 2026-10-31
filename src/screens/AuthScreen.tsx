import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { resetPassword, signIn, signUp } from '../auth';
import { authError, supabase } from '../supabase';
import { Field } from '../components';
import { Button, Card, Icon, colors, space, styles } from '../ui';

/** Anmelden bzw. Konto erstellen. Neue Konten muss der Besitzer erst freigeben. */
export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const submit = async () => {
    if (!email.includes('@')) return setMsg({ text: 'Bitte eine gültige E-Mail-Adresse eingeben.', error: true });
    if (password.length < 6) return setMsg({ text: 'Das Passwort braucht mindestens 6 Zeichen.', error: true });
    if (mode === 'register' && !name.trim()) return setMsg({ text: 'Bitte einen Namen eingeben.', error: true });
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'login') await signIn(email, password);
      else if (await signUp(email, password, name)) {
        setMsg({ text: 'Fast geschafft: Öffne den Link in der Bestätigungs-Mail und melde dich dann hier an.' });
        setMode('login');
      }
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.includes('@')) return setMsg({ text: 'Erst oben deine E-Mail-Adresse eintragen.', error: true });
    try {
      await resetPassword(email);
      setMsg({ text: 'Wenn es das Konto gibt, kommt gleich eine Mail zum Zurücksetzen.' });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={local.wrap}>
      <View style={local.box}>
        <View style={local.logo}><Icon name="coffee" size={26} color={colors.onAccent} /></View>
        <Text style={[styles.h1, { textAlign: 'center' }]}>MeinWochenplan</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>
          {mode === 'login' ? 'Melde dich an, um deinen Wochenplan zu sehen.' : 'Neues Konto – der Besitzer gibt es danach frei.'}
        </Text>
        <Card style={{ gap: space.md, marginTop: space.lg }}>
          {mode === 'register' ? <Field label="Name" value={name} onChangeText={setName} placeholder="Sascha" autoComplete="name" /> : null}
          <Field label="E-Mail" value={email} onChangeText={setEmail} placeholder="name@beispiel.de" autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" autoComplete="email" />
          <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onSubmitEditing={() => (busy ? null : submit())} placeholder="mindestens 6 Zeichen" />
          <Button label={busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'} icon={mode === 'login' ? 'log-in' : 'user-plus'}
            onPress={() => (busy ? null : submit())} />
          {msg ? <Text style={msg.error ? styles.error : styles.hint}>{msg.text}</Text> : null}
          <Button label={mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'} variant="ghost"
            onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(null); }} />
          {mode === 'login' ? <Text onPress={forgot} style={[styles.hint, local.link]}>Passwort vergessen?</Text> : null}
        </Card>
      </View>
    </ScrollView>
  );
}

/** Nach dem Link aus der „Passwort zurücksetzen“-Mail: neues Passwort festlegen. */
export function NewPasswordScreen({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (password.length < 6) return setMsg({ text: 'Das Passwort braucht mindestens 6 Zeichen.', error: true });
    if (password !== repeat) return setMsg({ text: 'Die beiden Passwörter sind nicht gleich.', error: true });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ text: authError(error.message), error: true });
    onDone();
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={local.wrap}>
      <View style={local.box}>
        <View style={local.logo}><Icon name="key" size={26} color={colors.onAccent} /></View>
        <Text style={[styles.h1, { textAlign: 'center' }]}>Neues Passwort</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>Für {email}. Tipp: Lass es dir vom iPhone beim Speichern im Schlüsselbund merken.</Text>
        <Card style={{ gap: space.md, marginTop: space.lg }}>
          <Field label="Neues Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="mindestens 6 Zeichen" />
          <Field label="Nochmal eingeben" value={repeat} onChangeText={setRepeat} secureTextEntry autoComplete="new-password" onSubmitEditing={() => (busy ? null : save())} />
          <Button label={busy ? 'Speichere …' : 'Passwort speichern'} icon="check" onPress={() => (busy ? null : save())} />
          {msg ? <Text style={msg.error ? styles.error : styles.hint}>{msg.text}</Text> : null}
        </Card>
      </View>
    </ScrollView>
  );
}

export function PendingScreen({ email, onRefresh, onSignOut }: { email: string; onRefresh: () => void; onSignOut: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={local.wrap}>
      <View style={local.box}>
        <View style={[local.logo, { backgroundColor: colors.warnSoft }]}><Icon name="clock" size={26} color={colors.warn} /></View>
        <Text style={[styles.h1, { textAlign: 'center' }]}>Wartet auf Freigabe</Text>
        <Text style={[styles.sub, { textAlign: 'center' }]}>
          Dein Konto ({email}) ist angelegt. Der Besitzer der App muss es noch freigeben – danach siehst du deinen Wochenplan.
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label="Nochmal prüfen" icon="refresh-cw" onPress={onRefresh} />
          <Button label="Abmelden" variant="ghost" icon="log-out" onPress={onSignOut} />
        </View>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  box: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.sm },
  logo: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: space.sm },
  link: { textAlign: 'center', color: colors.accent, paddingVertical: 6 },
});
