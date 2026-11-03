import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ingredientCost } from '../data/prices';
import { sendToBring } from '../bring';
import { applyPantry } from '../logic/pantry';
import { RECURRING_CHOICES, findRecurring } from '../logic/recurring';
import { ShopMode, type ShopRow } from './ShopMode';
import { cheaperElsewhere, itemPrice, lastBonPrice, preferredStore, priceTrend, shopPriceKey, storeKey } from '../logic/shopPrice';
import { BarcodeScan } from './BarcodeScan';
import { PfandCard, TrendCard } from './ShopCards';
import { CATEGORY_ORDER, buildShoppingList, formatAmount, isBasic, shoppingListAsText, shoppingTrip, type ShoppingItem } from '../logic/shoppingList';
import type { Category, MealPlan, PantryItem, Purchase, RecurringItem, Settings, ShopExtra, ShopPrice } from '../types';
import { Button, Chip, Grid, Icon, Split, autoColumns, colors, contentWidth, euro, hov, space, styles, useLayout } from '../ui';

/** „wattepads“ → „Wattepads“ (einheitlich, auch für ältere Einträge) */
export const capitalize = (s: string) => s.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());

const itemCost = (it: ShoppingItem) => ingredientCost({ name: it.name, amount: it.amount, unit: it.unit, category: it.category }) ?? 0;

/** Eine Kachel – Plan-Zutat oder eigener Artikel, einheitlich dargestellt. */
interface Tile {
  key: string;
  name: string;
  amount: string;
  sub: string;
  done: boolean;
  extra?: ShopExtra;
  /** Eigener Preis je Stück/Packung (zum Bearbeiten) */
  ownPrice?: number;
  /** Vorschlag im Preisfeld, z. B. vom letzten Bon */
  priceHint?: string;
  /** Hinweis „bei ALDI 0,30 € günstiger“ */
  tip?: string;
  /** Nur eigene Artikel: kommt alle X Tage wieder (0 = nie) */
  repeat?: number;
}

function TileView({ tile, editing, onToggle, onEdit, onDelete, onSave, onHave, onCancel }: {
  tile: Tile;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (name: string, amount: string, price: string, repeat: number) => void;
  /** Nur Plan-Zutaten: „hab ich noch“ → Vorrat */
  onHave?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(tile.name);
  const [amount, setAmount] = useState(tile.amount);
  const [price, setPrice] = useState(tile.ownPrice !== undefined ? tile.ownPrice.toFixed(2).replace('.', ',') : '');
  const [repeat, setRepeat] = useState(tile.repeat ?? 0);
  const save = () => onSave(name, amount, price, repeat);
  if (editing) {
    return (
      <View style={[local.tile, local.tileEdit]}>
        {tile.extra ? (
          <TextInput value={name} onChangeText={setName} placeholder="Artikel" placeholderTextColor={colors.muted} style={[styles.input, local.input]} autoFocus />
        ) : <Text style={local.name} numberOfLines={2}>{tile.name}</Text>}
        <TextInput value={amount} onChangeText={setAmount} placeholder="Menge, z. B. 2" placeholderTextColor={colors.muted}
          style={[styles.input, local.input]} autoFocus={!tile.extra} onSubmitEditing={save} />
        <TextInput value={price} onChangeText={setPrice} placeholder={tile.priceHint ?? 'Preis je Stück/Packung in €'} placeholderTextColor={colors.muted}
          keyboardType="decimal-pad" style={[styles.input, local.input]} onSubmitEditing={save} accessibilityLabel="Preis je Stück oder Packung" />
        {tile.extra ? (
          <View style={{ gap: 4 }}>
            <Text style={styles.hint}>Kommt wieder alle:</Text>
            <View style={local.repeatRow}>
              {RECURRING_CHOICES.map(([d, label]) => (
                <Pressable key={d} onPress={() => setRepeat(d)} accessibilityRole="radio" accessibilityState={{ selected: repeat === d }}
                  style={[local.repeatChip, repeat === d && local.repeatOn]}>
                  <Text style={[local.repeatText, repeat === d && { color: colors.onAccent }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={local.editBtns}>
          <Pressable onPress={save} accessibilityRole="button" accessibilityLabel="Speichern" style={[local.editBtn, { backgroundColor: colors.accent }]}>
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
          <Pressable onPress={onEdit} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${tile.name} ändern`} style={(s) => [local.iconBtn, hov(s) && local.iconHover]}>
            <Icon name="edit-2" size={16} color={colors.muted} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${tile.name} entfernen`} style={(s) => [local.iconBtn, hov(s) && local.iconHover]}>
            <Icon name="trash-2" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      <Text style={[local.name, tile.done && local.nameDone]} numberOfLines={2}>{tile.name}</Text>
      <Text style={local.amount} numberOfLines={1}>{tile.amount || ' '}</Text>
      <Text style={styles.hint} numberOfLines={2}>{tile.sub}</Text>
      {tile.tip && !tile.done ? <Text style={[styles.hint, { color: colors.warn }]} numberOfLines={1}>{tile.tip}</Text> : null}
      {tile.repeat ? <Text style={[styles.hint, { color: colors.accent }]} numberOfLines={1}>↻ alle {tile.repeat} Tage</Text> : null}
    </Pressable>
  );
}

export function ShoppingListScreen({
  plan, settings, checked, pantry, extras, hidden, amounts, purchases, prices, recurring, catOrder, split, shopMode, onShopMode,
  onPrice, onRecurring, onCatOrder, onSplit, onToggle, onReset, onHave, onShopped, onScanned, onAddExtra, onBuyAnyway, onToggleExtra, onRemoveExtra, onEditExtra, onHide, onAmount,
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
  /** Bons – für den zuletzt bezahlten Preis */
  purchases: Purchase[];
  /** Selbst eingetragene Preise je Stück/Packung */
  prices: Record<string, ShopPrice>;
  /** Preis merken (undefined = eigenen Preis löschen) */
  onPrice: (name: string, price: number | undefined) => void;
  recurring: RecurringItem[];
  /** Regelmäßigkeit eines eigenen Artikels setzen (0 = aus) */
  onRecurring: (name: string, amount: string | undefined, everyDays: number) => void;
  /** Eigene Reihenfolge der Ladenbereiche */
  catOrder?: Category[];
  onCatOrder: (order: Category[] | undefined) => void;
  /** Nach günstigstem Laden aufteilen */
  split: boolean;
  /** Einkaufsmodus (Vollbild zum Abhaken im Laden) */
  shopMode: boolean;
  onShopMode: (on: boolean) => void;
  onSplit: (on: boolean) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
  /** „Hab ich noch" → in den Vorrat */
  onHave: (name: string) => void;
  /** Einkauf fertig → weiter zu Ausgaben (Bon fotografieren) */
  onShopped: () => void;
  /** Leer-Scan: Artikel ist aufgebraucht → auf die Liste, aus dem Vorrat */
  onScanned: (name: string) => void;
  onAddExtra: (name: string) => void;
  /** „Schon im Vorrat“ → doch kaufen (als eigener Artikel mit Menge) */
  onBuyAnyway: (name: string, amount: string) => void;
  onToggleExtra: (id: string) => void;
  onRemoveExtra: (id: string) => void;
  onEditExtra: (id: string, name: string, amount: string) => void;
  onHide: (key: string, hide: boolean) => void;
  onAmount: (key: string, text: string) => void;
}) {
  const { isPhone } = useLayout();
  const { width, isWide } = useLayout();
  const columns = isPhone ? 2 : autoColumns(contentWidth(width) - (isWide ? 380 + space.xl : 0), 190, 6);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
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
  // Plan-Zutaten: eigener Preis, sonst Schätzung; eigene Artikel: eigener Preis, sonst letzter Bon
  const planPrice = (it: ShoppingItem) => itemPrice(it.name, amounts[it.key], prices, []);
  const planCost = (it: ShoppingItem) => planPrice(it)?.total ?? itemCost(it);
  const extraPrice = (x: ShopExtra) => itemPrice(x.name, x.amount, prices, purchases);
  const openExtras = extras.filter((x) => !x.done);
  const unpriced = openExtras.filter((x) => !extraPrice(x)).length;
  const openCost = items.filter((i) => !checked.includes(i.key)).reduce((s, i) => s + planCost(i), 0)
    + openExtras.reduce((s, x) => s + (extraPrice(x)?.total ?? 0), 0);
  const twoTrips = settings.shopRhythm === 'zweimal' && !split;
  const order: Category[] = catOrder?.length === CATEGORY_ORDER.length && CATEGORY_ORDER.every((c) => catOrder.includes(c)) ? catOrder : CATEGORY_ORDER;
  const [orderOpen, setOrderOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const moveCat = (cat: Category, dir: -1 | 1) => {
    const list = [...order];
    const i = list.indexOf(cat);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onCatOrder(list);
  };
  const tipFor = (name: string) => {
    const c = cheaperElsewhere(name, purchases);
    if (c) return `bei ${c.store} ${euro(c.saving)} günstiger`;
    const t = priceTrend(name, purchases);
    return t ? `${t.diff > 0 ? '▲ +' : '▼ '}${euro(Math.abs(t.diff))} seit dem Bon davor` : undefined;
  };

  const priceText = (p: NonNullable<ReturnType<typeof itemPrice>>) => {
    const one = p.deposit ? `${euro(p.each)} + ${euro(p.deposit)} Pfand` : euro(p.each);
    const each = p.count !== 1 ? `${euro(p.total)} (${p.count.toLocaleString('de-DE')} × ${one})` : p.deposit ? `${euro(p.total)} (${one})` : euro(p.total);
    return p.source === 'eigen' ? `${each} · dein Preis` : `${each} · ${p.from}`;
  };
  const planTile = (it: ShoppingItem): Tile => {
    const own = planPrice(it);
    return {
      key: it.key,
      name: it.name,
      amount: amounts[it.key] ?? formatAmount(it.amount, it.unit),
      sub: own ? `${priceText(own)} · ${it.recipes.join(', ')}` : `ca. ${euro(itemCost(it))} · ${it.recipes.join(', ')}`,
      done: checked.includes(it.key),
      ownPrice: prices[shopPriceKey(it.name)]?.price,
      priceHint: `Preis €, ca. ${euro(itemCost(it))}`,
      tip: tipFor(it.name),
    };
  };
  const extraTile = (x: ShopExtra): Tile => {
    const p = extraPrice(x);
    const bon = lastBonPrice(x.name, purchases);
    return {
      key: x.id, name: capitalize(x.name), amount: x.amount ?? '',
      sub: p ? priceText(p) : x.from === 'vorrat' ? 'Vorrat – Preis? Stift antippen' : 'Preis? Stift antippen',
      tip: tipFor(x.name),
      repeat: findRecurring(recurring, x.name)?.everyDays,
      done: !!x.done, extra: x,
      ownPrice: prices[shopPriceKey(x.name)]?.price,
      priceHint: bon ? `Preis €, zuletzt ${euro(bon.price)}` : 'Preis € je Stück',
    };
  };

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
      onSave={(name, amount, price, repeat) => {
        const value = parseFloat(price.replace(',', '.').replace(/[^0-9.]/g, ''));
        const own = Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
        const finalName = t.extra ? name.trim() || t.name : t.name;
        if (own !== t.ownPrice) onPrice(finalName, own);
        if (t.extra && repeat !== (t.repeat ?? 0)) onRecurring(finalName, amount, repeat);
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
  const byCategory = (list: ShoppingItem[], prefix = '') => order.map((cat) => section(`${prefix}${cat}`, list.filter((i) => i.category === cat && !checked.includes(i.key)).map(planTile)));

  // Nach Laden aufteilen: jeder Artikel dorthin, wo er laut Bons am günstigsten war
  const openItems = items.filter((i) => !checked.includes(i.key));
  const stores = useMemo(() => {
    if (!split) return [];
    const groups = new Map<string, { store: string; plan: ShoppingItem[]; extras: ShopExtra[] }>();
    const put = (name: string) => {
      const store = preferredStore(name, purchases) ?? 'Egal wo';
      const key = store === 'Egal wo' ? '~' : storeKey(store);
      if (!groups.has(key)) groups.set(key, { store, plan: [], extras: [] });
      return groups.get(key)!;
    };
    for (const it of openItems) put(it.name).plan.push(it);
    for (const x of openExtras) put(x.name).extras.push(x);
    return [...groups.entries()].sort(([a], [b]) => (a === '~' ? 1 : b === '~' ? -1 : a.localeCompare(b))).map(([, g]) => g);
  }, [split, openItems, openExtras, purchases]);

  const trip1 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 1);
  const trip2 = items.filter((i) => shoppingTrip(i, settings.shopRhythm) === 2);
  const inCart = [...extras.filter((x) => x.done).map(extraTile), ...items.filter((i) => checked.includes(i.key)).map(planTile)];

  const startBtn = total - done > 0 ? <Button label="Einkaufen starten" icon="shopping-cart" onPress={() => onShopMode(true)} /> : null;

  if (shopMode) {
    // Abschnitt je Zeile: bei „Nach Laden aufteilen“ der günstigste Laden, sonst der Ladenbereich
    const storeOf = (name: string) => (split ? preferredStore(name, purchases) ?? 'Egal wo' : null);
    const rows: ShopRow[] = [
      ...extras.map((x): ShopRow => ({
        key: x.id, name: capitalize(x.name), amount: x.amount ?? '', price: extraPrice(x)?.total, done: !!x.done,
        section: storeOf(x.name) ?? 'Eigene Artikel', toggle: () => onToggleExtra(x.id),
      })),
      ...[...items].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)).map((it): ShopRow => ({
        key: it.key, name: it.name, amount: amounts[it.key] ?? formatAmount(it.amount, it.unit), price: planCost(it), done: checked.includes(it.key),
        section: storeOf(it.name) ?? it.category, toggle: () => onToggle(it.key),
      })),
    ];
    const sections = split
      ? [...new Set(rows.map((r) => r.section))].sort((a, b) => (a === 'Egal wo' ? 1 : b === 'Egal wo' ? -1 : a.localeCompare(b)))
      : ['Eigene Artikel', ...order];
    return <ShopMode rows={rows} sections={sections} onAdd={onAddExtra} onClose={() => onShopMode(false)} onShopped={() => { onShopMode(false); onShopped(); }} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ gap: 4 }}>
        <View style={local.titleRow}>
          <Text style={styles.h1}>Einkaufsliste</Text>
          <Pressable onPress={() => setHelp(!help)} accessibilityRole="button" accessibilityLabel="Hilfe zur Einkaufsliste" hitSlop={8}
            style={(st) => [local.helpBtn, (help || hov(st)) && local.iconHover]}>
            <Icon name="help-circle" size={18} color={help ? colors.accent : colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.sub}>{done} von {total} im Wagen · offen ca. {euro(openCost)}{unpriced ? ` (${unpriced} ohne Preis)` : ''}</Text>
        <View style={local.progress}><View style={[local.progressFill, { width: `${total ? (done / total) * 100 : 0}%` }]} /></View>
      </View>

      {!isWide ? startBtn : null}
      <Split
        main={<>
      <View style={local.addRow}>
        <TextInput value={newItem} onChangeText={setNewItem} onSubmitEditing={add} placeholder="Artikel hinzufügen, z. B. Kaffee"
          placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} returnKeyType="done" />
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Hinzufügen" style={(s) => [local.addBtn, hov(s) && { backgroundColor: '#72CC96' }]}>
          <Icon name="plus" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
      {help ? <Text style={styles.hint}>Kachel antippen = im Wagen. Stift = Menge, Preis und Wiederholen ändern, Mülleimer = diese Woche nicht kaufen (lässt sich rückgängig machen).</Text> : null}

      <View style={styles.chipRow}>
        <Chip icon="git-branch" label="Nach Laden aufteilen" selected={split} onPress={() => onSplit(!split)} />
        <Chip icon="list" label="Reihenfolge" selected={orderOpen} onPress={() => setOrderOpen(!orderOpen)} />
      </View>
      {orderOpen ? (
        <View style={[styles.card, { gap: 6 }]}>
          <Text style={styles.hint}>So, wie du durch den Laden gehst – von oben nach unten.</Text>
          {order.map((cat, i) => (
            <View key={cat} style={local.orderRow}>
              <Text style={[styles.hint, { flex: 1, color: colors.text }]}>{i + 1}. {cat}</Text>
              <Pressable onPress={() => moveCat(cat, -1)} disabled={i === 0} accessibilityLabel={`${cat} nach oben`} style={(st) => [local.iconBtn, hov(st) && local.iconHover, i === 0 && { opacity: 0.3 }]}>
                <Icon name="arrow-up" size={14} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => moveCat(cat, 1)} disabled={i === order.length - 1} accessibilityLabel={`${cat} nach unten`} style={(st) => [local.iconBtn, hov(st) && local.iconHover, i === order.length - 1 && { opacity: 0.3 }]}>
                <Icon name="arrow-down" size={14} color={colors.text} />
              </Pressable>
            </View>
          ))}
          {order !== CATEGORY_ORDER ? <Pressable onPress={() => onCatOrder(undefined)}><Text style={[styles.hint, { color: colors.accent }]}>Standard-Reihenfolge</Text></Pressable> : null}
        </View>
      ) : null}

      {split ? stores.map((g) => {
        const cost = g.plan.reduce((sum, i) => sum + planCost(i), 0) + g.extras.reduce((sum, x) => sum + (extraPrice(x)?.total ?? 0), 0);
        return (
          <View key={g.store} style={{ gap: space.sm }}>
            <Text style={styles.h2}>{g.store} <Text style={styles.hint}>· ca. {euro(cost)}</Text></Text>
            {g.store === 'Egal wo' ? <Text style={styles.hint}>Noch auf keinem Bon – oder nur in einem Laden gekauft.</Text> : null}
            {section(`${g.store} · Eigene Artikel`, g.extras.map(extraTile))}
            {byCategory(g.plan, `${g.store} · `)}
          </View>
        );
      }) : null}

      {!split ? section('Eigene Artikel', openExtras.map(extraTile)) : null}

      {twoTrips ? <Text style={styles.h2}>Wocheneinkauf</Text> : null}
      {!split ? byCategory(settings.shopRhythm === 'zweimal' ? trip1 : items) : null}
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

        </>}
        side={<>
      {isWide ? (
        <View style={[styles.card, { gap: 6 }]}>
          <Text style={styles.hint}>Noch offen</Text>
          <Text style={local.bigSum}>{euro(openCost)}</Text>
          <Text style={styles.hint}>{total - done} von {total} Artikeln{unpriced ? ` · ${unpriced} ohne Preis` : ''}</Text>
        </View>
      ) : null}
          {isWide ? startBtn : null}
      <PfandCard openCost={openCost} />
      <Button label="Leer-Scan: Packung aufgebraucht" variant="secondary" icon="maximize" onPress={() => setScanning(true)} />
      {scanning ? <BarcodeScan onClose={() => setScanning(false)} onFound={(name) => { setScanning(false); onScanned(name); }} /> : null}
      <TrendCard names={[...extras.filter((x) => !x.done).map((x) => x.name), ...items.filter((i) => !checked.includes(i.key)).map((i) => i.name)]} purchases={purchases} />
      {notice ? <Text style={styles.hint}>{notice}</Text> : null}
      <Button label={bringBusy ? 'Sende an Bring! …' : 'An Bring! senden'} variant="secondary" icon="shopping-bag" onPress={() => (bringBusy ? null : toBring())} />
      <Button label="Einkauf erledigt – Bon fotografieren" variant="secondary" icon="camera" onPress={onShopped} />
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 150 }}><Button label="Als Text teilen" variant="ghost" icon="share" onPress={share} /></View>
        <View style={{ flex: 1, minWidth: 150 }}><Button label="Haken zurücksetzen" variant="ghost" icon="rotate-ccw" onPress={onReset} /></View>
      </View>
      {fromPantry.length ? (
        <View style={[styles.card, { gap: 6 }]}>
          <Pressable onPress={() => setPantryOpen(!pantryOpen)} accessibilityRole="button" accessibilityState={{ expanded: pantryOpen }} style={local.orderRow}>
            <Text style={[styles.sectionTitle, { flex: 1 }]}>Schon im Vorrat <Text style={styles.hint}>· {fromPantry.length} Dinge da</Text></Text>
            <Icon name={pantryOpen ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
          </Pressable>
          {pantryOpen ? (
            <>
              <Text style={styles.hint}>Antippen = doch kaufen (kommt als eigener Artikel auf die Liste).</Text>
              {order.map((cat) => {
                const list = fromPantry.filter((it) => it.category === cat);
                if (!list.length) return null;
                return (
                  <View key={cat} style={{ gap: 2 }}>
                    <Text style={local.section}>{cat}</Text>
                    {list.map((it) => (
                      <Pressable key={it.key} onPress={() => onBuyAnyway(it.name, formatAmount(it.amount, it.unit))} accessibilityRole="button"
                        accessibilityLabel={`${it.name} doch kaufen`} style={(st) => [local.pantryRow, hov(st) && local.pantryHover]}>
                        <Icon name="check" size={14} color={colors.accent} />
                        <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.hint}>{formatAmount(it.amount, it.unit)}</Text>
                        <Icon name="plus-circle" size={16} color={colors.muted} />
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
      ) : null}

      {recurring.length ? (
        <View style={[styles.card, { gap: 6 }]}>
          <Text style={styles.sectionTitle}>Kommt regelmäßig</Text>
          {[...recurring].sort((x, y) => x.next.localeCompare(y.next)).map((r) => (
            <View key={r.id} style={local.orderRow}>
              <Text style={[styles.hint, { flex: 1, color: colors.text }]}>
                {r.amount ? `${r.amount} ` : ''}{r.name} <Text style={styles.hint}>· alle {r.everyDays} Tage · nächstes Mal {new Date(r.next).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</Text>
              </Text>
              <Pressable onPress={() => onRecurring(r.name, undefined, 0)} accessibilityLabel={`${r.name} nicht mehr wiederholen`} style={(st) => [local.iconBtn, hov(st) && local.iconHover]}>
                <Icon name="x" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {basics.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Grundzutaten – hast du</Text>
          <Text style={styles.hint}>{basics.map((b) => b.name).join(', ')}. Ändern unter Einstellungen → Grundzutaten vorhanden.</Text>
        </View>
      ) : null}

        </>}
      />
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
  tileTop: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginTop: -4, marginRight: -4 },
  doneDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 'auto' },
  icons: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconHover: { backgroundColor: colors.surface },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  nameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  amount: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  input: { minHeight: 38, paddingVertical: 6, fontSize: 14 },
  editBtns: { flexDirection: 'row', gap: 6 },
  editBtn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  helpBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bigSum: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  pantryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 8, borderRadius: 8 },
  pantryHover: { backgroundColor: colors.cardHover },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  repeatChip: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  repeatOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  repeatText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: space.sm },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
