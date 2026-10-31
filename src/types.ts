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
}

export interface PlanSlot {
  day: Weekday;
  recipeId: string;
}

export interface MealPlan {
  createdAt: string;
  slots: PlanSlot[];
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
}

export interface PhotoRef {
  id: string;
  date: string;
}

/** Was zu Hause schon da ist. Ohne Menge = „genug da". */
export interface PantryItem {
  name: string;
  amount?: number;
  unit?: Unit;
}

export type SpendCategory = 'plan' | 'grund' | 'extra' | 'verzichtbar' | 'pfand';

export interface PurchaseItem {
  name: string;
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
