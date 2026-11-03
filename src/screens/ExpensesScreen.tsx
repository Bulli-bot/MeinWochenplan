import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, BigPhoto, Field, Link, Thumb } from '../components';
import { readReceiptAny } from '../ai';
import { CATEGORY_LABEL, CATEGORY_ORDER, bonKey, classifyWithMemory, isUnclear, learnPrice, matchIngredient, sumBy } from '../logic/receipt';
import type { BonName, Purchase, PurchaseItem, SpendCategory, UserPrice } from '../types';
import { Button, Card, Chip, Icon, colors, euro, hov, space, styles } from '../ui';
import { getPhotoData } from '../photos';

const TONE: Record<SpendCategory, string> = {
  plan: '#62B87D', grund: '#5C9BD6', extra: '#E6B450', verzichtbar: '#EE7A64', pfand: '#7D857F',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const newId = () => `e${Date.now().toString(36)}`;
const money = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** „31.10.2026" → ISO-Datum (Mittag, damit Zeitzonen nicht den Tag verschieben) */
function parseDate(text: string): string {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return new Date().toISOString();
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(year, Number(m[2]) - 1, Number(m[1]), 12).toISOString();
}

export function ExpensesScreen({ purchases, budget, plannedCost, planIngredients, bonNames, currentWeek, weekOf, onSave, onDelete, onLearn, onLearnName, onBonPhoto }: {
  purchases: Purchase[];
  budget: number;
  /** Geschätzte Kosten des aktuellen Wochenplans */
  plannedCost: number;
  planIngredients: Set<string>;
  /** Gelernte Bon-Kürzel */
  bonNames: Record<string, BonName>;
  /** Montag der Woche, für die gerade eingekauft/gekocht wird */
  currentWeek: string;
  /** Zu welcher Woche ein Einkauf zählt */
  weekOf: (iso: string) => string;
  onSave: (p: Purchase) => void;
  onDelete: (id: string) => void;
  onLearn: (prices: Record<string, UserPrice>) => void;
  onLearnName: (key: string, value: BonName) => void;
  /** Foto aufnehmen, speichern, hochladen → Foto-ID */
  onBonPhoto: () => Promise<string | null>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    for (const p of [...purchases].sort((a, b) => b.date.localeCompare(a.date))) {
      const k = weekOf(p.date);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()];
  }, [purchases, weekOf]);

  const pending = purchases.filter((p) => p.status === 'wartet');
  const open = purchases.find((p) => p.id === openId);

  const photoBon = async () => {
    setNotice(null);
    try {
      const photoId = await onBonPhoto();
      if (!photoId) return;
      onSave({ id: newId(), date: new Date().toISOString(), store: '', total: 0, items: [], photoId, status: 'wartet' });
      setNotice(Platform.OS === 'web' && /iPhone|iPad|Android/i.test(navigator.userAgent)
        ? 'Bon gespeichert – jetzt „Auslesen" tippen (am PC lokal, unterwegs per Gemini).'
        : 'Bon gespeichert – jetzt „Auslesen" tippen.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const ocr = async (p: Purchase) => {
    if (!p.photoId) return;
    setBusy(p.id);
    setNotice('Lese den Bon … das dauert je nach Modell 20 Sekunden bis 2 Minuten.');
    try {
      const image = await getPhotoData(p.photoId);
      if (!image) throw new Error('Foto noch nicht auf diesem Gerät – kurz warten, bis die Cloud es geladen hat.');
      const r = await readReceiptAny(image);
      const items: PurchaseItem[] = r.artikel.map((a) => ({ name: a.name, price: a.preis, quantity: a.kg ?? undefined, ...classifyWithMemory(a.name, planIngredients, bonNames) }));
      const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
      const gap = r.summe ? Math.round((r.summe - sum) * 100) / 100 : 0;
      // Nicht erkannte Zeilen sichtbar machen statt sie stillschweigend in der Summe zu verstecken
      if (Math.abs(gap) >= 0.05) items.push({ name: 'Nicht erkannt (Rest zur Bon-Summe)', price: gap, category: 'extra' });
      onSave({ ...p, store: r.laden || 'Einkauf', date: r.datum ? parseDate(r.datum) : p.date, total: r.summe ?? sum, items, status: 'fertig' });
      const unclear = items.filter(isUnclear).length;
      setNotice(`${items.length} Positionen erkannt (${r.model}). ${Math.abs(gap) >= 0.05 ? `${euro(gap)} nicht zugeordnet – steht unten als eigene Zeile. ` : 'Summe stimmt mit dem Bon überein. '}${unclear ? `${unclear} Artikel kenne ich noch nicht – bitte kurz sagen, was das ist.` : 'Kategorien bitte kurz prüfen.'}`);
      setOpenId(p.id);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (open) {
    return <PurchaseDetail purchase={open} planIngredients={planIngredients} onBack={() => setOpenId(null)} onSave={onSave} onLearn={onLearn} onLearnName={onLearnName} notice={notice}
      onDelete={() => { onDelete(open.id); setOpenId(null); }} />;
  }

  const current = weeks.find(([k]) => k === currentWeek)?.[1] ?? [];
  const currentSum = current.reduce((s, p) => s + p.total, 0);
  const ratio = budget ? currentSum / budget : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Ausgaben</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Woche ab {new Date(currentWeek).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</Text>
        <Text style={[local.big, { color: ratio > 1 ? colors.danger : ratio > 0.85 ? colors.warn : colors.accent }]}>{euro(currentSum)}</Text>
        <Text style={styles.hint}>von {euro(budget)} Budget · Wochenplan geschätzt {euro(plannedCost)}</Text>
        <CategoryBar purchases={current} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}><Button label="Bon fotografieren" icon="camera" onPress={photoBon} /></View>
        <View style={{ flex: 1 }}><Button label="Betrag eintragen" variant="secondary" onPress={() => setManual((v) => !v)} /></View>
      </View>
      {manual ? <ManualEntry onSave={(p) => { onSave(p); setManual(false); }} /> : null}
      {notice ? <Text style={styles.hint}>{notice}</Text> : null}

      {pending.map((p) => (
        <View key={p.id} style={[styles.card, local.pending]}>
          <View style={local.rowTop}>
            <Thumb id={p.photoId} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={local.title}>Bon vom {fmtDate(p.date)}</Text>
              <Text style={styles.hint}>Noch nicht ausgelesen</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Pressable onPress={() => (busy ? null : ocr(p))} style={styles.small}><Text style={styles.smallText}>{busy === p.id ? 'Lese …' : 'Auslesen'}</Text></Pressable>
            <Pressable onPress={() => setOpenId(p.id)} style={styles.small}><Text style={styles.smallText}>Selbst eintragen</Text></Pressable>
          </View>
        </View>
      ))}

      <MonthOverview purchases={purchases.filter((p) => p.status === 'fertig')} />

      {weeks.map(([week, list]) => {
        const sum = list.reduce((s, p) => s + p.total, 0);
        return (
          <View key={week} style={styles.card}>
            <Text style={styles.sectionTitle}>Woche ab {new Date(week).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · {euro(sum)}</Text>
            <CategoryBar purchases={list} />
            {list.filter((p) => p.status === 'fertig').map((p) => {
              const unclear = p.items.filter(isUnclear).length;
              return (
                <Pressable key={p.id} onPress={() => setOpenId(p.id)} style={local.purchase}>
                  <Text style={local.title}>{fmtDate(p.date)} · {p.store || 'Einkauf'}{unclear ? <Text style={[styles.hint, { color: colors.warn }]}>  · {unclear} unklar</Text> : null}</Text>
                  <Text style={local.amount}>{euro(p.total)} ›</Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}
      {!purchases.length ? <Text style={styles.hint}>Noch keine Einkäufe. Nach dem Einkaufen den Bon fotografieren – den Rest macht die KI.</Text> : null}
    </ScrollView>
  );
}

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string, long = false) =>
  new Date(`${key}-15`).toLocaleDateString('de-DE', long ? { month: 'long', year: 'numeric' } : { month: 'short' });

/** Monate nebeneinander: Summe, Kategorien, Trend bei „verzichtbar“ und die teuersten Artikel. */
function MonthOverview({ purchases }: { purchases: Purchase[] }) {
  const months = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    for (const p of purchases) {
      const k = monthKey(p.date);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [purchases]);
  const [sel, setSel] = useState<string | null>(null);
  if (!months.length) return null;
  const idx = Math.max(0, months.findIndex(([k]) => k === sel));
  const selIdx = sel ? idx : months.length - 1;
  const [key, list] = months[selIdx];
  const prev = selIdx > 0 ? months[selIdx - 1][1] : null;
  const total = (l: Purchase[]) => l.reduce((s, p) => s + p.total, 0);
  const max = Math.max(...months.map(([, l]) => total(l)), 1);
  const sums = sumBy(list);
  const prevSums = prev ? sumBy(prev) : null;
  const diff = prev ? total(list) - total(prev) : null;
  const waste = prevSums ? sums.verzichtbar - prevSums.verzichtbar : null;

  // Teuerste Artikel des Monats (gleiche Artikel zusammengezählt, ohne Pfand)
  const top = new Map<string, { name: string; sum: number; count: number }>();
  for (const p of list) {
    for (const i of p.items) {
      if (i.price <= 0 || i.category === 'pfand') continue;
      const name = i.label || i.name;
      const k = name.toLowerCase();
      const t = top.get(k) ?? { name, sum: 0, count: 0 };
      t.sum += i.price;
      t.count += 1;
      top.set(k, t);
    }
  }
  const topList = [...top.values()].sort((a, b) => b.sum - a.sum).slice(0, 5);

  return (
    <View style={[styles.card, { gap: space.sm }]}>
      <Text style={styles.sectionTitle}>Monate</Text>
      <View style={local.months}>
        {months.map(([k, l], i) => {
          const sum = total(l);
          const on = i === selIdx;
          return (
            <Pressable key={k} onPress={() => setSel(k)} style={local.monthCol} accessibilityLabel={`${monthLabel(k, true)}: ${euro(sum)}`}>
              <Text style={[styles.hint, { fontSize: 11 }]}>{Math.round(sum)} €</Text>
              <View style={local.monthTrack}>
                <View style={[local.monthFill, { height: `${Math.max(4, (sum / max) * 100)}%`, backgroundColor: on ? colors.accent : colors.border }]} />
              </View>
              <Text style={[styles.hint, on && { color: colors.text, fontWeight: '700' }]}>{monthLabel(k)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.h2}>{monthLabel(key, true)} · {euro(total(list))}</Text>
      <Text style={styles.hint}>
        {list.length} Einkäufe{diff !== null ? ` · ${diff > 0 ? '+' : '−'}${euro(Math.abs(diff))} zum Vormonat` : ''}
      </Text>
      <CategoryBar purchases={list} />
      {waste !== null ? (
        <Text style={[styles.hint, { color: waste > 0 ? colors.warn : colors.accent }]}>
          Verzichtbar: {euro(sums.verzichtbar)} – {waste > 0.004 ? `${euro(waste)} mehr` : waste < -0.004 ? `${euro(-waste)} weniger` : 'gleich viel'} als im Vormonat
        </Text>
      ) : null}
      {topList.length ? (
        <View style={{ gap: 2 }}>
          <Text style={[styles.hint, { fontWeight: '700', color: colors.text }]}>Am teuersten</Text>
          {topList.map((t) => (
            <View key={t.name} style={local.topRow}>
              <Text style={[styles.hint, { flex: 1, color: colors.text }]} numberOfLines={1}>{t.name}{t.count > 1 ? <Text style={styles.hint}> · {t.count}×</Text> : null}</Text>
              <Text style={[styles.hint, { color: colors.text }]}>{euro(t.sum)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function CategoryBar({ purchases, compact }: { purchases: Purchase[]; compact?: boolean }) {
  const sums = sumBy(purchases);
  const total = CATEGORY_ORDER.reduce((s, c) => s + Math.max(0, sums[c]), 0);
  if (!total) return null;
  return (
    <View style={{ gap: 6, marginTop: compact ? 2 : 8 }}>
      <View style={[local.bar, compact && { height: 8 }]}>
        {CATEGORY_ORDER.map((c) => (sums[c] > 0 ? <View key={c} style={{ flex: sums[c], backgroundColor: TONE[c] }} /> : null))}
      </View>
      <View style={[local.legend, compact && { flexDirection: 'column', gap: 2 }]}>
        {CATEGORY_ORDER.map((c) => (sums[c] > 0.004 ? (
          <Text key={c} style={[styles.hint, compact && { fontSize: 12 }]}><Text style={{ color: TONE[c] }}>■</Text> {CATEGORY_LABEL[c]} {euro(sums[c])}</Text>
        ) : null))}
      </View>
    </View>
  );
}

function ManualEntry({ onSave }: { onSave: (p: Purchase) => void }) {
  const [store, setStore] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<SpendCategory>('plan');
  const value = parseFloat(amount.replace(',', '.'));
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <Field label="Laden" value={store} onChangeText={setStore} placeholder="z. B. ALDI" />
      <Field label="Betrag in €" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <View style={styles.chipRow}>
        {CATEGORY_ORDER.filter((c) => c !== 'pfand').map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>
      <Button label="Speichern" onPress={() => {
        if (!Number.isFinite(value) || value <= 0) return;
        onSave({ id: newId(), date: new Date().toISOString(), store: store || 'Einkauf', total: value, items: [{ name: store || 'Einkauf', price: value, category }], status: 'fertig' });
      }} />
    </View>
  );
}

/** Eine Bon-Zeile bearbeiten: Name, Preis, Kategorie – optional als Kürzel merken. */
function ItemEditor({ item, onSave, onDelete, onCancel, ask }: {
  item: PurchaseItem;
  onSave: (it: PurchaseItem, remember: boolean) => void;
  onDelete?: () => void;
  onCancel: () => void;
  /** Nachfrage-Modus für unbekannte Kürzel */
  ask?: boolean;
}) {
  const [label, setLabel] = useState(item.label ?? (ask ? '' : item.name));
  const [price, setPrice] = useState(money(item.price));
  const [category, setCategory] = useState<SpendCategory>(item.category);
  const [remember, setRemember] = useState(true);
  const apply = () => {
    const p = parseFloat(price.replace(',', '.'));
    const clean = label.trim();
    const ingredient = clean ? matchIngredient(clean) ?? item.ingredient : item.ingredient;
    onSave({ ...item, label: clean && clean !== item.name ? clean : undefined, price: Number.isFinite(p) ? p : item.price, category, ingredient, known: true }, remember && !!clean);
  };
  return (
    <View style={local.editor}>
      <Text style={styles.hint}>Auf dem Bon: <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text></Text>
      <Field label={ask ? 'Was ist das?' : 'Name'} value={label} onChangeText={setLabel} placeholder="z. B. Toilettenpapier" autoFocus={ask} onSubmitEditing={apply} />
      {!ask ? <Field label="Preis in €" value={price} onChangeText={setPrice} keyboardType="decimal-pad" /> : null}
      <View style={styles.chipRow}>
        {CATEGORY_ORDER.map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>
      <Pressable onPress={() => setRemember((v) => !v)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
        <View style={[local.box, remember && local.boxOn]}>{remember ? <Icon name="check" size={14} color={colors.onAccent} /> : null}</View>
        <Text style={styles.hint}>Beim nächsten Bon automatisch so erkennen</Text>
      </Pressable>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 120 }}><Button label="Übernehmen" icon="check" onPress={apply} /></View>
        <View style={{ flex: 1, minWidth: 100 }}><Button label={ask ? 'Später' : 'Abbrechen'} variant="ghost" onPress={onCancel} /></View>
      </View>
      {onDelete ? <Pressable onPress={onDelete}><Text style={[styles.hint, { color: colors.danger }]}>Zeile löschen (nicht gekauft / doppelt gelesen)</Text></Pressable> : null}
    </View>
  );
}

function PurchaseDetail({ purchase, planIngredients, onBack, onSave, onDelete, onLearn, onLearnName, notice }: {
  purchase: Purchase;
  planIngredients: Set<string>;
  onBack: () => void;
  onSave: (p: Purchase) => void;
  onDelete: () => void;
  onLearn: (prices: Record<string, UserPrice>) => void;
  onLearnName: (key: string, value: BonName) => void;
  notice: string | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const [learned, setLearned] = useState<string | null>(null);
  const [total, setTotal] = useState(purchase.total ? String(purchase.total).replace('.', ',') : '');
  const [store, setStore] = useState(purchase.store);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const sums = sumBy([purchase]);
  // Pro Zutat nur ein Preis (der letzte auf dem Bon)
  const prices = Object.entries(Object.fromEntries(
    purchase.items.map((it) => learnPrice(it, purchase.store, purchase.date)).filter((x): x is [string, UserPrice] => !!x),
  ));
  const unclear = purchase.items.map((it, idx) => ({ it, idx })).filter(({ it, idx }) => isUnclear(it) && !skipped.includes(idx));
  const asking = unclear[0];

  const saveItem = (idx: number, it: PurchaseItem, remember: boolean) => {
    // Gehört der neue Name zu einer Zutat dieser Woche, zählt er zum Wochenplan
    const category = it.ingredient && planIngredients.has(it.ingredient) && it.category === 'extra' ? 'plan' : it.category;
    const next = { ...it, category };
    const items = purchase.items.map((x, i) => (i === idx ? next : x));
    onSave({ ...purchase, items, total: purchase.items.length ? Math.round(items.reduce((s, x) => s + x.price, 0) * 100) / 100 || purchase.total : purchase.total });
    if (remember && next.label) onLearnName(bonKey(next.name), { name: next.label, category: next.category, ingredient: next.ingredient });
    setEditIdx(null);
  };
  const deleteItem = (idx: number) => {
    const items = purchase.items.filter((_, i) => i !== idx);
    onSave({ ...purchase, items, total: Math.round(items.reduce((s, x) => s + x.price, 0) * 100) / 100 });
    setEditIdx(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Link label="‹ Zurück" onPress={onBack} />
      <Text style={styles.h1}>{purchase.store || 'Einkauf'}</Text>
      <Text style={styles.sub}>{fmtDate(purchase.date)} · {euro(purchase.total)}</Text>
      {notice ? <Text style={styles.hint}>{notice}</Text> : null}

      {purchase.status === 'wartet' || !purchase.items.length ? (
        <View style={[styles.card, { gap: 10 }]}>
          <Field label="Laden" value={store} onChangeText={setStore} />
          <Field label="Betrag in €" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
          <Button label="Speichern" onPress={() => {
            const v = parseFloat(total.replace(',', '.'));
            if (Number.isFinite(v)) onSave({ ...purchase, store, total: v, status: 'fertig' });
          }} />
        </View>
      ) : null}

      {asking && editIdx === null ? (
        <Card style={{ borderColor: colors.warn, gap: space.sm }}>
          <View style={styles.row}>
            <Icon name="help-circle" color={colors.warn} />
            <Text style={styles.sectionTitle}>Was ist das? ({unclear.length} {unclear.length === 1 ? 'Artikel' : 'Artikel'} unklar)</Text>
          </View>
          <ItemEditor key={asking.idx} item={asking.it} ask
            onSave={(it, remember) => saveItem(asking.idx, it, remember)}
            onCancel={() => setSkipped((s) => [...s, asking.idx])} />
          {unclear.length > 1 ? (
            <Pressable onPress={() => onSave({ ...purchase, items: purchase.items.map((x) => (isUnclear(x) ? { ...x, known: true } : x)) })}>
              <Text style={[styles.hint, { color: colors.accent }]}>Alle {unclear.length} passen so – nicht mehr fragen</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {purchase.items.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Positionen</Text>
          <Text style={styles.hint}>Antippen zum Ändern von Name, Preis oder Kategorie.</Text>
          {CATEGORY_ORDER.map((c) => (sums[c] ? <Text key={c} style={styles.hint}><Text style={{ color: TONE[c] }}>■</Text> {CATEGORY_LABEL[c]}: {euro(sums[c])}</Text> : null))}
          {purchase.items.map((it, idx) => (editIdx === idx ? (
            <ItemEditor key={idx} item={it} onSave={(x, remember) => saveItem(idx, x, remember)} onDelete={() => deleteItem(idx)} onCancel={() => setEditIdx(null)} />
          ) : (
            <Pressable key={idx} onPress={() => setEditIdx(idx)} accessibilityRole="button" style={(s) => [local.itemRow, hov(s) && { backgroundColor: colors.cardHover }]}>
              <View style={{ flex: 1 }}>
                <Text style={local.itemName}>{it.label ?? it.name}</Text>
                {it.label ? <Text style={styles.hint}>Bon: {it.name}</Text> : null}
                {it.ingredient && it.ingredient !== it.label ? <Text style={styles.hint}>→ {it.ingredient}</Text> : null}
              </View>
              {isUnclear(it) ? <Badge label="unklar" tone="warn" /> : null}
              <Badge label={CATEGORY_LABEL[it.category]} tone={it.category === 'verzichtbar' ? 'danger' : it.category === 'extra' ? 'warn' : it.category === 'plan' ? 'accent' : 'muted'} />
              <Text style={local.amount}>{euro(it.price)}</Text>
            </Pressable>
          )))}
        </View>
      ) : null}

      {prices.length ? (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.sectionTitle}>Preise für die App</Text>
          <Text style={styles.hint}>{prices.map(([n, p]) => `${n}: ${euro(p.price)}/${p.per}`).join(' · ')}</Text>
          <Button label={`${prices.length} Preise übernehmen`} onPress={() => { onLearn(Object.fromEntries(prices)); setLearned(`${prices.length} Preise übernommen – Rezepte sind neu berechnet.`); }} />
          {learned ? <Text style={styles.hint}>{learned}</Text> : null}
        </View>
      ) : null}

      {purchase.photoId ? <BigPhoto id={purchase.photoId} /> : null}
      <Button label={confirm ? 'Wirklich löschen?' : 'Einkauf löschen'} variant="secondary" onPress={() => (confirm ? onDelete() : setConfirm(true))} />
    </ScrollView>
  );
}

const local = StyleSheet.create({
  months: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  monthTrack: { height: 80, width: '100%', maxWidth: 44, justifyContent: 'flex-end' },
  monthFill: { width: '100%', borderRadius: 6 },
  topRow: { flexDirection: 'row', gap: 8 },
  big: { fontSize: 34, fontWeight: '800' },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.input },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pending: { borderColor: colors.warn, gap: 8 },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { fontSize: 16, color: colors.text, fontWeight: '600' },
  purchase: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 8 },
  itemName: { fontSize: 15, color: colors.text },
  editor: { gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent },
});
