import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ingredientCost } from '../data/prices';
import { sendToBring } from '../bring';
import { applyPantry } from '../logic/pantry';
import { CATEGORY_ORDER, buildShoppingList, formatAmount, isBasic, shoppingListAsText, shoppingTrip, type ShoppingItem } from '../logic/shoppingList';
import type { MealPlan, PantryItem, Settings, ShopExtra } from '../types';
import { Button, Grid, Icon, colors, euro, hov, space, styles, useLayout } from '../ui';

const itemCost = (it: ShoppingItem) => ingredientCost({ name: it.name, amount: it.amount, unit: it.unit, category: it.category }) ?? 0;

/** Eine Kachel – Plan-Zutat oder eigener Artikel, einheitlich dargestellt. */
interface Tile {
  key: string;
  name: string;
  amount: string;
  sub: string;
  done: boolean;
  extra?: ShopExtra;
}

function TileView({ tile, editing, onToggle, onEdit, onDelete, onSave, onHave, onCancel }: {
  tile: Tile;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (name: string, amount: string) => void;
  /** Nur Plan-Zutaten: „hab ich noch“ → Vorrat */
  onHave?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tile.name);
  const [amount, setAmount] = useState(tile.amount);
  if (editing) {
    return (
      <View style={[local.tile, local.tileEdit]}>
        {tile.extra ? (
          <TextInput value={name} onChangeText={setName} placeholder="Artikel" placeholderTextColor={colors.muted} style={[styles.input, local.input]} autoFocus />
        ) : <Text style={local.name} numberOfLines={2}>{tile.name}</Text>}
        <TextInput value={amount} onChangeText={setAmount} placeholder="Menge, z. B. 2 Packungen" placeholderTextColor={colors.muted}
          style={[styles.input, local.input]} autoFocus={!tile.extra} onSubmitEditing={() => onSave(name, amount)} />
        <View style={local.editBtns}>
          <Pressable onPress={() => onSave(name, amount)} accessibilityRole="button" accessibilityLabel="Speichern" style={[local.editBtn, { backgroundColor: colors.accent }]}>
            <Icon name="check" size={16} color={colors.onAccent} />
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Abbrechen" style={local.editBtn}>
            <Icon name="x" size={16} color={colors.text} />
          </Pressable>
        </View>
        {onHave ? (
          <Pressable onPress={onHave}><Text style={[styles.hint, { color: colors.accent }]}>Hab ich noch → Vorrat</Text></Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: tile.done }} accessibilityLabel={tile.name}
      style={(s) => [local.tile, tile.extra && local.tileExtra, tile.done && local.tileDone, hov(s) && !tile.done && local.tileHover]}>
      <View style={local.tileTop}>
        {tile.done ? <View style={local.doneDot}><Icon name="check" size={12} color={colors.onAccent} /></View> : <View style={{ flex: 1 }} />}
        <View style={local.icons}>
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${tile.name} ändern`} style={(s) => [local.iconBtn, hov(s) && local.iconHover]}>
            <Icon name="edit-2" size={14} color={colors.muted} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${tile.name} entfernen`} style={(s) => [local.iconBtn, hov(s) && local.iconHover]}>
            <Icon name="trash-2" size={14} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      <Text style={[local.name, tile.done && local.nameDone]} numberOfLines={2}>{tile.name}</Text>
      <Text style={local.amount} numberOfLines={1}>{tile.amount || ' '}</Text>
      <Text style={styles.hint} numberOfLines={1}>{tile.sub}</Text>
    </Pressable>
  );
}

export function ShoppingListScreen({
  plan, settings, checked, pantry, extras, hidden, amounts,
  onToggle, onReset, onHave, onShopped, onAddExtra, onToggleExtra, onRemoveExtra, onEditExtra, onHide, onAmount,
}: {
  plan: MealPlan;
  settings: Settings;
  checked: string[];
  pantry: PantryItem[];
  extras: ShopExtra[];
  /** Ausgeblendete Plan-Artikel */
  hidden: string[];
  /** Geänderte Mengen der Plan-Artikel */
  amounts: Record<string, string>;
  onToggle: (key: string) => void;
  onReset: () => void;
  /** „Hab ich noch" → in den Vorrat */
  onHave: (name: string) => void;
  /** Einkauf fertig → weiter zu Ausgaben (Bon fotografieren) */
  onShopped: () => void;
  onAddExtra: (name: string) => void;
  onToggleExtra: (id: string) => void;
  onRemoveExtra: (id: string) => void;
  onEditExtra: (id: string, name: string, amount: string) => void;
  onHide: (key: string, hide: boolean) => void;
  onAmount: (key: string, text: string) => void;
}) {
  const { isPhone, isDesktop } = useLayout();
  const columns = isDesktop ? 5 : isPhone ? 2 : 3;
  const all = useMemo(() => buildShoppingList(plan, settings.householdSize), [plan, settings.householdSize]);
  const basics = all.filter((i) => isBasic(i.name, settings.basics));
  const { toBuy, fromPantry } = useMemo(() => applyPantry(all.filter((i) => !isBasic(i.name, settings.basics)), pantry), [all, pantry, settings.basics]);
  const items = toBuy.filter((i) => !hidden.includes(i.key));
  const hiddenItems = toBuy.filter((i) => hidden.includes(i.key));
  const [notice, setNotice] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [bringBusy, setBringBusy] = useState(false);
  const done = items.filter((i) => checked.includes(i.key)).length + extras.filter((x) => x.done).length;
  const total = items.length + extras.length;
  const openCost = items.filter((i) => !checked.includes(i.key)).reduce((s, i) => s + itemCost(i), 0);
  const twoTrips = settings.shopRhythm === 'zweimal';

  const planTile = (it: ShoppingItem): Tile => ({
    key: it.key,
    name: it.name,
    amount: amounts[it.key] ?? formatAmount(it.amount, it.unit),
    sub: `ca. ${euro(itemCost(it))} · ${it.recipes.join(', ')}`,
    done: checked.includes(it.key),
  });
  const extraTile = (x: ShopExtra): Tile => ({
    key: x.id, name: x.name, amount: x.amount ?? '', sub: x.from === 'vorrat' ? 'Vorrat – bald leer' : 'eigener Artikel', done: !!x.done, extra: x,
  });

  const add = () => {
    const name = newItem.trim();
    if (!name) return;
    onAddExtra(name);
    setNewItem('');
  };

  const share = async () => {
    const open = items.filter((i) => !checked.includes(i.key)).map((i) => ({ ...i }));
    const text = [shoppingListAsText(open), ...extras.filter((x) => !x.done).map((x) => `- ${x.amount ? `${x.amount} ` : ''}${x.name}`)].join('\n');
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({ title: 'Einkaufsliste', text });
          return;
        } catch {
          // abgebrochen oder nicht erlaubt → kopieren
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        setNotice('Liste kopiert.');
      } catch {
        setNotice('Teilen ist hier nicht verfügbar.');
      }
      return;
    }
    await Share.share({ message: text }).catch(() => setNotice('Teilen ist hier nicht verfügbar.'));
  };

  const toBring = async () => {
    const list = [
      ...items.filter((i) => !checked.includes(i.key)).map((i) => ({ name: i.name, spec: formatAmount(i.amount, i.unit) })),
      ...extras.filter((x) => !x.done).map((x) => ({ name: x.name, spec: x.amount ?? '' })),
    ];
    if (!list.length) {
      setNotice('Nichts Offenes zum Senden – alles im Wagen.');
      return;
    }
    setBringBusy(true);
    setNotice(null);
    try {
      const r = await sendToBring(list);
      setNotice(`${r.added} Artikel an „${r.list}“ geschickt. Jetzt in der Bring!-App ansehen – dort auch die Prospekte.`);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBringBusy(false);
    }
  };

  const renderTile = (t: Tile) => (
    <TileView
      key={t.key}
      tile={t}
      editing={editing === t.key}
      onToggle={() => (t.extra ? onToggleExtra(t.extra.id) : onToggle(t.key))}
      onEdit={() => setEditing(t.key)}
      onCancel={() => setEditing(null)}
      onDelete={() => { setEditing(null); if (t.extra) onRemoveExtra(t.extra.id); else onHide(t.key, true); }}
      onSave={(name, amount) => {
        if (t.extra) onEditExtra(t.extra.id, name.trim() || t.name, amount.trim());
        else {
          // Unveränderte Menge nicht als eigene Angabe speichern
          const it = items.find((i) => i.key === t.key);
          onAmount(t.key, it && amount.trim() === formatAmount(it.amount, it.unit) ? '' : amount);
        }
        setEditing(null);
      }}
      onHave={t.extra ? undefined : () => { setEditing(null); onHave(t.name); }}
    />
  );

  // Offene Kacheln nach Ladenbereich; Abgehaktes sammelt sich unten „im Wagen“
  const section = (title: string, tiles: Tile[]) => (tiles.length ? (
    <View key={title} style={{ gap: space.sm }}>
      <Text style={local.section}>{title} <Text style={styles.hint}>{tiles.length}</Text></Text>
      <Grid columns={columns} gap={space.sm}>{tiles.map(renderTile)}</Grid>
    </View>
  ) : null);
  const byCategory = (list: ShoppingItem[]) => CATEGORY_ORDER.map((cat) => section(cat, list.filter((i) => i.category === cat && !checked.includes(i.key)).map(planTile)));

  const trip1 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 1);
  const trip2 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 2);
  const inCart = [...extras.filter((x) => x.done).map(extraTile), ...items.filter((i) => checked.includes(i.key)).map(planTile)];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ gap: 4 }}>
        <Text style={styles.h1}>Einkaufsliste</Text>
        <Text style={styles.sub}>{done} von {total} im Wagen · offen ca. {euro(openCost)}</Text>
        <View style={local.progress}><View style={[local.progressFill, { width: `${total ? (done / total) * 100 : 0}%` }]} /></View>
      </View>

      <View style={local.addRow}>
        <TextInput value={newItem} onChangeText={setNewItem} onSubmitEditing={add} placeholder="Artikel hinzufügen, z. B. Kaffee"
          placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} returnKeyType="done" />
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Hinzufügen" style={(s) => [local.addBtn, hov(s) && { backgroundColor: '#72CC96' }]}>
          <Icon name="plus" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
      <Text style={styles.hint}>Kachel antippen = im Wagen. Stift = Menge ändern, Mülleimer = diese Woche nicht kaufen.</Text>

      {section('Eigene Artikel', extras.filter((x) => !x.done).map(extraTile))}

      {twoTrips ? <Text style={styles.h2}>Wocheneinkauf</Text> : null}
      {byCategory(trip1)}
      {twoTrips && trip2.some((i) => !checked.includes(i.key)) ? (
        <>
          <Text style={styles.h2}>Frische-Einkauf zur Wochenmitte</Text>
          <Text style={styles.hint}>Wird erst ab Donnerstag gebraucht – am Mittwoch oder Donnerstag frisch kaufen.</Text>
          {byCategory(trip2)}
        </>
      ) : null}

      {done === total && total > 0 ? (
        <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
          <Icon name="check-circle" size={28} color={colors.accent} />
          <Text style={styles.sectionTitle}>Alles im Wagen</Text>
        </View>
      ) : null}

      {inCart.length ? <View style={{ opacity: 0.75 }}>{section('Im Wagen', inCart)}</View> : null}

      {hiddenItems.length ? (
        <View style={[styles.card, { gap: space.sm }]}>
          <Text style={styles.sectionTitle}>Diese Woche nicht kaufen</Text>
          <View style={styles.chipRow}>
            {hiddenItems.map((i) => (
              <Pressable key={i.key} onPress={() => onHide(i.key, false)} style={styles.small} accessibilityLabel={`${i.name} wieder anzeigen`}>
                <Text style={styles.smallText}>{i.name} ↺</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {fromPantry.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Schon im Vorrat</Text>
          <Text style={styles.hint}>{fromPantry.map((it) => `${formatAmount(it.amount, it.unit)} ${it.name}`).join(' · ')}</Text>
        </View>
      ) : null}

      {basics.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Grundzutaten – hast du</Text>
          <Text style={styles.hint}>{basics.map((b) => b.name).join(', ')}. Ändern unter Einstellungen → Grundzutaten vorhanden.</Text>
        </View>
      ) : null}

      {notice ? <Text style={styles.hint}>{notice}</Text> : null}
      <Button label={bringBusy ? 'Sende an Bring! …' : 'An Bring! senden'} icon="shopping-bag" onPress={() => (bringBusy ? null : toBring())} />
      <Button label="Einkauf erledigt – Bon fotografieren" variant="secondary" icon="camera" onPress={onShopped} />
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 150 }}><Button label="Als Text teilen" variant="ghost" icon="share" onPress={share} /></View>
        <View style={{ flex: 1, minWidth: 150 }}><Button label="Haken zurücksetzen" variant="ghost" icon="rotate-ccw" onPress={onReset} /></View>
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  progress: { height: 6, borderRadius: 3, backgroundColor: colors.input, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: space.sm },
  tile: { minHeight: 104, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 2 },
  tileHover: { backgroundColor: colors.cardHover, borderColor: colors.borderStrong },
  tileExtra: { borderStyle: 'dashed', borderColor: colors.borderStrong },
  tileDone: { backgroundColor: colors.surface },
  tileEdit: { borderColor: colors.accent, gap: 6 },
  tileTop: { flexDirection: 'row', alignItems: 'center', minHeight: 26 },
  doneDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 'auto' },
  icons: { flexDirection: 'row', gap: 2 },
  iconBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconHover: { backgroundColor: colors.surface },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  amount: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  input: { minHeight: 38, paddingVertical: 6, fontSize: 14 },
  editBtns: { flexDirection: 'row', gap: 6 },
  editBtn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: space.sm },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
