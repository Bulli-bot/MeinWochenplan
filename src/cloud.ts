import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { getPhotoData, setRemotePhotoLoader } from './photos';
import { EMPTY_STATE } from './storage';
import { rpc } from './supabase';
import type { AppState } from './types';

/**
 * Abgleich aller Geräte eines Haushalts über Supabase. Zugriff nur angemeldet und vom Besitzer
 * freigegeben (SQL-Funktionen wp2_* in supabase-konten.sql). Konflikte: die jüngere Änderung gewinnt.
 */
interface Meta {
  /** Konto, zu dem die Angaben gehören – bei Kontowechsel wird neu angefangen */
  userId: string | null;
  /** updated_at der Cloud beim letzten erfolgreichen Abgleich */
  synced: string | null;
  /** Zeitpunkt der letzten lokalen Änderung, die noch nicht hochgeladen ist */
  dirtySince: string | null;
  /** Foto-IDs, deren Upload noch aussteht */
  pendingPhotos: string[];
}

const META_KEY = 'meinwochenplan:cloud-meta';
/** Alte Einstellung mit Haushalts-Code (vor den Konten) – nur noch für die einmalige Übernahme */
const LEGACY_KEY = 'meinwochenplan:cloud';
const PUSH_DELAY_MS = 1500;
const POLL_MS = 60000;

let active = false;
let meta: Meta = { userId: null, synced: null, dirtySince: null, pendingPhotos: [] };

const saveMeta = () => AsyncStorage.setItem(META_KEY, JSON.stringify(meta)).catch(() => {});

/** Für das angemeldete, freigegebene Konto einschalten (bzw. mit null ausschalten). */
export async function activateCloud(userId: string | null) {
  active = !!userId;
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (raw) meta = { ...meta, ...JSON.parse(raw) };
  } catch {
    // dann eben frisch
  }
  if (userId && meta.userId !== userId) {
    meta = { userId, synced: null, dirtySince: null, pendingPhotos: [] };
    await saveMeta();
  }
}

/** Haushalts-Code aus der Zeit vor den Konten, falls auf diesem Gerät noch vorhanden. */
export async function legacyCode(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw).code as string) ?? null : null;
  } catch {
    return null;
  }
}

/** Alte Daten ins Konto übernehmen. Gibt 'besitzer' zurück, wenn dieses Konto dadurch Besitzer wurde. */
export async function claimLegacy(code: string): Promise<string> {
  const result = await rpc<string>('wp2_claim_legacy', { code });
  await AsyncStorage.removeItem(LEGACY_KEY);
  meta.synced = null;
  meta.dirtySince = null;
  await saveMeta();
  return result;
}

export async function uploadPhoto(id: string) {
  if (!meta.pendingPhotos.includes(id)) meta.pendingPhotos.push(id);
  await saveMeta();
  if (active) await flushPhotos();
}

async function flushPhotos() {
  for (const id of [...meta.pendingPhotos]) {
    const data = await getPhotoData(id);
    try {
      if (data) await rpc('wp2_put_foto', { foto_id: id, payload: data });
      meta.pendingPhotos = meta.pendingPhotos.filter((p) => p !== id);
      await saveMeta();
    } catch {
      return; // später erneut
    }
  }
}

export async function deleteCloudPhoto(id: string) {
  meta.pendingPhotos = meta.pendingPhotos.filter((p) => p !== id);
  await saveMeta();
  if (active) await rpc('wp2_delete_foto', { foto_id: id }).catch(() => {});
}

setRemotePhotoLoader(async (id) => (active ? rpc<string | null>('wp2_get_foto', { foto_id: id }) : null));

export type SyncStatus = { kind: 'aus' | 'ok' | 'läuft' | 'fehler'; text: string };

const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Hält den Zustand automatisch abgeglichen: beim Start und beim Zurückkehren in die App holen, nach
 * jeder Änderung (verzögert) hochladen, jede Minute nachsehen. `userId` = angemeldetes, freigegebenes Konto.
 */
export function useCloudSync(state: AppState, loaded: boolean, replace: (s: AppState) => void, userId: string | null) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'aus', text: 'Nicht angemeldet.' });
  const stateRef = useRef(state);
  const applying = useRef(false);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = state;

  const doPush = async () => {
    if (!active) return;
    setStatus({ kind: 'läuft', text: 'Speichere …' });
    try {
      meta.synced = await rpc<string>('wp2_put_state', { payload: stateRef.current });
      meta.dirtySince = null;
      await saveMeta();
      await flushPhotos();
      setStatus({ kind: 'ok', text: `Gespeichert ${fmt(meta.synced)}` });
    } catch (e) {
      setStatus({ kind: 'fehler', text: (e as Error).message });
    }
  };

  const check = async () => {
    if (!active) return;
    try {
      const remote = await rpc<{ data: AppState; updated_at: string } | null>('wp2_get_state');
      if (!remote) {
        // Neuer Haushalt: nur hochladen, wenn es hier schon einen Plan gibt
        if (stateRef.current.plan) await doPush();
        else setStatus({ kind: 'ok', text: 'Bereit' });
        return;
      }
      if (remote.updated_at === meta.synced) {
        if (meta.dirtySince) await doPush();
        else setStatus({ kind: 'ok', text: `Synchron ${fmt(remote.updated_at)}` });
        return;
      }
      // Cloud hat Neues. Eigene, noch nicht hochgeladene Änderungen gewinnen nur, wenn sie jünger sind.
      if (meta.dirtySince && meta.dirtySince > remote.updated_at) return doPush();
      applying.current = true;
      replace({ ...EMPTY_STATE, ...remote.data });
      meta.synced = remote.updated_at;
      meta.dirtySince = null;
      await saveMeta();
      setStatus({ kind: 'ok', text: `Neuer Stand ${fmt(remote.updated_at)}` });
    } catch (e) {
      setStatus({ kind: 'fehler', text: (e as Error).message });
    }
  };

  useEffect(() => {
    if (!loaded) return;
    ready.current = false;
    if (!userId) {
      setStatus({ kind: 'aus', text: 'Nicht angemeldet.' });
      return;
    }
    let alive = true;
    activateCloud(userId).then(() => { if (alive) return check(); }).finally(() => { ready.current = true; });
    const poll = setInterval(check, POLL_MS);
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') check(); };
    let sub: { remove: () => void } | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    else sub = RNAppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => {
      alive = false;
      clearInterval(poll);
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, userId]);

  useEffect(() => {
    if (!loaded || !active) return;
    if (applying.current) {
      applying.current = false;
      return;
    }
    if (!ready.current) return;
    meta.dirtySince = new Date().toISOString();
    saveMeta();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(doPush, PUSH_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { status, syncNow: check };
}
