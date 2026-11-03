import { useState, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { Pressable, View } from 'react-native';
import { defaultMembers } from '../logic/people';
import { DEFAULT_MEAL_TIME, shiftTime } from '../logic/mealtime';
import type { Member } from '../types';
import type { Allergen, Basic, Carb, Diet, Equipment, Protein, Settings, StoreLevel, Vibe, Weekday } from '../types';
import { Field } from '../components';
import { CalendarCard } from './CalendarCard';
import { BASICS } from '../logic/shoppingList';
import { DEFAULT_SETTINGS } from '../storage';
import { Button, Chip, Icon, Section, Stepper, Toggle, WEEKDAYS, colors, euro, styles } from '../ui';

const DIETS: [Diet, string][] = [['alles', 'Alles'], ['pescetarisch', 'Pescetarisch'], ['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan']];
const ALLERGENS: [Allergen, string][] = [
  ['gluten', 'Gluten'], ['milch', 'Milch'], ['ei', 'Ei'], ['fisch', 'Fisch'],
  ['nuesse', 'Nüsse'], ['soja', 'Soja'], ['sesam', 'Sesam'], ['schalentiere', 'Schalentiere'],
];
const EQUIPMENT: [Equipment, string][] = [['herd', 'Herd'], ['ofen', 'Backofen'], ['airfryer', 'Airfryer'], ['mikrowelle', 'Mikrowelle']];
const VIBES: [Vibe, string][] = [
  ['schnell', 'Schnell & einfach'], ['kinder', 'Kinderfreundlich'], ['proteinreich', 'Proteinreich'], ['leicht', 'Leicht'], ['deftig', 'Deftig'], ['international', 'International'],
];
const PROTEINS: [Protein, string][] = [
  ['huhn', 'Geflügel'], ['rind', 'Rind'], ['schwein', 'Schwein'], ['fisch', 'Fisch'], ['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan'],
];
const SIDES: [Carb, string][] = [['kartoffeln', 'Kartoffeln'], ['nudeln', 'Nudeln'], ['reis', 'Reis'], ['brot', 'Brot']];
const STORES: [StoreLevel, string][] = [['discounter', 'Discounter (günstig)'], ['supermarkt', 'Supermarkt (Standard)'], ['mix', 'Angebote/Mix']];
const MINUTES = [20, 30, 45, 90];
const PORTIONS: [number, string][] = [[1, '1'], [0.75, '¾'], [0.5, '½']];
const minutesLabel = (m: number) => (m === 90 ? 'egal' : `${m} Min.`);

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function SettingsScreen({ initial, isFirstRun, onSave, onSaveOnly, error, header }: {
  initial: Settings;
  isFirstRun: boolean;
  onSave: (s: Settings) => void;
  /** Speichern, ohne den Plan neu zu würfeln */
  onSaveOnly?: (s: Settings) => void;
  error: string | null;
  /** Wird über dem Formular angezeigt, z. B. „Woche vom PC laden" beim ersten Start. */
  header?: ReactNode;
}) {
  // Ältere Einstellungen kennen die neuen Felder noch nicht → Standardwerte, Kochzeit aus dem alten Wert
  const [s, setS] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    maxMinutesWeekday: initial.maxMinutes,
    maxMinutesWeekend: initial.maxMinutes,
    ...initial,
  }));
  const set = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));
  const [kidsText, setKidsText] = useState((initial.kids ?? []).join(', '));
  const members = s.members ?? [];
  const setMember = (i: number, patch: Partial<Member>) => set({ members: members.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const final = (): Settings => ({
    ...s,
    kids: kidsText.split(',').map((k) => k.trim()).filter(Boolean),
    // Namenlose Einträge weglassen; mit Mitgliedern zählt der Haushalt nach Köpfen
    members: members.filter((m) => m.name.trim()).map((m) => ({ ...m, name: m.name.trim() })),
    ...(members.some((m) => m.name.trim()) ? { householdSize: members.filter((m) => m.name.trim()).length } : {}),
    // Für alte Stellen, die nur eine Kochzeit kennen
    maxMinutes: Math.max(s.maxMinutesWeekday ?? s.maxMinutes, s.maxMinutesWeekend ?? s.maxMinutes),
  });
  const save = () => onSave(final());
  const sides = s.sides ?? [];
  const basics = s.basics ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{isFirstRun ? 'Willkommen!' : 'Einstellungen'}</Text>
      <Text style={styles.sub}>
        {isFirstRun ? 'Ein paar Angaben, dann erstelle ich dir einen Wochenplan mit Einkaufsliste.' : 'Änderungen gelten ab dem nächsten Plan.'}
      </Text>
      {header}

      <Section title="Personen im Haushalt">
        <Stepper value={s.householdSize} min={1} max={8} label={`${s.householdSize} ${s.householdSize === 1 ? 'Person' : 'Personen'}`}
          onChange={(v) => set({ householdSize: v })} />
      </Section>

      <Section title="Kinder" hint="Namen mit Komma getrennt – für die Daumen-Bewertung nach dem Essen.">
        <Field label="" value={kidsText} onChangeText={setKidsText} placeholder="z. B. Mia, Ben" style={{ minWidth: 260 }} />
      </Section>

      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.sectionTitle}>Wer isst mit?</Text>
        <Text style={styles.hint}>Portion und Abneigungen pro Person. Im Plan lässt sich pro Tag abhaken, wer da ist – Mengen und Preise rechnen dann genau.</Text>
        {members.length ? members.map((m, i) => (
          <View key={i} style={{ gap: 6, paddingTop: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <View style={styles.row}>
              <View style={{ flex: 1, minWidth: 160 }}><Field label="" value={m.name} onChangeText={(t) => setMember(i, { name: t })} placeholder="Name" /></View>
              {PORTIONS.map(([v, label]) => <Chip key={v} label={label} selected={m.portion === v} onPress={() => setMember(i, { portion: v })} />)}
              <Pressable onPress={() => set({ members: members.filter((_, j) => j !== i) })} accessibilityLabel={`${m.name} entfernen`} style={{ padding: 8 }}>
                <Icon name="x" size={16} color={colors.muted} />
              </Pressable>
            </View>
            <Field label="Mag nicht (mit Komma)" value={m.dislikes.join(', ')} onChangeText={(t) => setMember(i, { dislikes: t.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="z. B. Pilze, Fisch" />
          </View>
        )) : null}
        <View style={styles.row}>
          {members.length ? (
            <Button label="Person dazu" variant="secondary" icon="user-plus" onPress={() => set({ members: [...members, { name: '', portion: 1, dislikes: [] }] })} />
          ) : (
            <Button label="Personen einzeln festlegen" variant="secondary" icon="users"
              onPress={() => set({ members: defaultMembers(s.householdSize, kidsText.split(',').map((k) => k.trim()).filter(Boolean), '') })} />
          )}
        </View>
      </View>

      <Section title="Normalerweise essen wir um" hint="Davon rechnet der Kochmodus rückwärts, wann es losgeht. Einzelne Tage änderst du direkt im Plan.">
        <View style={styles.row}>
          <Pressable onPress={() => set({ mealTime: shiftTime(s.mealTime ?? DEFAULT_MEAL_TIME, -15) })} style={styles.stepBtn} accessibilityLabel="15 Minuten früher" accessibilityRole="button">
            <Icon name="minus" color={colors.accent} />
          </Pressable>
          <Text style={styles.stepValue}>{s.mealTime ?? DEFAULT_MEAL_TIME} Uhr</Text>
          <Pressable onPress={() => set({ mealTime: shiftTime(s.mealTime ?? DEFAULT_MEAL_TIME, 15) })} style={styles.stepBtn} accessibilityLabel="15 Minuten später" accessibilityRole="button">
            <Icon name="plus" color={colors.accent} />
          </Pressable>
        </View>
      </Section>

      <Section title="Wochenbudget" hint="Für alle Hauptgerichte zusammen.">
        <Stepper value={s.weeklyBudget} step={5} min={10} max={250} label={euro(s.weeklyBudget)} onChange={(v) => set({ weeklyBudget: v })} />
      </Section>

      <Section title="Einkaufsmarkt & Preislevel" hint="Die Preise in der App sind Discounter-Eigenmarken – im Supermarkt oder mit Markenware wird es teurer.">
        {STORES.map(([id, label]) => <Chip key={id} label={label} selected={s.store === id} onPress={() => set({ store: id })} />)}
        <Toggle label="Bevorzugt Eigenmarken / No-Name" hint={s.privateLabel === false ? 'Aus: Markenware, ca. 25 % teurer gerechnet' : undefined}
          value={s.privateLabel !== false} onChange={(v) => set({ privateLabel: v })} />
      </Section>

      <Section title="Grundzutaten vorhanden" hint="Kommt nicht auf die Einkaufsliste und nicht in „noch zu kaufen“.">
        {BASICS.map(([id, label]) => (
          <Chip key={id} label={label} selected={basics.includes(id)} onPress={() => set({ basics: toggle<Basic>(basics, id) })} />
        ))}
      </Section>

      <Section title="Einkaufsrhythmus">
        <Chip label="1x Wocheneinkauf" selected={s.shopRhythm !== 'zweimal'} onPress={() => set({ shopRhythm: 'einmal' })} />
        <Chip label="2x (mit Frische-Split)" selected={s.shopRhythm === 'zweimal'} onPress={() => set({ shopRhythm: 'zweimal' })} />
      </Section>
      {s.shopRhythm === 'zweimal' ? <Text style={styles.hint}>Frisches für Donnerstag bis Sonntag kommt auf einen zweiten Einkauf zur Wochenmitte.</Text> : null}

      <Section title="Einkaufstage" hint="Für die Erinnerung im Kalender (siehe unten).">
        {WEEKDAYS.map((d, idx) => (
          <Chip key={d} label={d} selected={(s.shopDays ?? []).includes(idx as Weekday)}
            onPress={() => set({ shopDays: toggle(s.shopDays ?? [], idx as Weekday) })} />
        ))}
      </Section>
      {(s.shopDays ?? []).length ? (
        <Section title="Uhrzeit des Einkaufs">
          <Stepper value={s.shopHour ?? 10} min={6} max={21} label={`${s.shopHour ?? 10}:00 Uhr`} onChange={(v) => set({ shopHour: v })} />
        </Section>
      ) : null}
      {!isFirstRun ? <CalendarCard hasShopDays={!!initial.shopDays?.length} /> : null}

      <Section title="Kochtage">
        {WEEKDAYS.map((d, idx) => (
          <Chip key={d} label={d} selected={s.cookingDays.includes(idx as Weekday)}
            onPress={() => set({ cookingDays: toggle(s.cookingDays, idx as Weekday) })} />
        ))}
      </Section>

      <Section title="Für welche Woche planen?" hint="Du planst Freitag oder Samstag und kaufst bis Samstag ein – dann gilt der neue Plan ab Montag.">
        <Chip label="Ab Freitag: kommende Woche" selected={s.planWeek !== 'laufend'} onPress={() => set({ planWeek: 'kommend' })} />
        <Chip label="Immer laufende Woche" selected={s.planWeek === 'laufend'} onPress={() => set({ planWeek: 'laufend' })} />
      </Section>

      <Section title="Reste & Meal-Prep">
        <Toggle label="Für 2 Tage vorkochen" hint="Jeden zweiten Kochtag gibt es Reste vom Vortag – doppelte Menge auf der Einkaufsliste."
          value={!!s.mealPrep} onChange={(v) => set({ mealPrep: v })} />
        <Toggle label="Fester Restetag" hint="An diesem Tag wird nicht gekocht, Reste und Vorrat werden aufgegessen."
          value={s.leftoverDay != null} onChange={(v) => set({ leftoverDay: v ? 4 : null })} />
      </Section>
      {s.leftoverDay != null ? (
        <Section title="Restetag ist">
          {WEEKDAYS.map((d, idx) => <Chip key={d} label={d} selected={s.leftoverDay === idx} onPress={() => set({ leftoverDay: idx as Weekday })} />)}
        </Section>
      ) : null}

      <Section title="Zeitplan" hint="Maximale Kochzeit">
        <Text style={[styles.hint, { width: '100%' }]}>Unter der Woche (Mo–Fr)</Text>
        {MINUTES.map((m) => <Chip key={m} label={minutesLabel(m)} selected={s.maxMinutesWeekday === m} onPress={() => set({ maxMinutesWeekday: m })} />)}
        <Text style={[styles.hint, { width: '100%', marginTop: 4 }]}>Wochenende (Sa/So)</Text>
        {MINUTES.map((m) => <Chip key={m} label={minutesLabel(m)} selected={s.maxMinutesWeekend === m} onPress={() => set({ maxMinutesWeekend: m })} />)}
      </Section>

      <Section title="Ernährung">
        {DIETS.map(([id, label]) => <Chip key={id} label={label} selected={s.diet === id} onPress={() => set({ diet: id })} />)}
      </Section>

      <Section title="Allergien & Unverträglichkeiten" hint="Diese Zutaten kommen nie in den Plan.">
        {ALLERGENS.map(([id, label]) => (
          <Chip key={id} label={label} selected={s.allergens.includes(id)} onPress={() => set({ allergens: toggle(s.allergens, id) })} />
        ))}
      </Section>

      <Section title="Küchengeräte" hint="Nur Rezepte, die du damit kochen kannst.">
        {EQUIPMENT.map(([id, label]) => (
          <Chip key={id} label={label} selected={s.equipment.includes(id)} onPress={() => set({ equipment: toggle(s.equipment, id) })} />
        ))}
      </Section>

      <Section title="Worauf hast du Lust?">
        {VIBES.map(([id, label]) => (
          <Chip key={id} label={label} selected={s.vibes.includes(id)} onPress={() => set({ vibes: toggle(s.vibes, id) })} />
        ))}
      </Section>

      <Section title="Lieblings-Proteine" hint="Werden bevorzugt, andere bleiben möglich.">
        {PROTEINS.map(([id, label]) => (
          <Chip key={id} label={label} selected={s.proteinLikes.includes(id)} onPress={() => set({ proteinLikes: toggle(s.proteinLikes, id) })} />
        ))}
      </Section>

      <Section title="Sättigungsbeilagen" hint="Nur Gerichte mit diesen Beilagen (Gerichte ohne klassische Beilage bleiben möglich).">
        {SIDES.map(([id, label]) => <Chip key={id} label={label} selected={sides.includes(id)} onPress={() => set({ sides: toggle<Carb>(sides, id) })} />)}
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={isFirstRun ? 'Wochenplan erstellen' : 'Speichern und neuen Plan erstellen'} icon="refresh-cw" onPress={save} />
      {onSaveOnly ? <Button label="Nur speichern – Plan behalten" variant="secondary" icon="check" onPress={() => onSaveOnly(final())} /> : null}
    </ScrollView>
  );
}
