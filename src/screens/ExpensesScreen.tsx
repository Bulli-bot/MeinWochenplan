import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, BigPhoto, Field, Link, Thumb } from '../components';
import { readReceipt } from '../pchelper';
import { CATEGORY_LABEL, CATEGORY_ORDER, classify, learnPrice, sumBy, weekKey } from '../logic/receipt';
import type { Purchase, PurchaseItem, SpendCategory, UserPrice } from '../types';
import { Button, Chip, colors, euro, styles } from '../ui';
import { getPhotoData } from '../photos';

const TONE: Record<SpendCategory, string> = {
  plan: '#62B87D', grund: '#5C9BD6', extra: '#E6B450', verzichtbar: '#EE7A64', pfand: '#7D857F',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const newId = () => `e${Date.now().toString(36)}`;

/** „31.10.2026" → ISO-Datum (Mittag, damit Zeitzonen nicht den Tag verschieben) */
function parseDate(text: string): string {
  const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return new Date().toISOString();
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(year, Number(m[2]) - 1, Number(m[1]), 12).toISOString();
}

export function ExpensesScreen({ purchases, budget, plannedCost, planIngredients, onSave, onDelete, onLearn, onBonPhoto }: {
  purchases: Purchase[];
  budget: number;
  /** Geschätzte Kosten des aktuellen Wochenplans */
  plannedCost: number;
  planIngredients: Set<string>;
  onSave: (p: Purchase) => void;
  onDelete: (id: string) => void;
  onLearn: (prices: Record<string, UserPrice>) => void;
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
      const k = weekKey(p.date);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()];
  }, [purchases]);

  const thisWeek = weekKey(new Date().toISOString());
  const pending = purchases.filter((p) => p.status === 'wartet');
  const open = purchases.find((p) => p.id === openId);

  const photoBon = async () => {
    setNotice(null);
    try {
      const photoId = await onBonPhoto();
      if (!photoId) return;
      onSave({ id: newId(), date: new Date().toISOString(), store: '', total: 0, items: [], photoId, status: 'wartet' });
      setNotice(Platform.OS === 'web' && /iPhone|iPad|Android/i.test(navigator.userAgent)
        ? 'Bon gespeichert. Am PC unter Ausgaben auf „Am PC auslesen" tippen.'
        : 'Bon gespeichert – jetzt „Am PC auslesen" tippen.');
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
      const r = await readReceipt(image);
      const items: PurchaseItem[] = r.artikel.map((a) => ({ name: a.name, price: a.preis, quantity: a.kg ?? undefined, ...classify(a.name, planIngredients) }));
      const sum = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
      const gap = r.summe ? Math.round((r.summe - sum) * 100) / 100 : 0;
      // Nicht erkannte Zeilen sichtbar machen statt sie stillschweigend in der Summe zu verstecken
      if (Math.abs(gap) >= 0.05) items.push({ name: 'Nicht erkannt (Rest zur Bon-Summe)', price: gap, category: 'extra' });
      onSave({ ...p, store: r.laden || 'Einkauf', date: r.datum ? parseDate(r.datum) : p.date, total: r.summe ?? sum, items, status: 'fertig' });
      setNotice(`${items.length} Positionen erkannt (${r.model}). ${Math.abs(gap) >= 0.05 ? `${euro(gap)} nicht zugeordnet – steht unten als eigene Zeile.` : 'Summe stimmt mit dem Bon überein.'} Kategorien bitte kurz prüfen.`);
      setOpenId(p.id);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (open) {
    return <PurchaseDetail purchase={open} onBack={() => setOpenId(null)} onSave={onSave} onLearn={onLearn} notice={notice}
      onDelete={() => { onDelete(open.id); setOpenId(null); }} />;
  }

  const current = weeks.find(([k]) => k === thisWeek)?.[1] ?? [];
  const currentSum = current.reduce((s, p) => s + p.total, 0);
  const ratio = budget ? currentSum / budget : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Ausgaben</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Diese Woche</Text>
        <Text style={[local.big, { color: ratio > 1 ? colors.danger : ratio > 0.85 ? colors.warn : colors.accent }]}>{euro(currentSum)}</Text>
        <Text style={styles.hint}>von {euro(budget)} Budget · Wochenplan geschätzt {euro(plannedCost)}</Text>
        <CategoryBar purchases={current} />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}><Button label="📷 Bon fotografieren" onPress={photoBon} /></View>
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
            <Pressable onPress={() => (busy ? null : ocr(p))} style={styles.small}><Text style={styles.smallText}>{busy === p.id ? 'Lese …' : 'Am PC auslesen'}</Text></Pressable>
            <Pressable onPress={() => setOpenId(p.id)} style={styles.small}><Text style={styles.smallText}>Selbst eintragen</Text></Pressable>
          </View>
        </View>
      ))}

      {weeks.map(([week, list]) => {
        const sum = list.reduce((s, p) => s + p.total, 0);
        return (
          <View key={week} style={styles.card}>
            <Text style={styles.sectionTitle}>Woche ab {new Date(week).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · {euro(sum)}</Text>
            <CategoryBar purchases={list} />
            {list.filter((p) => p.status === 'fertig').map((p) => (
              <Pressable key={p.id} onPress={() => setOpenId(p.id)} style={local.purchase}>
                <Text style={local.title}>{fmtDate(p.date)} · {p.store || 'Einkauf'}</Text>
                <Text style={local.amount}>{euro(p.total)} ›</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      {!purchases.length ? <Text style={styles.hint}>Noch keine Einkäufe. Nach dem Einkaufen den Bon fotografieren – den Rest macht der PC.</Text> : null}
    </ScrollView>
  );
}

function CategoryBar({ purchases }: { purchases: Purchase[] }) {
  const sums = sumBy(purchases);
  const total = CATEGORY_ORDER.reduce((s, c) => s + Math.max(0, sums[c]), 0);
  if (!total) return null;
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      <View style={local.bar}>
        {CATEGORY_ORDER.map((c) => (sums[c] > 0 ? <View key={c} style={{ flex: sums[c], backgroundColor: TONE[c] }} /> : null))}
      </View>
      <View style={local.legend}>
        {CATEGORY_ORDER.map((c) => (sums[c] > 0.004 ? (
          <Text key={c} style={styles.hint}><Text style={{ color: TONE[c] }}>■</Text> {CATEGORY_LABEL[c]} {euro(sums[c])}</Text>
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

function PurchaseDetail({ purchase, onBack, onSave, onDelete, onLearn, notice }: {
  purchase: Purchase;
  onBack: () => void;
  onSave: (p: Purchase) => void;
  onDelete: () => void;
  onLearn: (prices: Record<string, UserPrice>) => void;
  notice: string | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const [learned, setLearned] = useState<string | null>(null);
  const [total, setTotal] = useState(purchase.total ? String(purchase.total).replace('.', ',') : '');
  const [store, setStore] = useState(purchase.store);
  const cycle = (idx: number) => {
    const items = purchase.items.map((it, i) => (i === idx ? { ...it, category: CATEGORY_ORDER[(CATEGORY_ORDER.indexOf(it.category) + 1) % CATEGORY_ORDER.length] } : it));
    onSave({ ...purchase, items });
  };
  const sums = sumBy([purchase]);
  // Pro Zutat nur ein Preis (der letzte auf dem Bon)
  const prices = Object.entries(Object.fromEntries(
    purchase.items.map((it) => learnPrice(it, purchase.store, purchase.date)).filter((x): x is [string, UserPrice] => !!x),
  ));

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

      {purchase.items.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Positionen</Text>
          <Text style={styles.hint}>Auf die Kategorie tippen, um sie zu ändern.</Text>
          {CATEGORY_ORDER.map((c) => (sums[c] ? <Text key={c} style={styles.hint}><Text style={{ color: TONE[c] }}>■</Text> {CATEGORY_LABEL[c]}: {euro(sums[c])}</Text> : null))}
          {purchase.items.map((it, idx) => (
            <View key={idx} style={local.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={local.itemName}>{it.name}</Text>
                {it.ingredient ? <Text style={styles.hint}>→ {it.ingredient}</Text> : null}
              </View>
              <Pressable onPress={() => cycle(idx)}><Badge label={CATEGORY_LABEL[it.category]} tone={it.category === 'verzichtbar' ? 'danger' : it.category === 'extra' ? 'warn' : it.category === 'plan' ? 'accent' : 'muted'} /></Pressable>
              <Text style={local.amount}>{euro(it.price)}</Text>
            </View>
          ))}
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
  big: { fontSize: 34, fontWeight: '800' },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.input },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pending: { borderColor: colors.warn, gap: 8 },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { fontSize: 16, color: colors.text, fontWeight: '600' },
  purchase: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  itemName: { fontSize: 15, color: colors.text },
});
