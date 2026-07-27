import { useMemo, useState } from 'react';
import { Flame, Heart, Star, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { DISCOVER_FILTERS, filterRecipes, RECIPES } from '../data/recipes.js';
import { filterByDiet } from '../lib/goals.js';
import { Section, Card, Chip, Pill, FoodArt } from './ui.jsx';

export default function RecipesTab({ openRecipe }) {
  const app = useApp();
  const [filter, setFilter] = useState('Trending');
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const favourites = app.favourites.map((id) => RECIPES.find((r) => r.id === id)).filter(Boolean);

  // Search spans the whole catalogue; the chip filter only applies when not searching.
  const recipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? RECIPES.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
      )
      : filterRecipes(filter);
    return onlyMine && app.diets.length ? filterByDiet(pool, app.diets) : pool;
  }, [filter, query, onlyMine, app.diets]);

  const hidden = app.diets.length && onlyMine
    ? (query.trim() ? RECIPES.length : filterRecipes(filter).length) - recipes.length
    : 0;

  // Pinterest-style: split into two masonry columns, alternating card heights
  const cols = useMemo(() => {
    const a = [], b = [];
    recipes.forEach((r, i) => (i % 2 === 0 ? a : b).push(r));
    return [a, b];
  }, [recipes]);

  return (
    <div className="pb-6">
      <div className="hero-gradient px-5 pt-14 pb-3">
        <h1 className="text-[26px] font-extrabold tracking-tight rise">Discover</h1>
        <div className="mt-3 rise rise-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, cuisines, ingredients…"
            className="w-full rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none focus:ring-2"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)', '--tw-ring-color': 'var(--accent-soft)' }}
          />
        </div>
      </div>

      {app.diets.length > 0 && (
        <div className="mt-4 px-5 flex items-center justify-between gap-3 rise rise-1">
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            {onlyMine
              ? `Showing what fits ${app.diets.length === 1 ? 'your pattern' : 'your patterns'}${hidden > 0 ? ` · ${hidden} hidden` : ''}`
              : 'Showing everything, including what clashes'}
          </p>
          <Chip active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>Fits my diet</Chip>
        </div>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar px-5 rise rise-1">
        {DISCOVER_FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>
        ))}
      </div>

      <Section className="mt-5 rise rise-2">
        {recipes.length === 0 ? (
          <Card className="text-center py-10">
            <UtensilsCrossed size={30} className="mx-auto mb-2" style={{ color: 'var(--faint)' }} />
            <p className="font-bold">Nothing matches</p>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>Try another filter or search term.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 items-start">
            {cols.map((col, ci) => (
              <div key={ci} className="space-y-3">
                {col.map((r, i) => {
                  const tall = (i + ci) % 3 === 0;
                  const fav = app.favourites.includes(r.id);
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
                        {r.tags.includes('trending') || r.rating >= 4.8 ? (
                          <span className="absolute bottom-2 left-2"><Pill tone="accent"><Flame size={11} /> Trending</Pill></span>
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-[13.5px] leading-tight line-clamp-2">{r.name}</p>
                        <p className="mt-1 text-[11.5px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                          {r.time <= 60 ? `${r.time} min` : `${Math.round(r.time / 60)} h`} · {r.kcal} kcal · <Star size={10} fill="currentColor" /> {r.rating}
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

      {/* Your favourites, once you've starred some */}
      {favourites.length > 0 && !query && (
        <Section title="Your favourites" className="mt-6 rise rise-3">
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
            {favourites.map((r) => (
              <Card key={r.id} onClick={() => openRecipe(r)} className="w-[190px] shrink-0 !p-0 overflow-hidden">
                <FoodArt recipe={r} className="h-24 w-full" px={34} />
                <div className="p-3">
                  <p className="font-bold text-[13.5px] leading-tight line-clamp-2">{r.name}</p>
                  <p className="mt-1 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                    {r.time} min · {gbp(r.costPerServing, { always: true })}/serving
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
