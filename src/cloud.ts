import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { getPhotoData, setRemotePhotoLoader } from './photos';
import { EMPTY_STATE } from './storage';
import type { AppState } from './types';

/**
 * Abgleich PC ↔ iPhone über ein eigenes, kostenloses Supabase-Projekt. Zugriff nur über die
 * Funktionen aus supabase-einrichtung.sql; der Haushalts-Code wirkt wie ein Passwort.
 * Konflikte: wer zuletzt geändert hat, gewinnt (reicht für einen Haushalt).
 */
export interface CloudConfig {
  url: string;
  key: string;
  code: string;
}

interface Meta {
  /** updated_at der Cloud beim letzten erfolgreichen Abgleich */
  synced: string | null;
  /** Zeitpunkt der letzten lokalen Änderung, die noch nicht hochgeladen ist */
  dirtySince: string | null;
  /** Foto-IDs, deren Upload noch aussteht */
  pendingPhotos: string[];
}

const CONFIG_KEY = 'meinwochenplan:cloud';
const META_KEY = 'meinwochenplan:cloud-meta';
const PUSH_DELAY_MS = 1500;
const POLL_MS = 60000;
const TIMEOUT_MS = 20000;

let config: CloudConfig | null = null;
let meta: Meta = { synced: null, dirtySince: null, pendingPhotos: [] };

export const newHouseholdCode = () =>
  Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('-');

export async function loadCloudConfig(): Promise<CloudConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    config = raw ? JSON.parse(raw) : null;
    const m = await AsyncStorage.getItem(META_KEY);
    if (m) meta = { ...meta, ...JSON.parse(m) };
  } catch {
    config = null;
  }
  return config;
}

/** `uploadLocal`: true = dieses Gerät gibt den Stand vor, false = vorhandenen Cloud-Stand übernehmen. */
export async function saveCloudConfig(next: CloudConfig | null, uploadLocal = false) {
  config = next;
  meta = { synced: null, dirtySince: uploadLocal ? new Date().toISOString() : null, pendingPhotos: [] };
  if (next) await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  else await AsyncStorage.removeItem(CONFIG_KEY);
  await saveMeta();
}

const saveMeta = () => AsyncStorage.setItem(META_KEY, JSON.stringify(meta)).catch(() => {});

export const cloudConfig = () => config;

async function rpc<T>(fn: string, body: Record<string, unknown>, cfg = config): Promise<T> {
  if (!cfg) throw new Error('Cloud-Sync ist nicht eingerichtet.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: cfg.key };
  // Alte „anon"-Schlüssel sind JWTs und gehören zusätzlich in Authorization; neue sb_publishable_… nicht.
  if (cfg.key.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${cfg.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers, body: JSON.stringify({ code: cfg.code, ...body }), signal: controller.signal,
    });
  } catch {
    throw new Error('Cloud nicht erreichbar – kein Internet?');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404) throw new Error('Funktion fehlt – wurde supabase-einrichtung.sql ausgeführt?');
    if (res.status === 401) throw new Error('Schlüssel ungültig – Supabase-Key prüfen.');
    throw new Error(`Cloud-Fehler ${res.status}: ${text.slice(0, 120)}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Verbindung prüfen, bevor die Einstellungen gespeichert werden. */
export async function testCloud(cfg: CloudConfig): Promise<'leer' | 'vorhanden'> {
  const remote = await rpc<{ data: unknown } | null>('wp_get_state', {}, cfg);
  return remote ? 'vorhanden' : 'leer';
}

async function pull(): Promise<{ data: AppState; updated_at: string } | null> {
  return rpc('wp_get_state', {});
}

async function push(state: AppState): Promise<string> {
  return rpc<string>('wp_put_state', { payload: state });
}

export async function uploadPhoto(id: string) {
  if (!config) return;
  if (!meta.pendingPhotos.includes(id)) meta.pendingPhotos.push(id);
  await saveMeta();
  await flushPhotos();
}

async function flushPhotos() {
  for (const id of [...meta.pendingPhotos]) {
    const data = await getPhotoData(id);
    try {
      if (data) await rpc('wp_put_foto', { foto_id: id, payload: data });
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
  if (config) await rpc('wp_delete_foto', { foto_id: id }).catch(() => {});
}

setRemotePhotoLoader(async (id) => (config ? rpc<string | null>('wp_get_foto', { foto_id: id }) : null));

export type SyncStatus = { kind: 'aus' | 'ok' | 'läuft' | 'fehler'; text: string };

const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Hält den Zustand automatisch mit der Cloud abgeglichen: beim Start und beim Zurückkehren in
 * die App holen, nach jeder Änderung (verzögert) hochladen, jede Minute nachsehen.
 */
export function useCloudSync(state: AppState, loaded: boolean, replace: (s: AppState) => void, configVersion: number) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'aus', text: 'Cloud-Sync ist aus.' });
  const stateRef = useRef(state);
  const applying = useRef(false);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  stateRef.current = state;

  const doPush = async () => {
    if (!config) return;
    setStatus({ kind: 'läuft', text: 'Speichere in der Cloud …' });
    try {
      meta.synced = await push(stateRef.current);
      meta.dirtySince = null;
      await saveMeta();
      await flushPhotos();
      setStatus({ kind: 'ok', text: `Abgeglichen ${fmt(meta.synced)}` });
    } catch (e) {
      setStatus({ kind: 'fehler', text: (e as Error).message });
    }
  };

  const check = async () => {
    if (!config) return;
    try {
      const remote = await pull();
      if (!remote) return doPush();
      if (remote.updated_at === meta.synced) {
        if (meta.dirtySince) await doPush();
        else setStatus({ kind: 'ok', text: `Abgeglichen ${fmt(remote.updated_at)}` });
        return;
      }
      // Cloud hat Neues. Eigene, noch nicht hochgeladene Änderungen gewinnen nur, wenn sie jünger sind.
      if (meta.dirtySince && meta.dirtySince > remote.updated_at) return doPush();
      applying.current = true;
      replace({ ...EMPTY_STATE, ...remote.data });
      meta.synced = remote.updated_at;
      meta.dirtySince = null;
      await saveMeta();
      setStatus({ kind: 'ok', text: `Neuen Stand geladen (${fmt(remote.updated_at)})` });
    } catch (e) {
      setStatus({ kind: 'fehler', text: (e as Error).message });
    }
  };

  // Start und nach Änderung der Einstellungen
  useEffect(() => {
    if (!loaded) return;
    ready.current = false;
    if (!config) {
      setStatus({ kind: 'aus', text: 'Cloud-Sync ist aus.' });
      return;
    }
    check().finally(() => { ready.current = true; });
    const poll = setInterval(check, POLL_MS);
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') check(); };
    let sub: { remove: () => void } | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    else sub = RNAppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => {
      clearInterval(poll);
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, configVersion]);

  // Lokale Änderung → verzögert hochladen
  useEffect(() => {
    if (!loaded || !config) return;
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
