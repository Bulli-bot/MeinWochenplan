import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../logic/shoppingList';
import type { Recipe } from '../types';
import { Button, Icon, colors, radius, space, styles } from '../ui';
import { useWakeLock } from './ShopMode';

/** „20 Minuten“, „10–15 Min.“, „1 Stunde“ → Minuten (die größere Zahl bei Spannen) */
export function stepMinutes(step: string): number | null {
  const m = step.match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?(min|minuten|minute|std|stunden|stunde)\b/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return /^st/i.test(m[3]) ? n * 60 : n;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Ein Wecker für den aktuellen Schritt – piept und vibriert am Ende (soweit das Gerät es kann). */
function StepTimer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const start = () => {
    if (timer.current) clearInterval(timer.current);
    const end = Date.now() + minutes * 60000;
    setLeft(minutes * 60);
    timer.current = setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
        ring();
      }
    }, 500);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setLeft(null);
  };
  return left === null ? (
    <Button label={`Timer ${minutes} Min.`} variant="secondary" icon="clock" onPress={start} />
  ) : (
    <View style={[local.timer, left === 0 && { borderColor: colors.warn }]}>
      <Text style={[local.timerText, left === 0 && { color: colors.warn }]}>{left === 0 ? 'Fertig!' : mmss(left)}</Text>
      <Pressable onPress={stop} style={local.timerStop} accessibilityRole="button"><Text style={styles.smallText}>{left === 0 ? 'OK' : 'Stopp'}</Text></Pressable>
    </View>
  );
}

function ring() {
  if (Platform.OS !== 'web') return;
  try {
    navigator.vibrate?.([300, 150, 300]);
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.4, 0.8].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // ohne Ton – die Anzeige reicht
  }
}

/** Kochmodus: Schritt für Schritt in großer Schrift, Timer pro Schritt, Bildschirm bleibt an. */
export function CookMode({ recipe, people, isCooked, onDone, onClose }: {
  recipe: Recipe;
  people: number;
  isCooked: boolean;
  /** Am Ende: als gekocht markieren und Foto machen */
  onDone: (photo: boolean) => void;
  onClose: () => void;
}) {
  const awake = useWakeLock();
  // -1 = Zutaten bereitlegen, danach die Schritte
  const [idx, setIdx] = useState(-1);
  const steps = recipe.steps;
  const last = idx === steps.length - 1;
  const minutes = idx >= 0 ? stepMinutes(steps[idx]) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={local.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hint} numberOfLines={1}>{recipe.name} · {people} Personen</Text>
          <Text style={styles.h2}>{idx < 0 ? 'Zutaten bereitlegen' : `Schritt ${idx + 1} von ${steps.length}`}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kochmodus beenden" style={local.close}>
          <Text style={local.closeText}>Schließen</Text>
        </Pressable>
      </View>
      <View style={local.progress}><View style={[local.progressFill, { width: `${((idx + 1) / steps.length) * 100}%` }]} /></View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={local.content}>
        {idx < 0 ? (
          <View style={{ gap: 10 }}>
            {recipe.ingredients.map((ing, i) => (
              <Text key={`${ing.name}-${i}`} style={local.ingredient}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>{formatAmount(Math.round(ing.amount * people * 10) / 10, ing.unit)}</Text> {ing.name}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={local.step}>{steps[idx]}</Text>
        )}
        {minutes ? <StepTimer key={idx} minutes={minutes} /> : null}
        {awake ? <Text style={[styles.hint, { fontSize: 12 }]}>Bildschirm bleibt an</Text> : null}
      </ScrollView>

      <View style={local.foot}>
        {idx >= 0 ? (
          <View style={{ flex: 1 }}><Button label="Zurück" variant="ghost" icon="chevron-left" onPress={() => setIdx(idx - 1)} /></View>
        ) : null}
        {!last ? (
          <View style={{ flex: 2 }}><Button label={idx < 0 ? 'Los geht’s' : 'Weiter'} icon="chevron-right" onPress={() => setIdx(idx + 1)} /></View>
        ) : (
          <View style={{ flex: 2, gap: space.sm }}>
            <Button label="Fertig – Foto machen" icon="camera" onPress={() => onDone(true)} />
            {!isCooked ? <Button label="Fertig ohne Foto" variant="secondary" icon="check" onPress={() => onDone(false)} /> : null}
          </View>
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, backgroundColor: colors.surface },
  close: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  closeText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  progress: { height: 6, backgroundColor: colors.input },
  progressFill: { height: 6, backgroundColor: colors.accent },
  content: { padding: space.xl, gap: space.xl, maxWidth: 820, width: '100%', alignSelf: 'center' },
  step: { fontSize: 26, lineHeight: 38, color: colors.text, fontWeight: '600' },
  ingredient: { fontSize: 20, lineHeight: 28, color: colors.text },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.accent },
  timerText: { flex: 1, fontSize: 40, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  timerStop: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.sm, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  foot: { flexDirection: 'row', gap: space.sm, padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
