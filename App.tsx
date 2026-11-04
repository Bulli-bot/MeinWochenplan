import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './src/auth';
import { deleteCloudPhoto, uploadPhoto, useCloudSync } from './src/cloud';
import { priceLevelFor } from './src/data/prices';
import { BUILTIN_IDS, RECIPE_BY_ID, rebuildCatalog } from './src/data/recipes';
import { budgetWeekKey, isoWeek, parseDay, planWeekKey, targetWeekStart, todayInPlan, weekRelation } from './src/logic/dates';
import { eligibleRecipes, findSwap, generatePlan, kidTally, planCost, type PlanContext } from './src/logic/generator';
import { buildCalendarFeed, sameFeed } from './src/logic/calendar';
import { applyRecurring, setRecurring } from './src/logic/recurring';
import { applyAutoList, applyReceipt, consumeCooked } from './src/logic/automations';
import { setMembers, slotPeople } from './src/logic/people';
import { mealTime, slotEatAt } from './src/logic/mealtime';
import { LiveShopPanel } from './src/screens/ShopCards';
import { openShopping } from './src/logic/shopPrice';
import { newVote, voteScores } from './src/logic/vote';
import { cookableNow } from './src/logic/vision';
import { VoteScreen } from './src/screens/VoteScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { deletePhotoData, newPhotoId, pickPhoto, savePhotoData } from './src/photos';
import { AccountScreen } from './src/screens/AccountScreen';
import { AiScreen } from './src/screens/AiScreen';
import { AuthScreen, NewPasswordScreen, PendingScreen } from './src/screens/AuthScreen';
import { CategoryBar, ExpensesScreen } from './src/screens/ExpensesScreen';
import { MoreScreen, type MoreView } from './src/screens/MoreScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { PantryScreen } from './src/screens/PantryScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PricesScreen } from './src/screens/PricesScreen';
import { RecipeEditScreen } from './src/screens/RecipeEditScreen';
import { RecipeScreen } from './src/screens/RecipeScreen';
import { DEFAULT_FILTERS, RecipesScreen, type RecipeFilters } from './src/screens/RecipesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ShoppingListScreen, capitalize } from './src/screens/ShoppingListScreen';
import { Snackbar, type UndoToast } from './src/snackbar';
import { DEFAULT_SETTINGS, EMPTY_STATE, loadState, saveState } from './src/storage';
import type { AppState, CustomRecipe, MealPlan, Settings } from './src/types';
import { Button, Icon, colors, euro, hov, maxBodyWidth, space, styles, useLayout, type IconName } from './src/ui';

type Tab = 'start' | 'plan' | 'rezepte' | 'einkauf' | 'ausgaben' | 'ki' | 'mehr';
const TABS: [Tab, string, IconName][] = [
  ['start', 'Übersicht', 'grid'], ['plan', 'Woche', 'calendar'], ['rezepte', 'Rezepte', 'book-open'],
  ['einkauf', 'Einkauf', 'shopping-cart'], ['ausgaben', 'Ausgaben', 'credit-card'], ['ki', 'KI-Assistent', 'zap'], ['mehr', 'Mehr', 'menu'],
];
/** Auf dem Handy ist unten nur Platz für fünf – Ausgaben und KI gibt es dort über die Übersicht und „Mehr“. */
const PHONE_TABS: Tab[] = ['start', 'plan', 'rezepte', 'einkauf', 'mehr'];
const RECENT_LIMIT = 21;
/** So viele automatisch aufgehobene Wochen bleiben; selbst gespeicherte bleiben immer. */
const ARCHIVE_LIMIT = 26;
const LOCAL_OWNER_KEY = 'meinwochenplan:local-owner';

/** Woche ins Archiv legen (mit „gekocht“), neueste zuerst, alte ungespeicherte aufräumen. */
function archiveAdd(archive: MealPlan[], plan: MealPlan, cooked: string[]): MealPlan[] {
  const entry: MealPlan = { ...plan, weekStart: planWeekKey(plan), cooked };
  const rest = archive.filter((p) => p.createdAt !== plan.createdAt);
  const sorted = [entry, ...rest].sort((a, b) => planWeekKey(b).localeCompare(planWeekKey(a)));
  let unsaved = 0;
  return sorted.filter((p) => p.saved || ++unsaved <= ARCHIVE_LIMIT);
}

export default function App() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('start');
  const layout = useLayout();
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [editRecipe, setEditRecipe] = useState<CustomRecipe | 'neu' | null>(null);
  const [moreView, setMoreView] = useState<MoreView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickDay, setPickDay] = useState<number | null>(null);
  /** Angezeigte Woche (JJJJ-MM-TT des Montags); null = aktueller Plan */
  const [viewWeek, setViewWeek] = useState<string | null>(null);
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [pickFilters, setPickFilters] = useState<RecipeFilters>({ ...DEFAULT_FILTERS, onlyMatching: true });
  /** Konto, für das der Abgleich läuft – erst gesetzt, wenn die lokalen Daten zu diesem Konto passen */
  const [syncUser, setSyncUser] = useState<string | null>(null);
  const auth = useAuth();
  const firstSave = useRef(true);
  /** Pro Tag die Rezepte, die beim Tauschen schon dran waren – damit nicht dieselben zurückkommen. */
  const swapSeen = useRef<Record<number, string[]>>({});
  /** „Rückgängig“-Leiste nach dem Löschen. Eine neue ersetzt die alte – deren Aufräumen läuft dann sofort. */
  const [toast, setToast] = useState<UndoToast | null>(null);
  /** Familien-Abstimmung offen */
  const [voteOpen, setVoteOpen] = useState(false);
  /** Wochen-Rückblick offen */
  const [reviewOpen, setReviewOpen] = useState(false);
  /** Einkaufsmodus: Vollbild ohne Tab-Leiste */
  const [shopMode, setShopMode] = useState(false);
  const toastRef = useRef<UndoToast | null>(null);
  const showToast = (next: UndoToast | null) => {
    if (next && toastRef.current && toastRef.current !== next) toastRef.current.onExpire?.();
    toastRef.current = next;
    setToast(next);
  };

  useEffect(() => {
    (async () => {
      setState(await loadState());
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    saveState(state);
  }, [state, loaded]);

  const replaceFromCloud = (next: AppState) => {
    swapSeen.current = {};
    setState(next);
  };
  // Lokale Daten gehören immer zu genau einem Konto. Meldet sich jemand anderes an, wird vorher geleert,
  // damit nichts in den falschen Haushalt hochgeladen wird.
  const approvedUser = auth.session && auth.profile?.approved ? auth.session.user.id : null;
  useEffect(() => {
    if (!loaded) return;
    if (!approvedUser) {
      setSyncUser(null);
      return;
    }
    (async () => {
      const owner = await AsyncStorage.getItem(LOCAL_OWNER_KEY).catch(() => null);
      if (owner && owner !== approvedUser) {
        swapSeen.current = {};
        setState(EMPTY_STATE);
      }
      await AsyncStorage.setItem(LOCAL_OWNER_KEY, approvedUser).catch(() => {});
      setSyncUser(approvedUser);
    })();
  }, [approvedUser, loaded]);
  const { status: syncStatus, syncNow } = useCloudSync(state, loaded, replaceFromCloud, syncUser);

  // Erst nach dem Abgleich mit der Cloud selbst etwas ändern – sonst überschreibt ein alter lokaler Stand
  // womöglich einen neueren vom anderen Gerät.
  const synced = loaded && !!syncUser && syncStatus.kind === 'ok';
  const today = new Date().toDateString();
  // Regelmäßige Artikel, die fällig sind, auf die Liste
  useEffect(() => {
    if (synced) setState((prev) => applyAutoList(applyRecurring(prev)));
  }, [synced, state.recurring, state.pantry, today]);
  // Auszug für das Kalender-Abo aktuell halten
  useEffect(() => {
    if (!synced) return;
    const feed = buildCalendarFeed(state, state.plan, state.settings);
    if (!sameFeed(feed, state.calendar)) {
      setState((prev) => ({ ...prev, calendar: feed ? { ...feed, updated: new Date().toISOString() } : undefined }));
    }
  }, [synced, state, today]);

  const signOut = async () => {
    await auth.signOut();
    swapSeen.current = {};
    setState(EMPTY_STATE);
    setTab('start');
    setMoreView(null);
    setOpenRecipe(null);
  };

  // Eigene Rezepte und Preise in den Katalog rechnen, bevor irgendetwas gerendert wird.
  rebuildCatalog(state.customRecipes, state.userPrices, priceLevelFor(state.settings?.store, state.settings?.privateLabel));
  setMembers(state.settings?.members);

  const context = (settings: Settings): PlanContext => ({
    settings,
    favourites: state.favourites,
    ratings: state.ratings,
    recentRecipeIds: state.recentRecipeIds,
    kidVotes: state.kidVotes,
    pantry: state.pantry,
    wishes: [...Object.values(state.kidWishes ?? {}), ...(state.carryOver ?? [])],
    votes: voteScores(state.vote),
  });

  /**
   * Neuen Plan aktiv machen. Gilt er für eine andere Woche als der bisherige, wandert der bisherige
   * ins Archiv (mit dem, was gekocht wurde); für dieselbe Woche wird er ersetzt (außer er ist gespeichert).
   */
  const installPlan = (next: MealPlan, settings?: Settings) => {
    const week = planWeekKey(next);
    swapSeen.current = {};
    setViewWeek(null);
    setState((prev) => {
      const old = prev.plan;
      const keepOld = old && (planWeekKey(old) !== week || old.saved);
      const archive = (keepOld ? archiveAdd(prev.archive, old, prev.cooked) : prev.archive)
        .filter((p) => p.saved || planWeekKey(p) !== week);
      return {
        ...prev,
        settings: settings ?? prev.settings,
        plan: next,
        archive,
        // Der bisherige Plan wird zur "letzten Woche", damit sich Gerichte nicht sofort wiederholen.
        recentRecipeIds: [...(old?.slots.map((s) => s.recipeId).filter(Boolean) ?? []), ...prev.recentRecipeIds].slice(0, RECENT_LIMIT),
        // Die Abstimmung ist mit dem neuen Plan erledigt, Übernommenes auch
        vote: undefined,
        carryOver: (prev.carryOver ?? []).filter((id) => !next.slots.some((s) => s.recipeId === id)),
        // Erfüllte Wunschessen sind erledigt
        kidWishes: Object.fromEntries(Object.entries(prev.kidWishes ?? {}).filter(([, id]) => !next.slots.some((s) => s.recipeId === id))),
        checkedItems: [],
        cooked: [],
        shopExtras: prev.shopExtras.filter((x) => !x.done),
        shopHidden: [],
        shopAmounts: {},
      };
    });
  };

  /** `week` = Montag der Zielwoche; ohne Angabe nach Einstellung (ab Freitag die kommende Woche). */
  const createPlan = (settings: Settings, week?: string) => {
    const result = generatePlan(context(settings), week ?? targetWeekStart(settings));
    if (!result.ok) {
      setError(result.reason);
      return false;
    }
    setError(null);
    installPlan(result.plan, settings);
    return true;
  };

  const setDayRecipe = (day: number, recipeId: string) => {
    const current = state.plan?.slots.find((s) => s.day === day);
    const previous = current?.recipeId;
    if (previous) swapSeen.current[day] = [...(swapSeen.current[day] ?? []), previous];
    setState((prev) => prev.plan ? {
      ...prev,
      plan: {
        ...prev.plan,
        slots: prev.plan.slots.map((s) => {
          if (s.day === day) return { day: s.day, recipeId, ...(s.guests ? { guests: s.guests } : {}), ...(s.absent ? { absent: s.absent } : {}) };
          // Beim Vorkochen wandert der Reste-Tag mit dem gekochten Gericht mit
          if (!current?.kind && s.kind === 'reste' && s.recipeId === previous && s.day > day) return { ...s, recipeId };
          return s;
        }),
      },
    } : prev);
  };

  /** Woche merken bzw. vergessen – aktueller Plan oder Eintrag im Archiv */
  const markSaved = (target: MealPlan, saved: boolean, name?: string) => setState((prev) => {
    const patch = (p: MealPlan): MealPlan => (p.createdAt === target.createdAt ? { ...p, saved, name: saved ? (name?.trim() || undefined) : p.name } : p);
    return { ...prev, plan: prev.plan ? patch(prev.plan) : prev.plan, archive: prev.archive.map(patch) };
  });

  const addExtra = (raw: string, from: 'eigen' | 'vorrat' = 'eigen') => {
    const name = capitalize(raw);
    setState((prev) => (
      prev.shopExtras.some((x) => !x.done && x.name.toLowerCase() === name.toLowerCase()) ? prev
        : { ...prev, shopExtras: [...prev.shopExtras, { id: `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, from }] }
    ));
  };

  /** Leer-Scan: Artikel ist aufgebraucht → auf die Liste und (falls passend) aus dem Vorrat */
  const scannedEmpty = (name: string) => {
    const low = name.toLowerCase();
    const gone = state.pantry.filter((p) => p.name.trim().length >= 3 && low.includes(p.name.trim().toLowerCase()));
    addExtra(name, 'vorrat');
    if (gone.length) setState((prev) => ({ ...prev, pantry: prev.pantry.filter((p) => !gone.includes(p)) }));
    showToast({ text: `${capitalize(name)} kommt auf die Liste${gone.length ? ` · aus dem Vorrat: ${gone.map((g) => g.name).join(', ')}` : ''}`,
      undo: () => setState((prev) => ({
        ...prev,
        shopExtras: prev.shopExtras.filter((x) => !(x.from === 'vorrat' && !x.done && x.name.toLowerCase() === capitalize(name).toLowerCase())),
        pantry: [...prev.pantry, ...gone.filter((g) => !prev.pantry.some((p) => p.name === g.name))],
      })),
    });
  };

  const swapDay = (day: number) => {
    if (!state.plan || !state.settings) return false;
    const replacement = findSwap(state.plan, day, context(state.settings), swapSeen.current[day]);
    if (!replacement) {
      setError('Für diesen Tag gibt es keinen passenden Ersatz im Budget.');
      return false;
    }
    setError(null);
    setDayRecipe(day, replacement);
    return true;
  };

  const toggleIn = (key: 'favourites' | 'cooked' | 'checkedItems', value: string) =>
    setState((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));

  /** Gekocht → Zutaten im Vorrat abziehen, mit „Rückgängig“ */
  const consumeFor = (recipeId: string) => {
    if (state.cooked.includes(recipeId)) return;
    const slot = state.plan?.slots.find((s) => s.recipeId === recipeId && !s.kind);
    const people = slot ? slotPeople(slot, state.settings?.householdSize ?? 4) : state.settings?.householdSize ?? 4;
    const before = state.pantry;
    const { used } = consumeCooked(before, recipeId, people);
    if (!used.length) return;
    setState((prev) => ({ ...prev, pantry: consumeCooked(prev.pantry, recipeId, people).pantry }));
    showToast({ text: `Aus dem Vorrat abgezogen: ${used.join(', ')}`, undo: () => setState((prev) => ({ ...prev, pantry: before })) });
  };

  /** Foto aufnehmen, lokal speichern, in die Cloud schieben → ID */
  const takePhoto = async (kind: 'essen' | 'bon') => {
    const data = await pickPhoto(kind);
    if (!data) return null;
    const id = newPhotoId();
    await savePhotoData(id, data);
    uploadPhoto(id).catch(() => {});
    return id;
  };

  const addMealPhoto = async (recipeId: string) => {
    const id = await takePhoto('essen');
    if (!id) return;
    consumeFor(recipeId);
    setState((prev) => ({
      ...prev,
      photos: { ...prev.photos, [recipeId]: [{ id, date: new Date().toISOString() }, ...(prev.photos[recipeId] ?? [])] },
      cooked: prev.cooked.includes(recipeId) ? prev.cooked : [...prev.cooked, recipeId],
    }));
  };

  const deleteMealPhoto = (recipeId: string, id: string) => {
    deletePhotoData(id);
    deleteCloudPhoto(id);
    setState((prev) => ({ ...prev, photos: { ...prev.photos, [recipeId]: (prev.photos[recipeId] ?? []).filter((p) => p.id !== id) } }));
  };

  if (!loaded || auth.loading || (approvedUser && syncUser !== approvedUser)) {
    return (
      <View style={[local.root, local.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!auth.session) return <View style={local.root}><StatusBar style="light" /><AuthScreen /></View>;
  if (auth.recovery) {
    return (
      <View style={local.root}>
        <StatusBar style="light" />
        <NewPasswordScreen email={auth.session.user.email ?? ''} onDone={auth.finishRecovery} />
      </View>
    );
  }
  if (!auth.profile?.approved) {
    return (
      <View style={local.root}>
        <StatusBar style="light" />
        <PendingScreen email={auth.session.user.email ?? ''} onRefresh={auth.refresh} onSignOut={signOut} />
      </View>
    );
  }
  const profile = auth.profile;

  const { settings, plan } = state;
  // Erster Start: kurz warten, ob die Cloud schon eine Woche hat, statt sofort das Formular zu zeigen.
  const isFirstRun = (!settings || !plan) && syncStatus.kind !== 'läuft';

  // Wochen: aktueller Plan plus Archiv (gleiche Woche zählt nur einmal, der aktuelle gewinnt)
  const allPlans: MealPlan[] = plan ? [plan, ...state.archive.filter((p) => planWeekKey(p) !== planWeekKey(plan))] : [];
  const weeksAsc = [...allPlans].sort((a, b) => planWeekKey(a).localeCompare(planWeekKey(b)));
  const shown = (viewWeek ? allPlans.find((p) => planWeekKey(p) === viewWeek) : undefined) ?? plan;
  const shownIdx = shown ? weeksAsc.indexOf(shown) : -1;
  const nav = shown ? {
    plan: shown,
    relation: weekRelation(shown),
    onPrev: shownIdx > 0 ? () => setViewWeek(planWeekKey(weeksAsc[shownIdx - 1])) : undefined,
    onNext: shownIdx >= 0 && shownIdx < weeksAsc.length - 1 ? () => setViewWeek(planWeekKey(weeksAsc[shownIdx + 1])) : undefined,
  } : null;
  const isActiveShown = !!plan && shown === plan;
  const todayPlan = allPlans.find((p) => todayInPlan(p) !== null) ?? null;
  const target = settings ? targetWeekStart(settings) : null;
  // Ab Freitag: Hinweis „kommende Woche planen“, solange der aktuelle Plan noch für diese Woche ist
  const planNext = settings && plan && target && target > planWeekKey(plan)
    ? { label: `Kommende Woche (KW ${isoWeek(parseDay(target))})`, run: () => { createPlan(settings, target); } }
    : undefined;
  const weekOf = (iso: string) => budgetWeekKey(iso, settings);
  const nowWeek = budgetWeekKey(new Date().toISOString(), settings);
  const purchasesFor = (week: string) => state.purchases.filter((p) => p.status === 'fertig' && weekOf(p.date) === week);
  const goMore = (v: MoreView) => { setOpenRecipe(null); setEditRecipe(null); setPickDay(null); setTab('mehr'); setMoreView(v); };

  let body;
  if (!settings || !plan) {
    body = isFirstRun ? (
      <SettingsScreen
        initial={settings ?? DEFAULT_SETTINGS}
        isFirstRun
        onSave={createPlan}
        error={error}
        header={auth.notice ? <View style={[styles.card, { gap: 8 }]}><Text style={styles.hint}>{auth.notice}</Text></View> : undefined}
      />
    ) : <View style={[local.root, local.center]}><ActivityIndicator color={colors.accent} /></View>;
  } else if (editRecipe) {
    body = (
      <RecipeEditScreen
        initial={editRecipe === 'neu' ? undefined : editRecipe}
        onCancel={() => setEditRecipe(null)}
        onSave={(r) => {
          setState((prev) => ({ ...prev, customRecipes: [...prev.customRecipes.filter((x) => x.id !== r.id), r] }));
          setEditRecipe(null);
          setOpenRecipe(r.id);
        }}
      />
    );
  } else if (openRecipe) {
    const id = openRecipe;
    // Steht das Gericht im Plan (bevorzugt heute), gelten Personen und Essenszeit dieses Tages
    const today = plan ? todayInPlan(plan) : null;
    const recipeSlot = plan?.slots.find((s) => s.recipeId === id && !s.kind && s.day === today) ?? plan?.slots.find((s) => s.recipeId === id && !s.kind);
    body = (
      <RecipeScreen
        recipeId={id}
        householdSize={recipeSlot ? slotPeople(recipeSlot, settings.householdSize) : settings.householdSize}
        eatAt={slotEatAt(recipeSlot, settings)}
        isFavourite={state.favourites.includes(id)}
        isCooked={state.cooked.includes(id)}
        rating={state.ratings[id]}
        photos={state.photos[id] ?? []}
        kids={settings.kids ?? []}
        votes={state.kidVotes[id] ?? {}}
        isCustom={!BUILTIN_IDS.has(id)}
        onBack={() => setOpenRecipe(null)}
        onToggleFavourite={() => toggleIn('favourites', id)}
        onToggleCooked={() => { consumeFor(id); toggleIn('cooked', id); }}
        wishes={state.kidWishes ?? {}}
        onWish={(kid, on) => setState((prev) => {
          const { [kid]: _, ...rest } = prev.kidWishes ?? {};
          return { ...prev, kidWishes: on ? { ...rest, [kid]: id } : rest };
        })}
        onRate={(stars) => setState((prev) => ({ ...prev, ratings: { ...prev.ratings, [id]: stars } }))}
        onAddPhoto={() => addMealPhoto(id)}
        onDeletePhoto={(photoId) => deleteMealPhoto(id, photoId)}
        onVote={(kid, vote) => setState((prev) => {
          const { [kid]: _, ...rest } = prev.kidVotes[id] ?? {};
          return { ...prev, kidVotes: { ...prev.kidVotes, [id]: vote ? { ...rest, [kid]: vote } : rest } };
        })}
        onEdit={() => setEditRecipe(state.customRecipes.find((r) => r.id === id) ?? null)}
        onDelete={() => {
          const gone = state.customRecipes.find((r) => r.id === id);
          setOpenRecipe(null);
          setState((prev) => ({ ...prev, customRecipes: prev.customRecipes.filter((r) => r.id !== id) }));
          if (gone) showToast({ text: `„${gone.name}“ gelöscht`, undo: () => setState((prev) => ({ ...prev, customRecipes: [...prev.customRecipes, gone] })) });
        }}
      />
    );
  } else if (pickDay !== null) {
    body = (
      <RecipesScreen
        context={context(settings)}
        favourites={state.favourites}
        filters={pickFilters}
        onFilters={setPickFilters}
        onOpen={setOpenRecipe}
        pickFor={{
          plan,
          day: pickDay,
          onPick: (id) => { setDayRecipe(pickDay, id); setPickDay(null); },
          onRandom: () => { if (swapDay(pickDay)) setPickDay(null); },
          onCancel: () => setPickDay(null),
        }}
      />
    );
  } else if (reviewOpen) {
    const reviewed = shown!;
    body = (
      <ReviewScreen plan={reviewed} cooked={reviewed === plan ? state.cooked : reviewed.cooked ?? []} purchases={purchasesFor(planWeekKey(reviewed))}
        budget={settings.weeklyBudget} photos={state.photos} ratings={state.ratings} kidUps={(id) => kidTally(id, context(settings)).up}
        pantry={state.pantry} carryOver={state.carryOver ?? []}
        onCarry={(id) => setState((prev) => ({ ...prev, carryOver: (prev.carryOver ?? []).includes(id) ? (prev.carryOver ?? []).filter((x) => x !== id) : [...(prev.carryOver ?? []), id] }))}
        onOpen={setOpenRecipe}
        onPlanNext={() => { setReviewOpen(false); if (planNext) planNext.run(); else createPlan(settings); setTab('plan'); }}
        onSave={() => markSaved(reviewed, !reviewed.saved)}
        onBack={() => setReviewOpen(false)} />
    );
  } else if (voteOpen) {
    // Wer abstimmen kann: Mitglieder, sonst „Ich“ + Kinder
    const voters = settings.members?.length ? settings.members.map((m) => m.name) : [profile.name || 'Ich', ...(settings.kids ?? [])];
    body = (
      <VoteScreen vote={state.vote} voters={voters} householdSize={settings.householdSize} photos={state.photos}
        onStart={() => setState((prev) => ({ ...prev, vote: newVote(eligibleRecipes(context(settings)), prev.recentRecipeIds) }))}
        onCast={(voter, id, choice) => setState((prev) => {
          if (!prev.vote) return prev;
          const { [id]: _, ...rest } = prev.vote.ballots[voter] ?? {};
          return { ...prev, vote: { ...prev.vote, ballots: { ...prev.vote.ballots, [voter]: choice === null ? rest : { ...rest, [id]: choice } } } };
        })}
        onPlan={() => { if (createPlan(settings)) { setVoteOpen(false); setTab('plan'); } }}
        onOpen={setOpenRecipe}
        onBack={() => setVoteOpen(false)} />
    );
  } else if (tab === 'start') {
    body = (
      <OverviewScreen state={state} settings={settings} plan={shown!} isActive={isActiveShown} nav={nav!} todayPlan={todayPlan}
        weekPurchases={purchasesFor(planWeekKey(shown!))} showExpenses={!layout.isDesktop} name={profile.name} notice={auth.notice} syncStatus={syncStatus}
        onOpen={setOpenRecipe} onPlanNext={planNext} onToShopping={(n) => addExtra(n, 'vorrat')}
        onGo={(t) => { if (t === 'vorrat') goMore('vorrat'); else { setTab(t); setMoreView(null); } }} />
    );
  } else if (tab === 'plan') {
    body = (
      <PlanScreen
        plan={shown!}
        isActive={isActiveShown}
        nav={nav!}
        allPlans={allPlans}
        savedPlans={allPlans.filter((p) => p.saved && p !== shown)}
        householdSize={settings.householdSize}
        budget={settings.weeklyBudget}
        favourites={state.favourites}
        cooked={isActiveShown ? state.cooked : shown!.cooked ?? []}
        photos={state.photos}
        kidInfo={(rid) => kidTally(rid, { kidVotes: state.kidVotes, settings })}
        error={error}
        onOpen={setOpenRecipe}
        onSwap={swapDay}
        onChoose={(day) => { setError(null); setPickDay(day); }}
        wishes={state.kidWishes ?? {}}
        vote={state.vote}
        onVote={() => setVoteOpen(true)}
        onReview={() => setReviewOpen(true)}
        onMove={(from, to) => setState((prev) => {
          if (!prev.plan) return prev;
          const a = prev.plan.slots.find((x) => x.day === from);
          const b = prev.plan.slots.find((x) => x.day === to);
          if (!a || !b) return prev;
          // Gericht, Art (Reste/Restetag) und Personen wandern mit dem Tag
          // Wer an dem Tag da ist (absent), bleibt beim Tag
          const move = (target: typeof a, src: typeof a) => ({ day: target.day, recipeId: src.recipeId, ...(src.kind ? { kind: src.kind } : {}), ...(src.guests ? { guests: src.guests } : {}), ...(target.absent ? { absent: target.absent } : {}), ...(target.eatAt ? { eatAt: target.eatAt } : {}) });
          return { ...prev, plan: { ...prev.plan, slots: prev.plan.slots.map((x) => (x.day === from ? move(a, b) : x.day === to ? move(b, a) : x)) } };
        })}
        onAbsent={(day, name) => setState((prev) => prev.plan ? {
          ...prev,
          plan: { ...prev.plan, slots: prev.plan.slots.map((x) => {
            if (x.day !== day) return x;
            const absent = x.absent?.includes(name) ? x.absent.filter((n) => n !== name) : [...(x.absent ?? []), name];
            const { absent: _, ...rest } = x;
            return absent.length ? { ...rest, absent } : rest;
          }) },
        } : prev)}
        mealTime={mealTime(settings)}
        shopPanel={layout.isUltra && isActiveShown ? <LiveShopPanel {...openShopping(state, plan, settings)} onGo={() => setTab('einkauf')} /> : undefined}
        onEatAt={(day, time) => setState((prev) => prev.plan ? {
          ...prev,
          plan: { ...prev.plan, slots: prev.plan.slots.map((x) => {
            if (x.day !== day) return x;
            const { eatAt: _, ...rest } = x;
            return time && time !== mealTime(prev.settings) ? { ...rest, eatAt: time } : rest;
          }) },
        } : prev)}
        onGuests={(day, guests) => setState((prev) => prev.plan ? {
          ...prev,
          plan: { ...prev.plan, slots: prev.plan.slots.map((x) => {
            if (x.day !== day) return x;
            const { guests: _, ...rest } = x;
            return guests ? { ...rest, guests } : rest;
          }) },
        } : prev)}
        onRegenerate={() => createPlan(settings, planWeekKey(plan))}
        onPlanNext={planNext}
        onSaveWeek={(name) => markSaved(shown!, true, name)}
        onUnsave={(p) => markSaved(p, false)}
        onReuse={(p) => installPlan({ createdAt: new Date().toISOString(), weekStart: targetWeekStart(settings), slots: p.slots.map((x) => ({ ...x })) })}
        footer={<Text style={[styles.hint, syncStatus.kind === 'fehler' && { color: colors.danger }]}>☁ {syncStatus.text}</Text>}
      />
    );
  } else if (tab === 'ki') {
    body = <AiScreen state={state} settings={settings} onRecipeDraft={(r) => setEditRecipe(r)} />;
  } else if (tab === 'rezepte') {
    body = <RecipesScreen context={context(settings)} favourites={state.favourites} filters={filters} onFilters={setFilters} onOpen={setOpenRecipe} onNew={() => setEditRecipe('neu')} />;
  } else if (tab === 'einkauf') {
    body = (
      <ShoppingListScreen
        plan={plan}
        settings={settings}
        checked={state.checkedItems}
        pantry={state.pantry}
        extras={state.shopExtras}
        onAddExtra={(n) => addExtra(n)}
        onBuyAnyway={(name, amount) => {
          const id = `x${Date.now().toString(36)}`;
          setState((prev) => ({ ...prev, shopExtras: [...prev.shopExtras, { id, name: capitalize(name), amount, from: 'eigen' }] }));
          showToast({ text: `${capitalize(name)} kommt doch auf die Liste`, undo: () => setState((prev) => ({ ...prev, shopExtras: prev.shopExtras.filter((x) => x.id !== id) })) });
        }}
        onToggleExtra={(id) => setState((prev) => ({ ...prev, shopExtras: prev.shopExtras.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }))}
        onRemoveExtra={(id) => {
          const gone = state.shopExtras.find((x) => x.id === id);
          setState((prev) => ({ ...prev, shopExtras: prev.shopExtras.filter((x) => x.id !== id) }));
          if (gone) showToast({ text: `${capitalize(gone.name)} entfernt`, undo: () => setState((prev) => ({ ...prev, shopExtras: [...prev.shopExtras, gone] })) });
        }}
        onEditExtra={(id, name, amount) => setState((prev) => ({ ...prev, shopExtras: prev.shopExtras.map((x) => (x.id === id ? { ...x, name: capitalize(name), amount: amount || undefined } : x)) }))}
        hidden={state.shopHidden ?? []}
        amounts={state.shopAmounts ?? {}}
        purchases={state.purchases}
        prices={state.shopPrices ?? {}}
        recurring={state.recurring ?? []}
        onRecurring={(name, amount, days) => setState((prev) => ({ ...prev, recurring: setRecurring(prev.recurring, name, amount, days) }))}
        catOrder={state.shopCatOrder}
        onCatOrder={(order) => setState((prev) => ({ ...prev, shopCatOrder: order }))}
        split={!!state.shopSplit}
        shopMode={shopMode}
        onShopMode={setShopMode}
        onSplit={(on) => setState((prev) => ({ ...prev, shopSplit: on }))}
        onPrice={(name, price, deposit) => setState((prev) => {
          const key = name.trim().toLowerCase();
          const { [key]: _, ...rest } = prev.shopPrices ?? {};
          return { ...prev, shopPrices: price !== undefined ? { ...rest, [key]: { price, ...(deposit !== undefined ? { deposit } : {}), date: new Date().toISOString() } } : rest };
        })}
        onHide={(key, hide) => {
          const setHidden = (h: boolean) => setState((prev) => ({ ...prev, shopHidden: h ? [...(prev.shopHidden ?? []).filter((k) => k !== key), key] : (prev.shopHidden ?? []).filter((k) => k !== key) }));
          setHidden(hide);
          if (hide) showToast({ text: `${key.split('|')[0].replace(/^./, (c) => c.toUpperCase())} diese Woche nicht kaufen`, undo: () => setHidden(false) });
        }}
        onAmount={(key, text) => setState((prev) => {
          const { [key]: _, ...rest } = prev.shopAmounts ?? {};
          return { ...prev, shopAmounts: text.trim() ? { ...rest, [key]: text.trim() } : rest };
        })}
        onToggle={(key) => toggleIn('checkedItems', key)}
        onReset={() => setState((prev) => ({ ...prev, checkedItems: [], shopExtras: prev.shopExtras.map((x) => ({ ...x, done: false })) }))}
        onHave={(name) => setState((prev) => ({ ...prev, pantry: [...prev.pantry.filter((p) => p.name !== name), { name }] }))}
        onShopped={() => setTab('ausgaben')}
        onScanned={scannedEmpty}
        flyerLinks={state.flyerLinks}
        onFlyerLinks={(flyerLinks) => setState((prev) => ({ ...prev, flyerLinks }))}
      />
    );
  } else if (tab === 'ausgaben') {
    body = (
      <ExpensesScreen
        purchases={state.purchases}
        budget={settings.weeklyBudget}
        plannedCost={planCost(plan, settings.householdSize, RECIPE_BY_ID)}
        planIngredients={new Set(plan.slots.flatMap((s) => RECIPE_BY_ID[s.recipeId]?.ingredients.map((i) => i.name) ?? []))}
        bonNames={state.bonNames}
        currentWeek={nowWeek}
        weekOf={weekOf}
        onLearnName={(key, value) => setState((prev) => ({ ...prev, bonNames: { ...prev.bonNames, [key]: value } }))}
        onSave={(p) => setState((prev) => ({ ...prev, purchases: [...prev.purchases.filter((x) => x.id !== p.id), p] }))}
        onDelete={(id) => {
          const gone = state.purchases.find((p) => p.id === id);
          setState((prev) => ({ ...prev, purchases: prev.purchases.filter((p) => p.id !== id) }));
          // Das Bon-Foto erst endgültig löschen, wenn nicht rückgängig gemacht wurde
          if (gone) showToast({
            text: `Einkauf ${gone.store || ''} (${euro(gone.total)}) gelöscht`.replace('  ', ' '),
            undo: () => setState((prev) => ({ ...prev, purchases: [...prev.purchases, gone] })),
            onExpire: () => { if (gone.photoId) { deletePhotoData(gone.photoId); deleteCloudPhoto(gone.photoId); } },
          });
        }}
        onLearn={(prices) => setState((prev) => ({ ...prev, userPrices: { ...prev.userPrices, ...prices } }))}
        onBonPhoto={() => takePhoto('bon')}
        onReceiptRead={(p) => {
          const { summary } = applyReceipt(state, p);
          if (!summary.length) return;
          const before = { checkedItems: state.checkedItems, shopExtras: state.shopExtras, pantry: state.pantry, userPrices: state.userPrices };
          setState((prev) => applyReceipt(prev, p).state);
          showToast({ text: `Vom Bon: ${summary.join(', ')}`, undo: () => setState((prev) => ({ ...prev, ...before })) });
        }}
      />
    );
  } else if (moreView === 'einstellungen') {
    body = (
      <SettingsScreen
        key={JSON.stringify(settings)}
        initial={settings}
        isFirstRun={false}
        error={error}
        header={<Pressable onPress={() => setMoreView(null)}><Text style={local.back}>‹ Mehr</Text></Pressable>}
        onSave={(s) => { if (createPlan(s)) { setMoreView(null); setTab('plan'); } }}
        onSaveOnly={(s) => { setState((prev) => ({ ...prev, settings: s })); setMoreView(null); }}
      />
    );
  } else if (moreView === 'vorrat') {
    body = <PantryScreen pantry={state.pantry} onChange={(pantry) => setState((prev) => ({ ...prev, pantry }))} onBack={() => setMoreView(null)}
      cookable={(pantry) => cookableNow(eligibleRecipes({ ...context(settings), pantry }), pantry, settings.basics)}
      onOpenRecipe={setOpenRecipe}
      onRemove={(item) => {
        setState((prev) => ({ ...prev, pantry: prev.pantry.filter((p) => p.name !== item.name) }));
        showToast({ text: `${item.name} aus dem Vorrat entfernt`, undo: () => setState((prev) => ({ ...prev, pantry: [...prev.pantry.filter((p) => p.name !== item.name), item] })) });
      }}
      onToShopping={(n) => addExtra(n, 'vorrat')} />;
  } else if (moreView === 'preise') {
    body = <PricesScreen userPrices={state.userPrices} onChange={(userPrices) => setState((prev) => ({ ...prev, userPrices }))} onBack={() => setMoreView(null)} />;
  } else if (moreView === 'konto') {
    body = <AccountScreen profile={profile} syncStatus={syncStatus} onSyncNow={syncNow} onSignOut={signOut} onBack={() => setMoreView(null)} onProfileChanged={auth.refresh} />;
  } else {
    body = <MoreScreen state={state} syncStatus={syncStatus} onOpen={setMoreView} onRestore={(s) => { swapSeen.current = {}; setState(s); }}
      onExpenses={layout.isPhone ? () => setTab('ausgaben') : undefined} onAi={layout.isPhone ? () => setTab('ki') : undefined} />;
  }

  const showNav = !!settings && !!plan && !openRecipe && !editRecipe && pickDay === null;
  const go = (id: Tab) => { setTab(id); setMoreView(null); setError(null); setShopMode(false); setVoteOpen(false); setReviewOpen(false); };
  const tabs = layout.isPhone ? TABS.filter(([id]) => PHONE_TABS.includes(id)) : TABS;

  return (
    <View style={local.root}>
      <StatusBar style="light" />
      <View style={local.frame}>
        {layout.isDesktop && settings && plan ? (
          <View style={local.sidebar}>
            <View style={local.brand}>
              <View style={local.logo}><Icon name="coffee" size={18} color={colors.onAccent} /></View>
              <Text style={local.brandText}>Wochenplan</Text>
            </View>
            {TABS.map(([id, label, icon]) => {
              const active = tab === id && showNav;
              return (
                <Pressable key={id} onPress={() => { setOpenRecipe(null); setEditRecipe(null); setPickDay(null); go(id); }} accessibilityRole="tab" accessibilityState={{ selected: active }}
                  style={(st) => [local.navItem, hov(st) && local.navHover, active && local.navActive]}>
                  <Icon name={icon} size={18} color={active ? colors.accent : colors.muted} />
                  <Text style={[local.navText, active && { color: colors.text, fontWeight: '700' }]}>{label}</Text>
                </Pressable>
              );
            })}
            <View style={{ flex: 1 }} />
            {(() => {
              // Ausgaben der Einkaufswoche – am Desktop dauerhaft sichtbar über dem Konto
              const list = purchasesFor(nowWeek);
              const sum = list.reduce((a, p) => a + p.total, 0);
              return (
                <Pressable onPress={() => { setOpenRecipe(null); setEditRecipe(null); setPickDay(null); go('ausgaben'); }} accessibilityRole="button"
                  style={(st) => [local.spendBox, hov(st) && local.navHover]}>
                  <View style={local.spendHead}>
                    <Text style={[styles.hint, { fontWeight: '700', color: colors.text }]}>Ausgaben KW {isoWeek(parseDay(nowWeek))}</Text>
                    <Icon name="chevron-right" size={16} />
                  </View>
                  <Text style={[local.spendSum, { color: sum > settings.weeklyBudget ? colors.danger : sum > settings.weeklyBudget * 0.85 ? colors.warn : colors.text }]}>
                    {euro(sum)}<Text style={[styles.hint, { fontSize: 12 }]}> / {euro(settings.weeklyBudget)}</Text>
                  </Text>
                  {list.length ? <CategoryBar purchases={list} compact /> : <Text style={[styles.hint, { fontSize: 12 }]}>Noch kein Bon</Text>}
                </Pressable>
              );
            })()}
            <Pressable onPress={() => goMore('konto')} accessibilityRole="button"
              style={(st) => [local.syncBox, hov(st) && local.navHover]}>
              <View style={local.avatar}><Text style={local.avatarText}>{(profile.name || profile.email).slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={local.navText} numberOfLines={1}>{profile.name || profile.email}</Text>
                <Text style={[styles.hint, { fontSize: 12 }, syncStatus.kind === 'fehler' && { color: colors.danger }]} numberOfLines={1}>
                  {profile.role === 'owner' ? 'Besitzer · ' : ''}{syncStatus.text}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        <View style={local.main}><View style={[local.body, layout.isDesktop && { maxWidth: maxBodyWidth(layout.width) }]}>{body}</View></View>
      </View>
      {showNav && !layout.isDesktop && !(shopMode && tab === 'einkauf') ? (
        <View style={local.tabBar}>
          {tabs.map(([id, label, icon]) => (
            <Pressable key={id} onPress={() => go(id)} style={local.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
              <View style={[local.tabPill, tab === id && local.tabPillActive]}>
                <Icon name={icon} size={20} color={tab === id ? colors.accent : colors.muted} />
              </View>
              <Text style={[local.tabText, tab === id && local.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Snackbar toast={toast} onClose={() => { toastRef.current = null; setToast(null); }} bottom={showNav && !layout.isDesktop && !(shopMode && tab === 'einkauf') ? 84 : 24} />
    </View>
  );
}

const local = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'web' ? 0 : 44 },
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: 960 },
  sidebar: { width: 232, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, padding: space.lg, gap: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingBottom: space.xl },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingHorizontal: space.md, borderRadius: 12 },
  navHover: { backgroundColor: colors.card },
  navActive: { backgroundColor: colors.accentSoft },
  navText: { fontSize: 15, color: colors.muted },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontWeight: '800' },
  spendBox: { padding: space.md, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 4, marginBottom: space.sm },
  spendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spendSum: { fontSize: 18, fontWeight: '800', color: colors.text },
  syncBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: colors.card },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: 6, paddingBottom: Platform.OS === 'web' ? 6 : 22 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: colors.accentSoft },
  tabText: { fontSize: 11, color: colors.muted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
