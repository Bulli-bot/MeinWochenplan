# MeinWochenplan

Private Expo-App: Wochenplan aus eigenen Rezepten erzeugen, passend zu Budget, Haushalt,
Kochtagen, Ernährung, Allergenen und Küchengeräten – mit Einkaufsliste.

## Starten
```bash
npm install
npx expo start          # Handy: Expo Go, QR-Code scannen
npx expo start --web    # im Browser
```

## Aufbau
- `src/data/recipes.ts` – eigene Rezepte (Mengen pro Portion, Preis pro Portion). Hier ergänzen.
- `src/logic/generator.ts` – Plan-Generator: Filter → Punkte → gierige Auswahl mit Budget und
  Abwechslungsgrenzen (max. 2× gleiches Protein / gleiche Beilage) → Reihenfolge ohne
  Wiederholung hintereinander. Pro Tag „Zufällig tauschen" (zufällig aus den 8 besten, schon
  gezeigte Gerichte werden übersprungen) oder „Selbst aussuchen" (Rezeptliste mit Budgetanzeige).

## Woche zwischen PC und Handy
Unten im Plan (und beim ersten Start): „Woche speichern" / „Woche laden". Der Expo-Entwicklungsserver
legt die Woche dafür als `data/sync-state.json` auf dem PC ab (Zusatz in `metro.config.js`, Pfad
`/sync/state`). Funktioniert im LAN- und im Tunnel-Modus, solange Expo auf dem PC läuft.
Nach Änderungen an `metro.config.js` Expo neu starten.

## Preise
`src/data/prices.ts` enthält einen Preis pro Zutat (€/kg, €/l, €/Stück, €/EL oder €/TL). Der
Portionspreis jedes Rezepts wird daraus berechnet (anteilig, plus 0,10 € für Salz/Öl/Gewürze).
- Quelle „bon": tatsächlich bezahlt laut eigenem Kassenbon (ALDI SÜD / EDEKA, 31.10.2026) – hat Vorrang.
- Quelle „aldi": Regalpreis aus dem Online-Sortiment von aldi-sued.de, Stand 31.10.2026, keine Aktionspreise.
- Quelle „schätzung": dort ohne Online-Preis (v. a. loses Obst und Gemüse) – grob geschätzt.
- Lidl veröffentlicht online keine Ladenpreise für Lebensmittel, daher nicht enthalten.
Zum Aktualisieren nur `prices.ts` und `PRICE_DATE` ändern.
- `src/logic/shoppingList.ts` – Zutaten zusammenführen, skalieren, runden, nach Kategorie gruppieren.
- `src/screens/` – Einstellungen, Plan, Rezeptübersicht (Suche, Filter, Preise), Rezept, Einkaufsliste.
- `src/storage.ts` – alles lokal in AsyncStorage, kein Server, kein Login.

## Ideen für später
Favoriten-Ansicht, mehr Rezepte, Haushalt teilen, Erinnerung am Wochenende,
Preise pro Supermarkt.
