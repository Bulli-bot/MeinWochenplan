import type { Category, CustomRecipe, Ingredient, Recipe, Unit, UserPrice } from '../types';
import { BASICS_PER_PORTION, ingredientCost, priceFor, setUserPrices } from './prices';

// Eigene Beispielrezepte. Mengen pro Portion; der Preis wird unten aus den Zutatenpreisen (prices.ts) berechnet.
type RawRecipe = Omit<Recipe, 'pricePerPortion' | 'estimatedIngredients'>;
const i = (name: string, amount: number, unit: Unit, category: Category): Ingredient => ({ name, amount, unit, category });

const GEM: Category = 'Obst & Gemüse';
const FLF: Category = 'Fleisch & Fisch';
const KUE: Category = 'Kühlregal';
const VOR: Category = 'Vorrat';
const GEW: Category = 'Gewürze & Saucen';
const BRO: Category = 'Brot & Backwaren';
const TK: Category = 'Tiefkühl';

const RAW_RECIPES: RawRecipe[] = [
  {
    id: 'haehnchen-curry-reis', name: 'Hähnchen-Curry mit Reis', minutes: 30,
    protein: 'huhn', carb: 'reis', vibes: ['international', 'proteinreich'], equipment: ['herd'], allergens: [],
    ingredients: [i('Hähnchenbrust', 150, 'g', FLF), i('Basmatireis', 75, 'g', VOR), i('Kokosmilch', 100, 'ml', VOR),
      i('Currypaste', 1, 'EL', GEW), i('Paprika', 0.5, 'Stück', GEM), i('Zwiebel', 0.5, 'Stück', GEM)],
    steps: ['Reis nach Packungsangabe kochen.', 'Zwiebel und Paprika würfeln, Hähnchen in Stücke schneiden.',
      'Hähnchen anbraten, Gemüse dazugeben.', 'Currypaste kurz mitrösten, mit Kokosmilch ablöschen und 10 Minuten köcheln.'],
  },
  {
    id: 'spaghetti-bolognese', name: 'Spaghetti Bolognese', minutes: 35,
    protein: 'rind', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten'],
    ingredients: [i('Rinderhack', 125, 'g', FLF), i('Spaghetti', 100, 'g', VOR), i('Passierte Tomaten', 150, 'ml', VOR),
      i('Zwiebel', 0.5, 'Stück', GEM), i('Möhre', 0.5, 'Stück', GEM), i('Knoblauch', 1, 'Stück', GEM)],
    steps: ['Zwiebel, Möhre und Knoblauch fein würfeln.', 'Hack krümelig anbraten, Gemüse mitbraten.',
      'Tomaten dazugeben, 20 Minuten köcheln, würzen.', 'Spaghetti kochen und mit der Sauce servieren.'],
  },
  {
    id: 'ofengemuese-feta', name: 'Ofengemüse mit Feta', minutes: 35,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['leicht'], equipment: ['ofen'], allergens: ['milch'],
    ingredients: [i('Zucchini', 0.5, 'Stück', GEM), i('Paprika', 1, 'Stück', GEM), i('Rote Zwiebel', 0.5, 'Stück', GEM),
      i('Feta', 75, 'g', KUE), i('Olivenöl', 1, 'EL', VOR)],
    steps: ['Ofen auf 200 °C vorheizen.', 'Gemüse grob schneiden, mit Öl, Salz und Pfeffer mischen.',
      'Auf dem Blech 20 Minuten backen.', 'Feta darüberbröseln und 10 Minuten weiterbacken.'],
  },
  {
    id: 'lachs-kartoffeln-brokkoli', name: 'Lachs mit Kartoffeln und Brokkoli', minutes: 30,
    protein: 'fisch', carb: 'kartoffeln', vibes: ['proteinreich', 'leicht'], equipment: ['herd', 'ofen'], allergens: ['fisch'],
    ingredients: [i('Lachsfilet', 125, 'g', TK), i('Kartoffeln', 250, 'g', GEM), i('Brokkoli', 0.5, 'Stück', GEM), i('Zitrone', 0.25, 'Stück', GEM)],
    steps: ['Kartoffeln kochen.', 'Lachs würzen und bei 200 °C ca. 15 Minuten im Ofen garen.',
      'Brokkoli in den letzten 5 Minuten zu den Kartoffeln geben.', 'Mit Zitrone servieren.'],
  },
  {
    id: 'linsen-dal', name: 'Rotes Linsen-Dal', minutes: 25,
    protein: 'vegan', carb: 'reis', vibes: ['international', 'schnell'], equipment: ['herd'], allergens: [],
    ingredients: [i('Rote Linsen', 80, 'g', VOR), i('Basmatireis', 60, 'g', VOR), i('Kokosmilch', 100, 'ml', VOR),
      i('Gehackte Tomaten', 100, 'g', VOR), i('Zwiebel', 0.5, 'Stück', GEM), i('Currypulver', 1, 'TL', GEW)],
    steps: ['Reis kochen.', 'Zwiebel anschwitzen, Currypulver kurz mitrösten.',
      'Linsen, Tomaten, Kokosmilch und etwas Wasser dazugeben.', '15 Minuten köcheln, bis die Linsen weich sind.'],
  },
  {
    id: 'schweinegeschnetzeltes', name: 'Geschnetzeltes mit Bandnudeln', minutes: 30,
    protein: 'schwein', carb: 'nudeln', vibes: ['deftig'], equipment: ['herd'], allergens: ['gluten', 'milch', 'ei'],
    ingredients: [i('Schweineschnitzel', 150, 'g', FLF), i('Bandnudeln', 100, 'g', VOR), i('Champignons', 100, 'g', GEM),
      i('Kochsahne', 75, 'ml', KUE), i('Zwiebel', 0.5, 'Stück', GEM)],
    steps: ['Nudeln kochen.', 'Fleisch in Streifen schneiden und scharf anbraten, herausnehmen.',
      'Zwiebel und Pilze braten, mit Sahne ablöschen.', 'Fleisch zurückgeben, würzen, mit den Nudeln servieren.'],
  },
  {
    id: 'chili-sin-carne', name: 'Chili sin Carne', minutes: 35,
    protein: 'vegan', carb: 'reis', vibes: ['deftig', 'international'], equipment: ['herd'], allergens: [],
    ingredients: [i('Kidneybohnen', 120, 'g', VOR), i('Mais', 70, 'g', VOR), i('Gehackte Tomaten', 200, 'g', VOR),
      i('Paprika', 0.5, 'Stück', GEM), i('Zwiebel', 0.5, 'Stück', GEM), i('Basmatireis', 60, 'g', VOR), i('Chilipulver', 1, 'TL', GEW)],
    steps: ['Reis kochen.', 'Zwiebel und Paprika anbraten, Chilipulver dazugeben.',
      'Tomaten, Bohnen und Mais zugeben.', '20 Minuten köcheln und abschmecken.'],
  },
  {
    id: 'haehnchen-airfryer-wedges', name: 'Knuspriges Hähnchen mit Wedges', minutes: 30,
    protein: 'huhn', carb: 'kartoffeln', vibes: ['kinder', 'proteinreich', 'deftig'], equipment: ['airfryer'], allergens: [],
    ingredients: [i('Hähnchenschenkel', 200, 'g', FLF), i('Kartoffeln', 250, 'g', GEM), i('Paprikapulver', 1, 'TL', GEW), i('Gurke', 0.25, 'Stück', GEM)],
    steps: ['Kartoffeln in Spalten schneiden, mit Öl und Paprikapulver mischen.',
      'Hähnchen würzen.', 'Beides im Airfryer bei 190 °C ca. 25 Minuten garen, zwischendurch wenden.', 'Mit Gurkenscheiben servieren.'],
  },
  {
    id: 'shakshuka', name: 'Shakshuka mit Brot', minutes: 25,
    protein: 'vegetarisch', carb: 'brot', vibes: ['schnell', 'international'], equipment: ['herd'], allergens: ['ei', 'gluten'],
    ingredients: [i('Eier', 2, 'Stück', KUE), i('Gehackte Tomaten', 200, 'g', VOR), i('Paprika', 0.5, 'Stück', GEM),
      i('Zwiebel', 0.5, 'Stück', GEM), i('Fladenbrot', 0.25, 'Stück', BRO), i('Kreuzkümmel', 1, 'TL', GEW)],
    steps: ['Zwiebel und Paprika anbraten, Kreuzkümmel dazugeben.', 'Tomaten zugeben und 10 Minuten einkochen.',
      'Mulden formen, Eier hineinschlagen, zugedeckt stocken lassen.', 'Mit Brot servieren.'],
  },
  {
    id: 'thunfisch-pasta', name: 'Thunfisch-Tomaten-Pasta', minutes: 20,
    protein: 'fisch', carb: 'nudeln', vibes: ['schnell'], equipment: ['herd'], allergens: ['fisch', 'gluten'],
    ingredients: [i('Penne', 100, 'g', VOR), i('Thunfisch (Dose)', 75, 'g', VOR), i('Passierte Tomaten', 150, 'ml', VOR),
      i('Knoblauch', 1, 'Stück', GEM), i('Kapern', 1, 'TL', GEW)],
    steps: ['Penne kochen.', 'Knoblauch anschwitzen, Tomaten dazugeben.', 'Thunfisch und Kapern unterrühren, 5 Minuten köcheln.', 'Mit den Nudeln mischen.'],
  },
  {
    id: 'rindergulasch', name: 'Rindergulasch mit Kartoffeln', minutes: 90,
    protein: 'rind', carb: 'kartoffeln', vibes: ['deftig'], equipment: ['herd'], allergens: [],
    ingredients: [i('Rindergulasch', 175, 'g', FLF), i('Zwiebel', 1, 'Stück', GEM), i('Tomatenmark', 1, 'EL', VOR),
      i('Kartoffeln', 250, 'g', GEM), i('Paprikapulver', 1, 'TL', GEW)],
    steps: ['Fleisch portionsweise scharf anbraten.', 'Zwiebeln dazugeben, Tomatenmark und Paprikapulver mitrösten.',
      'Mit Wasser ablöschen und 75 Minuten schmoren.', 'Kartoffeln kochen und dazu servieren.'],
  },
  {
    id: 'gemuese-reispfanne', name: 'Asia-Gemüsepfanne mit Tofu', minutes: 25,
    protein: 'vegan', carb: 'reis', vibes: ['schnell', 'leicht', 'international'], equipment: ['herd'], allergens: ['soja', 'sesam'],
    ingredients: [i('Tofu', 100, 'g', KUE), i('Basmatireis', 70, 'g', VOR), i('Brokkoli', 0.5, 'Stück', GEM),
      i('Möhre', 1, 'Stück', GEM), i('Sojasauce', 2, 'EL', GEW), i('Sesamöl', 1, 'TL', GEW)],
    steps: ['Reis kochen.', 'Tofu würfeln und knusprig braten.', 'Gemüse dazugeben und bissfest braten.', 'Mit Sojasauce und Sesamöl abschmecken.'],
  },
  {
    id: 'kartoffelsuppe', name: 'Kartoffelsuppe mit Würstchen', minutes: 35,
    protein: 'schwein', carb: 'kartoffeln', vibes: ['deftig'], equipment: ['herd'], allergens: [],
    ingredients: [i('Kartoffeln', 250, 'g', GEM), i('Möhre', 1, 'Stück', GEM), i('Lauch', 0.5, 'Stück', GEM),
      i('Wiener Würstchen', 2, 'Stück', KUE), i('Gemüsebrühe', 400, 'ml', VOR)],
    steps: ['Gemüse schälen und würfeln.', 'In Brühe 20 Minuten weich kochen.', 'Teilweise pürieren, würzen.', 'Würstchen in Scheiben darin erwärmen.'],
  },
  {
    id: 'haehnchen-wrap', name: 'Hähnchen-Wraps', minutes: 20,
    protein: 'huhn', carb: 'brot', vibes: ['kinder', 'schnell', 'proteinreich'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Hähnchenbrust', 125, 'g', FLF), i('Tortilla-Wraps', 2, 'Stück', BRO), i('Eisbergsalat', 0.25, 'Stück', GEM),
      i('Tomate', 1, 'Stück', GEM), i('Joghurt', 50, 'g', KUE)],
    steps: ['Hähnchen in Streifen schneiden und braten.', 'Salat und Tomate schneiden.', 'Joghurt mit Salz und Pfeffer verrühren.', 'Wraps füllen und rollen.'],
  },
  {
    id: 'gnocchi-tomate', name: 'Gnocchi in Tomaten-Spinat-Sauce', minutes: 20,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Gnocchi', 200, 'g', KUE), i('Blattspinat', 75, 'g', TK), i('Passierte Tomaten', 150, 'ml', VOR), i('Parmesan', 15, 'g', KUE)],
    steps: ['Gnocchi in der Pfanne goldbraun braten.', 'Tomaten und Spinat dazugeben.', '5 Minuten köcheln, würzen.', 'Mit Parmesan servieren.'],
  },
  {
    id: 'fischstaebchen-kartoffelpueree', name: 'Fischstäbchen mit Püree', minutes: 25,
    protein: 'fisch', carb: 'kartoffeln', vibes: ['kinder', 'schnell'], equipment: ['herd', 'ofen'], allergens: ['fisch', 'gluten', 'milch'],
    ingredients: [i('Fischstäbchen', 5, 'Stück', TK), i('Kartoffeln', 250, 'g', GEM), i('Milch', 50, 'ml', KUE), i('Erbsen', 80, 'g', TK)],
    steps: ['Kartoffeln kochen, mit Milch zu Püree stampfen.', 'Fischstäbchen nach Packung im Ofen backen.', 'Erbsen kurz kochen.', 'Alles zusammen servieren.'],
  },
  {
    id: 'kichererbsen-curry', name: 'Kichererbsen-Spinat-Curry', minutes: 25,
    protein: 'vegan', carb: 'reis', vibes: ['international', 'leicht'], equipment: ['herd'], allergens: [],
    ingredients: [i('Kichererbsen', 120, 'g', VOR), i('Blattspinat', 75, 'g', TK), i('Kokosmilch', 100, 'ml', VOR),
      i('Basmatireis', 60, 'g', VOR), i('Currypaste', 1, 'EL', GEW)],
    steps: ['Reis kochen.', 'Currypaste in etwas Öl anrösten.', 'Kichererbsen, Kokosmilch und Spinat dazugeben.', '10 Minuten köcheln.'],
  },
  {
    id: 'frikadellen-gemuese', name: 'Frikadellen mit Möhrengemüse', minutes: 35,
    protein: 'rind', carb: 'kartoffeln', vibes: ['kinder', 'deftig', 'proteinreich'], equipment: ['herd'], allergens: ['ei', 'gluten'],
    ingredients: [i('Rinderhack', 150, 'g', FLF), i('Ei', 0.5, 'Stück', KUE), i('Paniermehl', 1, 'EL', VOR),
      i('Möhre', 2, 'Stück', GEM), i('Kartoffeln', 200, 'g', GEM)],
    steps: ['Hack mit Ei, Paniermehl, Salz und Pfeffer verkneten, Frikadellen formen.', 'Von beiden Seiten je 6 Minuten braten.',
      'Kartoffeln und Möhren kochen.', 'Zusammen servieren.'],
  },
  {
    id: 'mikrowellen-ofenkartoffel', name: 'Gefüllte Ofenkartoffel', minutes: 15,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['schnell', 'leicht'], equipment: ['mikrowelle'], allergens: ['milch'],
    ingredients: [i('Große Kartoffel', 1, 'Stück', GEM), i('Kräuterquark', 75, 'g', KUE), i('Mais', 50, 'g', VOR), i('Schnittlauch', 1, 'EL', GEM)],
    steps: ['Kartoffel einstechen und ca. 8 Minuten in der Mikrowelle garen, einmal wenden.', 'Aufschneiden und etwas auflockern.',
      'Mit Quark, Mais und Schnittlauch füllen.'],
  },
  {
    id: 'lachs-reis-bowl', name: 'Lachs-Reis-Bowl', minutes: 25,
    protein: 'fisch', carb: 'reis', vibes: ['proteinreich', 'leicht', 'international'], equipment: ['herd'], allergens: ['fisch', 'soja', 'sesam'],
    ingredients: [i('Lachsfilet', 125, 'g', TK), i('Sushireis', 75, 'g', VOR), i('Gurke', 0.25, 'Stück', GEM),
      i('Avocado', 0.5, 'Stück', GEM), i('Sojasauce', 1, 'EL', GEW), i('Sesam', 1, 'TL', VOR)],
    steps: ['Reis kochen.', 'Lachs in der Pfanne braten und zerteilen.', 'Gurke und Avocado schneiden.', 'Alles in Schalen anrichten, mit Sojasauce und Sesam.'],
  },
  {
    id: 'pfannkuchen-apfel', name: 'Apfelpfannkuchen', minutes: 25,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch', 'ei'],
    ingredients: [i('Mehl', 75, 'g', VOR), i('Milch', 125, 'ml', KUE), i('Eier', 1, 'Stück', KUE), i('Apfel', 1, 'Stück', GEM)],
    steps: ['Mehl, Milch und Eier zu einem glatten Teig verrühren.', 'Apfel in dünne Scheiben schneiden.',
      'Teig portionsweise in die Pfanne geben, Apfelscheiben darauflegen.', 'Von beiden Seiten goldbraun backen.'],
  },
  {
    id: 'putenpfanne-paprika', name: 'Putenpfanne mit Paprika und Reis', minutes: 25,
    protein: 'huhn', carb: 'reis', vibes: ['proteinreich', 'leicht'], equipment: ['herd'], allergens: [],
    ingredients: [i('Putenbrust', 150, 'g', FLF), i('Basmatireis', 70, 'g', VOR), i('Paprika', 1, 'Stück', GEM), i('Frühlingszwiebel', 1, 'Stück', GEM)],
    steps: ['Reis kochen.', 'Pute in Streifen schneiden und anbraten.', 'Paprika und Frühlingszwiebeln dazugeben.', 'Würzen und mit Reis servieren.'],
  },
  {
    id: 'ofen-haehnchen-gemuese', name: 'Blech-Hähnchen mit Ofengemüse', minutes: 45,
    protein: 'huhn', carb: 'kartoffeln', vibes: ['deftig', 'proteinreich'], equipment: ['ofen'], allergens: [],
    ingredients: [i('Hähnchenschenkel', 200, 'g', FLF), i('Kartoffeln', 200, 'g', GEM), i('Möhre', 1, 'Stück', GEM),
      i('Rote Zwiebel', 0.5, 'Stück', GEM), i('Rosmarin', 1, 'TL', GEW)],
    steps: ['Ofen auf 200 °C vorheizen.', 'Gemüse schneiden, mit Öl und Rosmarin aufs Blech geben.',
      'Hähnchen würzen und darauflegen.', '35–40 Minuten backen.'],
  },
  {
    id: 'minestrone', name: 'Minestrone', minutes: 35,
    protein: 'vegan', carb: 'nudeln', vibes: ['leicht'], equipment: ['herd'], allergens: ['gluten'],
    ingredients: [i('Suppennudeln', 40, 'g', VOR), i('Weiße Bohnen', 80, 'g', VOR), i('Zucchini', 0.5, 'Stück', GEM),
      i('Möhre', 1, 'Stück', GEM), i('Gehackte Tomaten', 150, 'g', VOR), i('Gemüsebrühe', 300, 'ml', VOR)],
    steps: ['Gemüse klein würfeln und anschwitzen.', 'Tomaten und Brühe dazugeben, 15 Minuten köcheln.',
      'Nudeln und Bohnen zugeben und weitere 10 Minuten garen.', 'Abschmecken.'],
  },
  {
    id: 'kaesespaetzle', name: 'Käsespätzle mit Röstzwiebeln', minutes: 25,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd', 'ofen'], allergens: ['gluten', 'milch', 'ei'],
    ingredients: [i('Spätzle (Kühlregal)', 200, 'g', KUE), i('Bergkäse', 60, 'g', KUE), i('Zwiebel', 1, 'Stück', GEM), i('Butter', 1, 'EL', KUE), i('Feldsalat', 50, 'g', GEM)],
    steps: ['Zwiebeln in Ringe schneiden und in Butter goldbraun braten.', 'Spätzle in der Pfanne erhitzen.',
      'Lagenweise mit geriebenem Käse in eine Form geben und 5 Minuten im heißen Ofen schmelzen lassen.', 'Mit Röstzwiebeln und Feldsalat servieren.'],
  },
  {
    id: 'haehnchen-teriyaki-airfryer', name: 'Teriyaki-Hähnchen aus dem Airfryer', minutes: 25,
    protein: 'huhn', carb: 'reis', vibes: ['international', 'proteinreich'], equipment: ['airfryer', 'herd'], allergens: ['soja', 'sesam', 'gluten'],
    ingredients: [i('Hähnchenschenkel', 180, 'g', FLF), i('Basmatireis', 70, 'g', VOR), i('Teriyakisauce', 2, 'EL', GEW),
      i('Brokkoli', 0.5, 'Stück', GEM), i('Sesam', 1, 'TL', VOR)],
    steps: ['Hähnchen in Stücke schneiden und mit der Hälfte der Sauce mischen.', 'Im Airfryer bei 200 °C 15 Minuten garen.',
      'Reis kochen, Brokkoli die letzten 4 Minuten mitgaren.', 'Mit restlicher Sauce und Sesam servieren.'],
  },
  {
    id: 'kartoffel-blumenkohl-curry', name: 'Kartoffel-Blumenkohl-Curry', minutes: 35,
    protein: 'vegan', carb: 'kartoffeln', vibes: ['international', 'leicht'], equipment: ['herd'], allergens: [],
    ingredients: [i('Kartoffeln', 200, 'g', GEM), i('Blumenkohl', 0.25, 'Stück', GEM), i('Kokosmilch', 100, 'ml', VOR),
      i('Gehackte Tomaten', 100, 'g', VOR), i('Currypulver', 1, 'TL', GEW), i('Zwiebel', 0.5, 'Stück', GEM)],
    steps: ['Kartoffeln würfeln, Blumenkohl in Röschen teilen.', 'Zwiebel und Curry anschwitzen.',
      'Gemüse, Tomaten und Kokosmilch zugeben.', 'Zugedeckt 20 Minuten köcheln, bis alles weich ist.'],
  },
  {
    id: 'chili-con-carne', name: 'Chili con Carne', minutes: 40,
    protein: 'rind', carb: 'brot', vibes: ['deftig', 'proteinreich'], equipment: ['herd'], allergens: ['gluten'],
    ingredients: [i('Rinderhack', 125, 'g', FLF), i('Kidneybohnen', 100, 'g', VOR), i('Gehackte Tomaten', 200, 'g', VOR),
      i('Paprika', 0.5, 'Stück', GEM), i('Zwiebel', 0.5, 'Stück', GEM), i('Baguette', 0.25, 'Stück', BRO), i('Chilipulver', 1, 'TL', GEW)],
    steps: ['Hack mit Zwiebeln krümelig braten.', 'Paprika und Chilipulver zugeben.',
      'Tomaten und Bohnen dazugeben, 25 Minuten köcheln.', 'Mit Baguette servieren.'],
  },
  {
    id: 'ofenlachs-gemuese-gf', name: 'Ofenlachs mit Süßkartoffeln', minutes: 35,
    protein: 'fisch', carb: 'kartoffeln', vibes: ['leicht', 'proteinreich'], equipment: ['ofen'], allergens: ['fisch'],
    ingredients: [i('Lachsfilet', 125, 'g', TK), i('Süßkartoffel', 200, 'g', GEM), i('Grüne Bohnen', 100, 'g', TK), i('Zitrone', 0.25, 'Stück', GEM), i('Olivenöl', 1, 'EL', VOR)],
    steps: ['Ofen auf 200 °C vorheizen.', 'Süßkartoffel würfeln, mit Öl mischen und 15 Minuten backen.',
      'Lachs und Bohnen aufs Blech geben, 15 Minuten weiterbacken.', 'Mit Zitrone beträufeln.'],
  },
  {
    id: 'pilzrisotto', name: 'Pilzrisotto', minutes: 35,
    protein: 'vegetarisch', carb: 'reis', vibes: ['deftig'], equipment: ['herd'], allergens: ['milch'],
    ingredients: [i('Risottoreis', 80, 'g', VOR), i('Champignons', 125, 'g', GEM), i('Gemüsebrühe', 300, 'ml', VOR),
      i('Parmesan', 20, 'g', KUE), i('Zwiebel', 0.5, 'Stück', GEM)],
    steps: ['Zwiebel und Pilze anbraten.', 'Reis kurz mitrösten.', 'Nach und nach Brühe zugeben und 20 Minuten unter Rühren garen.', 'Parmesan unterziehen.'],
  },
  {
    id: 'bratkartoffeln-spiegelei', name: 'Bratkartoffeln mit Spiegelei', minutes: 25,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'deftig', 'schnell'], equipment: ['herd'], allergens: ['ei'],
    ingredients: [i('Kartoffeln (festkochend)', 250, 'g', GEM), i('Eier', 2, 'Stück', KUE), i('Zwiebel', 0.5, 'Stück', GEM), i('Gewürzgurken', 2, 'Stück', VOR)],
    steps: ['Kartoffeln in Scheiben schneiden und in Öl langsam knusprig braten.', 'Zwiebel die letzten 5 Minuten zugeben.',
      'Spiegeleier braten.', 'Mit Gewürzgurken servieren.'],
  },
  {
    id: 'putengeschnetzeltes-gf', name: 'Puten-Paprika-Pfanne mit Kartoffeln', minutes: 30,
    protein: 'huhn', carb: 'kartoffeln', vibes: ['leicht', 'proteinreich'], equipment: ['herd'], allergens: [],
    ingredients: [i('Putenbrust', 150, 'g', FLF), i('Kartoffeln', 200, 'g', GEM), i('Paprika', 1, 'Stück', GEM), i('Zucchini', 0.5, 'Stück', GEM)],
    steps: ['Kartoffeln kochen.', 'Pute in Streifen schneiden und anbraten.', 'Paprika und Zucchini mitbraten und würzen.', 'Mit den Kartoffeln servieren.'],
  },
  {
    id: 'gyros-pfanne', name: 'Gyros-Pfanne mit Tzatziki', minutes: 25,
    protein: 'schwein', carb: 'reis', vibes: ['international', 'proteinreich'], equipment: ['herd'], allergens: ['milch'],
    ingredients: [i('Schweinegeschnetzeltes', 150, 'g', FLF), i('Basmatireis', 70, 'g', VOR), i('Joghurt', 75, 'g', KUE),
      i('Gurke', 0.25, 'Stück', GEM), i('Zwiebel', 0.5, 'Stück', GEM), i('Gyrosgewürz', 1, 'TL', GEW)],
    steps: ['Fleisch mit Gyrosgewürz marinieren.', 'Reis kochen.', 'Fleisch und Zwiebeln scharf anbraten.', 'Gurke raspeln, mit Joghurt und Salz verrühren und dazu servieren.'],
  },
  {
    id: 'tomatensuppe-grilled-cheese', name: 'Tomatensuppe mit Käsetoast', minutes: 20,
    protein: 'vegetarisch', carb: 'brot', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Passierte Tomaten', 250, 'ml', VOR), i('Gemüsebrühe', 100, 'ml', VOR), i('Toastbrot', 2, 'Stück', BRO), i('Gouda', 40, 'g', KUE)],
    steps: ['Tomaten mit Brühe aufkochen und würzen.', 'Toast mit Käse belegen, zusammenklappen.', 'In der Pfanne von beiden Seiten goldbraun braten.', 'Zur Suppe servieren.'],
  },
  {
    id: 'erdnuss-nudeln', name: 'Erdnuss-Nudeln mit Gemüse', minutes: 20,
    protein: 'vegan', carb: 'nudeln', vibes: ['schnell', 'international'], equipment: ['herd'], allergens: ['nuesse', 'soja', 'gluten'],
    ingredients: [i('Mie-Nudeln', 80, 'g', VOR), i('Erdnussbutter', 1, 'EL', VOR), i('Sojasauce', 1, 'EL', GEW),
      i('Möhre', 1, 'Stück', GEM), i('Frühlingszwiebel', 1, 'Stück', GEM)],
    steps: ['Nudeln nach Packung garen.', 'Möhre in feine Streifen schneiden und kurz anbraten.',
      'Erdnussbutter mit Sojasauce und etwas Nudelwasser glatt rühren.', 'Alles vermengen, mit Frühlingszwiebeln bestreuen.'],
  },
  {
    id: 'garnelen-knoblauch-nudeln', name: 'Knoblauch-Garnelen-Linguine', minutes: 20,
    protein: 'fisch', carb: 'nudeln', vibes: ['schnell', 'proteinreich'], equipment: ['herd'], allergens: ['schalentiere', 'gluten'],
    ingredients: [i('Garnelen', 100, 'g', TK), i('Linguine', 100, 'g', VOR), i('Knoblauch', 2, 'Stück', GEM), i('Cherrytomaten', 100, 'g', GEM), i('Olivenöl', 1, 'EL', VOR)],
    steps: ['Nudeln kochen.', 'Knoblauch in Öl anschwitzen, Garnelen 3 Minuten braten.', 'Tomaten halbieren und kurz mitbraten.', 'Mit den Nudeln und etwas Nudelwasser mischen.'],
  },
  {
    id: 'falafel-bowl', name: 'Falafel-Bowl mit Hummus', minutes: 20,
    protein: 'vegan', carb: 'sonstiges', vibes: ['leicht', 'international'], equipment: ['airfryer'], allergens: ['sesam', 'gluten'],
    ingredients: [i('Falafel (Kühlregal)', 5, 'Stück', KUE), i('Hummus', 60, 'g', KUE), i('Bulgur', 60, 'g', VOR),
      i('Gurke', 0.25, 'Stück', GEM), i('Cherrytomaten', 80, 'g', GEM)],
    steps: ['Bulgur mit kochendem Wasser übergießen und 10 Minuten quellen lassen.', 'Falafel im Airfryer bei 190 °C 8 Minuten knusprig backen.',
      'Gemüse schneiden.', 'Alles in Schalen anrichten, Hummus dazu.'],
  },
  {
    id: 'reis-gemuese-mikrowelle', name: 'Schneller Bohnen-Reis-Topf', minutes: 15,
    protein: 'vegan', carb: 'reis', vibes: ['schnell'], equipment: ['mikrowelle'], allergens: [],
    ingredients: [i('Express-Reis', 125, 'g', VOR), i('Kidneybohnen', 80, 'g', VOR), i('Mais', 50, 'g', VOR), i('Salsa', 2, 'EL', GEW), i('Avocado', 0.5, 'Stück', GEM)],
    steps: ['Reis nach Packung in der Mikrowelle erhitzen.', 'Bohnen und Mais abspülen und 1 Minute mit erhitzen.', 'Mit Salsa mischen.', 'Mit Avocado servieren.'],
  },
  {
    id: 'flammkuchen', name: 'Flammkuchen', minutes: 25,
    protein: 'schwein', carb: 'brot', vibes: ['kinder', 'deftig', 'schnell'], equipment: ['ofen'], allergens: ['gluten', 'milch'],
    ingredients: [i('Flammkuchenteig', 0.5, 'Stück', KUE), i('Schmand', 60, 'g', KUE), i('Speckwürfel', 50, 'g', KUE), i('Rote Zwiebel', 0.5, 'Stück', GEM)],
    steps: ['Ofen auf 220 °C vorheizen.', 'Teig ausrollen und mit Schmand bestreichen.', 'Speck und Zwiebelringe verteilen.', '12–15 Minuten knusprig backen.'],
  },
  {
    id: 'linsensuppe', name: 'Linsensuppe mit Würstchen', minutes: 40,
    protein: 'schwein', carb: 'sonstiges', vibes: ['deftig'], equipment: ['herd'], allergens: [],
    ingredients: [i('Tellerlinsen', 80, 'g', VOR), i('Möhre', 1, 'Stück', GEM), i('Kartoffeln', 100, 'g', GEM),
      i('Wiener Würstchen', 1, 'Stück', KUE), i('Gemüsebrühe', 400, 'ml', VOR), i('Essig', 1, 'TL', GEW)],
    steps: ['Gemüse würfeln und anschwitzen.', 'Linsen und Brühe zugeben, 30 Minuten köcheln.', 'Würstchen in Scheiben darin erwärmen.', 'Mit einem Schuss Essig abschmecken.'],
  },
  {
    id: 'zucchini-nudeln-pesto', name: 'Penne mit Zucchini und Pesto', minutes: 20,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['schnell', 'leicht'], equipment: ['herd'], allergens: ['gluten', 'milch', 'nuesse'],
    ingredients: [i('Penne', 100, 'g', VOR), i('Zucchini', 0.5, 'Stück', GEM), i('Pesto', 2, 'EL', GEW), i('Cherrytomaten', 80, 'g', GEM)],
    steps: ['Nudeln kochen.', 'Zucchini würfeln und anbraten.', 'Tomaten halbieren und kurz mitbraten.', 'Mit Pesto und den Nudeln mischen.'],
  },
  {
    id: 'rinderpfanne-reis-gf', name: 'Rinder-Gemüse-Pfanne mit Reis', minutes: 25,
    protein: 'rind', carb: 'reis', vibes: ['proteinreich', 'international'], equipment: ['herd'], allergens: ['soja'],
    ingredients: [i('Rinderhüftsteak', 125, 'g', FLF), i('Basmatireis', 70, 'g', VOR), i('Paprika', 0.5, 'Stück', GEM),
      i('Zuckerschoten', 75, 'g', GEM), i('Sojasauce', 1, 'EL', GEW)],
    steps: ['Reis kochen.', 'Fleisch in dünne Streifen schneiden und sehr heiß kurz anbraten.', 'Gemüse dazugeben und bissfest braten.', 'Mit Sojasauce abschmecken.'],
  },
  {
    id: 'ofen-feta-nudeln', name: 'Ofen-Feta-Pasta', minutes: 30,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['schnell'], equipment: ['ofen', 'herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Fusilli', 100, 'g', VOR), i('Feta', 75, 'g', KUE), i('Cherrytomaten', 150, 'g', GEM), i('Knoblauch', 1, 'Stück', GEM), i('Olivenöl', 1, 'EL', VOR)],
    steps: ['Ofen auf 200 °C vorheizen.', 'Feta in die Mitte einer Form, Tomaten und Knoblauch drumherum, mit Öl beträufeln.',
      '25 Minuten backen, Nudeln kochen.', 'Feta und Tomaten zerdrücken und mit den Nudeln mischen.'],
  },
  {
    id: 'tofu-airfryer-bowl', name: 'Knusper-Tofu-Bowl', minutes: 25,
    protein: 'vegan', carb: 'reis', vibes: ['proteinreich', 'leicht'], equipment: ['airfryer', 'herd'], allergens: ['soja'],
    ingredients: [i('Tofu', 150, 'g', KUE), i('Basmatireis', 70, 'g', VOR), i('Edamame', 75, 'g', TK), i('Möhre', 1, 'Stück', GEM), i('Sojasauce', 1, 'EL', GEW), i('Speisestärke', 1, 'EL', VOR)],
    steps: ['Tofu würfeln, in Stärke wenden.', 'Im Airfryer bei 200 °C 15 Minuten knusprig garen.', 'Reis kochen, Edamame kurz mitgaren.', 'Mit geraspelter Möhre und Sojasauce anrichten.'],
  },
  {
    id: 'kabeljau-senfsauce', name: 'Kabeljau in Senfsauce mit Kartoffeln', minutes: 30,
    protein: 'fisch', carb: 'kartoffeln', vibes: ['leicht'], equipment: ['herd'], allergens: ['fisch', 'milch'],
    ingredients: [i('Kabeljaufilet', 125, 'g', TK), i('Kartoffeln', 250, 'g', GEM), i('Kochsahne', 75, 'ml', KUE), i('Senf', 1, 'EL', GEW), i('Erbsen', 80, 'g', TK)],
    steps: ['Kartoffeln kochen.', 'Sahne mit Senf aufkochen und würzen.', 'Fisch in der Sauce 8 Minuten gar ziehen lassen.', 'Erbsen kurz mitgaren und alles servieren.'],
  },

  // Einfach und kinderfreundlich: milde Würzung, bekannte Zutaten, wenig Arbeit.
  {
    id: 'nudeln-tomatensauce', name: 'Nudeln mit Tomatensoße', minutes: 20,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Spaghetti', 125, 'g', VOR), i('Passierte Tomaten', 125, 'ml', VOR), i('Zwiebel', 0.25, 'Stück', GEM), i('Olivenöl', 1, 'EL', VOR), i('Parmesan', 10, 'g', KUE)],
    steps: ['Nudeln nach Packung kochen.', 'Zwiebel fein würfeln und in Öl glasig dünsten.', 'Passierte Tomaten dazu, 10 Minuten köcheln, mild mit Salz und etwas Zucker abschmecken.', 'Mit den Nudeln mischen und Parmesan darüberstreuen.'],
  },
  {
    id: 'ofen-nuggets-pommes', name: 'Hähnchen-Nuggets mit Ofen-Pommes', minutes: 35,
    protein: 'huhn', carb: 'kartoffeln', vibes: ['kinder', 'proteinreich'], equipment: ['ofen'], allergens: ['gluten', 'ei'],
    ingredients: [i('Hähnchenbrust', 125, 'g', FLF), i('Paniermehl', 3, 'EL', VOR), i('Eier', 0.5, 'Stück', KUE), i('Pommes frites', 150, 'g', TK), i('Ketchup', 1, 'EL', GEW), i('Gurke', 0.25, 'Stück', GEM)],
    steps: ['Ofen auf 220 °C vorheizen.', 'Hähnchen in mundgerechte Stücke schneiden, erst in verquirltem Ei, dann in Paniermehl wenden.', 'Nuggets und Pommes auf ein Blech legen, 20 Minuten backen, einmal wenden.', 'Mit Ketchup und Gurkenstiften servieren.'],
  },
  {
    id: 'blechpizza-schinken', name: 'Blechpizza mit Schinken und Mais', minutes: 30,
    protein: 'schwein', carb: 'brot', vibes: ['kinder'], equipment: ['ofen'], allergens: ['gluten', 'milch'],
    ingredients: [i('Pizzateig', 0.33, 'Stück', KUE), i('Passierte Tomaten', 60, 'ml', VOR), i('Gouda', 50, 'g', KUE), i('Kochschinken', 40, 'g', KUE), i('Mais', 40, 'g', VOR)],
    steps: ['Ofen auf 220 °C vorheizen, Teig aufs Blech rollen.', 'Mit passierten Tomaten bestreichen, salzen.', 'Schinken, Mais und Käse verteilen – Kinder können selbst belegen.', '12–15 Minuten backen, bis der Käse goldbraun ist.'],
  },
  {
    id: 'nudelauflauf-schinken', name: 'Nudelauflauf mit Schinken und Erbsen', minutes: 35,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd', 'ofen'], allergens: ['gluten', 'milch'],
    ingredients: [i('Fusilli', 110, 'g', VOR), i('Kochschinken', 50, 'g', KUE), i('Erbsen', 60, 'g', TK), i('Kochsahne', 75, 'ml', KUE), i('Gouda', 40, 'g', KUE)],
    steps: ['Nudeln 2 Minuten kürzer als angegeben kochen.', 'Mit Schinkenwürfeln, Erbsen und Sahne mischen, salzen.', 'In eine Auflaufform geben und mit Käse bestreuen.', 'Bei 200 °C 15 Minuten überbacken.'],
  },
  {
    id: 'kartoffelpuffer-apfelmus', name: 'Kartoffelpuffer mit Apfelmus', minutes: 30,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei'],
    ingredients: [i('Kartoffeln', 300, 'g', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Eier', 0.5, 'Stück', KUE), i('Mehl', 15, 'g', VOR), i('Apfelmus', 120, 'g', VOR), i('Olivenöl', 2, 'EL', VOR)],
    steps: ['Kartoffeln und Zwiebel fein reiben, gut ausdrücken.', 'Mit Ei, Mehl und Salz verrühren.', 'Kleine Puffer in heißem Öl von beiden Seiten goldbraun braten.', 'Mit Apfelmus servieren.'],
  },
  {
    id: 'milchreis-kirschen', name: 'Milchreis mit Zimt und Kirschen', minutes: 35,
    protein: 'vegetarisch', carb: 'reis', vibes: ['kinder'], equipment: ['herd'], allergens: ['milch'],
    ingredients: [i('Milchreis', 65, 'g', VOR), i('Milch', 250, 'ml', KUE), i('Zucker', 1, 'EL', VOR), i('Zimt', 0.5, 'TL', GEW), i('Sauerkirschen (Glas)', 90, 'g', VOR)],
    steps: ['Milch mit Zucker aufkochen, Reis einrühren.', 'Bei kleiner Hitze 30 Minuten quellen lassen, öfter umrühren.', 'Kirschen im Saft kurz erwärmen.', 'Milchreis mit Zimt und Kirschen servieren.'],
  },
  {
    id: 'haehnchen-reispfanne-mild', name: 'Milde Hähnchen-Reis-Pfanne mit Mais und Erbsen', minutes: 25,
    protein: 'huhn', carb: 'reis', vibes: ['kinder', 'schnell', 'proteinreich'], equipment: ['herd'], allergens: ['soja'],
    ingredients: [i('Hähnchenbrust', 110, 'g', FLF), i('Basmatireis', 70, 'g', VOR), i('Mais', 50, 'g', VOR), i('Erbsen', 50, 'g', TK), i('Möhre', 0.5, 'Stück', GEM), i('Sojasauce', 1, 'EL', GEW)],
    steps: ['Reis kochen.', 'Hähnchen klein schneiden und anbraten.', 'Möhrenwürfel, Erbsen und Mais 5 Minuten mitbraten.', 'Reis unterheben und mit etwas Sojasauce abschmecken.'],
  },
  {
    id: 'fischstaebchen-burger', name: 'Fischstäbchen-Burger', minutes: 20,
    protein: 'fisch', carb: 'brot', vibes: ['kinder', 'schnell'], equipment: ['ofen'], allergens: ['fisch', 'gluten', 'ei'],
    ingredients: [i('Fischstäbchen', 4, 'Stück', TK), i('Burgerbrötchen', 1, 'Stück', BRO), i('Eisbergsalat', 0.1, 'Stück', GEM), i('Tomate', 0.5, 'Stück', GEM), i('Mayonnaise', 1, 'EL', GEW)],
    steps: ['Fischstäbchen nach Packung im Ofen backen, Brötchen die letzten 3 Minuten mit aufbacken.', 'Salat und Tomate schneiden.', 'Brötchen mit Mayo bestreichen, Fischstäbchen, Salat und Tomate darauf legen.'],
  },
  {
    id: 'hackbaellchen-tomatensauce', name: 'Hackbällchen in Tomatensoße mit Nudeln', minutes: 35,
    protein: 'rind', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei'],
    ingredients: [i('Rinderhack', 100, 'g', FLF), i('Paniermehl', 1, 'EL', VOR), i('Eier', 0.25, 'Stück', KUE), i('Fusilli', 100, 'g', VOR), i('Passierte Tomaten', 150, 'ml', VOR), i('Zwiebel', 0.25, 'Stück', GEM)],
    steps: ['Hack mit Ei, Paniermehl und Salz verkneten, kleine Bällchen formen.', 'Bällchen rundum anbraten, Zwiebel kurz mitbraten.', 'Passierte Tomaten dazugeben und 15 Minuten köcheln.', 'Nudeln kochen und mit den Bällchen servieren.'],
  },
  {
    id: 'hamburger-selbstgemacht', name: 'Selbstgemachte Burger', minutes: 25,
    protein: 'rind', carb: 'brot', vibes: ['kinder', 'proteinreich'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Rinderhack', 125, 'g', FLF), i('Burgerbrötchen', 1, 'Stück', BRO), i('Gouda', 20, 'g', KUE), i('Tomate', 0.5, 'Stück', GEM), i('Eisbergsalat', 0.1, 'Stück', GEM), i('Ketchup', 1, 'EL', GEW)],
    steps: ['Hack salzen, flache Patties formen.', 'In der Pfanne je Seite 3–4 Minuten braten, zum Schluss Käse darauf schmelzen.', 'Brötchen kurz anrösten.', 'Mit Salat, Tomate und Ketchup belegen – jeder baut seinen Burger selbst.'],
  },
  {
    id: 'kartoffelgratin', name: 'Kartoffelgratin mit Käse', minutes: 50,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'deftig'], equipment: ['ofen'], allergens: ['milch'],
    ingredients: [i('Kartoffeln', 300, 'g', GEM), i('Kochsahne', 75, 'ml', KUE), i('Milch', 50, 'ml', KUE), i('Gouda', 40, 'g', KUE), i('Möhre', 0.5, 'Stück', GEM)],
    steps: ['Ofen auf 200 °C vorheizen.', 'Kartoffeln in dünne Scheiben hobeln, Möhre raspeln, in eine Form schichten.', 'Sahne und Milch salzen und darüber gießen, mit Käse bestreuen.', '40 Minuten backen, bis die Kartoffeln weich sind.'],
  },
  {
    id: 'kartoffelsalat-wuerstchen', name: 'Kartoffelsalat mit Würstchen', minutes: 30,
    protein: 'schwein', carb: 'kartoffeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['ei'],
    ingredients: [i('Kartoffeln (festkochend)', 250, 'g', GEM), i('Wiener Würstchen', 2, 'Stück', KUE), i('Gewürzgurken', 1, 'Stück', VOR), i('Mayonnaise', 1.5, 'EL', GEW), i('Joghurt', 40, 'g', KUE)],
    steps: ['Kartoffeln kochen, pellen und in Scheiben schneiden.', 'Gurken würfeln, Mayo und Joghurt verrühren und salzen.', 'Alles vermengen und kurz ziehen lassen.', 'Würstchen in heißem Wasser erwärmen und dazu servieren.'],
  },
  {
    id: 'quesadillas-haehnchen', name: 'Hähnchen-Quesadillas mit Mais', minutes: 20,
    protein: 'huhn', carb: 'brot', vibes: ['kinder', 'schnell', 'international'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Tortilla-Wraps', 2, 'Stück', BRO), i('Hähnchenbrust', 90, 'g', FLF), i('Gouda', 40, 'g', KUE), i('Mais', 40, 'g', VOR), i('Paprika', 0.25, 'Stück', GEM)],
    steps: ['Hähnchen klein schneiden und anbraten, salzen.', 'Eine Wrap-Hälfte mit Käse, Hähnchen, Mais und Paprika belegen, zuklappen.', 'In der trockenen Pfanne je Seite 2 Minuten knusprig braten.', 'In Dreiecke schneiden.'],
  },
  {
    id: 'eierreis-gemuese', name: 'Gebratener Eierreis mit Gemüse', minutes: 20,
    protein: 'vegetarisch', carb: 'reis', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['ei', 'soja'],
    ingredients: [i('Basmatireis', 70, 'g', VOR), i('Eier', 1, 'Stück', KUE), i('Erbsen', 50, 'g', TK), i('Möhre', 0.5, 'Stück', GEM), i('Mais', 30, 'g', VOR), i('Sojasauce', 1, 'EL', GEW)],
    steps: ['Reis kochen (am besten vom Vortag).', 'Möhrenwürfel, Erbsen und Mais in der Pfanne anbraten.', 'Reis dazugeben, Eier verquirlen und unterrühren, bis sie stocken.', 'Mit etwas Sojasauce abschmecken.'],
  },
  {
    id: 'tortellini-schinken-sahne', name: 'Tortellini in Schinken-Sahne-Soße', minutes: 15,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'schnell', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Tortellini', 150, 'g', KUE), i('Kochschinken', 40, 'g', KUE), i('Kochsahne', 75, 'ml', KUE), i('Erbsen', 50, 'g', TK), i('Parmesan', 10, 'g', KUE)],
    steps: ['Tortellini nach Packung kochen.', 'Schinkenwürfel kurz anbraten, Sahne und Erbsen dazugeben und 3 Minuten köcheln.', 'Tortellini unterheben und mit Parmesan servieren.'],
  },
  {
    id: 'ofen-wedges-quark', name: 'Ofen-Kartoffelspalten mit Kräuterquark', minutes: 40,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'leicht'], equipment: ['ofen'], allergens: ['milch'],
    ingredients: [i('Kartoffeln', 300, 'g', GEM), i('Olivenöl', 1, 'EL', VOR), i('Paprikapulver', 0.5, 'TL', GEW), i('Kräuterquark', 100, 'g', KUE), i('Gurke', 0.25, 'Stück', GEM)],
    steps: ['Ofen auf 220 °C vorheizen.', 'Kartoffeln mit Schale in Spalten schneiden, mit Öl, Salz und Paprika mischen.', '30 Minuten backen, einmal wenden.', 'Mit Kräuterquark und Gurkenstiften servieren.'],
  },
  {
    id: 'haehnchenschnitzel-pueree', name: 'Hähnchenschnitzel mit Püree und Möhren', minutes: 35,
    protein: 'huhn', carb: 'kartoffeln', vibes: ['kinder', 'proteinreich'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Hähnchenbrust', 125, 'g', FLF), i('Mehl', 10, 'g', VOR), i('Eier', 0.5, 'Stück', KUE), i('Paniermehl', 3, 'EL', VOR), i('Kartoffeln', 250, 'g', GEM), i('Milch', 50, 'ml', KUE), i('Butter', 1, 'EL', KUE), i('Möhre', 1, 'Stück', GEM)],
    steps: ['Kartoffeln kochen, mit Milch und Butter zu Püree stampfen.', 'Möhren in Scheiben schneiden und weich dünsten.', 'Hähnchen flach klopfen, salzen, in Mehl, Ei und Paniermehl wenden.', 'In Öl je Seite 4 Minuten goldbraun braten.'],
  },
  {
    id: 'mac-and-cheese-brokkoli', name: 'Käse-Makkaroni mit Brokkoli', minutes: 20,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Makkaroni', 110, 'g', VOR), i('Milch', 120, 'ml', KUE), i('Gouda', 50, 'g', KUE), i('Butter', 0.5, 'EL', KUE), i('Mehl', 5, 'g', VOR), i('Brokkoli', 0.25, 'Stück', GEM)],
    steps: ['Nudeln kochen, Brokkoliröschen die letzten 4 Minuten mitkochen.', 'Butter schmelzen, Mehl einrühren, Milch nach und nach dazugeben.', 'Käse darin schmelzen und salzen.', 'Nudeln und Brokkoli unterrühren.'],
  },
  {
    id: 'gebratene-nudeln-haehnchen', name: 'Gebratene Nudeln mit Hähnchen', minutes: 20,
    protein: 'huhn', carb: 'nudeln', vibes: ['kinder', 'schnell', 'international'], equipment: ['herd'], allergens: ['gluten', 'ei', 'soja'],
    ingredients: [i('Mie-Nudeln', 80, 'g', VOR), i('Hähnchenbrust', 100, 'g', FLF), i('Möhre', 0.5, 'Stück', GEM), i('Erbsen', 50, 'g', TK), i('Sojasauce', 1.5, 'EL', GEW)],
    steps: ['Nudeln nach Packung einweichen bzw. kochen.', 'Hähnchenstreifen anbraten.', 'Möhrenstifte und Erbsen 3 Minuten mitbraten.', 'Nudeln und Sojasauce dazu, alles kurz durchschwenken.'],
  },
  {
    id: 'kaiserschmarrn-apfelmus', name: 'Kaiserschmarrn mit Apfelmus', minutes: 25,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['kinder'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Mehl', 60, 'g', VOR), i('Milch', 100, 'ml', KUE), i('Eier', 1.5, 'Stück', KUE), i('Zucker', 1, 'EL', VOR), i('Butter', 1, 'EL', KUE), i('Apfelmus', 120, 'g', VOR)],
    steps: ['Mehl, Milch, Eier und eine Prise Salz glatt rühren.', 'Teig in Butter stocken lassen, wenden und mit zwei Gabeln zerreißen.', 'Mit Zucker bestreuen und kurz karamellisieren.', 'Mit Apfelmus servieren.'],
  },
  {
    id: 'linsen-bolognese', name: 'Spaghetti mit Linsen-Bolognese', minutes: 30,
    protein: 'vegan', carb: 'nudeln', vibes: ['kinder', 'proteinreich'], equipment: ['herd'], allergens: ['gluten'],
    ingredients: [i('Spaghetti', 110, 'g', VOR), i('Rote Linsen', 40, 'g', VOR), i('Passierte Tomaten', 150, 'ml', VOR), i('Möhre', 0.5, 'Stück', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Olivenöl', 1, 'EL', VOR)],
    steps: ['Zwiebel und Möhre fein würfeln und in Öl andünsten.', 'Linsen und passierte Tomaten mit etwas Wasser dazugeben.', '15 Minuten köcheln, bis die Linsen weich sind, salzen.', 'Mit den gekochten Spaghetti servieren.'],
  },
  {
    id: 'tomatenreis-mais-erbsen', name: 'Tomatenreis mit Mais und Erbsen', minutes: 25,
    protein: 'vegan', carb: 'reis', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: [],
    ingredients: [i('Basmatireis', 75, 'g', VOR), i('Passierte Tomaten', 100, 'ml', VOR), i('Gemüsebrühe', 100, 'ml', VOR), i('Mais', 40, 'g', VOR), i('Erbsen', 50, 'g', TK), i('Paprikapulver', 0.5, 'TL', GEW)],
    steps: ['Reis kurz in etwas Öl anrösten.', 'Mit Tomaten und Brühe ablöschen, Paprikapulver dazu.', 'Zugedeckt 15 Minuten garen.', 'Mais und Erbsen unterheben und 3 Minuten mitziehen lassen.'],
  },

  // Nach Vorlagen von gaumenfreundin.de (Kinderrezepte): Zutaten auf 1 Portion umgerechnet,
  // Zubereitung in eigenen Worten gekürzt, Preise selbst geschätzt. Original über `source`.
  {
    id: 'gf-spaghetti-kuerbissauce', name: 'Spaghetti mit Kürbissauce', minutes: 25,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Spaghetti', 100, 'g', VOR), i('Hokkaido-Kürbis', 125, 'g', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Knoblauch', 0.25, 'Stück', GEM), i('Gemüsebrühe', 40, 'ml', VOR), i('Kochsahne', 40, 'ml', KUE), i('Parmesan', 12, 'g', KUE)],
    steps: ['Kürbis mit Schale klein würfeln, Zwiebel und Knoblauch hacken.', 'Alles in Öl andünsten, mit Brühe und Sahne ablöschen und weich köcheln.', 'Fein pürieren, Parmesan einrühren, mit Salz, Pfeffer und Muskat abschmecken.', 'Mit den gekochten Spaghetti mischen.'],
    source: 'https://www.gaumenfreundin.de/spaghetti-mit-kuerbissauce/',
  },
  {
    id: 'gf-kuerbis-kartoffel-auflauf', name: 'Kürbis-Kartoffel-Auflauf', minutes: 70,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'deftig'], equipment: ['ofen'], allergens: ['milch'],
    ingredients: [i('Kartoffeln (festkochend)', 100, 'g', GEM), i('Hokkaido-Kürbis', 100, 'g', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Kochsahne', 60, 'ml', KUE), i('Frischkäse', 50, 'g', KUE), i('Gouda', 50, 'g', KUE)],
    steps: ['Kartoffeln und Kürbis in dünne Scheiben schneiden und in eine Auflaufform schichten.', 'Sahne mit Frischkäse, gehackter Zwiebel, Salz, Pfeffer und Muskat verrühren und darüber gießen.', 'Mit Käse bestreuen.', 'Bei 180 °C etwa 50 Minuten backen, bis alles weich ist.'],
    source: 'https://www.gaumenfreundin.de/kuerbis-kartoffel-auflauf/',
  },
  {
    id: 'gf-krautnudeln', name: 'Krautnudeln mit Speck', minutes: 30,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei'],
    ingredients: [i('Weißkohl', 175, 'g', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Speckwürfel', 35, 'g', KUE), i('Bandnudeln', 75, 'g', VOR), i('Paprikapulver', 0.25, 'TL', GEW)],
    steps: ['Nudeln kochen.', 'Speck und Zwiebel in einer großen Pfanne anbraten.', 'Kohl in feine Streifen schneiden und 10–15 Minuten mitbraten, bis er weich und leicht gebräunt ist.', 'Nudeln untermischen und mit Salz, Pfeffer, Paprika und etwas Kümmel würzen.'],
    source: 'https://www.gaumenfreundin.de/krautnudeln-rezept/',
  },
  {
    id: 'gf-kartoffelcremesuppe', name: 'Kartoffelcremesuppe', minutes: 45,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'leicht'], equipment: ['herd'], allergens: ['milch'],
    ingredients: [i('Kartoffeln', 250, 'g', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Suppengemüse', 0.25, 'Stück', GEM), i('Butter', 0.5, 'EL', KUE), i('Gemüsebrühe', 275, 'ml', VOR), i('Kochsahne', 25, 'ml', KUE)],
    steps: ['Kartoffeln, Zwiebel und Suppengemüse schälen und würfeln.', 'In Butter andünsten, mit Brühe auffüllen, Majoran und ein Lorbeerblatt dazu.', 'Etwa 20 Minuten köcheln, Lorbeer entfernen und fein pürieren.', 'Sahne einrühren, mit Salz, Pfeffer und Muskat abschmecken.'],
    source: 'https://www.gaumenfreundin.de/kartoffelcremesuppe-einfach-und-klassisch/',
  },
  {
    id: 'gf-tortellini-suppe', name: 'Tortellini-Suppe mit Hackfleisch', minutes: 30,
    protein: 'rind', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Rinderhack', 125, 'g', FLF), i('Tortellini', 125, 'g', KUE), i('Cherrytomaten', 50, 'g', GEM), i('Babyspinat', 15, 'g', GEM), i('Tomatenmark', 1, 'EL', VOR), i('Milch', 125, 'ml', KUE), i('Mehl', 8, 'g', VOR), i('Gemüsebrühe', 200, 'ml', VOR), i('Parmesan', 12, 'g', KUE)],
    steps: ['Hack in Öl krümelig braten, mit Paprika würzen, Tomatenmark kurz mitrösten.', 'Mehl darüberstäuben, mit Milch und Brühe ablöschen und aufkochen.', 'Tortellini und halbierte Tomaten darin nach Packung garen.', 'Spinat und Parmesan unterrühren und abschmecken.'],
    source: 'https://www.gaumenfreundin.de/tortellini-suppe/',
  },
  {
    id: 'gf-gnocchi-pfanne-haehnchen', name: 'Gnocchi-Gemüse-Pfanne mit Hähnchen und Frischkäse', minutes: 20,
    protein: 'huhn', carb: 'sonstiges', vibes: ['kinder', 'schnell', 'proteinreich'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Hähnchenbrust', 125, 'g', FLF), i('Gnocchi', 125, 'g', KUE), i('Zucchini', 0.25, 'Stück', GEM), i('Cherrytomaten', 75, 'g', GEM), i('Rote Zwiebel', 0.25, 'Stück', GEM), i('Frischkäse', 50, 'g', KUE), i('Gemüsebrühe', 50, 'ml', VOR)],
    steps: ['Hähnchen würfeln, mit Salz, Pfeffer und Paprika würzen und anbraten, herausnehmen.', 'Gnocchi in derselben Pfanne goldbraun braten.', 'Zwiebel, Zucchini und Tomaten kurz mitbraten.', 'Frischkäse und Brühe einrühren, Hähnchen zurück in die Pfanne geben und alles cremig einkochen.'],
    source: 'https://www.gaumenfreundin.de/gnocchi-gemuese-pfanne-mit-tomaten-und-zucchini/',
  },
  {
    id: 'gf-pizzatoast-airfryer', name: 'Pizza-Toast aus dem Airfryer', minutes: 15,
    protein: 'schwein', carb: 'brot', vibes: ['kinder', 'schnell'], equipment: ['airfryer'], allergens: ['gluten', 'milch'],
    ingredients: [i('Toastbrot', 2, 'Stück', BRO), i('Pizzasoße', 2, 'TL', GEW), i('Salami', 20, 'g', KUE), i('Paprika', 0.25, 'Stück', GEM), i('Mais', 1, 'EL', VOR), i('Mozzarella (gerieben)', 25, 'g', KUE)],
    steps: ['Toast mit Pizzasoße bestreichen und mit Pizzakräutern bestreuen.', 'Mit Salami, Paprikawürfeln und Mais belegen, Käse darüber.', 'Im Airfryer bei 180 °C etwa 6 Minuten backen, bis der Käse schmilzt.'],
    source: 'https://www.gaumenfreundin.de/pizza-toast-aus-der-heissluftfritteuse/',
  },
  {
    id: 'gf-cevapcici', name: 'Cevapcici mit Fladenbrot und Joghurt-Dip', minutes: 40,
    protein: 'rind', carb: 'brot', vibes: ['kinder', 'proteinreich'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Hackfleisch (gemischt)', 125, 'g', FLF), i('Knoblauch', 0.5, 'Stück', GEM), i('Paprikapulver', 0.5, 'TL', GEW), i('Fladenbrot', 0.25, 'Stück', BRO), i('Joghurt', 60, 'g', KUE), i('Gurke', 0.25, 'Stück', GEM)],
    steps: ['Hack mit gepresstem Knoblauch, Paprika, Salz, Pfeffer, einer Prise Natron und etwas Öl gründlich verkneten.', 'Mit feuchten Händen fingerdicke Röllchen formen und kurz kühl stellen.', 'In der Pfanne rundum etwa 8 Minuten braten.', 'Mit Fladenbrot, Gurke und Joghurt servieren.'],
    source: 'https://www.gaumenfreundin.de/cevapcici-zubereiten/',
  },
  {
    id: 'gf-haehnchen-gemuese-spiesse', name: 'Hähnchen-Gemüse-Spieße mit Reis', minutes: 30,
    protein: 'huhn', carb: 'reis', vibes: ['kinder', 'proteinreich', 'leicht'], equipment: ['herd', 'ofen'], allergens: [],
    ingredients: [i('Hähnchenbrust', 125, 'g', FLF), i('Paprika', 0.25, 'Stück', GEM), i('Zucchini', 0.25, 'Stück', GEM), i('Cherrytomaten', 40, 'g', GEM), i('Rote Zwiebel', 0.25, 'Stück', GEM), i('Olivenöl', 1, 'EL', VOR), i('Basmatireis', 70, 'g', VOR)],
    steps: ['Hähnchen und Gemüse in mundgerechte Stücke schneiden.', 'Mit Öl, Paprikapulver, Oregano, Salz und Pfeffer marinieren und abwechselnd auf Spieße stecken.', 'Im Ofen bei 220 °C (oder in der Grillpfanne) 15–20 Minuten garen, einmal wenden.', 'Reis kochen und dazu servieren.'],
    source: 'https://www.gaumenfreundin.de/haehnchen-spiesse-vom-grill/',
  },
  {
    id: 'gf-zucchinipuffer', name: 'Zucchinipuffer mit Kräuterquark', minutes: 30,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['kinder', 'leicht'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Zucchini', 1, 'Stück', GEM), i('Zwiebel', 0.25, 'Stück', GEM), i('Mehl', 35, 'g', VOR), i('Paniermehl', 0.5, 'EL', VOR), i('Eier', 0.75, 'Stück', KUE), i('Gouda', 25, 'g', KUE), i('Kräuterquark', 60, 'g', KUE)],
    steps: ['Zucchini grob raspeln, salzen, 10 Minuten ziehen lassen und kräftig ausdrücken.', 'Mit gehackter Zwiebel, Mehl, Paniermehl, Eiern und Käse zu einem Teig verrühren.', 'Kleine Puffer in Öl von beiden Seiten goldbraun braten.', 'Mit Kräuterquark servieren.'],
    source: 'https://www.gaumenfreundin.de/zucchinipuffer/',
  },
  {
    id: 'gf-flammkuchen-broetchen', name: 'Flammkuchen-Brötchen', minutes: 35,
    protein: 'schwein', carb: 'brot', vibes: ['kinder'], equipment: ['ofen'], allergens: ['gluten', 'milch'],
    ingredients: [i('Aufbackbrötchen', 1.5, 'Stück', BRO), i('Schmand', 100, 'g', KUE), i('Gouda', 35, 'g', KUE), i('Speckwürfel', 35, 'g', KUE), i('Frühlingszwiebel', 0.75, 'Stück', GEM)],
    steps: ['Brötchen halbieren und mit der Schnittfläche nach oben aufs Blech legen.', 'Schmand mit Käse, Schinkenwürfeln, Frühlingszwiebeln, Salz und Pfeffer verrühren.', 'Dick auf die Brötchenhälften streichen.', 'Bei 200 °C etwa 15–20 Minuten goldbraun backen.'],
    source: 'https://www.gaumenfreundin.de/flammkuchen-broetchen/',
  },
  {
    id: 'gf-weisse-bolognese', name: 'Weiße Bolognese', minutes: 35,
    protein: 'rind', carb: 'nudeln', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Hackfleisch (gemischt)', 125, 'g', FLF), i('Bandnudeln', 100, 'g', VOR), i('Zwiebel', 0.25, 'Stück', GEM), i('Knoblauch', 0.5, 'Stück', GEM), i('Möhre', 0.5, 'Stück', GEM), i('Staudensellerie', 0.5, 'Stück', GEM), i('Gemüsebrühe', 90, 'ml', VOR), i('Kochsahne', 40, 'ml', KUE), i('Parmesan', 10, 'g', KUE)],
    steps: ['Zwiebel, Knoblauch, Möhre und Sellerie sehr fein würfeln.', 'Hack in Öl krümelig braten, Gemüse dazugeben und mitdünsten.', 'Mit Brühe (oder etwas Weißwein) ablöschen, Sahne und Oregano dazu, 15 Minuten köcheln.', 'Mit den Nudeln mischen und mit Parmesan servieren.'],
    source: 'https://www.gaumenfreundin.de/weisse-bolognese/',
  },

  // Selbst ausgesucht (gaumenfreundin.de, chefkoch.de, familienkost.de): gleiche Regeln wie oben.
  {
    id: 'gf-nudeln-schinken-sahne-erbsen', name: 'Nudeln mit Schinken-Sahne-Soße und Erbsen', minutes: 20,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Fusilli', 75, 'g', VOR), i('Zwiebel', 0.25, 'Stück', GEM), i('Kochschinken', 50, 'g', KUE), i('Kochsahne', 60, 'ml', KUE), i('Milch', 50, 'ml', KUE), i('Erbsen', 50, 'g', TK), i('Parmesan', 12, 'g', KUE)],
    steps: ['Nudeln kochen, dabei etwas Kochwasser aufheben. Zwiebel hacken, Schinken würfeln.', 'Zwiebel in Öl dünsten, Sahne, Milch und etwas Brühe dazugeben und aufkochen.', 'Schinken und Erbsen einrühren und ein paar Minuten köcheln lassen.', 'Nudeln, einen Schuss Kochwasser und Parmesan unterheben, mit Salz und Pfeffer abschmecken.'],
    source: 'https://www.gaumenfreundin.de/nudeln-mit-schinken-sahne-sauce-und-erbsen/',
  },
  {
    id: 'ck-nudeln-fleischwurst', name: 'Nudeln mit Fleischwurst', minutes: 20,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'schnell', 'deftig'], equipment: ['herd'], allergens: ['gluten'],
    ingredients: [i('Gabelspaghetti', 125, 'g', VOR), i('Fleischwurst', 0.25, 'Stück', KUE), i('Gemüsebrühe', 60, 'ml', VOR)],
    steps: ['Nudeln in Salzwasser kochen.', 'Fleischwurst klein würfeln und in heißem Öl kräftig anbraten.', 'Mit dem Großteil der Brühe ablöschen, einkochen lassen und weiterbraten, bis die Wurst knusprig ist.', 'Nudeln und restliche Brühe dazugeben, kurz mitbraten und 5 Minuten ziehen lassen. Dazu passt Salat.'],
    source: 'https://www.chefkoch.de/rezepte/1267961232026918/Nudeln-mit-Fleischwurst.html',
  },
  {
    id: 'ck-nudeln-kaese-schinken-ei', name: 'Nudeln mit Käse, Schinken und Ei', minutes: 15,
    protein: 'schwein', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Fusilli', 100, 'g', VOR), i('Kochschinken', 50, 'g', KUE), i('Gouda', 50, 'g', KUE), i('Eier', 1.5, 'Stück', KUE), i('Butter', 1, 'EL', KUE)],
    steps: ['Nudeln bissfest kochen (Reste vom Vortag gehen auch), Schinken würfeln, Eier verquirlen.', 'Nudeln und Schinken in Butter etwa 4 Minuten braten, bis alles heiß ist.', 'Eier und fein geriebenen Käse darübergeben und unter Rühren stocken bzw. schmelzen lassen.', 'Salzen, pfeffern und mit grünem Salat servieren.'],
    source: 'https://www.chefkoch.de/rezepte/1103241216286407/Nudeln-mit-Kaese-Schinken-und-Ei.html',
  },
  {
    id: 'ck-one-pot-tortellini', name: 'One-Pot-Tortellini mit Paprika und Lauch', minutes: 20,
    protein: 'vegetarisch', carb: 'nudeln', vibes: ['kinder', 'schnell'], equipment: ['herd'], allergens: ['gluten', 'ei', 'milch'],
    ingredients: [i('Tortellini', 125, 'g', KUE), i('Lauch', 0.25, 'Stück', GEM), i('Paprika', 0.5, 'Stück', GEM), i('Knoblauch', 0.25, 'Stück', GEM), i('Passierte Tomaten', 125, 'ml', VOR), i('Gemüsebrühe', 60, 'ml', VOR)],
    steps: ['Lauch, Paprika und Knoblauch klein schneiden und in einem großen Topf in Öl anbraten.', 'Mit passierten Tomaten und Brühe auffüllen und aufkochen.', 'Hitze reduzieren, Tortellini hineingeben und nach Packung 3–5 Minuten garen.', 'Mit Salz, Pfeffer, Oregano und Basilikum abschmecken.'],
    source: 'https://www.chefkoch.de/rezepte/3791571578671534/One-pot-Tortellini.html',
  },
  {
    id: 'ck-kaese-lauch-suppe', name: 'Käse-Lauch-Suppe mit Baguette', minutes: 25,
    protein: 'rind', carb: 'brot', vibes: ['kinder', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Hackfleisch (gemischt)', 125, 'g', FLF), i('Lauch', 0.75, 'Stück', GEM), i('Gemüsebrühe', 190, 'ml', VOR), i('Crème fraîche', 50, 'g', KUE), i('Schmelzkäse', 50, 'g', KUE), i('Baguette', 0.25, 'Stück', BRO)],
    steps: ['Hack in einem großen Topf in Öl anbraten, Lauch in Ringe schneiden und mitbraten.', 'Mit Brühe ablöschen, mit Salz, Pfeffer und Muskat würzen und 10 Minuten köcheln.', 'Schmelzkäse darin schmelzen, dann Crème fraîche einrühren und noch einmal aufkochen.', 'Mit frischem Baguette servieren.'],
    source: 'https://www.chefkoch.de/rezepte/4370751744365727/Wuerzige-Kaese-Lauch-Suppe.html',
  },
  {
    id: 'fk-gnocchi-auflauf', name: 'Gnocchi-Auflauf mit buntem Gemüse', minutes: 35,
    protein: 'vegetarisch', carb: 'sonstiges', vibes: ['kinder'], equipment: ['herd', 'ofen'], allergens: ['gluten', 'milch'],
    ingredients: [i('Gnocchi', 165, 'g', KUE), i('Zwiebel', 0.2, 'Stück', GEM), i('Möhre', 0.33, 'Stück', GEM), i('Paprika', 0.2, 'Stück', GEM), i('Grüne Bohnen', 35, 'g', TK), i('Kochsahne', 35, 'ml', KUE), i('Gouda', 35, 'g', KUE)],
    steps: ['Bohnen 10 Minuten in Salzwasser vorkochen. Möhre, Paprika und Zwiebel klein schneiden.', 'Gemüse in Öl anbraten, Zwiebel und Knoblauch zum Schluss mitdünsten.', 'Gnocchi nach Packung garen, kurz mit in der Pfanne braten, Sahne mit etwas Brühpulver unterrühren.', 'In eine Auflaufform geben, mit Käse bestreuen und bei 200 °C 15–20 Minuten überbacken.'],
    source: 'https://www.familienkost.de/rezept_gnocchi-auflauf.html',
  },
  {
    id: 'fk-gemuese-in-sauce', name: 'Gemüse in heller Soße mit Kartoffeln', minutes: 30,
    protein: 'vegetarisch', carb: 'kartoffeln', vibes: ['kinder', 'leicht'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Kaisergemüse', 125, 'g', TK), i('Kartoffeln', 250, 'g', GEM), i('Zwiebel', 0.2, 'Stück', GEM), i('Butter', 0.75, 'EL', KUE), i('Mehl', 10, 'g', VOR), i('Kochsahne', 50, 'ml', KUE)],
    steps: ['Kartoffeln als Salzkartoffeln kochen.', 'Gemüse 10 Minuten in leicht gesalzenem Wasser garen, abgießen und das Kochwasser auffangen.', 'Zwiebel in Butter anschwitzen, Mehl einrühren, mit Sahne und Kochwasser ablöschen und aufkochen.', 'Mit Salz und Muskat abschmecken, Gemüse unterheben und mit den Kartoffeln servieren.'],
    source: 'https://www.familienkost.de/rezept_gemuese-in-sauce.html',
  },
  {
    id: 'ck-friss-dich-dumm-nudeln', name: 'Friss-dich-dumm-Nudeln mit Hack und Feta', minutes: 20,
    protein: 'rind', carb: 'nudeln', vibes: ['kinder', 'schnell', 'deftig'], equipment: ['herd'], allergens: ['gluten', 'milch'],
    ingredients: [i('Makkaroni', 125, 'g', VOR), i('Hackfleisch (gemischt)', 125, 'g', FLF), i('Zwiebel', 0.25, 'Stück', GEM), i('Paprika', 0.5, 'Stück', GEM), i('Feta', 50, 'g', KUE), i('Bratensoße', 60, 'ml', GEW)],
    steps: ['Nudeln in Salzwasser bissfest kochen.', 'Hack mit gewürfelter Zwiebel und Paprika krümelig anbraten, mit Salz, Pfeffer und Majoran würzen.', 'Mit Bratensoße (aus Pulver oder Bratensaft) aufgießen und kurz köcheln.', 'Feta zerbröseln und unterheben, dann alles mit den Nudeln mischen.'],
    source: 'https://www.chefkoch.de/rezepte/1397991244719560/Friss-dich-dumm-Nudeln.html',
  },
];

/** Zutaten ohne hinterlegten Preis (sollte leer sein – fällt in der Rezeptansicht als Hinweis auf). */
export const UNPRICED = new Set<string>();

function priced(r: RawRecipe): Recipe {
  let cost = BASICS_PER_PORTION;
  for (const ing of r.ingredients) {
    const c = ingredientCost(ing);
    if (c === null) UNPRICED.add(`${ing.name} (${ing.unit})`);
    else cost += c;
  }
  return {
    ...r,
    pricePerPortion: Math.round(cost * 100) / 100,
    estimatedIngredients: r.ingredients.filter((x) => (priceFor(x.name)?.source ?? 'schätzung') === 'schätzung').map((x) => x.name),
  };
}

/** Eingebaute plus eigene Rezepte. Wird von rebuildCatalog an Ort und Stelle neu befüllt. */
export const RECIPES: Recipe[] = RAW_RECIPES.map(priced);
export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const BUILTIN_IDS = new Set(RAW_RECIPES.map((r) => r.id));

let lastKey = '';
/** Eigene Rezepte und Preise einrechnen. Billig, wenn sich nichts geändert hat. */
export function rebuildCatalog(custom: CustomRecipe[], userPrices: Record<string, UserPrice>) {
  const key = JSON.stringify([custom, userPrices]);
  if (key === lastKey) return;
  lastKey = key;
  setUserPrices(userPrices);
  UNPRICED.clear();
  const all = [...RAW_RECIPES, ...custom].map(priced);
  RECIPES.splice(0, RECIPES.length, ...all);
  for (const id of Object.keys(RECIPE_BY_ID)) delete RECIPE_BY_ID[id];
  for (const r of all) RECIPE_BY_ID[r.id] = r;
}

/** Alle Zutatennamen mit ihrer Kategorie – für eigene Rezepte, Vorrat und Preise. */
export function knownIngredients(): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const r of RECIPES) for (const ing of r.ingredients) if (!map.has(ing.name)) map.set(ing.name, ing.category);
  return map;
}
