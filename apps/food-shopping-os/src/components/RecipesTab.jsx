import { useEffect, useMemo, useState } from 'react';
import {
  ChefHat, Clock, FolderOpen, Heart, Inbox, Link2, Plus, Search, SlidersHorizontal, Sparkles,
  Trash2, UtensilsCrossed, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { allRecipes, DISCOVER_FILTERS, filterRecipes } from '../data/recipes.js';
import { DIET_PATTERNS } from '../data/goals.js';
import { missingFrom, parseShareCode, searchRecipes } from '../lib/recipe-tools.js';
import { rankByPrefs } from '../lib/preferences.js';
import { Section, Card, Chip, Pill, FoodArt, Sheet } from './ui.jsx';
import PrimaryAction from './PrimaryAction.jsx';
import RecipeGenerator from './RecipeGenerator.jsx';
import RecipeImport from './RecipeImport.jsx';
import TasteGame from './TasteGame.jsx';

const TIME_STEPS = [
  { label: 'Any time', value: null },
  { label: '≤ 15 min', value: 15 },
  { label: '≤ 25 min', value: 25 },
  { label: '≤ 45 min', value: 45 },
];

const SHOPPING = [
  { label: 'Anything', value: null },
  { label: 'Missing ≤ 2', value: 2 },
  { label: 'Can make now', value: 0 },
];

const DIET_IDS = DIET_PATTERNS.filter((d) => d.kind !== 'macro').map((d) => d.id);

/** How many recipe cards go into the page at a time. */
const PAGE = 24;

/** Filters that read as sentences: what's in it, what isn't, how long, whose diet. */
function FilterSheet({ filters, setFilters, onClose, results }) {
  const app = useApp();
  const [term, setTerm] = useState('');
  const [field, setField] = useState('include');

  const addTerm = () => {
    const value = term.trim();
    if (!value) return;
    setFilters((f) => ({ ...f, [field]: [...new Set([...f[field], value])] }));
    setTerm('');
  };

  const drop = (key, value) =>
    setFilters((f) => ({ ...f, [key]: f[key].filter((v) => v !== value) }));

  return (
    <div className="px-5 pb-10 space-y-5">
      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Ingredients</p>
        <div className="flex gap-2">
          <Chip active={field === 'include'} onClick={() => setField('include')}>With</Chip>
          <Chip active={field === 'exclude'} onClick={() => setField('exclude')}>Without</Chip>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTerm()}
            placeholder={field === 'include' ? 'chicken, spinach…' : 'mushrooms, coriander…'}
            aria-label={field === 'include' ? 'Ingredient to include' : 'Ingredient to exclude'}
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[14px] font-semibold outline-none"
            style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            onClick={addTerm}
            className="press rounded-xl px-4 text-[13px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <Plus size={15} />
          </button>
        </div>
        {(filters.include.length > 0 || filters.exclude.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {filters.include.map((t) => (
              <button key={`in-${t}`} onClick={() => drop('include', t)} className="press">
                <Pill tone="accent">with {t} <X size={11} /></Pill>
              </button>
            ))}
            {filters.exclude.map((t) => (
              <button key={`ex-${t}`} onClick={() => drop('exclude', t)} className="press">
                <Pill tone="warn">without {t} <X size={11} /></Pill>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Cooking time</p>
        <div className="flex flex-wrap gap-2">
          {TIME_STEPS.map((t) => (
            <Chip key={t.label} active={filters.maxTime === t.value} onClick={() => setFilters((f) => ({ ...f, maxTime: t.value }))}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Diet</p>
        <div className="flex flex-wrap gap-2">
          {DIET_PATTERNS.filter((d) => d.kind !== 'macro').map((d) => (
            <Chip
              key={d.id}
              active={filters.diets.includes(d.id)}
              onClick={() => setFilters((f) => ({
                ...f,
                diets: f.diets.includes(d.id) ? f.diets.filter((x) => x !== d.id) : [...f.diets, d.id],
              }))}
            >
              {d.label}
            </Chip>
          ))}
        </div>
        {app.planDiets.length > 0 && (
          <button
            onClick={() => setFilters((f) => ({ ...f, diets: [...new Set([...f.diets, ...app.planDiets.filter((d) => DIET_IDS.includes(d))])] }))}
            className="press mt-2 text-[12.5px] font-extrabold"
            style={{ color: 'var(--accent)' }}
          >
            Use my patterns ({app.planDiets.join(', ')})
          </button>
        )}
      </div>

      <div>
        <p className="text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--faint)' }}>Shopping</p>
        <div className="flex flex-wrap gap-2">
          {SHOPPING.map((s) => (
            <Chip key={s.label} active={filters.maxMissing === s.value} onClick={() => setFilters((f) => ({ ...f, maxMissing: s.value }))}>
              {s.label}
            </Chip>
          ))}
        </div>
        {filters.maxMissing !== null && app.pantry.length === 0 && (
          <p className="mt-2 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            Your pantry is empty, so nothing counts as makeable yet.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="press flex-[2] rounded-2xl py-3 text-[14px] font-extrabold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          Show {results} recipe{results === 1 ? '' : 's'}
        </button>
        <button
          onClick={() => setFilters({ diets: [], maxTime: null, include: [], exclude: [], maxMissing: null })}
          className="press flex-1 rounded-2xl border py-3 text-[13.5px] font-extrabold"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/** Paste in a recipe someone sent you. */
function SharedImport({ onDone }) {
  const app = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const read = () => {
    const { recipe, error: err } = parseShareCode(code);
    setError(err);
    setPreview(recipe);
  };

  return (
    <div className="px-5 pb-10 space-y-3">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
        Forq has no feed of strangers’ dinners. A recipe travels as a code someone sends you —
        paste it here and it becomes yours, credited to whoever shared it.
      </p>
      <textarea
        value={code}
        onChange={(e) => { setCode(e.target.value); setError(null); setPreview(null); }}
        rows={4}
        placeholder="FORQ1:…"
        aria-label="Recipe code"
        className="w-full rounded-2xl border p-3 text-[12px] font-mono outline-none"
        style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
      />
      <button
        onClick={read}
        disabled={!code.trim()}
        className="press w-full rounded-2xl border py-3 text-[14px] font-extrabold disabled:opacity-50"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
      >
        Read the code
      </button>
      {error && <p className="text-[13px] font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>}
      {preview && (
        <Card className="space-y-2">
          <p className="font-extrabold text-[15px]">{preview.name}</p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            {preview.sharedBy ? `From ${preview.sharedBy} · ` : ''}{preview.ingredients.length} ingredients · {preview.steps.length} steps · {preview.time} min
          </p>
          <button
            onClick={() => { app.saveRecipe(preview); onDone(); }}
            className="press w-full rounded-2xl py-3 text-[14px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Add to my recipes
          </button>
        </Card>
      )}
    </div>
  );
}

export default function RecipesTab({ openRecipe }) {
  const app = useApp();
  const [filter, setFilter] = useState('Dinner');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('library'); // library · mine · favourites
  const [sheet, setSheet] = useState(null); // filters · generate · shared · taste
  const [filters, setFilters] = useState({ diets: [], maxTime: null, include: [], exclude: [], maxMissing: null });
  const [collectionId, setCollectionId] = useState('');
  const [collectionName, setCollectionName] = useState('');

  const pantryNames = app.pantry.map((p) => p.name);
  const active = filters.diets.length + filters.include.length + filters.exclude.length
    + (filters.maxTime ? 1 : 0) + (filters.maxMissing !== null ? 1 : 0);

  const selectedCollection = app.recipeCollections.find((collection) => collection.id === collectionId)
    || app.recipeCollections[0]
    || null;

  const pool = useMemo(() => {
    if (view === 'mine') return app.myRecipes;
    if (view === 'favourites') return allRecipes().filter((r) => app.favourites.includes(r.id));
    if (view === 'collections') {
      if (!selectedCollection) return [];
      const ids = new Set(selectedCollection.recipeIds);
      return allRecipes().filter((recipe) => ids.has(recipe.id));
    }
    return query.trim() ? allRecipes() : filterRecipes(filter);
  }, [view, filter, query, app.myRecipes, app.favourites, selectedCollection]);

  // Allergens and observed rules cut the pool before anything else runs. A
  // blocked recipe is never a search result, however you got here.
  const safePool = useMemo(() => rankByPrefs(pool, app.prefs), [pool, app.prefs]);
  const blocked = pool.length - safePool.length;

  const recipes = useMemo(
    () => searchRecipes(safePool, { query, have: pantryNames, ...filters }),
    [safePool, query, filters, app.pantry],
  );

  /* The library is over a thousand dishes. Putting all of them in the page at
     once made a screen you had to scroll for a minute to reach the end of, and
     a first paint that had to build every card before showing you the first
     one. A page at a time, growing when you ask: the count above still tells
     you the real total, so nothing is hidden — just not all laid out at once. */
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [query, filters, view, filter]);
  const visible = recipes.slice(0, shown);

  const cols = useMemo(() => {
    const a = [], b = [];
    visible.forEach((r, i) => (i % 2 === 0 ? a : b).push(r));
    return [a, b];
  }, [visible]);

  // Saying how many were removed is the difference between a filter and a
  // disappearance you can't account for.
  const blockedLine = blocked > 0
    ? `${blocked} recipe${blocked === 1 ? '' : 's'} hidden by your allergies and rules.`
    : null;

  const emptyLine = view === 'mine'
    ? 'Nothing here yet — generate a dish from your pantry, import one from a link, or paste in a code someone sent you.'
    : view === 'favourites'
      ? 'No favourites yet. Tap the heart on any recipe and it lands here.'
      : view === 'collections'
        ? selectedCollection
          ? 'This collection is empty. Add recipes from any recipe page.'
          : 'Create a collection for recipes you want to keep together.'
      : 'Try another filter or search term.';

  return (
    <div className="pb-6">
      <div className="hero-gradient px-5 pt-1 pb-3">
        <div className="mt-3 flex gap-2 rise rise-1">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes, cuisines, ingredients…"
              aria-label="Search recipes"
              className="w-full rounded-2xl border py-3 pl-9 pr-3 text-[14px] font-semibold outline-none focus:ring-2"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)', '--tw-ring-color': 'var(--accent-soft)' }}
            />
          </div>
          <button
            onClick={() => setSheet('filters')}
            aria-label="Filters"
            className="press relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border"
            style={{ background: 'var(--card)', borderColor: active ? 'var(--accent)' : 'var(--line)', color: active ? 'var(--accent)' : 'var(--muted)' }}
          >
            <SlidersHorizontal size={17} />
            {active > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {active}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Library · my recipes · favourites · collections */}
      <div className="mt-4 px-5 flex gap-2 overflow-x-auto no-scrollbar rise rise-1">
        {[['library', `Library (${allRecipes().length})`], ['mine', `Mine (${app.myRecipes.length})`], ['favourites', `Favourites (${app.favourites.length})`], ['collections', `Collections (${app.recipeCollections.length})`]]
          .map(([key, label]) => (
            <Chip key={key} active={view === key} onClick={() => setView(key)}>{label}</Chip>
          ))}
      </div>

      <div className="mt-3 px-5 rise rise-1">
        <button
          onClick={() => setSheet('taste')}
          className="press relative w-full overflow-hidden rounded-2xl px-4 py-3 text-left"
          style={{ background: 'linear-gradient(120deg, var(--accent), var(--accent-deep))', color: 'var(--on-accent)' }}
        >
          <span className="relative z-10 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Heart size={19} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black">Taste match</span>
              <span className="block text-[11.5px] font-bold opacity-80">
                Swipe recipes to tune your AI plans
                {Object.keys(app.tasteRatings).length ? ` · ${Object.keys(app.tasteRatings).length} rated` : ''}
              </span>
            </span>
            <Sparkles size={18} />
          </span>
        </button>
      </div>

      {/* Make one, or take one in */}
      {app.householdAccess.recipes ? (
      <div className="mt-3 px-5 grid grid-cols-3 gap-2 rise rise-1">
        <button
          onClick={() => setSheet('import')}
          className="press rounded-2xl border py-2.5 px-1 text-[12px] font-extrabold"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <span className="inline-flex items-center gap-1"><Link2 size={13} /> Import from URL</span>
        </button>
        <button
          onClick={() => setSheet('generate')}
          className="press rounded-2xl border py-2.5 px-1 text-[12px] font-extrabold"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1"><Sparkles size={13} /> Invent a recipe</span>
        </button>
        <button
          onClick={() => setSheet('shared')}
          className="press rounded-2xl border py-2.5 px-1 text-[12px] font-extrabold"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1"><Inbox size={13} /> Add a shared one</span>
        </button>
      </div>
      ) : (
        <div className="mt-3 px-5">
          <Card className="!p-3">
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
              Recipe saving is off for {app.activeMember?.name}. Browsing and cooking still work.
            </p>
          </Card>
        </div>
      )}

      {view === 'collections' && app.householdAccess.recipes && (
        <Section className="mt-3 rise rise-1">
          <Card>
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              <FolderOpen size={14} /> Recipe collections
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                aria-label="Collection name"
                placeholder="e.g. Batch cooking"
                maxLength={40}
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none"
                style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
              />
              <button
                onClick={() => {
                  app.createRecipeCollection(collectionName);
                  setCollectionName('');
                }}
                disabled={collectionName.trim().length < 2}
                className="press rounded-xl px-3 py-2 text-[12.5px] font-extrabold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Create
              </button>
            </div>
            {app.recipeCollections.length > 0 && (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {app.recipeCollections.map((collection) => (
                  <Chip
                    key={collection.id}
                    active={selectedCollection?.id === collection.id}
                    onClick={() => setCollectionId(collection.id)}
                  >
                    {collection.name} ({collection.recipeIds.length})
                  </Chip>
                ))}
                {selectedCollection && (
                  <button
                    onClick={() => {
                      app.removeRecipeCollection(selectedCollection.id);
                      setCollectionId('');
                    }}
                    aria-label={`Delete ${selectedCollection.name} collection`}
                    className="press shrink-0 p-1"
                    style={{ color: 'var(--faint)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </Card>
        </Section>
      )}

      {view === 'library' && !query && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-5 rise rise-1">
          {DISCOVER_FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>
          ))}
        </div>
      )}

      <Section className="mt-4 rise rise-2">
        <p className="mb-3 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
          {filters.maxMissing === 0 && ' you can cook right now'}
          {filters.maxTime && ` in ${filters.maxTime} minutes or less`}
          {filters.diets.length > 0 && ` · ${filters.diets.join(', ')}`}
          {blockedLine && <span style={{ color: 'var(--faint)' }}> · {blockedLine}</span>}
        </p>
        {recipes.length === 0 ? (
          <Card className="text-center py-10">
            <UtensilsCrossed size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
            <p className="font-bold">Nothing matches</p>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{emptyLine}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 items-start">
            {cols.map((col, ci) => (
              <div key={ci} className="space-y-3">
                {col.map((r, i) => {
                  const tall = (i + ci) % 3 === 0;
                  const fav = app.favourites.includes(r.id);
                  const short = missingFrom(r, pantryNames).length;
                  return (
                    <Card key={r.id} onClick={() => openRecipe(r)} className="!p-0 overflow-hidden">
                      <div className="relative">
                        <FoodArt recipe={r} className={tall ? 'h-40 w-full' : 'h-28 w-full'} px={tall ? 44 : 36} />
                        {app.householdAccess.recipes && <button
                          onClick={(e) => { e.stopPropagation(); app.toggleFavourite(r.id); }}
                          aria-label={fav ? 'Unfavourite' : 'Favourite'}
                          className="tap press absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border"
                          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: fav ? 'var(--ink)' : 'var(--faint)' }}
                        >
                          <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
                        </button>}
                        <span className="absolute bottom-2 left-2">
                          {r.generated ? <Pill tone="accent"><Sparkles size={11} /> yours</Pill>
                            : r.shared ? <Pill tone="accent">shared</Pill>
                              : app.pantry.length > 0 && short === 0 ? <Pill tone="good"><ChefHat size={11} /> can cook now</Pill>
                                : r.tags.includes('high-protein') ? <Pill tone="accent">{r.protein}g protein</Pill>
                                  : r.time <= 20 ? <Pill tone="muted"><Clock size={11} /> {r.time} min</Pill>
                                    : null}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-[13.5px] leading-tight line-clamp-2">{r.name}</p>
                        <p className="mt-1 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                          {r.time <= 60 ? `${r.time} min` : `${Math.round(r.time / 60)} h`} · {r.kcal} kcal · {r.protein}g protein
                        </p>
                        <p className="mt-1 text-[12px] font-extrabold" style={{ color: 'var(--accent)' }}>
                          {gbp(r.costPerServing, { always: true })}/serving
                        </p>
                        {app.recipeRatings[r.id] && (
                          <p className="mt-1 text-[11.5px] font-bold" style={{ color: 'var(--warn)' }}>
                            ★ {app.recipeRatings[r.id]}/5
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {shown < recipes.length && (
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="press mt-3 w-full rounded-2xl border py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Show {Math.min(PAGE, recipes.length - shown)} more
            <span className="ml-1.5 font-bold" style={{ color: 'var(--faint)' }}>
              {shown} of {recipes.length}
            </span>
          </button>
        )}
      </Section>

      <Sheet open={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters">
        <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setSheet(null)} results={recipes.length} />
      </Sheet>
      <Sheet open={sheet === 'generate'} onClose={() => setSheet(null)} title="Invent a recipe">
        <RecipeGenerator openRecipe={(r) => { setSheet(null); openRecipe(r); }} />
      </Sheet>
      <Sheet open={sheet === 'import'} onClose={() => setSheet(null)} title="Import a recipe">
        <RecipeImport onDone={() => { setSheet(null); setView('mine'); }} />
      </Sheet>
      <Sheet open={sheet === 'shared'} onClose={() => setSheet(null)} title="A recipe someone sent you">
        <SharedImport onDone={() => { setSheet(null); setView('mine'); }} />
      </Sheet>
      <Sheet open={sheet === 'taste'} onClose={() => setSheet(null)} title="Taste match" full>
        <TasteGame />
      </Sheet>

      {/* With a thousand-odd dishes on the shelf, the useful move depends on
          where you are: cut them to what your kitchen can already make, undo a
          filter that left you with nothing, or just be handed one. */}
      {recipes.length === 0 ? (
        <PrimaryAction
          label="Clear the filters"
          onClick={() => { setFilters({ diets: [], maxTime: null, include: [], exclude: [], maxMissing: null }); setQuery(''); }}
        />
      ) : app.pantry.length > 0 && filters.maxMissing !== 0 ? (
        <PrimaryAction label="Show what I can cook now" onClick={() => setFilters((f) => ({ ...f, maxMissing: 0 }))} />
      ) : (
        <PrimaryAction
          label="Surprise me"
          hint={`1 of ${recipes.length}`}
          onClick={() => openRecipe(recipes[Math.floor(Math.random() * recipes.length)])}
        />
      )}
    </div>
  );
}
