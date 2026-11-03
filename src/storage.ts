import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Settings } from './types';

const KEY = 'meinwochenplan:state:v1';

export const DEFAULT_SETTINGS: Settings = {
  householdSize: 2,
  weeklyBudget: 35,
  cookingDays: [0, 1, 2, 3, 4],
  diet: 'alles',
  allergens: [],
  equipment: ['herd', 'ofen'],
  vibes: ['schnell'],
  proteinLikes: [],
  maxMinutes: 45,
  kids: [],
  maxMinutesWeekday: 30,
  maxMinutesWeekend: 90,
  mealPrep: false,
  leftoverDay: null,
  sides: ['kartoffeln', 'nudeln', 'reis', 'brot'],
  store: 'discounter',
  privateLabel: true,
  basics: ['oel_essig', 'salz_pfeffer'],
  shopRhythm: 'einmal',
  planWeek: 'kommend',
};

export const EMPTY_STATE: AppState = {
  settings: null,
  plan: null,
  recentRecipeIds: [],
  favourites: [],
  ratings: {},
  cooked: [],
  checkedItems: [],
  photos: {},
  pantry: [],
  purchases: [],
  userPrices: {},
  customRecipes: [],
  kidVotes: {},
  archive: [],
  bonNames: {},
  shopExtras: [],
  shopHidden: [],
  shopAmounts: {},
  shopPrices: {},
};

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Speichern ist Komfort; bei Fehlern läuft die App mit dem Zustand im Speicher weiter.
  }
}
