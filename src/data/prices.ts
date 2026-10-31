import type { Ingredient, UserPrice, StoreLevel } from '../types';

/**
 * Zutatenpreise. Quelle „bon" = tatsächlich bezahlt laut eigenem Kassenbon
 * (ALDI SÜD und EDEKA, 31.10.2026). Quelle „aldi" = Regalpreis (kein Aktionspreis)
 * aus dem Online-Sortiment von aldi-sued.de, abgerufen am PRICE_DATE. Quelle „schätzung" = dort
 * ohne Online-Preis (v. a. loses Obst/Gemüse, einige Kühl-/TK-Artikel) – grob geschätzt.
 * Lidl veröffentlicht online keine Ladenpreise für Lebensmittel, daher nicht enthalten.
 */
export const PRICE_DATE = '31.10.2026';
export const PRICE_SOURCE = 'eigener Kassenbon + ALDI SÜD online';

/** Salz, Pfeffer, Bratöl, Gewürze ohne eigene Zeile – pauschal pro Portion. */
export const BASICS_PER_PORTION = 0.1;

type Per = 'kg' | 'l' | 'Stück' | 'EL' | 'TL';
export interface IngredientPrice {
  price: number;
  per: Per;
  source: 'eigen' | 'bon' | 'aldi' | 'schätzung';
  /** Bei Bon/ALDI: Produkt, aus dem der Preis stammt */
  product?: string;
}

const aldi = (price: number, per: Per, product: string): IngredientPrice => ({ price, per, source: 'aldi', product });
const bon = (price: number, per: Per, product: string): IngredientPrice => ({ price, per, source: 'bon', product });
const est = (price: number, per: Per): IngredientPrice => ({ price, per, source: 'schätzung' });

export const PRICES: Record<string, IngredientPrice> = {
  // Nudeln, Reis, Hülsenfrüchte, Vorrat
  Spaghetti: bon(1.38, 'kg', 'ALDI Spaghetti 500 g, 0,69 €'),
  Gabelspaghetti: aldi(1.38, 'kg', 'CUCINA Spaghetti 500 g, 0,69 €'),
  Fusilli: aldi(1.38, 'kg', 'CUCINA Fusilli 500 g, 0,69 €'),
  Penne: aldi(1.38, 'kg', 'CUCINA Penne 500 g, 0,69 €'),
  Linguine: est(1.6, 'kg'),
  Makkaroni: est(1.6, 'kg'),
  Suppennudeln: est(2.0, 'kg'),
  Bandnudeln: bon(1.98, 'kg', 'ALDI Frischei-Nudeln 500 g, 0,99 €'),
  'Mie-Nudeln': aldi(3.56, 'kg', 'ASIA GREEN GARDEN Mie-Nudeln 250 g, 0,89 €'),
  Basmatireis: aldi(2.49, 'kg', 'BON-RI Basmati Reis 1 kg, 2,49 €'),
  'Express-Reis': aldi(4.76, 'kg', 'BON-RI Express-Reis 250 g, 1,19 €'),
  Risottoreis: est(2.8, 'kg'),
  Sushireis: est(4.0, 'kg'),
  Milchreis: est(2.0, 'kg'),
  Bulgur: est(2.5, 'kg'),
  'Rote Linsen': aldi(2.9, 'kg', 'BIO Rote Linsen 500 g, 1,45 €'),
  Tellerlinsen: aldi(2.9, 'kg', 'BIO Berglinsen 500 g, 1,45 €'),
  Kichererbsen: est(3.0, 'kg'),
  Kidneybohnen: aldi(2.71, 'kg', "KING'S CROWN Rote Kidney Bohnen 255 g, 0,69 €"),
  'Weiße Bohnen': est(2.7, 'kg'),
  Mais: bon(3.12, 'kg', 'ALDI Mais 285 g, 0,89 €'),
  'Passierte Tomaten': bon(1.3, 'kg', 'ALDI Passierte Tomaten 500 g, 0,65 €'),
  'Gehackte Tomaten': aldi(1.63, 'kg', 'BIO Tomaten gehackt 400 g, 0,65 €'),
  Tomatenmark: aldi(4.45, 'kg', "KING'S CROWN Tomatenmark 200 g, 0,89 €"),
  Kokosmilch: aldi(2.98, 'l', 'ASIA GREEN GARDEN Kokosnussmilch 400 ml, 1,19 €'),
  'Thunfisch (Dose)': aldi(6.97, 'kg', 'ALMARE Thunfischfilets 185 g, 1,29 €'),
  Mehl: aldi(0.59, 'kg', 'BACK FAMILY Weizenmehl 405, 1 kg, 0,59 €'),
  Paniermehl: aldi(1.69, 'kg', 'GOLDÄHREN Paniermehl 1 kg, 1,69 €'),
  Speisestärke: est(2.0, 'kg'),
  Zucker: est(1.0, 'kg'),
  Apfelmus: aldi(2.36, 'kg', 'BIO Apfelmus 360 g, 0,85 €'),
  'Sauerkirschen (Glas)': est(3.5, 'kg'),
  Erdnussbutter: aldi(5.0, 'kg', 'GRANDESSA Erdnusscreme 340 g, 1,70 €'),
  Gemüsebrühe: bon(0.13, 'l', 'ALDI Brühe im Glas (ergibt ca. 7,5 l), 0,99 €'),
  Olivenöl: est(8.0, 'l'),
  Sesam: est(8.0, 'kg'),
  Gewürzgurken: est(0.15, 'Stück'),

  // Saucen & Gewürze
  Ketchup: est(2.6, 'l'),
  Bratensoße: est(1.6, 'l'),
  Mayonnaise: aldi(3.74, 'l', 'HEINZ Mayonnaise 800 ml, 2,99 €'),
  Senf: aldi(2.36, 'l', 'DELIKATO Senf mittelscharf 250 ml, 0,59 €'),
  Pesto: aldi(5.21, 'kg', 'CUCINA Pesto 190 g, 0,99 €'),
  Pizzasoße: est(3.0, 'kg'),
  Sojasauce: est(6.0, 'l'),
  Teriyakisauce: aldi(12.76, 'l', 'KIKKOMAN Teriyaki Sauce 250 ml, 3,19 €'),
  Salsa: est(6.0, 'kg'),
  Currypaste: est(0.15, 'EL'),
  Sesamöl: est(15, 'l'),
  Essig: est(0.01, 'TL'),
  Kapern: est(0.08, 'TL'),
  Currypulver: est(0.05, 'TL'),
  Chilipulver: est(0.05, 'TL'),
  Kreuzkümmel: est(0.05, 'TL'),
  Paprikapulver: est(0.04, 'TL'),
  Rosmarin: est(0.05, 'TL'),
  Zimt: est(0.04, 'TL'),
  Gyrosgewürz: est(0.06, 'TL'),
  Schnittlauch: est(0.1, 'EL'),

  // Kühlregal
  Milch: aldi(0.85, 'l', 'MILSANI H-Milch 1,5 % 1 l, 0,85 €'),
  Kochsahne: bon(4.45, 'l', 'ALDI H-Sahne 200 g, 0,89 €'),
  Butter: bon(4.76, 'kg', 'EDEKA G&G Markenbutter 250 g, 1,19 €'),
  Joghurt: aldi(1.78, 'kg', 'MILSANI Naturjoghurt 3,5 % 500 g, 0,89 €'),
  Schmand: aldi(3.95, 'kg', 'MILSANI H-Schmand 200 g, 0,79 €'),
  'Crème fraîche': bon(4.95, 'kg', 'ALDI Crème fraîche 200 g, 0,99 €'),
  Kräuterquark: aldi(3.25, 'kg', 'MILSANI Gewürzquark 200 g, 0,65 €'),
  Frischkäse: aldi(5.3, 'kg', 'MILSANI Frischkäse 300 g, 1,59 €'),
  Gouda: aldi(6.6, 'kg', 'HOFBURGER Gouda jung 250 g, 1,65 €'),
  'Mozzarella (gerieben)': aldi(7.16, 'kg', 'HOFBURGER Mozzarella gerieben 250 g, 1,79 €'),
  Parmesan: est(14, 'kg'),
  Bergkäse: aldi(11.4, 'kg', 'MEINE KÄSETHEKE Bergkäse 350 g, 3,99 €'),
  Feta: aldi(5.96, 'kg', 'LYTTOS Hirtenkäse 250 g, 1,49 €'),
  Schmelzkäse: bon(7.45, 'kg', 'ALDI Schmelzkäsezubereitung 200 g, 1,49 €'),
  Eier: aldi(0.3, 'Stück', 'LANDFREUDE Eier Freiland 10er, 2,99 €'),
  Ei: aldi(0.3, 'Stück', 'LANDFREUDE Eier Freiland 10er, 2,99 €'),
  Kochschinken: bon(7.95, 'kg', 'ALDI Koch-Hinterschinken 200 g, 1,59 €'),
  Speckwürfel: aldi(8.63, 'kg', 'GUT DREI EICHEN Bauchspeck 300 g, 2,59 €'),
  Salami: est(7.0, 'kg'),
  'Wiener Würstchen': aldi(0.37, 'Stück', 'GUT DREI EICHEN Wiener Würstchen 400 g (8 St.), 2,99 €'),
  Fleischwurst: bon(3.49, 'Stück', 'ALDI Schinkenfleischwurst HF3, 3,49 €'),
  Tofu: est(5.0, 'kg'),
  Hummus: aldi(4.95, 'kg', 'WONNEMEYER Hummus 200 g, 0,99 €'),
  'Falafel (Kühlregal)': aldi(0.18, 'Stück', 'MY VAY Vegane Falafel 200 g (ca. 10 St.), 1,79 €'),
  Gnocchi: bon(1.98, 'kg', 'ALDI Gnocchi 500 g, 0,99 €'),
  Tortellini: bon(3.96, 'kg', 'ALDI Tortelloni 250 g, 0,99 €'),
  'Spätzle (Kühlregal)': aldi(3.38, 'kg', 'LANDFREUDE Eierspätzle 500 g, 1,69 €'),
  Pizzateig: aldi(1.29, 'Stück', 'CUCINA XXL-Pizzateig 550 g, 1,29 €'),
  Flammkuchenteig: aldi(1.39, 'Stück', 'WONNEMEYER Flammkuchenteig 280 g, 1,39 €'),

  // Fleisch & Fisch
  Hähnchenbrust: bon(7.49, 'kg', 'ALDI Hähnchen-Geschnetzeltes 1000 g, 7,49 €'),
  Hähnchenschenkel: aldi(4.25, 'kg', 'MEINE METZGEREI Hähnchen-Schenkel 2 kg, 8,49 €'),
  Putenbrust: aldi(12.49, 'kg', 'MEINE METZGEREI Putenbrustfilet 800 g, 9,99 €'),
  'Hackfleisch (gemischt)': bon(6.49, 'kg', 'ALDI Hackfleisch gemischt XXL 1 kg, 6,49 €'),
  Rinderhack: est(10.98, 'kg'),
  Rindergulasch: aldi(15.58, 'kg', 'MEINE METZGEREI Rindergulasch 500 g, 7,79 €'),
  Rinderhüftsteak: est(25, 'kg'),
  Schweineschnitzel: aldi(8.98, 'kg', 'MEINE METZGEREI Schnitzel vom Schwein 500 g, 4,49 €'),
  Schweinegeschnetzeltes: est(8.98, 'kg'),
  Lachsfilet: est(20, 'kg'),
  Kabeljaufilet: est(17.5, 'kg'),
  Garnelen: aldi(15.51, 'kg', 'GOLDEN SEAFOOD Riesengarnelen Natur 225 g, 3,49 €'),
  Fischstäbchen: aldi(0.2, 'Stück', 'GOLDEN SEAFOOD Fischstäbchen 450 g (15 St.), 2,99 €'),

  // Tiefkühl
  Erbsen: est(2.0, 'kg'),
  'Grüne Bohnen': aldi(3.59, 'kg', 'BIO Gemüsesortiment Junge Bohnen 750 g, 2,69 €'),
  Blattspinat: aldi(3.59, 'kg', 'BIO Gemüsesortiment Blattspinat 750 g, 2,69 €'),
  Kaisergemüse: aldi(3.59, 'kg', 'BIO Gemüsesortiment Kaisergemüse 750 g, 2,69 €'),
  Edamame: est(7.0, 'kg'),
  'Pommes frites': aldi(1.49, 'kg', 'SPEISEZEIT Pommes Frites 1 kg, 1,49 €'),

  // Brot & Backwaren
  Toastbrot: bon(0.04, 'Stück', 'ALDI Weizen-Sandwich 750 g (ca. 30 Scheiben), 1,19 €'),
  Baguette: bon(1.19, 'Stück', 'ALDI Französisches Steinofenbaguette, 1,19 €'),
  Aufbackbrötchen: aldi(0.12, 'Stück', 'GOLDÄHREN Weizenbrötchen 300 g (6 St.), 0,69 €'),
  Burgerbrötchen: aldi(0.17, 'Stück', 'GOLDÄHREN Hamburger-Brötchen 300 g (6 St.), 0,99 €'),
  'Tortilla-Wraps': aldi(0.21, 'Stück', 'GOLDÄHREN Weizen-Wraps 496 g (8 St.), 1,69 €'),
  Fladenbrot: est(1.29, 'Stück'),

  // Obst & Gemüse (bei ALDI SÜD online meist ohne Preis → geschätzt)
  Kartoffeln: bon(1.0, 'kg', 'ALDI Kartoffeln festkochend 2,5 kg, 2,49 €'),
  'Kartoffeln (festkochend)': bon(1.0, 'kg', 'ALDI Kartoffeln festkochend 2,5 kg, 2,49 €'),
  'Große Kartoffel': bon(0.25, 'Stück', 'ALDI Kartoffeln festkochend 2,5 kg (ca. 250 g/St.), 2,49 €'),
  Süßkartoffel: est(2.5, 'kg'),
  'Hokkaido-Kürbis': est(2.0, 'kg'),
  Zwiebel: bon(0.16, 'Stück', 'ALDI Bio-Zwiebeln 750 g (ca. 7 St.), 1,19 €'),
  'Rote Zwiebel': est(0.15, 'Stück'),
  Frühlingszwiebel: est(0.15, 'Stück'),
  Knoblauch: bon(0.03, 'Stück', 'ALDI Knoblauch 200 g (ca. 35 Zehen), 0,99 €'),
  Möhre: bon(0.16, 'Stück', 'ALDI Karotten lose 1,59 €/kg (ca. 100 g/St.)'),
  Paprika: bon(0.75, 'Stück', 'ALDI Paprika 500 g (ca. 3 St.), 2,19–2,29 €'),
  Zucchini: aldi(0.65, 'Stück', 'BIO Zucchini 500 g (ca. 2 St.), 1,29 €'),
  Gurke: est(0.69, 'Stück'),
  Tomate: bon(0.37, 'Stück', 'ALDI Rispentomaten 1 kg (ca. 8 St.), 2,99 €'),
  Cherrytomaten: bon(4.38, 'kg', 'ALDI Datteltomaten 500 g, 2,19 €'),
  Brokkoli: bon(2.39, 'Stück', 'EDEKA G&G Broccoli, 2,39 €'),
  Blumenkohl: est(1.99, 'Stück'),
  Lauch: bon(0.59, 'Stück', 'ALDI Lauch/Porree Stück, 0,59 €'),
  Staudensellerie: est(0.15, 'Stück'),
  Suppengemüse: est(1.49, 'Stück'),
  Weißkohl: est(0.99, 'kg'),
  Champignons: est(5.0, 'kg'),
  Babyspinat: est(12.7, 'kg'),
  Feldsalat: est(12, 'kg'),
  Eisbergsalat: est(0.99, 'Stück'),
  Zuckerschoten: est(10, 'kg'),
  Avocado: est(0.99, 'Stück'),
  Zitrone: est(0.35, 'Stück'),
  Apfel: est(0.4, 'Stück'),
};

/** Eigene Preise (selbst eingetragen oder vom Bon gelernt) – haben Vorrang. Wird von rebuildCatalog gesetzt. */
let USER_PRICES: Record<string, UserPrice> = {};
export function setUserPrices(prices: Record<string, UserPrice>) {
  USER_PRICES = prices;
}

/** Aufschlag auf die Listenpreise je nach Einkaufsmarkt (die Liste sind Discounter-Eigenmarken). */
let PRICE_LEVEL = 1;
export function setPriceLevel(factor: number) {
  PRICE_LEVEL = factor;
}

export function priceLevelFor(store: StoreLevel | undefined, privateLabel: boolean | undefined): number {
  const base = store === 'supermarkt' ? 1.2 : store === 'mix' ? 0.95 : 1;
  return Math.round(base * (privateLabel === false ? 1.25 : 1) * 100) / 100;
}

/** Gültiger Preis einer Zutat: eigener Preis vor Liste (Liste mit Markt-Aufschlag). */
export function priceFor(name: string): IngredientPrice | undefined {
  const own = USER_PRICES[name];
  if (own) return { price: own.price, per: own.per, source: 'eigen', product: own.product };
  const listed = PRICES[name];
  return listed && PRICE_LEVEL !== 1 ? { ...listed, price: listed.price * PRICE_LEVEL } : listed;
}

/** Ungefähres Gewicht eines Stücks – um Packungspreise (€/kg) in Stückpreise umzurechnen. */
export const GRAMS_PER_PIECE: Record<string, number> = {
  Zwiebel: 100, 'Rote Zwiebel': 100, Möhre: 100, Paprika: 170, Tomate: 125, 'Große Kartoffel': 250, Knoblauch: 6,
  Zucchini: 250, Gurke: 400, Lauch: 250, Brokkoli: 450, Blumenkohl: 800, Apfel: 180, Zitrone: 120, Avocado: 200,
  Frühlingszwiebel: 20, Süßkartoffel: 300,
};

const GRAMS_PER: Record<'EL' | 'TL', number> = { EL: 15, TL: 5 };

/** Kosten einer Zutatenzeile in Euro, oder null, wenn kein Preis hinterlegt ist bzw. die Einheit nicht passt. */
export function ingredientCost(ing: Ingredient): number | null {
  const p = priceFor(ing.name);
  if (!p) return null;
  const { amount, unit } = ing;
  if (unit === p.per) return amount * p.price;
  if (p.per === 'kg' || p.per === 'l') {
    if (unit === 'g' || unit === 'ml') return (amount / 1000) * p.price;
    if (unit === 'EL' || unit === 'TL') return ((amount * GRAMS_PER[unit]) / 1000) * p.price;
  }
  if (p.per === 'kg' && unit === 'Stück' && GRAMS_PER_PIECE[ing.name]) return ((amount * GRAMS_PER_PIECE[ing.name]) / 1000) * p.price;
  if (p.per === 'Stück' && unit === 'g' && GRAMS_PER_PIECE[ing.name]) return (amount / GRAMS_PER_PIECE[ing.name]) * p.price;
  if (p.per === 'EL' && unit === 'TL') return (amount / 3) * p.price;
  if (p.per === 'TL' && unit === 'EL') return amount * 3 * p.price;
  return null;
}
