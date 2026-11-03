# MeinWochenplan

Private Web-App (Expo/React Native Web): Wochenplan aus eigenen Rezepten, passend zu Budget, Haushalt,
Kochtagen, Ernährung, Allergenen und Küchengeräten – mit Einkaufsliste, Fotos, Vorrat und Ausgaben.
Läuft im Browser am PC und auf dem iPhone als Symbol auf dem Home-Bildschirm. Immer im Dark Mode.

## Benutzen
- **Online:** `https://<github-konto>.github.io/MeinWochenplan/` – wird bei jedem Push auf `main`
  automatisch neu gebaut (`.github/workflows/pages.yml`).
- **iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm".
- **PC-Helfer** (nur am PC): Doppelklick auf `PC-Helfer starten.cmd`. Liest Kassenbon-Fotos mit dem
  lokalen Ollama-Bildmodell aus (bevorzugt `qwen2.5vl`) und holt Rezepte per Link (schema.org/Recipe).
  Läuft nur auf 127.0.0.1:8093, Ollama auf 127.0.0.1:11435 (Docker).

## Was die App kann
- **Plan:** „Heute / Als Nächstes" oben mit dem letzten Foto vom Gericht. Pro Tag „Selbst aussuchen" oder
  „Zufällig tauschen". Gerichte mit Vorratszutaten und 👍 der Kinder werden bevorzugt; mögen es alle
  Kinder nicht (👎), fliegt es aus dem Plan.
- **Rezepte:** Suche, Filter, Preise; „+ Eigenes Rezept" von Hand oder per Link (Link-Import am PC).
- **Einkauf:** Abhaken, Preis je Artikel, „hab ich" schiebt in den Vorrat, eigene Artikel dazuschreiben.
  Grundzutaten (Einstellungen) fehlen auf der Liste; bei „2x einkaufen" kommt Frisches ab Donnerstag in einen zweiten Einkauf.
  „An Bring! senden" überträgt die offene Liste in die eigene Bring!-Liste (Angebote/Prospekte dann in Bring!).
- **Preis-Vergleich & Pfand:** Kacheln zeigen den letzten Bon-Preis inkl. Pfand (Pfandzeile direkt darunter auf dem
  Bon) und „bei X 0,30 € günstiger“, wenn ein anderer Laden billiger war. „Nach Laden aufteilen“ gruppiert die Liste
  nach dem günstigsten Laden; die Reihenfolge der Bereiche lässt sich anpassen. Eigene Artikel können „alle 1/2/4
  Wochen“ von selbst wiederkommen.
- **Reste:** Lebensmittel im Vorrat mit „hält noch …“ → Karte „Reste verwerten“ auf der Übersicht, neue Pläne
  bevorzugen passende Gerichte.
- **Ausgaben:** Bon fotografieren (auch am iPhone) → „Auslesen" (am PC lokal, unterwegs per Gemini) → Positionen werden in
  Wochenplan / Grundbedarf / Nicht im Plan / Verzichtbar / Pfand sortiert (antippen zum Ändern),
  Preise lassen sich mit einem Knopf für die Rezepte übernehmen. Wochenübersicht mit Budget-Ampel, Monatsvergleich
  mit Trend bei „verzichtbar“ und den teuersten Artikeln.
- **Mehr:** Vorrat, Preise (eigene Preise überschreiben die Liste), Konto und Abgleich, Einstellungen
  (inkl. Kindernamen), Sicherung als Datei.

- **Kochen & Woche:** Kochmodus (Schritt für Schritt, Timer, Bildschirm bleibt an), Tage per „Verschieben“ tauschen,
  Gäste pro Tag (Mengen, Liste, Preis passen sich an), Ausgewogenheit der Woche, Saison-Gemüse wird bevorzugt,
  Wunschessen der Kinder (⭐ im Rezept) kommt in den nächsten Plan.
- **Automatiken:** Gekocht → Zutaten im Vorrat abziehen; Bon ausgelesen → Liste abhaken, gezählten Vorrat auffüllen,
  Preise übernehmen; Vorrat mit „automatisch auf die Liste“ landet bald leer von selbst auf der Einkaufsliste.
  Alles mit „Rückgängig“.
- **Breite Bildschirme:** ab 1280 px Hauptspalte + Seitenspalte (Einkauf, Ausgaben, Rezepte, KI, Mehr), ab 1600 px
  die ganze Woche nebeneinander.

- **Familie:** „Wer isst mit?“ (Einstellungen) – Personen mit Portion (1, ¾, ½) und Abneigungen; im Plan pro Tag
  abhaken, wer da ist. Familien-Abstimmung (Woche → 10 Vorschläge, jede Person „will ich / egal / nein“) fließt in
  den nächsten Plan. Wochen-Rückblick ab Freitag (gekocht, Kosten, Liebling, Übriges, Nicht-Gekochtes übernehmen).
- **Kochen:** Kochmodus mit Zeitplan ab der Essenszeit (rückwärts gerechnet, ±5 Min.) und mehreren Timern.
- **Mit Foto/KI:** Rezept vom Kochbuch-Foto, aus Text/Diktat oder von Seiten ohne Rezept-Daten (Instagram, TikTok,
  YouTube: Titel + Beschreibung); Kühlschrank-Foto → Vorrat + „Daraus möglich“. Am PC lokal (PC-Helfer `/bild`),
  unterwegs Gemini (Funktion `ki`, Modus `bild`).

## Konten, Besitzer und Abgleich
Anmeldung mit E-Mail und Passwort (Supabase Auth). Neue Konten sind gesperrt, bis der Besitzer sie unter
Mehr → Konto freigibt; dort kann er Konten auch sperren oder „in meinen Haushalt" holen (gemeinsame Woche).
Besitzer wird, wer als Erstes mit dem alten Haushalts-Code (Gerät aus der Zeit vor den Konten) anmeldet –
dabei werden die alten Daten übernommen. Schema: `supabase-einrichtung.sql`, dann `supabase-konten.sql`.
Abgleich automatisch pro Haushalt (Start, Rückkehr in die App, jede Minute, kurz nach jeder Änderung).

## KI-Assistent
- Am PC: PC-Helfer → lokales Ollama (`qwen3:14b`, Bons mit `qwen2.5vl:7b`).
- Unterwegs: Supabase Edge Function `supabase/functions/ki` → Google Gemini. Braucht das Secret
  `GEMINI_API_KEY` (kostenloser Schlüssel aus Google AI Studio) unter Edge Functions → Secrets.
  Nur angemeldete, freigegebene Konten dürfen sie nutzen.

## An Bring! senden
- Supabase Edge Function `supabase/functions/bring` trägt die offene Einkaufsliste über die inoffizielle
  Bring!-Schnittstelle in die **eigene** Bring!-Liste ein (TO_PURCHASE). Nur angemeldete, freigegebene Konten.
- Secrets unter Edge Functions → Secrets: `BRING_EMAIL`, `BRING_PASSWORD` (Pflicht), optional
  `BRING_LIST_UUID` (bestimmte Liste statt Standardliste), `BRING_COUNTRY` (Standard `DE`).
- Die Bring!-Zugangsdaten liegen nur auf dem Server; die App sieht sie nie. Prospekte/Angebote bleiben in
  Bring! (Anbieter Offerista) und werden bewusst **nicht** abgegriffen.
- Hinweis: inoffizielle Schnittstelle – kann sich ändern, wenn Bring! sie umbaut.

## Kalender-Abo (Erinnerungen aufs iPhone)
- Einstellungen → Einkaufstage + Uhrzeit wählen → „Kalender-Link holen“ → „Im Kalender abonnieren“.
- Termine: Einkaufstag mit offenem Betrag (Erinnerung am Vorabend 19 Uhr und 1 Std. vorher), „Bald leer“ aus dem
  Vorrat, „Aufbrauchen“ für Reste mit Haltbarkeit, regelmäßige Artikel.
- Die App schreibt einen Auszug (`calendar`) in den Zustand; die Edge Function `supabase/functions/kalender` liefert
  daraus iCal. Schema: `supabase-kalender.sql`. Bei der Funktion „Verify JWT“ ausschalten (Kalender schickt keinen
  Anmelde-Header) – geschützt über den geheimen Schlüssel im Link.

## Preise
`src/data/prices.ts`: Preis pro Zutat (€/kg, €/l, €/Stück, €/EL, €/TL). Reihenfolge: eigener Preis in der
App (selbst eingetragen oder vom Bon gelernt) → „bon" (eigener Kassenbon 31.10.2026) → „aldi"
(Regalpreis aldi-sued.de) → „schätzung". Portionspreis = anteilige Zutaten + 0,10 € Grundzutaten.

## Entwickeln
```bash
npm install
npx expo start --web     # Entwicklung im Browser
npx expo export -p web   # statischer Build nach dist/ (Basis-Pfad /MeinWochenplan, siehe app.json)
npx tsc --noEmit         # Typprüfung
```
Aufbau: `App.tsx` (Navigation), `src/screens/` (Bildschirme), `src/logic/` (Generator, Einkaufsliste,
Vorrat, Bon-Zuordnung, Rezept-Import), `src/cloud.ts`, `src/photos.ts` (IndexedDB), `src/data/`.
