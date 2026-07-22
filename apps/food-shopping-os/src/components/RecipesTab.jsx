import { useMemo, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { DISCOVER_FILTERS, filterRecipes } from '../data/recipes.js';
import { Section, Card, Chip, Pill, FoodArt } from './ui.jsx';

export default function RecipesTab({ openRecipe }) {
  const app = useApp();
  const [filter, setFilter] = useState('Trending');
  const [query, setQuery] = useState('');

  const recipes = useMemo(() => {
    const base = filterRecipes(filter);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((r) => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)));
  }, [filter, query]);

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

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar px-5 rise rise-1">
        {DISCOVER_FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>
        ))}
      </div>

      <Section className="mt-5 rise rise-2">
        {recipes.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-3xl mb-2">🍽️</p>
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
                        <FoodArt recipe={r} className={tall ? 'h-40 w-full' : 'h-28 w-full'} size={tall ? 'text-6xl' : 'text-5xl'} />
                        <button
                          onClick={(e) => { e.stopPropagation(); app.toggleFavourite(r.id); }}
                          aria-label={fav ? 'Unfavourite' : 'Favourite'}
                          className="press absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-[15px] border"
                          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: fav ? 'var(--ink)' : 'var(--faint)' }}
                        >
                          {fav ? '♥' : '♡'}
                        </button>
                        {r.tags.includes('trending') || r.rating >= 4.8 ? (
                          <span className="absolute bottom-2 left-2"><Pill tone="accent">🔥 Trending</Pill></span>
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-[13.5px] leading-tight line-clamp-2">{r.name}</p>
                        <p className="mt-1 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                          {r.time <= 60 ? `${r.time} min` : `${Math.round(r.time / 60)} h`} · {r.kcal} kcal · ★ {r.rating}
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

      {/* Community strip */}
      <Section title="Community" className="mt-6 rise rise-3">
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
          {[
            { emoji: '🧑‍🍳', name: 'Chef Rosa', sub: '12.4k followers · Italian', cta: 'Follow' },
            { emoji: '🥦', name: 'Dr. Green, RD', sub: 'Dietitian · meal plans', cta: 'Follow' },
            { emoji: '🏆', name: 'July challenge', sub: '£1-per-portion dinners', cta: 'Join' },
            { emoji: '📸', name: 'Photo wall', sub: '318 cooks this week', cta: 'Browse' },
          ].map((c) => (
            <Card key={c.name} className="w-[190px] shrink-0 text-center !py-5">
              <p className="text-3xl">{c.emoji}</p>
              <p className="mt-1.5 font-bold text-[14px]">{c.name}</p>
              <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>{c.sub}</p>
              <button className="press mt-2.5 rounded-full px-4 py-1.5 text-[12px] font-extrabold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>
                {c.cta}
              </button>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
