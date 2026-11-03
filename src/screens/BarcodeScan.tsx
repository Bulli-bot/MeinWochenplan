import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components';
import { Button, colors, radius, space, styles } from '../ui';

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
const hasDetector = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'BarcodeDetector' in window;

/** Produktname zum Barcode bei OpenFoodFacts – es wird nur die Nummer übertragen. */
async function lookup(code: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands`);
    const j = await res.json();
    const p = j?.product;
    const name = (p?.product_name_de || p?.product_name || '').trim();
    if (!name) return null;
    const brand = String(p?.brands ?? '').split(',')[0].trim();
    return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name;
  } catch {
    return null;
  }
}

/**
 * Leer-Scan: leere Packung vor die Kamera (Chrome/Edge auf Android und am PC) oder Nummer eintippen.
 * Der Name kommt von OpenFoodFacts; unbekannte Codes lassen sich von Hand benennen.
 */
export function BarcodeScan({ onFound, onClose }: { onFound: (name: string) => void; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const camera = hasDetector();

  const check = async (c: string) => {
    const clean = c.replace(/\D/g, '');
    if (clean.length < 8) return setMsg('Bitte die ganze Nummer unter dem Strichcode eingeben (8 oder 13 Ziffern).');
    setCode(clean);
    setBusy(true);
    setMsg('Suche bei OpenFoodFacts …');
    const found = await lookup(clean);
    setBusy(false);
    if (found) {
      setName(found);
      setMsg(null);
    } else {
      setMsg('Nicht gefunden – bitte den Namen selbst eintragen.');
    }
  };

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const det = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      stream = s;
      if (stop) return s.getTracks().forEach((t) => t.stop());
      const v = video.current;
      if (!v) return;
      v.srcObject = s;
      v.play().catch(() => {});
      const tick = async () => {
        if (stop) return;
        try {
          const hits = await det.detect(v);
          if (hits[0]?.rawValue) {
            stream?.getTracks().forEach((t) => t.stop());
            return check(hits[0].rawValue);
          }
        } catch {
          // nächstes Bild
        }
        setTimeout(tick, 300);
      };
      tick();
    }).catch(() => setMsg('Kamera nicht freigegeben – Nummer eintippen.'));
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.backdrop}>
        <View style={local.box}>
          <Text style={styles.h2}>Leer-Scan</Text>
          <Text style={styles.hint}>Packung ist leer? Strichcode scannen – der Artikel kommt auf die Einkaufsliste und aus dem Vorrat.</Text>
          {camera && !name ? (
            <View style={local.cam}>
              <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </View>
          ) : !camera ? <Text style={[styles.hint, { color: colors.warn }]}>Kamera-Scan geht in Chrome und Edge. Hier die Nummer unter dem Strichcode eintippen.</Text> : null}
          {!name ? (
            <>
              <Field label="Strichcode-Nummer" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="z. B. 4008400401621" onSubmitEditing={() => check(code)} />
              <Button label={busy ? 'Suche …' : 'Nachschlagen'} variant="secondary" icon="search" onPress={() => (busy ? null : check(code))} />
            </>
          ) : null}
          {name || (msg && code.length >= 8 && !busy) ? (
            <>
              <Field label="Artikel" value={name} onChangeText={setName} placeholder="Name des Artikels" />
              <Button label="Auf die Einkaufsliste" icon="shopping-cart" onPress={() => name.trim() && onFound(name.trim())} />
            </>
          ) : null}
          {msg ? <Text style={styles.hint}>{msg}</Text> : null}
          <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={[styles.hint, { color: colors.accent }]}>Schließen</Text>
          </Pressable>
          <Text style={[styles.hint, { fontSize: 11 }]}>Zum Nachschlagen geht nur die Strichcode-Nummer an OpenFoodFacts.</Text>
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  box: { width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, padding: space.xl, gap: space.md },
  cam: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.input },
});
