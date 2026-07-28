import {
  AlarmClock, Camera, ChevronRight, Droplet, Flame, Layers, Mic, Package, Plus,
  ScanBarcode, Search, Star,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp, greeting, prettyDate } from '../lib/utils.js';
import { byId, RECIPES } from '../data/recipes.js';
import { MEAL_SLOTS } from '../data/plan.js';
import {
  daysUntil, expiringSoon, leftovers, pantryValue, planForDay, recipesUsing, runningLow,
} from '../lib/kitchen.js';
import { totalOf } from '../data/stores.js';
import { recipeAllowed } from '../lib/goals.js';
import { Section, Card, Ring, Pill, Meter, FoodArt } from './ui.jsx';
import { Glyph } from './icons.jsx';

/** Capture routes that open straight into the diary's matching sheet. */
const LOG_SHORTCUTS = [
  { id: 'add', label: 'Search food', Icon: Search },
  { id: 'barcode', label: 'Scan barcode', Icon: ScanBarcode },
  { id: 'photo', label: 'Photo', Icon: Camera },
  { id: 'voice', label: 'Voice', Icon: Mic },
  { id: 'copy', label: 'Copy meal', Icon: Layers },
];

/**
 * Suggestions read the actual state of your kitchen — what's going off, what
 * the budget looks like, where today's protein stands. If there's nothing to
 * say, nothing is said.
 */
const buildSuggestions = (app) => {
  const out = [];
  // Never suggest something your dietary patterns rule out.
  const fits = (r) => recipeAllowed(r, app.diets);
  const uses = recipesUsing(app.pantry, 4, app.day).filter((u) => fits(u.recipe)).slice(0, 2);
  for (const { recipe, hits } of uses) {
    const soon = expiringSoon(app.pantry, 3, app.day)[0];
    out.push({
      emoji: recipe.emoji,
      title: `Use your ${soon.name.toLowerCase()}`,
      text: `${recipe.name} uses ${hits === 1 ? '1 thing that needs' : `${hits} things that need`} eating this week.`,
      recipeId: recipe.id,
    });
  }
  const proteinLeft = Math.round(app.targets.protein - app.totals.protein);
  const highProtein = RECIPES.filter(fits).sort((a, b) => b.protein - a.protein)[0];
  if (app.entries.length && proteinLeft > 25 && highProtein) {
    out.push({
      emoji: '💪',
      title: `${proteinLeft}g of protein to go`,
      text: `${highProtein.name} would cover ${Math.min(100, Math.round((highProtein.protein / proteinLeft) * 100))}% of what's left.`,
      recipeId: highProtein.id,
    });
  }
  if (app.weeklyBudget > 0) {
    const left = app.weeklyBudget - app.spentThisWeek;
    out.push({
      emoji: '💷',
      title: left >= 0 ? `${gbp(left, { always: true })} left this week` : `${gbp(-left, { always: true })} over budget`,
      text: left >= 0
        ? `You've spent ${gbp(app.spentThisWeek, { always: true })} across ${app.shops.length} recorded shop${app.shops.length === 1 ? '' : 's'}.`
        : 'Cheap batch cooking — chilli and curry both come in under £1.20 a portion.',
    });
  }
  if (!app.pantry.length) {
    out.push({
      emoji: '🥫',
      title: 'Add what’s in your kitchen',
      text: 'Once the pantry knows what you have, recipes show what you’re missing and nothing gets forgotten at the back of the fridge.',
    });
  }
  return out;
};

export default function HomeTab({ openRecipe, openPantry, goTab, goLog }) {
  const app = useApp();
  const todayPlan = planForDay(app.plan, app.day);
  const expiring = expiringSoon(app.pantry, 3, app.day);
  const low = runningLow(app.pantry);
  const left = app.weeklyBudget - app.spentThisWeek;
  const suggestions = buildSuggestions(app);
  const recipeOfDay = RECIPES[new Date().getDate() % RECIPES.length];
  const listTotal = totalOf(app.shoppingList);
  const leftoverItems = leftovers(app.pantry);

  return (
    <div className="pb-6 space-y-6">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-2">
        <div className="flex items-start justify-between rise">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{prettyDate()}</p>
            <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">
              {greeting()}, {app.name}
            </h1>
          </div>
          <button
            onClick={() => goTab('profile')}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            aria-label="Profile"
          >
            {app.name[0]?.toUpperCase() || '?'}
          </button>
        </div>

        {(app.streak > 0 || app.xp > 0) && (
          <div className="mt-4 flex gap-2 rise rise-1">
            {app.streak > 0 && <Pill tone="accent"><Flame size={12} /> {app.streak}-day cooking streak</Pill>}
            <Pill tone="muted"><Star size={12} /> Level {app.level.level} · {app.xp.toLocaleString()} XP</Pill>
          </div>
        )}
      </div>

      {/* Budget + nutrition */}
      <div className="px-5 grid grid-cols-2 gap-3 rise rise-1">
        <Card onClick={() => goTab('shop')}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Weekly budget</p>
          {app.weeklyBudget > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <Ring
                value={app.spentThisWeek}
                max={app.weeklyBudget}
                size={64}
                label={`${Math.round((app.spentThisWeek / app.weeklyBudget) * 100)}%`}
              />
              <div>
                <p className="text-[17px] font-extrabold leading-tight">{gbp(app.spentThisWeek, { always: true })}</p>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>of {gbp(app.weeklyBudget)}</p>
                <p className="text-[11px] font-bold mt-0.5" style={{ color: left >= 0 ? 'var(--good)' : 'var(--warn)' }}>
                  {left >= 0 ? `${gbp(left, { always: true })} left` : `${gbp(-left, { always: true })} over`}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
              No budget set — add one in your profile to track spending.
            </p>
          )}
        </Card>

        <Card onClick={() => goLog()}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Calories today</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring
              value={app.kcalToday}
              max={app.kcalGoal}
              size={64}
              color="var(--series-2)"
              label={`${Math.round((app.kcalToday / app.kcalGoal) * 100)}%`}
            />
            <div>
              <p className="text-[17px] font-extrabold leading-tight">{app.kcalToday.toLocaleString()}</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>of {app.kcalGoal.toLocaleString()} kcal</p>
              <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--muted)' }}>
                P {Math.round(app.proteinToday)}g · C {Math.round(app.carbsToday)}g · F {Math.round(app.fatToday)}g
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Today's goals — small, and every bar is a count of something real */}
      <Section title="Today’s goals" action="Progress →" onAction={() => goTab('profile')} className="rise rise-2">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold">
              {app.game.daily.filter((g) => g.done).length} of {app.game.daily.length} done
            </p>
<Pill tone="muted">{app.game.streaks.logging.days} day diary streak</Pill>
          </div>
          <div className="mt-2.5 space-y-2">
            {app.game.daily.map((goal) => (
              <div key={goal.id}>
                <div className="flex justify-between text-[12px] font-bold mb-1">
                  <span style={goal.done ? { color: 'var(--good)' } : undefined}>
                    {goal.done ? '✓ ' : ''}{goal.label}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>{goal.progress}/{goal.of}</span>
                </div>
                <Meter value={goal.progress} max={goal.of} height={4} color={goal.done ? 'var(--good)' : 'var(--accent)'} />
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* One-tap food logging */}
      <Section title="Log what you ate" action="Diary →" onAction={() => goLog()} className="rise rise-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {LOG_SHORTCUTS.map(({ id, label, Icon }) => (
            <button
              key={label}
              onClick={() => goLog(id)}
              className="press shrink-0 inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-[12.5px] font-bold"
              style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Today's plan */}
      <Section title="Today’s meals" action="Full plan →" onAction={() => goTab('plan')} className="rise rise-2">
        <div className="space-y-2.5">
          {MEAL_SLOTS.map(({ key, label }) => {
            const r = todayPlan[key] ? byId(todayPlan[key]) : null;
            return r ? (
              <Card key={key} onClick={() => openRecipe(r)} className="flex items-center gap-3 !p-3">
                <FoodArt recipe={r} className="h-14 w-14 rounded-xl shrink-0" px={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>{label}</p>
                  <p className="font-bold text-[15px] truncate">{r.name}</p>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                    {r.time <= 60 ? `${r.time} min` : `${Math.round(r.time / 60)} h`} · {r.kcal} kcal · {gbp(r.costPerServing, { always: true })}/serving
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
              </Card>
            ) : (
              <Card key={key} className="flex items-center gap-3 !p-3" onClick={() => goTab('plan')}>
                <div className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--card-2)', color: 'var(--faint)' }}>
                  <Plus size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
                  <p className="font-semibold text-[14px]" style={{ color: 'var(--muted)' }}>Nothing planned — tap to choose</p>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Water + shopping list */}
      <div className="px-5 grid grid-cols-2 gap-3 rise rise-2">
        <Card>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Water</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Water glasses">
            {Array.from({ length: 8 }, (_, i) => {
              const on = i < app.water;
              return (
                <button
                  key={i}
                  onClick={() => app.set({ water: i + 1 === app.water ? i : i + 1 })}
                  className="press"
                  style={{ color: on ? 'var(--accent)' : 'var(--line)' }}
                  aria-label={`Glass ${i + 1}`}
                >
                  <Droplet size={18} fill={on ? 'currentColor' : 'none'} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] font-bold">
            {app.hydration.total.toLocaleString()} <span className="font-semibold" style={{ color: 'var(--muted)' }}>/ {app.targets.water.toLocaleString()} ml</span>
          </p>
        </Card>

        <Card onClick={() => goTab('shop')}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Shopping list</p>
          {app.shoppingList.length ? (
            <>
              <p className="mt-1.5 text-[22px] font-extrabold leading-none">{app.shoppingList.length}</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                items · about {gbp(listTotal, { always: true })}
              </p>
              <div className="mt-2">
                <Meter value={app.shoppingList.filter((i) => i.checked).length} max={app.shoppingList.length} height={5} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
              Empty — add items or send a recipe's ingredients over.
            </p>
          )}
        </Card>
      </div>

      {/* Suggestions, when there is something worth saying */}
      {suggestions.length > 0 && (
        <Section title="From your kitchen" className="rise rise-3">
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 snap-x">
            {suggestions.map((s) => (
              <Card
                key={s.title}
                className="w-[240px] shrink-0 snap-start !p-4"
                onClick={s.recipeId ? () => openRecipe(byId(s.recipeId)) : undefined}
              >
                <Glyph e={s.emoji} size={22} style={{ color: 'var(--muted)' }} />
                <p className="mt-2 font-bold text-[14px] leading-snug">{s.title}</p>
                <p className="mt-1 text-[12.5px] font-medium leading-snug" style={{ color: 'var(--muted)' }}>{s.text}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Pantry */}
      <Section title="Pantry" action="Open pantry →" onAction={openPantry} className="rise rise-3">
        <Card>
          {app.pantry.length === 0 ? (
            <button onClick={openPantry} className="press w-full flex items-center gap-3 text-left">
              <Package size={22} style={{ color: 'var(--faint)' }} />
              <span>
                <span className="block font-bold text-[14px]">Nothing tracked yet</span>
                <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                  Add what's in your fridge and cupboards to see value, expiry and what recipes need.
                </span>
              </span>
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Pantry value</p>
                  <p className="text-[22px] font-extrabold">{gbp(pantryValue(app.pantry), { always: true })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Items</p>
                  <p className="text-[14px] font-bold">{app.pantry.length} tracked</p>
                </div>
              </div>

              {expiring.length > 0 && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-[12px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                    <AlarmClock size={13} /> Use soon
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {expiring.slice(0, 4).map((p) => {
                      const d = daysUntil(p.expiry, app.day);
                      return (
                        <Pill key={p.id} tone={d <= 1 ? 'danger' : 'warn'}>
                          <Glyph e={p.emoji} size={12} /> {p.name} · {d <= 0 ? 'today' : `${d}d`}
                        </Pill>
                      );
                    })}
                  </div>
                </div>
              )}

              {low.length > 0 && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--muted)' }}>Running low</p>
                  <div className="flex gap-2 flex-wrap">
                    {low.map((p) => (
                      <Pill key={p.id} tone="muted"><Glyph e={p.emoji} size={12} /> {p.name}</Pill>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </Section>

      {/* Leftovers, if any are tracked */}
      {leftoverItems.length > 0 && (
        <Section title="Leftovers to use" className="rise rise-4">
          <div className="grid grid-cols-2 gap-3">
            {leftoverItems.map((l) => (
              <Card key={l.id} className="!p-3">
                <p className="font-bold text-[14px] flex items-center gap-1.5">
                  <Glyph e={l.emoji} size={15} style={{ color: 'var(--muted)' }} /> {l.name}
                </p>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                  {[l.qty, l.location].filter(Boolean).join(' · ')}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Recipe of the day */}
      <Section title="Recipe of the day" className="rise rise-4">
        <Card onClick={() => openRecipe(recipeOfDay)} className="!p-0 overflow-hidden">
          <FoodArt recipe={recipeOfDay} className="h-36 w-full" px={56} />
          <div className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-[16px]">{recipeOfDay.name}</p>
              <Pill tone="accent">{recipeOfDay.protein}g protein</Pill>
            </div>
            <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
              {recipeOfDay.cuisine} · {recipeOfDay.time} min · {gbp(recipeOfDay.costPerServing, { always: true })}/serving · {recipeOfDay.kcal} kcal
            </p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
