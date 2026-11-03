export type Protein = 'huhn' | 'rind' | 'schwein' | 'fisch' | 'vegetarisch' | 'vegan';
export type Carb = 'reis' | 'nudeln' | 'kartoffeln' | 'brot' | 'sonstiges';
export type Equipment = 'herd' | 'ofen' | 'airfryer' | 'mikrowelle';
export type Allergen = 'gluten' | 'milch' | 'ei' | 'fisch' | 'nuesse' | 'soja' | 'sesam' | 'schalentiere';
export type Diet = 'alles' | 'pescetarisch' | 'vegetarisch' | 'vegan';
export type Vibe = 'schnell' | 'proteinreich' | 'leicht' | 'deftig' | 'international' | 'kinder';
export type Category = 'Obst & Gemüse' | 'Fleisch & Fisch' | 'Kühlregal' | 'Vorrat' | 'Gewürze & Saucen' | 'Brot & Backwaren' | 'Tiefkühl';
export type Unit = 'g' | 'ml' | 'Stück' | 'EL' | 'TL';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Ingredient {
  name: string;
  /** Menge pro Portion */
  amount: number;
  unit: Unit;
  category: Category;
}

export interface Recipe {
  id: string;
  name: string;
  minutes: number;
  /** Preis pro Portion in Euro, berechnet aus den Zutatenpreisen in data/prices.ts */
  pricePerPortion: number;
  /** Zutaten, deren Preis geschätzt statt beim Händler abgelesen ist */
  estimatedIngredients: string[];
  protein: Protein;
  carb: Carb;
  vibes: Vibe[];
  equipment: Equipment[];
  allergens: Allergen[];
  ingredients: Ingredient[];
  steps: string[];
  /** Link zum Originalrezept, wenn das Rezept nach einer Vorlage erstellt wurde */
  source?: string;
}

export interface Settings {
  householdSize: number;
  weeklyBudget: number;
  cookingDays: Weekday[];
  diet: Diet;
  allergens: Allergen[];
  equipment: Equipment[];
  vibes: Vibe[];
  proteinLikes: Protein[];
  maxMinutes: number;
  /** Namen der Kinder für die Daumen-Bewertung */
  kids?: string[];
  /** Kochzeit getrennt nach Mo–Fr und Sa/So (ersetzen maxMinutes, wenn gesetzt) */
  maxMinutesWeekday?: number;
  maxMinutesWeekend?: number;
  /** Jedes zweite Essen ist „Reste vom Vortag“ – es wird für zwei Tage gekocht */
  mealPrep?: boolean;
  /** An diesem Tag wird nichts gekocht, sondern Reste gegessen */
  leftoverDay?: Weekday | null;
  /** Welche Sättigungsbeilagen auf den Tisch kommen; leer/fehlend = alle */
  sides?: Carb[];
  /** Wo eingekauft wird – passt die geschätzten Preise an */
  store?: StoreLevel;
  /** Eigenmarken / No-Name bevorzugt (Preise in der App sind Eigenmarken-Preise) */
  privateLabel?: boolean;
  /** Grundzutaten, die immer da sind und nicht auf die Einkaufsliste kommen */
  basics?: Basic[];
  shopRhythm?: 'einmal' | 'zweimal';
  /** Neue Pläne ab Freitag gelten für die kommende Woche (Standard) oder immer für die laufende */
  planWeek?: 'kommend' | 'laufend';
  /** Einkaufstage für die Kalender-Erinnerung */
  shopDays?: Weekday[];
  /** Uhrzeit des Einkaufs (volle Stunde), Standard 10 */
  shopHour?: number;
}

export type StoreLevel = 'discounter' | 'supermarkt' | 'mix';
export type Basic = 'oel_essig' | 'salz_pfeffer' | 'mehl_zucker' | 'zwiebel_knoblauch' | 'gewuerze';

export interface PlanSlot {
  day: Weekday;
  /** Leer bei „restetag“ */
  recipeId: string;
  /** „reste“ = Reste vom Vortag (doppelt gekocht), „restetag“ = fester Restetag ohne Kochen */
  kind?: 'reste' | 'restetag';
  /** Personen an diesem Tag, wenn abweichend vom Haushalt (z. B. Gäste) */
  guests?: number;
}

export interface MealPlan {
  createdAt: string;
  /** Montag der Woche, für die der Plan gilt (JJJJ-MM-TT). Fehlt bei alten Plänen. */
  weekStart?: string;
  slots: PlanSlot[];
  /** Nur bei gespeicherten Wochen: was gekocht wurde */
  cooked?: string[];
  /** Selbst gespeichert (bleibt, wird nicht automatisch aufgeräumt) und ggf. benannt */
  saved?: boolean;
  name?: string;
}

export interface AppState {
  settings: Settings | null;
  plan: MealPlan | null;
  /** Rezept-IDs der letzten Pläne, neueste zuerst */
  recentRecipeIds: string[];
  favourites: string[];
  ratings: Record<string, number>;
  cooked: string[];
  checkedItems: string[];
  /** Fotos vom gekochten Essen pro Rezept, neueste zuerst. Die Bilddaten liegen separat (photos.ts). */
  photos: Record<string, PhotoRef[]>;
  pantry: PantryItem[];
  purchases: Purchase[];
  /** Selbst eingetragene oder vom Bon gelernte Preise; haben Vorrang vor prices.ts */
  userPrices: Record<string, UserPrice>;
  customRecipes: CustomRecipe[];
  /** Rezept-ID → Kind → Daumen hoch (1) oder runter (-1) */
  kidVotes: Record<string, Record<string, KidVote>>;
  /** Frühere und gespeicherte Wochen, neueste zuerst */
  archive: MealPlan[];
  /** Selbst gelernte Bon-Kürzel: „TOPA 3LG. 20X200“ → Toilettenpapier */
  bonNames: Record<string, BonName>;
  /** Selbst hinzugefügte Einkaufsartikel (nicht aus dem Plan) */
  shopExtras: ShopExtra[];
  /** Plan-Artikel, die diese Woche nicht gekauft werden (Kachel gelöscht) */
  shopHidden?: string[];
  /** Selbst geänderte Mengen der Plan-Artikel, z. B. „2 Packungen“ */
  shopAmounts?: Record<string, string>;
  /** Selbst eingetragene Preise je Stück/Packung für die Einkaufsliste, Schlüssel = Name klein */
  shopPrices?: Record<string, ShopPrice>;
  /** Eigene Reihenfolge der Ladenbereiche in der Einkaufsliste */
  shopCatOrder?: Category[];
  /** Einkaufsliste nach dem günstigsten Laden aufteilen */
  shopSplit?: boolean;
  /** Artikel, die regelmäßig von selbst auf die Liste kommen */
  recurring?: RecurringItem[];
  /** Wunschessen: Kind → Rezept-ID (für den nächsten Plan) */
  kidWishes?: Record<string, string>;
  /** Auszug für das Kalender-Abo (wird von der App geschrieben, vom Server gelesen) */
  calendar?: CalendarFeed;
}

export interface RecurringItem {
  id: string;
  name: string;
  amount?: string;
  everyDays: number;
  /** Nächstes Mal auf die Liste (ISO-Datum) */
  next: string;
}

export interface CalendarFeed {
  /** ISO-Zeitpunkt der letzten Aktualisierung */
  updated: string;
  shopDays: Weekday[];
  shopHour: number;
  openCost: number;
  openCount: number;
  /** Offene Artikel (Auszug) für die Beschreibung */
  items: string[];
  /** Bald leer: Name und Datum (ISO) */
  empty: { name: string; date: string; remind: number }[];
  /** Reste aufbrauchen: Name und Haltbarkeitsdatum (ISO) */
  useBy: { name: string; date: string }[];
  /** Regelmäßige Artikel: nächstes Mal */
  recurring: { name: string; date: string }[];
}

export interface ShopPrice {
  price: number;
  /** ISO-Datum der Eingabe */
  date: string;
}

export interface ShopExtra {
  id: string;
  name: string;
  /** frei, z. B. „2 Packungen“ */
  amount?: string;
  done?: boolean;
  /** Woher: selbst eingetragen oder aus der Vorrats-Erinnerung */
  from?: 'eigen' | 'vorrat' | 'regelmaessig';
}

export interface BonName {
  name: string;
  category: SpendCategory;
  ingredient?: string;
}

export interface PhotoRef {
  id: string;
  date: string;
}

export type PantryKind = 'lebensmittel' | 'getraenke' | 'drogerie' | 'haushalt';

/** Was zu Hause schon da ist. Ohne Menge = „genug da". */
export interface PantryItem {
  name: string;
  amount?: number;
  /** Rezept-Einheit (g, ml, Stück …) oder frei, z. B. „Flaschen“, „Rollen“ */
  unit?: Unit | string;
  kind?: PantryKind;
  /** Verbrauch pro Tag in derselben Einheit – dann rechnet die App mit, wann es leer ist */
  perDay?: number;
  /** Wann die Menge zuletzt eingetragen wurde (ISO) */
  since?: string;
  /** So viele Tage vor „leer“ erinnern (Standard 1) */
  remindDays?: number;
  /** Haltbar bis (ISO-Datum) – für den Reste-Vorschlag */
  useBy?: string;
  /** Bald leer → von selbst auf die Einkaufsliste */
  autoList?: boolean;
}

export type SpendCategory = 'plan' | 'grund' | 'extra' | 'verzichtbar' | 'pfand';

export interface PurchaseItem {
  /** Text wie auf dem Bon */
  name: string;
  /** Verständlicher Name, z. B. „Toilettenpapier“ für „TOPA 3LG. 20X200“ */
  label?: string;
  /** Vom Nutzer geprüft – wird nicht mehr als „unklar“ nachgefragt */
  known?: boolean;
  price: number;
  category: SpendCategory;
  /** Zugeordnete Zutat aus den Rezepten, falls erkannt */
  ingredient?: string;
  /** Gewicht bzw. Menge in kg/l, falls auf dem Bon erkennbar */
  quantity?: number;
}

export interface Purchase {
  id: string;
  /** ISO-Datum des Einkaufs */
  date: string;
  store: string;
  total: number;
  items: PurchaseItem[];
  /** Foto vom Kassenbon */
  photoId?: string;
  /** „wartet" = Bon fotografiert, aber noch nicht am PC ausgelesen */
  status: 'fertig' | 'wartet';
}

export interface UserPrice {
  price: number;
  per: 'kg' | 'l' | 'Stück' | 'EL' | 'TL';
  product: string;
  date: string;
}

export type CustomRecipe = Omit<Recipe, 'pricePerPortion' | 'estimatedIngredients'>;

export type KidVote = 1 | -1;
