import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow } from './ui';

export interface UndoToast {
  text: string;
  undo: () => void;
  /** Läuft, wenn nicht rückgängig gemacht wurde (z. B. Foto endgültig löschen) */
  onExpire?: () => void;
}

const HIDDEN = 120;

/** Leiste unten: „Eistee entfernt · Rückgängig“ – gleitet hoch und verschwindet nach 8 s. */
export function Snackbar({ toast, onClose, bottom }: { toast: UndoToast | null; onClose: () => void; bottom: number }) {
  const y = useRef(new Animated.Value(HIDDEN)).current;
  useEffect(() => {
    if (!toast) return;
    y.setValue(HIDDEN);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: HIDDEN, duration: 180, useNativeDriver: true }).start(() => {
        toast.onExpire?.();
        onClose();
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <Animated.View style={[local.bar, { bottom, transform: [{ translateY: y }] }]} accessibilityLiveRegion="polite">
      <Text style={local.text} numberOfLines={2}>{toast.text}</Text>
      <Pressable onPress={() => { toast.undo(); onClose(); }} hitSlop={12} accessibilityRole="button" style={local.btn}>
        <Text style={local.undo}>Rückgängig</Text>
      </Pressable>
    </Animated.View>
  );
}

const local = StyleSheet.create({
  bar: {
    position: 'absolute', left: 16, right: 16, maxWidth: 520, alignSelf: 'center', marginHorizontal: 'auto',
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 8,
    borderRadius: radius.md, backgroundColor: colors.cardHover, borderWidth: 1, borderColor: colors.borderStrong, ...shadow,
  },
  text: { flex: 1, color: colors.text, fontSize: 14 },
  btn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderRadius: radius.sm },
  undo: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
