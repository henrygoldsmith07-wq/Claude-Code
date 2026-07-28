import { useMemo, useState } from 'react';
import {
  ChefHat, Clock, Heart, Inbox, Plus, Search, SlidersHorizontal, Sparkles, UtensilsCrossed, X,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { allRecipes, DISCOVER_FILTERS, filterRecipes } from '../data/recipes.js';
import { DIET_PATTERNS } from '../data/goals.js';
import { missingFrom, parseShareCode, searchRecipes } from '../lib/recipe-tools.js';
import { Section, Card, Chip, Pill, FoodArt, Sheet } from './ui.jsx';
import RecipeGenerator from './RecipeGenerator.jsx';

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
  const [sheet, setSheet] = useState(null); // filters · generate · shared
  const [filters, setFilters] = useState({ diets: [], maxTime: null, include: [], exclude: [], maxMissing: null });

  const pantryNames = app.pantry.map((p) => p.name);
  const active = filters.diets.length + filters.include.length + filters.exclude.length
    + (filters.maxTime ? 1 : 0) + (filters.maxMissing !== null ? 1 : 0);

  const pool = useMemo(() => {
    if (view === 'mine') return app.myRecipes;
    if (view === 'favourites') return allRecipes().filter((r) => app.favourites.includes(r.id));
    return query.trim() ? allRecipes() : filterRecipes(filter);
  }, [view, filter, query, app.myRecipes, app.favourites]);

  const recipes = useMemo(
    () => searchRecipes(pool, { query, have: pantryNames, ...filters }),
    [pool, query, filters, app.pantry],
  );

  const cols = useMemo(() => {
    const a = [], b = [];
    recipes.forEach((r, i) => (i % 2 === 0 ? a : b).push(r));
    return [a, b];
  }, [recipes]);

  const emptyLine = view === 'mine'
    ? 'Nothing here yet — generate a dish from your pantry, import one from a link, or paste in a code someone sent you.'
    : view === 'favourites'
      ? 'No favourites yet. Tap the heart on any recipe and it lands here.'
      : 'Try another filter or search term.';

  return (
    <div className="pb-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Recipes</h1>
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

      {/* Library · my recipes · favourites */}
      <div className="mt-4 px-5 flex gap-2 rise rise-1">
        {[['library', `Library (${allRecipes().length})`], ['mine', `Mine (${app.myRecipes.length})`], ['favourites', `Favourites (${app.favourites.length})`]]
          .map(([key, label]) => (
            <Chip key={key} active={view === key} onClick={() => setView(key)}>{label}</Chip>
          ))}
      </div>

      {/* Make one, or take one in */}
      <div className="mt-3 px-5 grid grid-cols-2 gap-2.5 rise rise-1">
        <button
          onClick={() => setSheet('generate')}
          className="press rounded-2xl border py-2.5 text-[13px] font-extrabold"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Invent a recipe</span>
        </button>
        <button
          onClick={() => setSheet('shared')}
          className="press rounded-2xl border py-2.5 text-[13px] font-extrabold"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1.5"><Inbox size={14} /> Add a shared one</span>
        </button>
      </div>

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
                        <button
                          onClick={(e) => { e.stopPropagation(); app.toggleFavourite(r.id); }}
                          aria-label={fav ? 'Unfavourite' : 'Favourite'}
                          className="press absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border"
                          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: fav ? 'var(--ink)' : 'var(--faint)' }}
                        >
                          <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
                        </button>
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
                      </div>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Sheet open={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters">
        <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setSheet(null)} results={recipes.length} />
      </Sheet>
      <Sheet open={sheet === 'generate'} onClose={() => setSheet(null)} title="Invent a recipe">
        <RecipeGenerator openRecipe={(r) => { setSheet(null); openRecipe(r); }} />
      </Sheet>
      <Sheet open={sheet === 'shared'} onClose={() => setSheet(null)} title="A recipe someone sent you">
        <SharedImport onDone={() => { setSheet(null); setView('mine'); }} />
      </Sheet>
    </div>
  );
}
