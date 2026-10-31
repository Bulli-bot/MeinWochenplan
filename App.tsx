import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './src/auth';
import { deleteCloudPhoto, uploadPhoto, useCloudSync } from './src/cloud';
import { BUILTIN_IDS, RECIPE_BY_ID, rebuildCatalog } from './src/data/recipes';
import { findSwap, generatePlan, kidTally, planCost, type PlanContext } from './src/logic/generator';
import { deletePhotoData, newPhotoId, pickPhoto, savePhotoData } from './src/photos';
import { AccountScreen } from './src/screens/AccountScreen';
import { AuthScreen, PendingScreen } from './src/screens/AuthScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { MoreScreen, type MoreView } from './src/screens/MoreScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { PantryScreen } from './src/screens/PantryScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PricesScreen } from './src/screens/PricesScreen';
import { RecipeEditScreen } from './src/screens/RecipeEditScreen';
import { RecipeScreen } from './src/screens/RecipeScreen';
import { DEFAULT_FILTERS, RecipesScreen, type RecipeFilters } from './src/screens/RecipesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ShoppingListScreen } from './src/screens/ShoppingListScreen';
import { DEFAULT_SETTINGS, EMPTY_STATE, loadState, saveState } from './src/storage';
import type { AppState, CustomRecipe, Settings } from './src/types';
import { Button, Icon, colors, hov, space, styles, useLayout, type IconName } from './src/ui';

type Tab = 'start' | 'plan' | 'rezepte' | 'einkauf' | 'ausgaben' | 'mehr';
const TABS: [Tab, string, IconName][] = [
  ['start', 'Übersicht', 'grid'], ['plan', 'Woche', 'calendar'], ['rezepte', 'Rezepte', 'book-open'],
  ['einkauf', 'Einkauf', 'shopping-cart'], ['ausgaben', 'Ausgaben', 'credit-card'], ['mehr', 'Mehr', 'menu'],
];
/** Auf dem Handy ist unten nur Platz für fünf – Ausgaben gibt es dort über die Übersicht und „Mehr“. */
const PHONE_TABS: Tab[] = ['start', 'plan', 'rezepte', 'einkauf', 'mehr'];
const RECENT_LIMIT = 21;
const LOCAL_OWNER_KEY = 'meinwochenplan:local-owner';

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
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [pickFilters, setPickFilters] = useState<RecipeFilters>({ ...DEFAULT_FILTERS, onlyMatching: true });
  /** Konto, für das der Abgleich läuft – erst gesetzt, wenn die lokalen Daten zu diesem Konto passen */
  const [syncUser, setSyncUser] = useState<string | null>(null);
  const auth = useAuth();
  const firstSave = useRef(true);
  /** Pro Tag die Rezepte, die beim Tauschen schon dran waren – damit nicht dieselben zurückkommen. */
  const swapSeen = useRef<Record<number, string[]>>({});

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

  const signOut = async () => {
    await auth.signOut();
    swapSeen.current = {};
    setState(EMPTY_STATE);
    setTab('start');
    setMoreView(null);
    setOpenRecipe(null);
  };

  // Eigene Rezepte und Preise in den Katalog rechnen, bevor irgendetwas gerendert wird.
  rebuildCatalog(state.customRecipes, state.userPrices);

  const context = (settings: Settings): PlanContext => ({
    settings,
    favourites: state.favourites,
    ratings: state.ratings,
    recentRecipeIds: state.recentRecipeIds,
    kidVotes: state.kidVotes,
    pantry: state.pantry,
  });

  const createPlan = (settings: Settings) => {
    const result = generatePlan(context(settings));
    if (!result.ok) {
      setError(result.reason);
      return false;
    }
    setError(null);
    swapSeen.current = {};
    setState((prev) => ({
      ...prev,
      settings,
      plan: result.plan,
      // Der bisherige Plan wird zur "letzten Woche", damit sich Gerichte nicht sofort wiederholen.
      recentRecipeIds: [...(prev.plan?.slots.map((s) => s.recipeId) ?? []), ...prev.recentRecipeIds].slice(0, RECENT_LIMIT),
      checkedItems: [],
      cooked: [],
    }));
    return true;
  };

  const setDayRecipe = (day: number, recipeId: string) => {
    const previous = state.plan?.slots.find((s) => s.day === day)?.recipeId;
    if (previous) swapSeen.current[day] = [...(swapSeen.current[day] ?? []), previous];
    setState((prev) => prev.plan ? {
      ...prev,
      plan: { ...prev.plan, slots: prev.plan.slots.map((s) => (s.day === day ? { ...s, recipeId } : s)) },
    } : prev);
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
    body = (
      <RecipeScreen
        recipeId={id}
        householdSize={settings.householdSize}
        isFavourite={state.favourites.includes(id)}
        isCooked={state.cooked.includes(id)}
        rating={state.ratings[id]}
        photos={state.photos[id] ?? []}
        kids={settings.kids ?? []}
        votes={state.kidVotes[id] ?? {}}
        isCustom={!BUILTIN_IDS.has(id)}
        onBack={() => setOpenRecipe(null)}
        onToggleFavourite={() => toggleIn('favourites', id)}
        onToggleCooked={() => toggleIn('cooked', id)}
        onRate={(stars) => setState((prev) => ({ ...prev, ratings: { ...prev.ratings, [id]: stars } }))}
        onAddPhoto={() => addMealPhoto(id)}
        onDeletePhoto={(photoId) => deleteMealPhoto(id, photoId)}
        onVote={(kid, vote) => setState((prev) => {
          const { [kid]: _, ...rest } = prev.kidVotes[id] ?? {};
          return { ...prev, kidVotes: { ...prev.kidVotes, [id]: vote ? { ...rest, [kid]: vote } : rest } };
        })}
        onEdit={() => setEditRecipe(state.customRecipes.find((r) => r.id === id) ?? null)}
        onDelete={() => {
          setOpenRecipe(null);
          setState((prev) => ({ ...prev, customRecipes: prev.customRecipes.filter((r) => r.id !== id) }));
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
  } else if (tab === 'start') {
    body = (
      <OverviewScreen state={state} settings={settings} plan={plan} name={profile.name} notice={auth.notice} syncStatus={syncStatus} onOpen={setOpenRecipe}
        onGo={(t) => { setTab(t); setMoreView(null); }} />
    );
  } else if (tab === 'plan') {
    body = (
      <PlanScreen
        plan={plan}
        householdSize={settings.householdSize}
        budget={settings.weeklyBudget}
        favourites={state.favourites}
        cooked={state.cooked}
        photos={state.photos}
        kidInfo={(rid) => kidTally(rid, { kidVotes: state.kidVotes, settings })}
        error={error}
        onOpen={setOpenRecipe}
        onSwap={swapDay}
        onChoose={(day) => { setError(null); setPickDay(day); }}
        onRegenerate={() => createPlan(settings)}
        footer={<Text style={[styles.hint, syncStatus.kind === 'fehler' && { color: colors.danger }]}>☁ {syncStatus.text}</Text>}
      />
    );
  } else if (tab === 'rezepte') {
    body = <RecipesScreen context={context(settings)} favourites={state.favourites} filters={filters} onFilters={setFilters} onOpen={setOpenRecipe} onNew={() => setEditRecipe('neu')} />;
  } else if (tab === 'einkauf') {
    body = (
      <ShoppingListScreen
        plan={plan}
        householdSize={settings.householdSize}
        checked={state.checkedItems}
        pantry={state.pantry}
        onToggle={(key) => toggleIn('checkedItems', key)}
        onReset={() => setState((prev) => ({ ...prev, checkedItems: [] }))}
        onHave={(name) => setState((prev) => ({ ...prev, pantry: [...prev.pantry.filter((p) => p.name !== name), { name }] }))}
        onShopped={() => setTab('ausgaben')}
      />
    );
  } else if (tab === 'ausgaben') {
    body = (
      <ExpensesScreen
        purchases={state.purchases}
        budget={settings.weeklyBudget}
        plannedCost={planCost(plan, settings.householdSize, RECIPE_BY_ID)}
        planIngredients={new Set(plan.slots.flatMap((s) => RECIPE_BY_ID[s.recipeId]?.ingredients.map((i) => i.name) ?? []))}
        onSave={(p) => setState((prev) => ({ ...prev, purchases: [...prev.purchases.filter((x) => x.id !== p.id), p] }))}
        onDelete={(id) => setState((prev) => {
          const gone = prev.purchases.find((p) => p.id === id);
          if (gone?.photoId) { deletePhotoData(gone.photoId); deleteCloudPhoto(gone.photoId); }
          return { ...prev, purchases: prev.purchases.filter((p) => p.id !== id) };
        })}
        onLearn={(prices) => setState((prev) => ({ ...prev, userPrices: { ...prev.userPrices, ...prices } }))}
        onBonPhoto={() => takePhoto('bon')}
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
      />
    );
  } else if (moreView === 'vorrat') {
    body = <PantryScreen pantry={state.pantry} onChange={(pantry) => setState((prev) => ({ ...prev, pantry }))} onBack={() => setMoreView(null)} />;
  } else if (moreView === 'preise') {
    body = <PricesScreen userPrices={state.userPrices} onChange={(userPrices) => setState((prev) => ({ ...prev, userPrices }))} onBack={() => setMoreView(null)} />;
  } else if (moreView === 'konto') {
    body = <AccountScreen profile={profile} syncStatus={syncStatus} onSyncNow={syncNow} onSignOut={signOut} onBack={() => setMoreView(null)} onProfileChanged={auth.refresh} />;
  } else {
    body = <MoreScreen state={state} syncStatus={syncStatus} onOpen={setMoreView} onRestore={(s) => { swapSeen.current = {}; setState(s); }}
      onExpenses={layout.isPhone ? () => setTab('ausgaben') : undefined} />;
  }

  const showNav = !!settings && !!plan && !openRecipe && !editRecipe && pickDay === null;
  const go = (id: Tab) => { setTab(id); setMoreView(null); setError(null); };
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
            <Pressable onPress={() => { setOpenRecipe(null); setEditRecipe(null); setPickDay(null); setTab('mehr'); setMoreView('konto'); }} accessibilityRole="button"
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
        <View style={local.main}><View style={[local.body, layout.isDesktop && { maxWidth: 1240 }]}>{body}</View></View>
      </View>
      {showNav && !layout.isDesktop ? (
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
  syncBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: colors.card },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: 6, paddingBottom: Platform.OS === 'web' ? 6 : 22 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabPillActive: { backgroundColor: colors.accentSoft },
  tabText: { fontSize: 11, color: colors.muted },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  back: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
