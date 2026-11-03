import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount } from '../logic/shoppingList';
import type { Recipe } from '../types';
import { Button, Chip, Icon, colors, radius, space, styles, useLayout } from '../ui';
import { useWakeLock } from './ShopMode';
import { DEFAULT_MEAL_TIME, todayAt } from '../logic/mealtime';
import { fmtPeople } from '../logic/people';
import { gestureSupported, useGestures, useVoice, voiceSupported, type HandsFreeCommand } from '../handsfree';

/** „20 Minuten“, „10–15 Min.“, „1 Stunde“ → Minuten (die größere Zahl bei Spannen) */
export function stepMinutes(step: string): number | null {
  const m = step.match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?(min|minuten|minute|std|stunden|stunde)\b/i);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return /^st/i.test(m[3]) ? n * 60 : n;
}

/** Schritte ohne Zeitangabe zählen mit 5 Minuten (Schneiden, Anrichten …) */
const DEFAULT_STEP = 5;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const hhmm = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Uhrzeit für jeden Schritt, rückwärts gerechnet von der Essenszeit */
export function schedule(steps: string[], eatAt: Date): Date[] {
  const mins = steps.map((s) => stepMinutes(s) ?? DEFAULT_STEP);
  const total = mins.reduce((a, b) => a + b, 0);
  let t = eatAt.getTime() - total * 60000;
  return mins.map((m) => {
    const at = new Date(t);
    t += m * 60000;
    return at;
  });
}

interface Timer { id: number; label: string; end: number; done?: boolean }

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

/** Mehrere Timer gleichzeitig (Suppe köchelt, Baguette im Ofen) – laufen beim Weiterblättern weiter. */
function useTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [, tick] = useState(0);
  const ref = useRef(timers);
  ref.current = timers;
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const finished = ref.current.filter((t) => !t.done && t.end <= now);
      if (finished.length) {
        ring();
        setTimers((list) => list.map((t) => (finished.includes(t) ? { ...t, done: true } : t)));
      }
      tick((n) => n + 1);
    }, 500);
    return () => clearInterval(iv);
  }, []);
  return {
    timers,
    start: (label: string, minutes: number) => setTimers((list) => [...list, { id: Date.now(), label, end: Date.now() + minutes * 60000 }]),
    stop: (id: number) => setTimers((list) => list.filter((t) => t.id !== id)),
    /** Freihändig: den zuletzt fertigen, sonst den zuletzt gestarteten Timer beenden */
    stopLatest: () => setTimers((list) => {
      const t = [...list].reverse().find((x) => x.done) ?? list[list.length - 1];
      return t ? list.filter((x) => x !== t) : list;
    }),
  };
}

/** Kochmodus: Zeitplan ab der Essenszeit, Schritt für Schritt in großer Schrift, mehrere Timer, Bildschirm bleibt an. */
export function CookMode({ recipe, people, eatAt: planned = DEFAULT_MEAL_TIME, isCooked, onDone, onClose }: {
  recipe: Recipe;
  people: number;
  /** Geplante Essenszeit „HH:MM“ (aus dem Plan bzw. den Einstellungen) */
  eatAt?: string;
  isCooked: boolean;
  /** Am Ende: als gekocht markieren und Foto machen */
  onDone: (photo: boolean) => void;
  onClose: () => void;
}) {
  const awake = useWakeLock();
  const { isWide, isTablet } = useLayout();
  const steps = recipe.steps;
  const totalMin = steps.reduce((s, x) => s + (stepMinutes(x) ?? DEFAULT_STEP), 0);
  // Geplante Essenszeit, oder – wenn das schon zu knapp ist – jetzt plus Kochzeit, auf 5 Minuten gerundet
  const [eatAt, setEatAt] = useState(() => {
    const d = todayAt(planned);
    const earliest = Date.now() + totalMin * 60000;
    if (d.getTime() < earliest) return new Date(Math.ceil(earliest / 300000) * 300000);
    return d;
  });
  const times = schedule(steps, eatAt);
  const shift = (min: number) => setEatAt((d) => new Date(d.getTime() + min * 60000));
  // -1 = Zutaten und Zeitplan, danach die Schritte
  const [idx, setIdx] = useState(-1);
  const last = idx === steps.length - 1;
  const minutes = idx >= 0 ? stepMinutes(steps[idx]) : null;
  const { timers, start, stop, stopLatest } = useTimers();
  const twoCol = isWide || isTablet;
  // Freihändig: Sprache und/oder Gesten – mit nassen oder schmutzigen Händen
  const [voiceOn, setVoiceOn] = useState(false);
  const [gestOn, setGestOn] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const command = (c: HandsFreeCommand) => {
    setHeard(c === 'weiter' ? 'Weiter' : c === 'zurueck' ? 'Zurück' : c === 'timer' ? 'Timer' : 'Timer stopp');
    if (c === 'weiter') setIdx((i) => Math.min(steps.length - 1, i + 1));
    else if (c === 'zurueck') setIdx((i) => Math.max(-1, i - 1));
    else if (c === 'stopp') stopLatest();
    else if (c === 'timer') {
      const i = idxRef.current;
      const m = i >= 0 ? stepMinutes(steps[i]) : null;
      if (m) start(`Schritt ${i + 1}`, m);
    }
  };
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const voiceError = useVoice(voiceOn, command);
  const gest = useGestures(gestOn, command);
  const camRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (camRef.current && gest.stream) camRef.current.srcObject = gest.stream; }, [gest.stream]);

  const plan = (
    <View style={{ gap: 2 }}>
      <View style={local.planHead}>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>Essen um {hhmm(eatAt)}</Text>
        <Pressable onPress={() => shift(-5)} style={local.small} accessibilityLabel="5 Minuten früher"><Text style={styles.smallText}>−5</Text></Pressable>
        <Pressable onPress={() => shift(5)} style={local.small} accessibilityLabel="5 Minuten später"><Text style={styles.smallText}>+5 Min.</Text></Pressable>
      </View>
      <Text style={styles.hint}>Los geht’s um {hhmm(times[0] ?? eatAt)} · ca. {totalMin} Min.</Text>
      {steps.map((s, i) => (
        <Pressable key={i} onPress={() => setIdx(i)} style={[local.planRow, i === idx && local.planNow, i < idx && { opacity: 0.45 }]}>
          <Text style={[local.planTime, i === idx && { color: colors.accent }]}>{hhmm(times[i])}</Text>
          <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={2}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );

  const timerList = timers.length ? (
    <View style={{ gap: space.sm }}>
      {timers.map((t) => {
        const left = Math.max(0, Math.round((t.end - Date.now()) / 1000));
        return (
          <View key={t.id} style={[local.timer, t.done && { borderColor: colors.warn }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hint} numberOfLines={1}>{t.label}</Text>
              <Text style={[local.timerText, t.done && { color: colors.warn }]}>{t.done ? 'Fertig!' : mmss(left)}</Text>
            </View>
            <Pressable onPress={() => stop(t.id)} style={local.timerStop} accessibilityRole="button"><Text style={styles.smallText}>{t.done ? 'OK' : 'Stopp'}</Text></Pressable>
          </View>
        );
      })}
    </View>
  ) : null;

  const main = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={local.content}>
      {idx < 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Zutaten für {fmtPeople(people)} {people === 1 ? 'Person' : 'Personen'}</Text>
          {recipe.ingredients.map((ing, i) => (
            <Text key={`${ing.name}-${i}`} style={local.ingredient}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{formatAmount(Math.round(ing.amount * people * 10) / 10, ing.unit)}</Text> {ing.name}
            </Text>
          ))}
          {!twoCol ? <View style={{ marginTop: space.lg }}>{plan}</View> : null}
        </View>
      ) : (
        <>
          <Text style={styles.hint}>ab {hhmm(times[idx])}</Text>
          <Text style={local.step}>{steps[idx]}</Text>
        </>
      )}
      {minutes ? <Button label={`Timer ${minutes} Min. starten`} variant="secondary" icon="clock" onPress={() => start(`Schritt ${idx + 1}`, minutes)} /> : null}
      {timerList}
      {voiceSupported() || gestureSupported() ? (
        <View style={{ gap: 6 }}>
          <View style={styles.row}>
            {voiceSupported() ? <Chip icon="mic" label="Sprache" selected={voiceOn} onPress={() => setVoiceOn(!voiceOn)} /> : null}
            {gestureSupported() ? <Chip icon="video" label="Gesten" selected={gestOn} onPress={() => setGestOn(!gestOn)} /> : null}
            {heard && (voiceOn || gestOn) ? <Text style={[styles.hint, { color: colors.accent }]}>erkannt: {heard}</Text> : null}
          </View>
          {voiceOn ? <Text style={styles.hint}>Sag „weiter“, „zurück“, „Timer“ oder „Timer stopp“.</Text> : null}
          {gestOn ? <Text style={styles.hint}>Hand vor der Kamera nach rechts wischen = weiter, nach links = zurück, flache Hand vor die Kamera = Timer stopp. Das Bild bleibt auf dem Gerät.</Text> : null}
          {gestOn && gest.stream ? (
            <View style={local.cam}><video ref={camRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} /></View>
          ) : null}
          {voiceError || gest.error ? <Text style={styles.error}>{voiceError ?? gest.error}</Text> : null}
        </View>
      ) : null}
      {awake ? <Text style={[styles.hint, { fontSize: 12 }]}>Bildschirm bleibt an</Text> : null}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={local.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hint} numberOfLines={1}>{recipe.name}</Text>
          <Text style={styles.h2}>{idx < 0 ? 'Bereitlegen und Zeitplan' : `Schritt ${idx + 1} von ${steps.length}`}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kochmodus beenden" style={local.close}>
          <Text style={local.closeText}>Schließen</Text>
        </Pressable>
      </View>
      <View style={local.progress}><View style={[local.progressFill, { width: `${((idx + 1) / steps.length) * 100}%` }]} /></View>

      {twoCol ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <ScrollView style={local.side} contentContainerStyle={{ padding: space.lg }}>{plan}</ScrollView>
          {main}
        </View>
      ) : main}

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
  side: { width: 380, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  planNow: { backgroundColor: colors.accentSoft },
  planTime: { width: 48, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  small: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  step: { fontSize: 26, lineHeight: 38, color: colors.text, fontWeight: '600' },
  ingredient: { fontSize: 20, lineHeight: 28, color: colors.text },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.accent },
  timerText: { fontSize: 40, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  cam: { width: 160, height: 120, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderStrong },
  timerStop: { minHeight: 44, paddingHorizontal: 18, borderRadius: radius.sm, backgroundColor: colors.accentSoft, justifyContent: 'center' },
  foot: { flexDirection: 'row', gap: space.sm, padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
