import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { RECIPE_JSON_PROMPT, SYSTEM_PROMPT, askAI, householdContext, type AiVia } from '../ai';
import { RECIPE_BY_ID } from '../data/recipes';
import { parseIngredientLine } from '../logic/customRecipe';
import { todayIndex } from '../logic/dates';
import type { ChatMessage } from '../pchelper';
import type { AppState, Carb, CustomRecipe, Ingredient, Protein, Settings } from '../types';
import { Card, Chip, Icon, Tag, colors, hov, space, styles } from '../ui';

interface Bubble extends ChatMessage {
  via?: AiVia;
  model?: string;
  error?: boolean;
}

/** Verlauf bleibt beim Tab-Wechsel erhalten (nicht dauerhaft gespeichert). */
let history: Bubble[] = [];

const PROTEINS: Protein[] = ['huhn', 'rind', 'schwein', 'fisch', 'vegetarisch', 'vegan'];
const CARBS: Carb[] = ['nudeln', 'kartoffeln', 'reis', 'brot', 'sonstiges'];

/** KI-Antwort im Rezept-Format → Entwurf für „Eigenes Rezept" */
function toRecipe(text: string): CustomRecipe {
  const r = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
  const portions = Number(r.portions) || 4;
  const ingredients = (r.ingredients ?? []).map((l: string) => parseIngredientLine(String(l), portions)).filter((x: Ingredient | null): x is Ingredient => !!x);
  if (!r.name || !ingredients.length) throw new Error('Die KI hat kein vollständiges Rezept geliefert – bitte nochmal.');
  return {
    id: `eigen-ki-${Date.now().toString(36)}`,
    name: String(r.name),
    minutes: Number(r.minutes) || 30,
    protein: PROTEINS.includes(r.protein) ? r.protein : 'vegetarisch',
    carb: CARBS.includes(r.carb) ? r.carb : 'sonstiges',
    vibes: r.kinder === false ? ['schnell'] : ['kinder', 'schnell'],
    equipment: ['herd'],
    allergens: [],
    ingredients,
    steps: (r.steps ?? []).map(String),
  };
}

export function AiScreen({ state, settings, onRecipeDraft }: {
  state: AppState;
  settings: Settings;
  /** Vorgeschlagenes Rezept zum Prüfen und Speichern öffnen */
  onRecipeDraft: (r: CustomRecipe) => void;
}) {
  const [messages, setMessages] = useState<Bubble[]>(history);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const today = state.plan?.slots.find((s) => s.day === todayIndex());
  const todayName = today ? RECIPE_BY_ID[today.recipeId]?.name : undefined;

  const update = (next: Bubble[]) => {
    history = next;
    setMessages(next);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const send = async (text: string, recipeMode = false) => {
    const q = text.trim();
    if (!q || busy) return;
    const withQ: Bubble[] = [...messages, { role: 'user', content: q }];
    update(withQ);
    setInput('');
    setBusy(true);
    try {
      const system = SYSTEM_PROMPT(householdContext(state, settings)) + (recipeMode ? `\n\n${RECIPE_JSON_PROMPT}` : '');
      const r = await askAI(system, withQ.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), recipeMode);
      if (recipeMode) {
        const draft = toRecipe(r.text);
        update([...withQ, { role: 'assistant', content: `Vorschlag: ${draft.name} – ich öffne ihn zum Prüfen und Speichern.`, via: r.via, model: r.model }]);
        onRecipeDraft(draft);
      } else {
        update([...withQ, { role: 'assistant', content: r.text.replace(/\*\*/g, ''), via: r.via, model: r.model }]);
      }
    } catch (e) {
      update([...withQ, { role: 'assistant', content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const quick: [string, string, boolean][] = [
    ['Was koche ich aus meinem Vorrat?', 'Was kann ich heute aus meinem Vorrat kochen? Gib mir 3 Ideen.', false],
    ['Neues Rezept vorschlagen', 'Schlag mir ein neues, günstiges Rezept vor, das Kinder mögen und das nicht im Wochenplan steht.', true],
    ...(todayName ? [[`Heutiges Essen kinderfreundlicher`, `Wie mache ich „${todayName}“ noch kinderfreundlicher und schneller?`, false] as [string, string, boolean]] : []),
    ['Resteverwertung', 'Was mache ich aus Resten von dieser Woche, damit nichts weggeworfen wird?', false],
    ['Günstiger einkaufen', 'Wo kann ich bei meinem Wochenplan am meisten sparen?', false],
  ];

  return (
    <View style={styles.screen}>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={local.head}>
          <View style={local.icon}><Icon name="zap" size={20} color={colors.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>KI-Assistent</Text>
            <Text style={styles.sub}>Am PC mit deiner lokalen KI, unterwegs mit Gemini. Kennt deinen Plan, Vorrat und Budget.</Text>
          </View>
        </View>

        {messages.length === 0 ? (
          <Card style={{ gap: space.md }}>
            <Text style={styles.sectionTitle}>Womit kann ich helfen?</Text>
            <View style={styles.chipRow}>
              {quick.map(([label, prompt, recipe]) => <Chip key={label} label={label} selected={false} onPress={() => send(prompt, recipe)} />)}
            </View>
          </Card>
        ) : null}

        {messages.map((m, i) => (
          <View key={i} style={[local.bubble, m.role === 'user' ? local.user : local.bot, m.error && local.err]}>
            <Text style={[local.text, m.role === 'user' && { color: colors.onAccent }]}>{m.content}</Text>
            {m.via ? <Tag label={m.via === 'PC' ? `Lokal · ${m.model}` : `Gemini · ${m.model}`} tone={m.via === 'PC' ? 'accent' : 'info'} icon={m.via === 'PC' ? 'monitor' : 'cloud'} /> : null}
          </View>
        ))}
        {busy ? <View style={[local.bubble, local.bot, { flexDirection: 'row', gap: 8 }]}><ActivityIndicator color={colors.accent} /><Text style={styles.hint}>denkt nach …</Text></View> : null}

        {messages.length > 0 && !busy ? (
          <View style={styles.chipRow}>
            {quick.slice(0, 3).map(([label, prompt, recipe]) => <Chip key={label} label={label} selected={false} onPress={() => send(prompt, recipe)} />)}
            <Chip label="Neu anfangen" selected={false} onPress={() => update([])} />
          </View>
        ) : null}
      </ScrollView>

      <View style={local.composer}>
        <TextInput value={input} onChangeText={setInput} placeholder="Frag etwas, z. B. „Was passt zu Hähnchen und Reis?“" placeholderTextColor={colors.muted}
          style={[styles.input, { flex: 1 }]} onSubmitEditing={() => send(input)} multiline={false} />
        <Pressable onPress={() => send(input)} accessibilityRole="button" accessibilityLabel="Senden"
          style={(st) => [local.send, hov(st) && { backgroundColor: '#72CC96' }]}>
          <Icon name="send" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', borderRadius: 16, padding: space.md, gap: space.sm },
  user: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  err: { borderColor: colors.danger },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  composer: { flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  send: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
