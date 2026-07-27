import { useState } from 'react';
import { CalendarDays, ChefHat, Home, ShoppingCart, Sparkles, User } from 'lucide-react';
import { AppProvider } from './lib/store.jsx';
import HomeTab from './components/HomeTab.jsx';
import PlanTab from './components/PlanTab.jsx';
import ShopTab from './components/ShopTab.jsx';
import RecipesTab from './components/RecipesTab.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import RecipeDetail from './components/RecipeDetail.jsx';
import PantryView from './components/PantryView.jsx';
import AiAssistant from './components/AiAssistant.jsx';
import { Sheet } from './components/ui.jsx';

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'plan', label: 'Plan', Icon: CalendarDays },
  { id: 'shop', label: 'Shop', Icon: ShoppingCart },
  { id: 'recipes', label: 'Recipes', Icon: ChefHat },
  { id: 'profile', label: 'Profile', Icon: User },
];

function Shell() {
  const [tab, setTab] = useState('home');
  const [recipe, setRecipe] = useState(null);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const openRecipe = (r) => setRecipe(r);

  return (
    <div className="mx-auto max-w-lg min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <main className="pb-24">
        {tab === 'home' && <HomeTab openRecipe={openRecipe} openPantry={() => setPantryOpen(true)} goTab={setTab} />}
        {tab === 'plan' && <PlanTab openRecipe={openRecipe} />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'recipes' && <RecipesTab openRecipe={openRecipe} />}
        {tab === 'profile' && <ProfileTab />}
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
        <AiAssistant />
      </Sheet>
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
