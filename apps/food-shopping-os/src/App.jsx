import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChefHat, ClipboardList, Home, ShoppingCart, Sparkles, User } from 'lucide-react';
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
import { distanceMetres } from './lib/smart.js';
import { showNotification } from './lib/notify.js';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'log', label: 'Log', Icon: ClipboardList },
  { id: 'shop', label: 'Shop', Icon: ShoppingCart },
  { id: 'recipes', label: 'Recipes', Icon: ChefHat },
  { id: 'profile', label: 'Profile', Icon: User },
];

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
  const [coachView, setCoachView] = useState('coach'); // coach · chat
  // Which logging sheet the diary should open with, when arriving from Home.
  const [logIntent, setLogIntent] = useState(null);

  const openRecipe = (r) => setRecipe(r);
  const goLog = (intent = null) => { setLogIntent(intent); setTab('log'); };

  // Nothing is pre-filled, so the first run asks for the little it needs.
  if (!app.onboarded) return <Onboarding />;

  return (
    <div className="mx-auto max-w-lg min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <main className="pb-24">
        {tab === 'home' && <HomeTab openRecipe={openRecipe} openPantry={() => setPantryOpen(true)} goTab={setTab} goLog={goLog} />}
        {tab === 'plan' && <PlanTab openRecipe={openRecipe} />}
        {tab === 'log' && <LogTab initialSheet={logIntent} onIntentUsed={() => setLogIntent(null)} />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'recipes' && <RecipesTab openRecipe={openRecipe} />}
        {tab === 'profile' && <ProfileTab openAssistant={() => {
          setCoachView('chat');
          setAiOpen(true);
        }} />}
      </main>

      {/* Floating AI assistant button */}
      <button
        onClick={() => setAiOpen(true)}
        aria-label="AI food coach"
        className="press fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-lg)', right: 'max(1.25rem, calc(50vw - 16rem + 1.25rem))' }}
      >
        <Sparkles size={24} strokeWidth={1.8} />
      </button>

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
                onClick={() => { setTab(id); window.scrollTo({ top: 0 }); }}
                className="press flex flex-1 flex-col items-center gap-1 py-2.5"
                aria-current={active ? 'page' : undefined}
                style={{ color: active ? 'var(--accent)' : 'var(--faint)' }}
              >
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10.5px] font-bold">{label}</span>
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
