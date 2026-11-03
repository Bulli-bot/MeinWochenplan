import Feather from '@expo/vector-icons/Feather';
import { Children, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

/** RN-Web kennt zusätzlich „hovered“ (Maus über dem Element). */
export type HoverState = PressableStateCallbackType & { hovered?: boolean };
export const hov = (s: PressableStateCallbackType) => (s as HoverState).hovered === true;

/** Immer dunkel – einen hellen Modus gibt es bewusst nicht. */
export const colors = {
  bg: '#0D1110',
  surface: '#121715',
  card: '#171D1A',
  cardHover: '#1C2420',
  input: '#111614',
  text: '#ECF1EE',
  muted: '#93A099',
  faint: '#66726B',
  accent: '#5FBF85',
  onAccent: '#08130C',
  accentSoft: '#1D3326',
  border: '#242C28',
  borderStrong: '#34403A',
  info: '#6EA8F2',
  infoSoft: '#1A2A3D',
  warn: '#E9B949',
  warnSoft: '#3A3018',
  danger: '#F07A6A',
  dangerSoft: '#3D2220',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 12, lg: 16, xl: 20 };
/** Weicher Schatten für Karten (RN-Web macht daraus box-shadow) */
export const shadow = { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } };

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const euro = (value: number) => value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export type IconName = ComponentProps<typeof Feather>['name'];
export function Icon({ name, size = 18, color = colors.muted }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

/** Bildschirmgröße: Handy < 700 px, Tablet bis 1023 px, ab 1024 px Desktop mit Seitenleiste. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 700 && !isDesktop;
  /** Breiter Bildschirm: Hauptspalte + Seitenspalte */
  const isWide = width >= 1280;
  /** Ultrawide: zusätzliche Spalte zwischen Haupt- und Seitenspalte */
  const isUltra = width >= 1920;
  return { width, isDesktop, isTablet, isWide, isUltra, isPhone: width < 700, columns: isDesktop ? 4 : isTablet ? 2 : 1 };
}

/** Breite der Inhaltsfläche (ohne Seitenleiste) – wie in App.tsx begrenzt */
export const maxBodyWidth = (width: number) => (width >= 1920 ? 2400 : width >= 1600 ? 1680 : 1240);
export const contentWidth = (width: number) => Math.min(width >= 1024 ? width - 232 : width, maxBodyWidth(width)) - 2 * space.xl;

/** Spaltenzahl aus der verfügbaren Breite (Mindestbreite je Spalte) statt fester Werte */
export const autoColumns = (available: number, min = 200, max = 6) => Math.max(1, Math.min(max, Math.floor(available / min)));

/**
 * Ab 1280 px: breite Hauptspalte + feste Seitenspalte, die beim Scrollen stehen bleibt.
 * Darunter einspaltig – erst die Seitenspalte (Zusammenfassung/Aktionen), wenn `sideFirst`, sonst danach.
 */
export function Split({ main, side, sideWidth = 380, sideFirst, extra }: { main: ReactNode; side: ReactNode; sideWidth?: number; sideFirst?: boolean; extra?: ReactNode }) {
  const { isWide, isUltra } = useLayout();
  if (!isWide) return <>{sideFirst ? side : null}{main}{sideFirst ? null : side}</>;
  const sticky = { gap: space.lg, position: 'sticky' as 'relative', top: 0 };
  return (
    <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0, gap: space.lg }}>{main}</View>
      {isUltra && extra ? <View style={[{ width: 380 }, sticky]}>{extra}</View> : null}
      <View style={[{ width: sideWidth }, sticky]}>{side}</View>
    </View>
  );
}

/** Platz für die Hauptspalte neben Seitenspalte (und ggf. Zusatzspalte) */
export const splitMainWidth = (width: number, sideWidth = 380, extra = false) =>
  contentWidth(width) - (width >= 1280 ? sideWidth + space.xl : 0) - (extra && width >= 1920 ? 380 + space.xl : 0);

/** Raster mit gleich breiten Spalten; bricht automatisch um. */
export function Grid({ columns, gap = space.md, children }: { columns: number; gap?: number; children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (columns <= 1) return <View style={{ gap }}>{items}</View>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((child, i) => (
        <View key={i} style={{ flexBasis: `${100 / columns - 3}%`, flexGrow: 1, maxWidth: `${100 / columns}%`, minWidth: 0 }}>{child}</View>
      ))}
    </View>
  );
}

export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: boolean }) {
  const base = [styles.card, accent && { borderColor: colors.accent }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={(s) => [base, hov(s) && styles.cardHover]}>
      {children}
    </Pressable>
  );
}

type Tone = 'accent' | 'info' | 'warn' | 'danger' | 'muted';
const TONES: Record<Tone, [string, string]> = {
  accent: [colors.accentSoft, colors.accent],
  info: [colors.infoSoft, colors.info],
  warn: [colors.warnSoft, colors.warn],
  danger: [colors.dangerSoft, colors.danger],
  muted: [colors.surface, colors.muted],
};
export function Tag({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Eyebrow({ children, color = colors.muted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

/** Auswahl-Chip; mit `icon` als Schalter (Ein/Aus) erkennbar. */
export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={icon ? 'switch' : 'button'} accessibilityState={icon ? { checked: selected } : { selected }}
      style={(s) => [styles.chip, icon && styles.chipIcon, hov(s) && !selected && styles.chipHover, selected && styles.chipSelected]}>
      {icon ? <Icon name={icon} size={15} color={selected ? colors.onAccent : colors.muted} /> : null}
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

/** Ein/Aus-Schalter als ganze Zeile – groß genug zum Tippen auf dem Handy. */
export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={(s) => [styles.toggleRow, hov(s) && { borderColor: colors.borderStrong }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

export function Button({ label, onPress, variant = 'primary', icon }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; icon?: IconName;
}) {
  const fg = variant === 'primary' ? colors.onAccent : variant === 'secondary' ? colors.accent : colors.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={(s) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        hov(s) && (variant === 'primary' ? styles.buttonHover : styles.buttonSecondaryHover),
        s.pressed && { transform: [{ scale: 0.98 }] },
      ]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, label, onChange, step = 1, min, max }: {
  value: number; label: string; onChange: (v: number) => void; step?: number; min: number; max: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn} accessibilityLabel="weniger" accessibilityRole="button">
        <Icon name="minus" color={colors.accent} />
      </Pressable>
      <Text style={styles.stepValue}>{label}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn} accessibilityLabel="mehr" accessibilityRole="button">
        <Icon name="plus" color={colors.accent} />
      </Pressable>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingBottom: 48, gap: space.lg },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm, ...shadow },
  cardHover: { backgroundColor: colors.cardHover, borderColor: colors.borderStrong },
  section: { gap: space.sm, marginTop: space.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipHover: { borderColor: colors.borderStrong, backgroundColor: colors.cardHover },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  chipTextSelected: { color: colors.onAccent, fontWeight: '700' },
  button: { minHeight: 44, flexDirection: 'row', gap: space.sm, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  buttonHover: { backgroundColor: '#72CC96' },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonSecondaryHover: { backgroundColor: '#25402F' },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  buttonTextSecondary: { color: colors.accent },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  stepValue: { fontSize: 16, minWidth: 110, textAlign: 'center', color: colors.text, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  input: {
    minHeight: 44, backgroundColor: colors.input, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, width: '100%', maxWidth: 560 },
  toggleLabel: { fontSize: 15, color: colors.text, fontWeight: '600' },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.borderStrong, padding: 2, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.muted },
  knobOn: { backgroundColor: colors.onAccent, alignSelf: 'flex-end' },
  small: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.accentSoft },
  smallText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
});
