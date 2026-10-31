import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Immer dunkel – einen hellen Modus gibt es bewusst nicht. */
export const colors = {
  bg: '#111513',
  card: '#1B201D',
  input: '#141916',
  text: '#E7ECE8',
  muted: '#98A29B',
  accent: '#62B87D',
  onAccent: '#0D1710',
  accentSoft: '#22362A',
  border: '#2B332E',
  danger: '#EE7A64',
  warn: '#E6B450',
};

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const euro = (value: number) => value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} accessibilityRole="button" accessibilityState={{ selected }}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, variant === 'secondary' && styles.buttonSecondary]} accessibilityRole="button">
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, label, onChange, step = 1, min, max }: {
  value: number; label: string; onChange: (v: number) => void; step?: number; min: number; max: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn} accessibilityLabel="weniger">
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{label}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn} accessibilityLabel="mehr">
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 26, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  section: { gap: 6, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.muted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.onAccent, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  buttonTextSecondary: { color: colors.accent },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  stepValue: { fontSize: 16, minWidth: 110, textAlign: 'center', color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  input: {
    backgroundColor: colors.input, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  small: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accentSoft },
  smallText: { color: colors.accent, fontWeight: '600' },
});
