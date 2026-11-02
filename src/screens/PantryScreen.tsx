import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, Link } from '../components';
import { knownIngredients } from '../data/recipes';
import { mergeGrundausstattung, missingGrundausstattung } from '../data/grundausstattung';
import { currentAmount, dueSoon, emptyOn } from '../logic/pantry';
import type { PantryItem, PantryKind } from '../types';
import { Button, Card, Chip, Icon, Stepper, colors, hov, space, styles } from '../ui';

const UNITS = ['g', 'ml', 'Stück', 'Flaschen', 'Packungen', 'Rollen', 'Dosen', 'Kisten'];
const KINDS: [PantryKind, string][] = [['lebensmittel', 'Lebensmittel'], ['getraenke', 'Getränke'], ['drogerie', 'Drogerie'], ['haushalt', 'Haushalt']];
const KIND_LABEL = Object.fromEntries(KINDS) as Record<PantryKind, string>;
/** Häufige Dinge außerhalb der Rezepte – als Vorschläge beim Tippen */
const COMMON = ['Wasser', 'Saft', 'Kaffee', 'Toilettenpapier', 'Küchenrolle', 'Taschentücher', 'Zahnpasta', 'Duschgel', 'Shampoo', 'Windeln',
  'Spülmittel', 'Waschmittel', 'Spülmaschinentabs', 'Müllbeutel', 'Frischhaltefolie'];

/** Art aus dem Namen raten – lässt sich im Formular ändern. */
export function guessKind(name: string): PantryKind {
  if (/toilett|klopapier|zahn|dusch|shampoo|seife|deo|windel|taschent|watte|rasier|creme|binden|tampon/i.test(name)) return 'drogerie';
  if (/spül|wasch|müll|küchenroll|folie|schwamm|reiniger|tabs|batterie/i.test(name)) return 'haushalt';
  if (/wasser|saft|schorle|cola|limo|bier|wein|sprudel|kaffee|\btee\b/i.test(name)) return 'getraenke';
  return 'lebensmittel';
}

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const dayLabel = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const parseNum = (t: string) => {
  const v = parseFloat(t.replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

/** Formular für einen Vorratsartikel – oben zum Hinzufügen, aufgeklappt in der Zeile zum Ändern. */
function ItemForm({ initial, names, onSave, onCancel }: {
  initial?: PantryItem;
  /** Vorschläge beim Tippen (nur beim Hinzufügen) */
  names?: string[];
  onSave: (item: PantryItem, perDay: number | undefined, remind: number) => void;
  onCancel?: () => void;
}) {
  const now = initial ? currentAmount(initial) : undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<PantryKind>(initial ? initial.kind ?? guessKind(initial.name) : 'lebensmittel');
  const [kindTouched, setKindTouched] = useState(!!initial);
  const [amount, setAmount] = useState(now !== undefined ? fmt(now) : '');
  const [unit, setUnit] = useState(initial?.unit ?? 'Stück');
  const [use, setUse] = useState(initial?.perDay ? fmt(initial.perDay) : '');
  const [usePer, setUsePer] = useState<'tag' | 'woche'>('tag');
  const [remind, setRemind] = useState(initial?.remindDays ?? 1);
  const q = name.trim().toLowerCase();
  const suggestions = q.length >= 2 && names ? names.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 8) : [];

  const save = () => {
    const clean = name.trim();
    if (!clean) return;
    const value = parseNum(amount);
    const perUse = parseNum(use);
    const perDay = value !== undefined && perUse !== undefined ? (usePer === 'woche' ? perUse / 7 : perUse) : undefined;
    onSave({
      name: clean,
      kind: kindTouched ? kind : guessKind(clean),
      ...(value !== undefined ? { amount: value, unit, since: new Date().toISOString() } : {}),
      ...(perDay ? { perDay: Math.round(perDay * 1000) / 1000, remindDays: remind } : {}),
    }, perDay, remind);
    if (!initial) {
      setName(''); setAmount(''); setUse(''); setRemind(1); setKindTouched(false); setKind('lebensmittel');
    }
  };

  return (
    <View style={{ gap: space.md }}>
      <Field label={initial ? 'Name' : 'Was?'} value={name} onChangeText={(t) => { setName(t); if (!kindTouched) setKind(guessKind(t)); }} placeholder="z. B. Wasser, Toilettenpapier, Spaghetti" />
      {suggestions.length ? (
        <View style={styles.chipRow}>{suggestions.map((s) => <Chip key={s} label={s} selected={false} onPress={() => { setName(s); if (!kindTouched) setKind(guessKind(s)); }} />)}</View>
      ) : null}
      <View style={styles.chipRow}>
        {KINDS.map(([id, label]) => <Chip key={id} label={label} selected={kind === id} onPress={() => { setKind(id); setKindTouched(true); }} />)}
      </View>
      <Field label="Wie viel ist jetzt da? (leer = genug da)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="z. B. 12" />
      <View style={styles.chipRow}>{UNITS.map((u) => <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />)}</View>
      {parseNum(amount) !== undefined ? (
        <>
          <Field label={`Verbrauch (${unit}) – optional, für die Erinnerung`} value={use} onChangeText={setUse} keyboardType="decimal-pad" placeholder="z. B. 3" />
          <View style={styles.chipRow}>
            <Chip label="pro Tag" selected={usePer === 'tag'} onPress={() => setUsePer('tag')} />
            <Chip label="pro Woche" selected={usePer === 'woche'} onPress={() => setUsePer('woche')} />
          </View>
          {parseNum(use) !== undefined ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.hint}>Erinnern, wenn es nur noch so viele Tage reicht:</Text>
              <Stepper value={remind} min={0} max={7} label={remind === 0 ? 'wenn leer' : `${remind} ${remind === 1 ? 'Tag' : 'Tage'}`} onChange={setRemind} />
            </View>
          ) : null}
        </>
      ) : null}
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 160 }}><Button label={initial ? 'Speichern' : 'Hinzufügen'} icon="check" onPress={save} /></View>
        {onCancel ? <View style={{ flex: 1, minWidth: 120 }}><Button label="Abbrechen" variant="ghost" onPress={onCancel} /></View> : null}
      </View>
    </View>
  );
}

/** Vorrat: Lebensmittel fliegen von der Einkaufsliste; mit Verbrauch pro Tag erinnert die App, bevor etwas leer ist. */
export function PantryScreen({ pantry, onChange, onBack, onToShopping }: {
  pantry: PantryItem[];
  onChange: (p: PantryItem[]) => void;
  onBack: () => void;
  /** Bald leer → auf die eigene Einkaufsliste */
  onToShopping: (name: string) => void;
}) {
  /** Aufgeklappter Artikel – „soon:…“ = im Kasten „Bald leer“, sonst in der Liste */
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<PantryKind | 'alle'>('alle');
  const [msg, setMsg] = useState<string | null>(null);
  const names = useMemo(() => [...new Set([...COMMON, ...knownIngredients().keys()])].sort((a, b) => a.localeCompare(b, 'de')), []);
  const soon = dueSoon(pantry);

  const saveItem = (oldName: string | null) => (item: PantryItem, perDay: number | undefined, remind: number) => {
    const others = pantry.filter((p) => p.name.toLowerCase() !== item.name.toLowerCase() && p.name !== oldName);
    onChange([...others, item]);
    setMsg(perDay && item.amount ? `${item.name}: reicht ca. ${Math.floor(item.amount / perDay)} Tage – ich erinnere ${remind === 0 ? 'am Tag, an dem es leer ist' : `${remind} ${remind === 1 ? 'Tag' : 'Tage'} vorher`}.` : `${item.name} gespeichert.`);
    setOpen(null);
  };
  const toggle = (key: string) => { setMsg(null); setOpen((o) => (o === key ? null : key)); };

  const visible = [...pantry]
    .filter((p) => filter === 'alle' || (p.kind ?? guessKind(p.name)) === filter)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Mehr" onPress={onBack} />
      <Text style={styles.h1}>Vorrat</Text>
      <Text style={styles.sub}>Lebensmittel, Getränke, Drogerie und Haushalt. Mit Verbrauch rechnet die App mit und erinnert dich, bevor etwas leer ist.</Text>

      {missingGrundausstattung(pantry) > 0 ? (
        <Card style={{ gap: space.sm, borderColor: colors.accent }}>
          <View style={styles.row}><Icon name="package" color={colors.accent} /><Text style={styles.sectionTitle}>Grundausstattung</Text></View>
          <Text style={styles.hint}>
            Die Sachen, die bei euch immer da sein sollten – Milch, Wasser, Eistee, Duschgel, Shampoo, Zahnpasta, Toilettenpapier,
            Spülmaschinentabs und mehr – mit sinnvollen Mengen und Erinnerung. Vorhandenes bleibt, nichts wird überschrieben.
          </Text>
          <Button label={`${missingGrundausstattung(pantry)} Artikel übernehmen`} icon="download" onPress={() => {
            const r = mergeGrundausstattung(pantry);
            onChange(r.pantry);
            setMsg(`${r.added} Artikel zur Grundausstattung ergänzt – Mengen und Verbrauch kannst du je Artikel über den Stift anpassen.`);
          }} />
        </Card>
      ) : null}

      {soon.length ? (
        <Card style={{ borderColor: colors.warn, gap: space.sm }}>
          <View style={styles.row}><Icon name="bell" color={colors.warn} /><Text style={styles.sectionTitle}>Bald leer</Text></View>
          {soon.map(({ item, left, days }) => (
            <View key={item.name} style={local.soonBlock}>
              <View style={local.soonRow}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={local.name}>{item.name}</Text>
                  <Text style={[styles.hint, { color: days === 0 ? colors.danger : colors.warn }]}>
                    {days === 0 ? 'heute leer' : `noch ${fmt(left)} ${item.unit ?? ''} · reicht ${days === 1 ? 'bis morgen' : `${days} Tage`}`}
                  </Text>
                </View>
                <Pressable onPress={() => { onToShopping(item.name); setMsg(`${item.name} steht auf der Einkaufsliste.`); }} style={styles.small}>
                  <Text style={styles.smallText}>Auf die Liste</Text>
                </Pressable>
                <Pressable onPress={() => toggle(`soon:${item.name}`)} style={styles.small}><Text style={styles.smallText}>Aufgefüllt</Text></Pressable>
              </View>
              {open === `soon:${item.name}` ? (
                <View style={local.editBox}>
                  <ItemForm initial={item} onSave={saveItem(item.name)} onCancel={() => setOpen(null)} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: space.md }}>
        <Text style={styles.sectionTitle}>Hinzufügen</Text>
        <ItemForm names={names} onSave={saveItem(null)} />
      </Card>

      {msg ? <Text style={[styles.hint, { color: colors.accent }]}>{msg}</Text> : null}

      <Card>
        <Text style={styles.sectionTitle}>Zu Hause ({pantry.length})</Text>
        <View style={styles.chipRow}>
          <Chip label="Alle" selected={filter === 'alle'} onPress={() => setFilter('alle')} />
          {KINDS.map(([id, label]) => <Chip key={id} label={label} selected={filter === id} onPress={() => setFilter(id)} />)}
        </View>
        {visible.length === 0 ? <Text style={styles.hint}>Noch nichts. Tipp: In der Einkaufsliste bei Dingen, die noch da sind, auf „hab ich“ tippen.</Text> : null}
        {visible.map((p) => {
          const left = currentAmount(p);
          const empty = emptyOn(p);
          const ratio = p.perDay && p.amount ? (left ?? 0) / p.amount : null;
          const due = soon.some((s) => s.item === p);
          const isOpen = open === p.name;
          return (
            <View key={p.name} style={[local.item, isOpen && local.itemOpen]}>
              <View style={local.row}>
                <Pressable onPress={() => toggle(p.name)} style={{ flex: 1, gap: 4 }} accessibilityLabel={`${p.name} ${isOpen ? 'zuklappen' : 'ändern'}`}>
                  <Text style={local.name}>{p.name} <Text style={styles.hint}>· {KIND_LABEL[p.kind ?? guessKind(p.name)]}</Text></Text>
                  <Text style={[styles.hint, due && { color: colors.warn }]}>
                    {left === undefined ? 'genug da' : `${fmt(left)} ${p.unit ?? ''}`}
                    {p.perDay ? ` · ${fmt(p.perDay)}/Tag · leer ca. ${empty ? dayLabel(empty) : '–'}` : ''}
                  </Text>
                  {ratio !== null ? (
                    <View style={local.track}><View style={[local.fill, { width: `${Math.max(3, Math.min(100, ratio * 100))}%`, backgroundColor: due ? colors.warn : colors.accent }]} /></View>
                  ) : null}
                </Pressable>
                <Pressable onPress={() => toggle(p.name)} accessibilityLabel={`${p.name} ${isOpen ? 'zuklappen' : 'ändern'}`} style={(s) => [local.iconBtn, (isOpen || hov(s)) && local.iconHover]}>
                  <Icon name={isOpen ? 'chevron-up' : 'edit-2'} size={16} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => onChange(pantry.filter((x) => x !== p))} accessibilityLabel={`${p.name} aufgebraucht`} style={(s) => [local.iconBtn, hov(s) && local.iconHover]}>
                  <Icon name="trash-2" size={16} color={colors.danger} />
                </Pressable>
              </View>
              {isOpen ? (
                <View style={local.editBox}>
                  <ItemForm initial={p} onSave={saveItem(p.name)} onCancel={() => setOpen(null)} />
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  item: { borderTopWidth: 1, borderTopColor: colors.border },
  itemOpen: { backgroundColor: colors.input, borderRadius: 12, borderTopColor: 'transparent', paddingHorizontal: 10, marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  editBox: { paddingBottom: 12, paddingTop: 4 },
  soonBlock: { borderTopWidth: 1, borderTopColor: colors.border },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingVertical: 6 },
  name: { fontSize: 16, color: colors.text, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.input, overflow: 'hidden', maxWidth: 260 },
  fill: { height: 6, borderRadius: 3 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  iconHover: { backgroundColor: colors.cardHover },
});
