import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SyncStatus } from '../cloud';
import { Field, Link } from '../components';
import { rpc, supabase, type Profile } from '../supabase';
import { Button, Card, Icon, Tag, colors, hov, space, styles } from '../ui';

interface UserRow {
  user_id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  approved: boolean;
  same_household: boolean;
  created_at: string;
}

/** Eigenes Konto; für den Besitzer zusätzlich die Freigabe aller Konten. */
export function AccountScreen({ profile, syncStatus, onSyncNow, onSignOut, onBack, onProfileChanged }: {
  profile: Profile;
  syncStatus: SyncStatus;
  onSyncNow: () => void;
  onSignOut: () => void;
  onBack: () => void;
  onProfileChanged: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const isOwner = profile.role === 'owner';

  const loadUsers = useCallback(() => {
    if (isOwner) rpc<UserRow[]>('wp2_list_users').then(setUsers).catch((e) => setMsg({ text: e.message, error: true }));
  }, [isOwner]);
  useEffect(loadUsers, [loadUsers]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await action();
      setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  };

  const manage = (target: string, aktion: string) => run(async () => { await rpc('wp2_manage_user', { target, aktion }); loadUsers(); }, 'Gespeichert.');
  const pending = users?.filter((u) => !u.approved) ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Mehr" onPress={onBack} />
      <Text style={styles.h1}>Konto</Text>

      <Card style={{ gap: space.md }}>
        <View style={local.head}>
          <View style={local.avatar}><Text style={local.avatarText}>{(profile.name || profile.email).slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{profile.name || 'Ohne Namen'}</Text>
            <Text style={styles.hint}>{profile.email}</Text>
          </View>
          <Tag label={isOwner ? 'Besitzer' : 'Mitglied'} tone={isOwner ? 'accent' : 'info'} icon={isOwner ? 'award' : 'user'} />
        </View>
        <Field label="Anzeigename" value={name} onChangeText={setName} />
        <Button label="Namen speichern" variant="secondary" onPress={() => run(async () => { await rpc('wp2_set_name', { new_name: name.trim() }); onProfileChanged(); }, 'Name gespeichert.')} />
        <Field label="Neues Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="mindestens 6 Zeichen" />
        <Button label="Passwort ändern" variant="secondary" onPress={() => run(async () => {
          if (password.length < 6) throw new Error('Das Passwort braucht mindestens 6 Zeichen.');
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw new Error(error.message);
          setPassword('');
        }, 'Passwort geändert.')} />
        {msg ? <Text style={msg.error ? styles.error : styles.hint}>{msg.text}</Text> : null}
      </Card>

      <Card style={{ gap: space.sm }}>
        <View style={local.head}>
          <Icon name="cloud" color={syncStatus.kind === 'fehler' ? colors.danger : colors.accent} />
          <Text style={[styles.sectionTitle, { flex: 1 }]}>Abgleich</Text>
          <Button label="Jetzt" variant="ghost" icon="refresh-cw" onPress={onSyncNow} />
        </View>
        <Text style={[styles.hint, syncStatus.kind === 'fehler' && { color: colors.danger }]}>{syncStatus.text}</Text>
        <Text style={styles.hint}>Alle Geräte, auf denen du (oder jemand aus deinem Haushalt) angemeldet ist, sehen dieselbe Woche.</Text>
      </Card>

      {isOwner ? (
        <Card style={{ gap: 0, padding: 0 }}>
          <View style={[local.head, { padding: space.lg }]}>
            <Icon name="users" color={colors.accent} />
            <Text style={[styles.sectionTitle, { flex: 1 }]}>Konten verwalten</Text>
            {pending.length ? <Tag label={`${pending.length} warten`} tone="warn" /> : null}
          </View>
          {(users ?? []).map((u) => (
            <View key={u.user_id} style={local.user}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={local.userName}>{u.name || u.email}</Text>
                <Text style={styles.hint}>{u.email} · seit {new Date(u.created_at).toLocaleDateString('de-DE')}</Text>
                <View style={[styles.row, { marginTop: 6 }]}>
                  {u.role === 'owner' ? <Tag label="Besitzer" tone="accent" /> : u.approved ? <Tag label="Freigegeben" tone="accent" icon="check" /> : <Tag label="Wartet" tone="warn" icon="clock" />}
                  {u.role !== 'owner' ? <Tag label={u.same_household ? 'Dein Haushalt' : 'Eigener Haushalt'} tone={u.same_household ? 'info' : 'muted'} icon="home" /> : null}
                </View>
              </View>
              {u.role !== 'owner' ? (
                <View style={local.actions}>
                  <Small label={u.approved ? 'Sperren' : 'Freigeben'} danger={u.approved} onPress={() => manage(u.user_id, u.approved ? 'sperren' : 'freigeben')} />
                  <Small label={u.same_household ? 'Eigener Haushalt' : 'In meinen Haushalt'} onPress={() => manage(u.user_id, u.same_household ? 'eigener_haushalt' : 'mein_haushalt')} />
                </View>
              ) : null}
            </View>
          ))}
          <Text style={[styles.hint, { padding: space.lg }]}>
            „In meinen Haushalt“: die Person sieht und bearbeitet deine Woche (z. B. Partnerin). Sonst hat jedes Konto seine eigenen Daten.
          </Text>
        </Card>
      ) : null}

      <Button label="Abmelden" variant="ghost" icon="log-out" onPress={onSignOut} />
    </ScrollView>
  );
}

function Small({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={(st) => [local.small, danger && { backgroundColor: colors.dangerSoft }, hov(st) && { opacity: 0.85 }]}>
      <Text style={[styles.smallText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  user: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  userName: { fontSize: 16, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  small: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.accentSoft },
});
