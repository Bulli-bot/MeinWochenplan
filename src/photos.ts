import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Fotos (Essen, Kassenbons) als verkleinerte JPEG-Daten-URLs. Im Browser in IndexedDB, weil
 * localStorage nur ~5 MB fasst; sonst AsyncStorage. Die Cloud-Kopie lädt cloud.ts nach.
 */
const DB = 'meinwochenplan-fotos';
const STORE = 'fotos';
const MAX_SIDE = { essen: 900, bon: 1600 };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const useIdb = () => Platform.OS === 'web' && typeof indexedDB !== 'undefined';

export async function savePhotoData(id: string, dataUrl: string): Promise<void> {
  if (useIdb()) await idb('readwrite', (s) => s.put(dataUrl, id));
  else await AsyncStorage.setItem(`foto:${id}`, dataUrl);
  notify(id);
}

export async function getPhotoData(id: string): Promise<string | null> {
  try {
    if (useIdb()) return (await idb<string | undefined>('readonly', (s) => s.get(id))) ?? null;
    return await AsyncStorage.getItem(`foto:${id}`);
  } catch {
    return null;
  }
}

export async function deletePhotoData(id: string): Promise<void> {
  try {
    if (useIdb()) await idb('readwrite', (s) => s.delete(id));
    else await AsyncStorage.removeItem(`foto:${id}`);
  } catch {
    // egal – dann bleibt eine verwaiste Bilddatei liegen
  }
}

export const newPhotoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Fehlt ein Foto lokal, kann die Cloud es nachliefern (setzt cloud.ts). */
let remoteLoader: ((id: string) => Promise<string | null>) | null = null;
export function setRemotePhotoLoader(loader: typeof remoteLoader) {
  remoteLoader = loader;
}

const listeners = new Set<(id: string) => void>();
function notify(id: string) {
  listeners.forEach((l) => l(id));
}

/** Bilddaten zu einer Foto-ID, lädt bei Bedarf aus der Cloud nach. */
export function usePhoto(id: string | undefined): string | null {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return setData(null);
    let alive = true;
    const load = async () => {
      let d = await getPhotoData(id);
      if (!d && remoteLoader) {
        d = await remoteLoader(id).catch(() => null);
        if (d) await savePhotoData(id, d);
      }
      if (alive) setData(d);
    };
    load();
    const onChange = (changed: string) => { if (changed === id) load(); };
    listeners.add(onChange);
    return () => { alive = false; listeners.delete(onChange); };
  }, [id]);
  return data;
}

/**
 * Foto auswählen oder aufnehmen (auf dem iPhone fragt Safari: Kamera oder Mediathek) und
 * verkleinern. Nur im Browser bzw. in der Web-App; gibt null zurück, wenn abgebrochen.
 */
export function pickPhoto(kind: 'essen' | 'bon'): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.reject(new Error('Fotos gehen in der Web-App (Browser bzw. Home-Bildschirm).'));
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await shrink(file, MAX_SIDE[kind], kind === 'bon' ? 0.85 : 0.75));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

async function shrink(file: File, maxSide: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
