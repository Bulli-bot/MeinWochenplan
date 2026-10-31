import { useState, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import type { Allergen, Diet, Equipment, Protein, Settings, Vibe, Weekday } from '../types';
import { Field } from '../components';
import { Button, Chip, Section, Stepper, WEEKDAYS, euro, styles } from '../ui';

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
const MINUTES = [20, 30, 45, 90];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function SettingsScreen({ initial, isFirstRun, onSave, error, header }: {
  initial: Settings;
  isFirstRun: boolean;
  onSave: (s: Settings) => void;
  error: string | null;
  /** Wird über dem Formular angezeigt, z. B. „Woche vom PC laden" beim ersten Start. */
  header?: ReactNode;
}) {
  const [s, setS] = useState<Settings>(initial);
  const set = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));
  const [kidsText, setKidsText] = useState((initial.kids ?? []).join(', '));
  const save = () => onSave({ ...s, kids: kidsText.split(',').map((k) => k.trim()).filter(Boolean) });

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

      <Section title="Wochenbudget" hint="Für alle Hauptgerichte zusammen.">
        <Stepper value={s.weeklyBudget} step={5} min={10} max={250} label={euro(s.weeklyBudget)} onChange={(v) => set({ weeklyBudget: v })} />
      </Section>

      <Section title="Kochtage">
        {WEEKDAYS.map((d, idx) => (
          <Chip key={d} label={d} selected={s.cookingDays.includes(idx as Weekday)}
            onPress={() => set({ cookingDays: toggle(s.cookingDays, idx as Weekday) })} />
        ))}
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

      <Section title="Maximale Kochzeit">
        {MINUTES.map((m) => <Chip key={m} label={m === 90 ? 'egal' : `${m} Min.`} selected={s.maxMinutes === m} onPress={() => set({ maxMinutes: m })} />)}
      </Section>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={isFirstRun ? 'Wochenplan erstellen' : 'Speichern und neuen Plan erstellen'} onPress={save} />
    </ScrollView>
  );
}
