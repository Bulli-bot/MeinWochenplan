import { Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { usePhoto } from './photos';
import { Icon, colors, styles } from './ui';

/** Foto aus dem Fotospeicher (lädt bei Bedarf aus der Cloud nach). */
export function Thumb({ id, size = 64, onPress }: { id: string | undefined; size?: number; onPress?: () => void }) {
  const data = usePhoto(id);
  const box = { width: size, height: size, borderRadius: 10 };
  const body = data ? <Image source={{ uri: data }} style={box} /> : <View style={[box, local.empty]}><Icon name="image" size={Math.round(size / 3)} color={colors.faint} /></View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** Breite Fotokachel für Tageskarten; ohne Foto ein ruhiger Platzhalter mit Icon. */
export function Cover({ id, height = 120 }: { id: string | undefined; height?: number }) {
  const data = usePhoto(id);
  if (data) return <Image source={{ uri: data }} style={{ width: '100%', height, borderRadius: 12 }} resizeMode="cover" />;
  return (
    <View style={[local.empty, { width: '100%', height, borderRadius: 12 }]}>
      <Icon name="camera" size={22} color={colors.faint} />
    </View>
  );
}

export function BigPhoto({ id, onDelete }: { id: string; onDelete?: () => void }) {
  const data = usePhoto(id);
  return (
    <View style={{ gap: 6 }}>
      {data ? <Image source={{ uri: data }} style={local.big} resizeMode="cover" /> : <View style={[local.big, local.empty]}><Text style={styles.hint}>Foto wird geladen …</Text></View>}
      {onDelete ? (
        <Pressable onPress={onDelete} style={{ alignSelf: 'flex-end' }}>
          <Text style={styles.hint}>Foto löschen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.hint}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'warn' | 'danger' }) {
  const color = tone === 'accent' ? colors.accent : tone === 'warn' ? colors.warn : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <View style={[local.badge, { borderColor: color }]}>
      <Text style={[local.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={local.link}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  empty: { backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 22, opacity: 0.5 },
  big: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
