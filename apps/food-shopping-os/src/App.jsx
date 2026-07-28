import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChefHat, ClipboardList, Home, ShoppingCart } from 'lucide-react';
import { AppProvider, useApp } from './lib/store.jsx';
import Onboarding from './components/Onboarding.jsx';
import HomeTab from './components/HomeTab.jsx';
import PlanTab from './components/PlanTab.jsx';
import LogTab from './components/LogTab.jsx';
import ShopTab from './components/ShopTab.jsx';
import RecipesTab from './components/RecipesTab.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import RecipeDetail from './components/RecipeDetail.jsx';
import PantryView from './components/PantryView.jsx';
import AiAssistant from './components/AiAssistant.jsx';
import CoachPanel from './components/CoachPanel.jsx';
import { Chip, Sheet } from './components/ui.jsx';
import AppHeader from './components/AppHeader.jsx';
import { cx } from './lib/utils.js';
import { distanceMetres } from './lib/smart.js';
import { showNotification } from './lib/notify.js';

/**
 * Five tabs, not six.
 *
 * Profile came out: it is a place you *visit*, not a place you work, and it
 * was taking a sixth of the bar from the five screens you use every day. It
 * now lives behind the avatar in the header, which is on every screen rather
 * than only on Home — so it went from one tap anywhere to one tap anywhere,
 * and the five that remain each got 20% wider to press.
 */
const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'log', label: 'Log', Icon: ClipboardList },
  { id: 'shop', label: 'Shop', Icon: ShoppingCart },
  { id: 'recipes', label: 'Recipes', Icon: ChefHat },
];

/** What each screen is called, and the one thing it is mainly for. */
export const SCREENS = {
  home: { title: 'Today' },
  plan: { title: 'Meal planner' },
  log: { title: 'Food diary' },
  shop: { title: 'Shop' },
  recipes: { title: 'Recipes' },
  profile: { title: 'You' },
};

function GeofenceWatcher() {
  const app = useApp();
  const inside = useRef(new Map());

  useEffect(() => {
    const places = app.placeReminders.filter((place) => place.on);
    if (!places.length || !navigator.geolocation?.watchPosition) return undefined;
    const activeIds = new Set(places.map((place) => place.id));
    [...inside.current.keys()].forEach((id) => {
      if (!activeIds.has(id)) inside.current.delete(id);
    });
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        places.forEach((place) => {
          const nowInside = distanceMetres(coords, place) <= place.radius;
          const wasInside = inside.current.get(place.id);
          inside.current.set(place.id, nowInside);
          if (nowInside && wasInside === false) {
            showNotification(place.label, {
              body: 'You entered the saved area. Open your shopping list.',
              tag: `place-${place.id}`,
            });
          }
        });
      },
      () => showNotification('Location reminder paused', {
        body: 'Forq could not read your location. Check site permissions before relying on this reminder.',
        tag: 'place-location-error',
      }),
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch?.(watchId);
  }, [app.placeReminders]);

  return null;
}

function Shell() {
  const app = useApp();
  const [tab, setTab] = useState('home');
  const [recipe, setRecipe] = useState(null);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [coachView, setCoachView] = useState('coach'); // coach · chat
  // Which logging sheet the diary should open with, when arriving from Home.
  const [logIntent, setLogIntent] = useState(null);

  const openRecipe = (r) => setRecipe(r);
  const goLog = (intent = null) => { setLogIntent(intent); setTab('log'); };

  /* Screens still ask to go to "profile" — it just isn't a tab any more, it's
     the sheet behind the avatar. Routing it here means nothing that pointed at
     it had to learn where it went. */
  const goTab = (id) => {
    if (id === 'profile') return setProfileOpen(true);
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  // Nothing is pre-filled, so the first run asks for the little it needs.
  if (!app.onboarded) return <Onboarding />;

  return (
    <div className="mx-auto max-w-lg min-h-screen relative" style={{ background: 'var(--bg)' }}>
      {/* The first stop for a keyboard or switch user: past the chrome, into
          the day. Invisible until it has focus. */}
      <a href="#main" className="skip-link">Skip to content</a>

      <AppHeader tab={tab} onProfile={() => setProfileOpen(true)} onAi={() => setAiOpen(true)} />

      {/* Room at the foot for the tab bar and the screen's primary action. */}
      <main id="main" tabIndex={-1} className="pb-44">
        {tab === 'home' && <HomeTab openRecipe={openRecipe} openPantry={() => setPantryOpen(true)} goTab={goTab} goLog={goLog} />}
        {tab === 'plan' && <PlanTab openRecipe={openRecipe} />}
        {tab === 'log' && <LogTab initialSheet={logIntent} onIntentUsed={() => setLogIntent(null)} />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'recipes' && <RecipesTab openRecipe={openRecipe} />}
      </main>

      {/* Bottom nav */}
      <nav
        className="glass fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg border-t"
        style={{ borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => goTab(id)}
                className="press flex flex-1 flex-col items-center justify-center gap-1 py-3 min-h-[56px]"
                aria-current={active ? 'page' : undefined}
                // The colour says which tab you're on; the weight says it again,
                // for anyone who can't see the difference.
                style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                <span className={cx('text-[11px]', active ? 'font-extrabold' : 'font-semibold')}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Overlays */}
      <Sheet open={!!recipe} onClose={() => setRecipe(null)} full>
        {recipe && <RecipeDetail recipe={recipe} onClose={() => setRecipe(null)} />}
      </Sheet>
      <Sheet open={pantryOpen} onClose={() => setPantryOpen(false)} title="Smart pantry">
        <PantryView />
      </Sheet>
      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="You">
        <ProfileTab openAssistant={() => { setCoachView('chat'); setAiOpen(true); }} />
      </Sheet>
      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title="AI food coach">
        <div className="px-5 pb-2 flex gap-2">
          <Chip active={coachView === 'coach'} onClick={() => setCoachView('coach')}>Coach</Chip>
          <Chip active={coachView === 'chat'} onClick={() => setCoachView('chat')}>Ask</Chip>
        </div>
        {coachView === 'coach' ? <CoachPanel /> : <AiAssistant />}
      </Sheet>
      <GeofenceWatcher />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
