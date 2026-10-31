import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Field, Link } from '../components';
import { formatAmount } from '../logic/shoppingList';
import { parseIngredientLine, unpricedNames } from '../logic/customRecipe';
import { importRecipe } from '../pchelper';
import type { Carb, CustomRecipe, Ingredient, Protein, Vibe } from '../types';
import { Button, Chip, styles } from '../ui';

const PROTEINS: [Protein, string][] = [['huhn', 'Geflügel'], ['rind', 'Rind'], ['schwein', 'Schwein'], ['fisch', 'Fisch'], ['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan']];
const CARBS: [Carb, string][] = [['nudeln', 'Nudeln'], ['kartoffeln', 'Kartoffeln'], ['reis', 'Reis'], ['brot', 'Brot'], ['sonstiges', 'Sonstiges']];

const slug = (s: string) => s.toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]!)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Eigenes Rezept anlegen oder bearbeiten – von Hand oder per Link (Link-Import nur am PC mit PC-Helfer). */
export function RecipeEditScreen({ initial, onSave, onCancel }: {
  initial?: CustomRecipe;
  onSave: (r: CustomRecipe) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? 30));
  const [portions, setPortions] = useState(initial ? '1' : '4');
  const [ingredients, setIngredients] = useState(initial ? initial.ingredients.map((i) => `${i.amount} ${i.unit === 'Stück' ? '' : i.unit} ${i.name}`.replace(/\s+/g, ' ')).join('\n') : '');
  const [steps, setSteps] = useState(initial?.steps.join('\n') ?? '');
  const [protein, setProtein] = useState<Protein>(initial?.protein ?? 'vegetarisch');
  const [carb, setCarb] = useState<Carb>(initial?.carb ?? 'nudeln');
  const [kinder, setKinder] = useState(initial ? initial.vibes.includes('kinder') : true);
  const [source, setSource] = useState(initial?.source ?? '');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed: Ingredient[] = ingredients.split('\n').map((l) => parseIngredientLine(l, Number(portions) || 1)).filter((x): x is Ingredient => !!x);
  const missing = unpricedNames(parsed);

  const doImport = async () => {
    if (!source.trim()) return setMsg({ text: 'Erst den Link zum Rezept eintragen.', error: true });
    setBusy(true);
    setMsg(null);
    try {
      const r = await importRecipe(source.trim());
      setName(r.name.replace(/\s+von\s+\S+$/, '').replace(/\s+-\s+/g, '-'));
      setMinutes(String(r.minutes));
      setPortions(String(r.portions));
      setIngredients(r.ingredients.join('\n'));
      setSteps(r.steps.join('\n'));
      setMsg({ text: `Importiert (${r.portions} Portionen). Bitte Zutaten kurz prüfen – Zubereitung gern in eigenen Worten kürzen.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!name.trim()) return setMsg({ text: 'Bitte einen Namen eingeben.', error: true });
    if (!parsed.length) return setMsg({ text: 'Bitte mindestens eine Zutat mit Menge eingeben, z. B. „500 g Spaghetti“.', error: true });
    const vibes: Vibe[] = kinder ? ['kinder', 'schnell'] : ['schnell'];
    onSave({
      id: initial?.id ?? `eigen-${slug(name)}-${Date.now().toString(36).slice(-4)}`,
      name: name.trim(),
      minutes: Number(minutes) || 30,
      protein,
      carb,
      vibes: (Number(minutes) || 30) <= 30 ? vibes : vibes.filter((v) => v !== 'schnell'),
      equipment: ['herd'],
      allergens: [],
      ingredients: parsed,
      steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
      source: source.trim() || undefined,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Abbrechen" onPress={onCancel} />
      <Text style={styles.h1}>{initial ? 'Rezept bearbeiten' : 'Eigenes Rezept'}</Text>

      <View style={[styles.card, { gap: 10 }]}>
        <Field label="Link zum Rezept (optional, z. B. Chefkoch)" value={source} onChangeText={setSource} autoCapitalize="none" autoCorrect={false} placeholder="https://www.chefkoch.de/rezepte/…" />
        <Button label={busy ? 'Hole Rezept …' : 'Vom Link übernehmen (nur am PC)'} variant="secondary" onPress={() => (busy ? null : doImport())} />
      </View>
      {msg ? <Text style={msg.error ? styles.error : styles.hint}>{msg.text}</Text> : null}

      <View style={[styles.card, { gap: 10 }]}>
        <Field label="Name" value={name} onChangeText={setName} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Minuten" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Mengen unten für … Portionen" value={portions} onChangeText={setPortions} keyboardType="number-pad" /></View>
        </View>
        <Field label="Zutaten – eine pro Zeile, z. B. „500 g Spaghetti“ oder „2 Zwiebeln“" value={ingredients} onChangeText={setIngredients} multiline />
        {parsed.length ? (
          <Text style={styles.hint}>
            Erkannt pro Portion: {parsed.map((i) => `${formatAmount(i.amount, i.unit)} ${i.name}`).join(' · ')}
            {missing.length ? `\nOhne Preis (unter Mehr → Preise eintragen): ${missing.join(', ')}` : ''}
          </Text>
        ) : null}
        <Field label="Zubereitung – ein Schritt pro Zeile" value={steps} onChangeText={setSteps} multiline />
      </View>

      <View style={[styles.card, { gap: 8 }]}>
        <Text style={styles.sectionTitle}>Hauptzutat</Text>
        <View style={styles.chipRow}>{PROTEINS.map(([id, l]) => <Chip key={id} label={l} selected={protein === id} onPress={() => setProtein(id)} />)}</View>
        <Text style={styles.sectionTitle}>Beilage</Text>
        <View style={styles.chipRow}>{CARBS.map(([id, l]) => <Chip key={id} label={l} selected={carb === id} onPress={() => setCarb(id)} />)}</View>
        <View style={styles.chipRow}><Chip label="Kinderfreundlich" selected={kinder} onPress={() => setKinder((v) => !v)} /></View>
      </View>

      <Button label="Rezept speichern" onPress={save} />
    </ScrollView>
  );
}
