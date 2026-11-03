import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Cover, Link } from '../components';
import { RECIPE_BY_ID } from '../data/recipes';
import { portionCost } from '../logic/generator';
import { tally, voteScores } from '../logic/vote';
import type { FamilyVote, PhotoRef, VoteChoice } from '../types';
import { Button, Card, Chip, Icon, colors, euro, space, styles } from '../ui';

const VOTER_KEY = 'meinwochenplan:voter';

/** Familien-Abstimmung: jede Person tippt bei 10 Vorschlägen „will ich“, „egal“ oder „nein“. */
export function VoteScreen({ vote, voters, householdSize, photos, onStart, onCast, onPlan, onOpen, onBack }: {
  vote: FamilyVote | undefined;
  /** Wer abstimmen kann (Mitglieder bzw. Kinder + „Ich“) */
  voters: string[];
  householdSize: number;
  photos: Record<string, PhotoRef[]>;
  onStart: () => void;
  onCast: (voter: string, recipeId: string, choice: VoteChoice | null) => void;
  /** Neuen Plan mit dem Ergebnis erstellen */
  onPlan: () => void;
  onOpen: (recipeId: string) => void;
  onBack: () => void;
}) {
  const [voter, setVoter] = useState<string | null>(null);
  // Das Gerät merkt sich, wer hier abstimmt – auf dem Kinder-Tablet muss nicht jedes Mal gewählt werden
  useEffect(() => {
    AsyncStorage.getItem(VOTER_KEY).then((v) => { if (v && voters.includes(v)) setVoter(v); }).catch(() => {});
  }, [voters.join('|')]);
  const pick = (v: string) => {
    setVoter(v);
    AsyncStorage.setItem(VOTER_KEY, v).catch(() => {});
  };

  if (!vote) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Link label="‹ Zurück" onPress={onBack} />
        <Text style={styles.h1}>Familien-Abstimmung</Text>
        <Card style={{ gap: space.sm }}>
          <Text style={styles.hint}>
            Die App sucht 10 Gerichte aus, die zu euren Einstellungen und zum Budget passen. Jede Person tippt „will ich“, „egal“ oder „nein“ –
            auf dem eigenen Handy oder nacheinander auf einem Gerät. Die Gewinner kommen in den nächsten Plan.
          </Text>
          <Button label="Abstimmung starten" icon="check-square" onPress={onStart} />
        </Card>
      </ScrollView>
    );
  }

  const ballot = voter ? vote.ballots[voter] ?? {} : {};
  const next = vote.suggestions.find((id) => ballot[id] === undefined && RECIPE_BY_ID[id]);
  const r = next ? RECIPE_BY_ID[next] : null;
  const doneCount = (name: string) => vote.suggestions.filter((id) => vote.ballots[name]?.[id] !== undefined).length;
  const scores = voteScores(vote);
  const ranking = [...vote.suggestions].filter((id) => RECIPE_BY_ID[id]).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Zurück" onPress={onBack} />
      <Text style={styles.h1}>Was essen wir nächste Woche?</Text>

      <View style={{ gap: 6 }}>
        <Text style={styles.hint}>Wer stimmt gerade ab?</Text>
        <View style={styles.chipRow}>
          {voters.map((v) => (
            <Chip key={v} label={`${v} · ${doneCount(v)}/${vote.suggestions.length}`} selected={voter === v} onPress={() => pick(v)} />
          ))}
        </View>
      </View>

      {voter && r ? (
        <Card style={{ gap: space.md, borderColor: colors.accent }}>
          <Cover id={photos[r.id]?.[0]?.id} height={200} />
          <Text style={styles.hint}>Vorschlag {vote.suggestions.indexOf(r.id) + 1} von {vote.suggestions.length}</Text>
          <Pressable onPress={() => onOpen(r.id)}><Text style={styles.h2}>{r.name} ›</Text></Pressable>
          <Text style={styles.hint}>{r.minutes} Min. · {euro(portionCost(r, householdSize))} für {householdSize}{r.vibes.includes('kinder') ? ' · kinderfreundlich' : ''}</Text>
          <View style={local.buttons}>
            <Pressable onPress={() => onCast(voter, r.id, -1)} accessibilityRole="button" accessibilityLabel="Nein" style={[local.round, local.no]}>
              <Icon name="x" size={28} color={colors.danger} />
            </Pressable>
            <Pressable onPress={() => onCast(voter, r.id, 0)} accessibilityRole="button" accessibilityLabel="Egal" style={[local.round, local.meh]}>
              <Text style={[styles.hint, { fontWeight: '700' }]}>egal</Text>
            </Pressable>
            <Pressable onPress={() => onCast(voter, r.id, 1)} accessibilityRole="button" accessibilityLabel="Will ich" style={[local.round, local.yes]}>
              <Icon name="check" size={30} color={colors.onAccent} />
            </Pressable>
          </View>
        </Card>
      ) : voter ? (
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <Icon name="check-circle" size={28} color={colors.accent} />
          <Text style={styles.sectionTitle}>{voter} ist fertig – danke!</Text>
          <Text style={styles.hint}>Als Nächstes jemand anderes oben auswählen.</Text>
        </Card>
      ) : (
        <Text style={styles.hint}>Oben den eigenen Namen antippen, dann geht’s los.</Text>
      )}

      <Card style={{ gap: 6 }}>
        <Text style={styles.sectionTitle}>Zwischenstand</Text>
        {ranking.map((id) => {
          const t = tally(vote, id);
          const mine = voter ? vote.ballots[voter]?.[id] : undefined;
          return (
            <View key={id} style={local.row}>
              <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{RECIPE_BY_ID[id].name}</Text>
              <Text style={[styles.hint, { color: colors.accent }]}>{t.yes} ja</Text>
              <Text style={[styles.hint, { color: colors.danger, width: 52, textAlign: 'right' }]}>{t.no} nein</Text>
              {mine !== undefined && voter ? (
                <Pressable onPress={() => onCast(voter, id, null)} accessibilityLabel="Eigene Stimme zurücknehmen" style={{ paddingLeft: 6 }}>
                  <Icon name="rotate-ccw" size={14} color={colors.muted} />
                </Pressable>
              ) : <View style={{ width: 20 }} />}
            </View>
          );
        })}
        <Text style={styles.hint}>Mit mindestens zwei Ja-Stimmen mehr als Nein kommt ein Gericht sicher in den Plan, sofern das Budget passt.</Text>
      </Card>

      <Button label="Jetzt mit dem Ergebnis planen" icon="calendar" onPress={onPlan} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  buttons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  no: { borderWidth: 2, borderColor: colors.danger },
  meh: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: colors.borderStrong },
  yes: { backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
});
