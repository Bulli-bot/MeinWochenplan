import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type HandsFreeCommand = 'weiter' | 'zurueck' | 'stopp' | 'timer';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: (e: { error: string }) => void;
  start: () => void; stop: () => void;
};

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const SR = () => (web ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined : undefined);

export const voiceSupported = () => !!SR();
export const gestureSupported = () => web && !!navigator.mediaDevices?.getUserMedia;

/** Gesprochenes Wort → Befehl */
export function parseCommand(text: string): HandsFreeCommand | null {
  const t = text.toLowerCase();
  if (/stopp|stop|pause|aus\b/.test(t)) return 'stopp';
  if (/timer|wecker|uhr starten/.test(t)) return 'timer';
  if (/zurück|zurueck|vorherig/.test(t)) return 'zurueck';
  if (/weiter|nächst|naechst|next/.test(t)) return 'weiter';
  return null;
}

/**
 * Sprachsteuerung im Browser (Chrome/Edge, Safari ab iOS 14.5): „weiter“, „zurück“, „Timer“, „Timer stopp“.
 * Die Erkennung läuft über den Spracherkennungsdienst des Browsers.
 */
export function useVoice(on: boolean, onCommand: (c: HandsFreeCommand) => void) {
  const cb = useRef(onCommand);
  cb.current = onCommand;
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const Ctor = SR();
    if (!on || !Ctor) return;
    let active = true;
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const c = parseCommand(last[0].transcript);
      if (c) cb.current(c);
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed') { active = false; setError('Mikrofon nicht freigegeben.'); } };
    rec.onend = () => { if (active) try { rec.start(); } catch { /* läuft schon */ } };
    try { rec.start(); setError(null); } catch { setError('Spracherkennung startet nicht.'); }
    return () => { active = false; try { rec.stop(); } catch { /* schon aus */ } };
  }, [on]);
  return error;
}

/**
 * Gesten über die Frontkamera – einfache Bewegungserkennung, nichts wird gespeichert oder gesendet:
 * Hand vor der Kamera nach rechts wischen = weiter, nach links = zurück, Hand flach vor die Kamera = Timer stopp.
 */
export function useGestures(on: boolean, onCommand: (c: HandsFreeCommand) => void) {
  const cb = useRef(onCommand);
  cb.current = onCommand;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!on || !gestureSupported()) return;
    let stop = false;
    let s: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } }).then(async (st) => {
      s = st;
      if (stop) return st.getTracks().forEach((t) => t.stop());
      setStream(st);
      const vid = document.createElement('video');
      vid.srcObject = st;
      vid.muted = true;
      vid.playsInline = true;
      await vid.play().catch(() => {});
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 48;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      let prev: Uint8Array | null = null;
      let track: [number, number][] = [];
      let cool = 0;
      let base: number | null = null;
      const loop = () => {
        if (stop) return;
        ctx.drawImage(vid, 0, 0, 64, 48);
        const d = ctx.getImageData(0, 0, 64, 48).data;
        const cur = new Uint8Array(64 * 48);
        let sx = 0, n = 0, lum = 0;
        for (let i = 0; i < 64 * 48; i++) {
          const g = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
          cur[i] = g;
          lum += g;
          if (prev && Math.abs(g - prev[i]) > 38) { sx += i % 64; n++; }
        }
        lum /= 64 * 48;
        base = base === null ? lum : base * 0.97 + lum * 0.03;
        prev = cur;
        const now = Date.now();
        if (now > cool) {
          if (n > 120) {
            track.push([now, sx / n]);
            track = track.filter((t) => now - t[0] < 600);
            if (track.length > 4) {
              const dx = track[track.length - 1][1] - track[0][1];
              if (Math.abs(dx) > 22) { cb.current(dx < 0 ? 'weiter' : 'zurueck'); track = []; cool = now + 1200; }
            }
          }
          if (lum < base * 0.45) { cb.current('stopp'); cool = now + 2000; base = lum; }
        }
        requestAnimationFrame(loop);
      };
      loop();
    }).catch(() => setError('Kamera nicht freigegeben.'));
    return () => {
      stop = true;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [on]);
  return { stream, error };
}
