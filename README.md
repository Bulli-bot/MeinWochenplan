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
- **Einkauf:** Abhaken, Preis je Artikel, „hab ich" schiebt in den Vorrat. „An Bring! übergeben" kopiert
  die offene Liste – in Bring! ins Eingabefeld einfügen, jede Zeile wird ein Artikel.
- **Ausgaben:** Bon fotografieren (auch am iPhone) → am PC „Am PC auslesen" → Positionen werden in
  Wochenplan / Grundbedarf / Nicht im Plan / Verzichtbar / Pfand sortiert (antippen zum Ändern),
  Preise lassen sich mit einem Knopf für die Rezepte übernehmen. Wochenübersicht mit Budget-Ampel.
- **Mehr:** Vorrat, Preise (eigene Preise überschreiben die Liste), Cloud-Sync, Einstellungen
  (inkl. Kindernamen), Sicherung als Datei.

## Cloud-Sync (PC ↔ iPhone)
Eigenes kostenloses Supabase-Projekt: `supabase-einrichtung.sql` im SQL-Editor ausführen, dann in der App
unter Mehr → Cloud-Sync Project URL, Publishable/anon key und Haushalts-Code eintragen. Danach
„Verbindungs-Link kopieren" und auf dem iPhone öffnen. Abgleich automatisch (Start, Rückkehr in die App,
jede Minute, kurz nach jeder Änderung); bei Konflikten gewinnt die jüngere Änderung. Fotos liegen
verkleinert in der Tabelle `wochenplan_fotos`. Zugriff nur über die SQL-Funktionen mit dem Haushalts-Code.

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
