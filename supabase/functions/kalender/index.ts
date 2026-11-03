// Supabase Edge Function „kalender": liefert das Kalender-Abo (iCal) eines Haushalts.
// Aufruf: GET …/functions/v1/kalender?t=<Schlüssel>. Das iPhone abonniert den Link als Kalender und
// erinnert dann von selbst – ohne Push-Dienst und ohne Secrets.
//
// WICHTIG: In Supabase bei dieser Funktion „Verify JWT“ ausschalten – der Kalender schickt keinen
// Anmelde-Header. Geschützt ist der Link über den geheimen Schlüssel (wp2_calendar_feed).
//
// Die App rechnet alles vor und legt es im Zustand unter „calendar“ ab (src/logic/calendar.ts).

interface Feed {
  updated: string;
  shopDays: number[]; // 0 = Montag
  shopHour: number;
  openCost: number;
  openCount: number;
  items: string[];
  empty: { name: string; date: string; remind: number }[];
  useBy: { name: string; date: string }[];
  recurring: { name: string; date: string }[];
}

const TZ = 'Europe/Berlin';
const euro = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Datum in deutscher Zeit als [Jahr, Monat, Tag] */
function berlinDate(d: Date): [number, number, number] {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).split('-').map(Number);
  return [y, m, day];
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = ([y, m, d]: [number, number, number]) => `${y}${pad(m)}${pad(d)}`;
/** Ortszeit ohne Zeitzone („floating“) – das iPhone nimmt seine eigene Zeitzone */
const local = (day: [number, number, number], hour: number, min = 0) => `${ymd(day)}T${pad(hour)}${pad(min)}00`;

function addDays([y, m, d]: [number, number, number], n: number): [number, number, number] {
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
}
const weekday = ([y, m, d]: [number, number, number]) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
const cmp = (a: [number, number, number], b: [number, number, number]) => ymd(a).localeCompare(ymd(b));
const dayLabel = (day: [number, number, number]) =>
  new Date(Date.UTC(day[0], day[1] - 1, day[2], 12)).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** Text für iCal maskieren und auf 75 Zeichen je Zeile falten */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

interface Ev { uid: string; start: string; minutes?: number; allDay?: boolean; title: string; text?: string; alarms?: string[] }

function event(e: Ev, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@meinwochenplan`, `DTSTAMP:${stamp}`];
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${e.start}`);
  } else {
    lines.push(`DTSTART:${e.start}`, `DURATION:PT${e.minutes ?? 15}M`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.text) lines.push(`DESCRIPTION:${esc(e.text)}`);
  for (const trigger of e.alarms ?? []) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

function buildIcs(feed: Feed | null): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const today = berlinDate(now);
  const events: Ev[] = [];

  if (feed) {
    // Einkaufstage der nächsten drei Wochen; der nächste bekommt Betrag und Liste
    let first = true;
    for (let i = 0; i < 21; i++) {
      const day = addDays(today, i);
      if (!feed.shopDays.includes(weekday(day))) continue;
      if (i === 0 && berlinHour(now) >= feed.shopHour + 1) continue; // heutiger Einkauf ist vorbei
      events.push({
        uid: `einkauf-${ymd(day)}`,
        start: local(day, feed.shopHour),
        minutes: 60,
        title: first && feed.openCount ? `Einkaufen – ca. ${euro(feed.openCost)}` : 'Einkaufen',
        text: first && feed.openCount
          ? `${feed.openCount} Artikel offen, ca. ${euro(feed.openCost)}:\n${feed.items.map((n) => `• ${n}`).join('\n')}`
          : 'Liste in MeinWochenplan',
        // Am Vorabend um 19 Uhr und eine Stunde vorher
        alarms: [`-PT${feed.shopHour + 5}H`, '-PT1H'],
      });
      first = false;
    }

    for (const e of feed.empty) {
      const empty = berlinDate(new Date(e.date));
      let day = addDays(empty, -Math.max(0, e.remind));
      if (cmp(day, today) < 0) day = today;
      events.push({
        uid: `leer-${e.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${ymd(empty)}`,
        start: local(day, 9),
        title: `Bald leer: ${e.name}`,
        text: `${e.name} ist ca. ${dayLabel(empty)} leer – auf die Einkaufsliste setzen.`,
        alarms: ['PT0M'],
      });
    }

    for (const u of feed.useBy) {
      const until = berlinDate(new Date(u.date));
      let day = addDays(until, -1);
      if (cmp(day, today) < 0) day = today;
      events.push({
        uid: `reste-${u.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${ymd(until)}`,
        start: local(day, 16),
        title: `Aufbrauchen: ${u.name}`,
        text: `${u.name} hält bis ${dayLabel(until)} – Vorschläge unter „Reste verwerten“ in der App.`,
        alarms: ['PT0M'],
      });
    }

    for (const r of feed.recurring) {
      const day = berlinDate(new Date(r.date));
      events.push({ uid: `regel-${r.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${ymd(day)}`, start: ymd(day), allDay: true, title: `Auf die Liste: ${r.name}` });
    }
  }

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MeinWochenplan//Kalender//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:MeinWochenplan', 'X-WR-TIMEZONE:Europe/Berlin', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...events.flatMap((e) => event(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

function berlinHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d));
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[0-9a-f]{32,}$/.test(token)) return new Response('Link ungültig', { status: 404 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_P0hAfHHtyDt1RLdxgRp7pw_-Qf1XsoY';
  const res = await fetch(`${url}/rest/v1/rpc/wp2_calendar_feed`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ tok: token }),
  });
  if (!res.ok) return new Response('Fehler beim Laden', { status: 502 });
  // Unbekannter Schlüssel oder noch kein Auszug → leerer Kalender statt Fehler, damit das Abo bestehen bleibt
  const feed = (await res.json()) as Feed | null;
  return new Response(buildIcs(feed), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
});
