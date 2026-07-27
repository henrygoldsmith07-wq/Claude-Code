import { AlarmClock, Camera, ChevronRight, Droplet, Flame, Layers, Mic, Plus, ScanBarcode, Search, Star } from 'lucide-react';
import { useApp, levelFromXp } from '../lib/store.jsx';
import { gbp, greeting, prettyDate, todayName } from '../lib/utils.js';
import { byId, RECIPES } from '../data/recipes.js';
import { DEFAULT_PLAN, AI_SUGGESTIONS, WEEKLY_CHALLENGE } from '../data/plan.js';
import { pantryValue, expiringSoon, RUNNING_LOW, LEFTOVERS } from '../data/pantry.js';
import { fullList, totalOf, checkedTotalOf } from '../data/stores.js';
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

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', time: '8:00' },
  { key: 'lunch', label: 'Lunch', time: '12:30' },
  { key: 'dinner', label: 'Dinner', time: '18:30' },
];

export default function HomeTab({ openRecipe, openPantry, goTab, goLog }) {
  const app = useApp();
  const dayKey = todayName().slice(0, 3);
  const todayPlan = DEFAULT_PLAN[dayKey] || DEFAULT_PLAN.Mon;
  const list = fullList(app.extraItems);
  const spent = app.spentBase + checkedTotalOf(list, app.checked);
  const left = app.weeklyBudget - spent;
  const expiring = expiringSoon();
  const recipeOfDay = RECIPES[new Date().getDate() % RECIPES.length];

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
            {app.name[0]}
          </button>
        </div>

        {/* Streak + XP strip */}
        <div className="mt-4 flex gap-2 rise rise-1">
          <Pill tone="accent"><Flame size={12} /> {app.streak}-day cooking streak</Pill>
          <Pill tone="muted"><Star size={12} /> Level {levelFromXp(app.xp)} · {app.xp.toLocaleString()} XP</Pill>
        </div>
      </div>

      {/* Budget + nutrition hero cards */}
      <div className="px-5 grid grid-cols-2 gap-3 rise rise-1">
        <Card onClick={() => goTab('shop')}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Weekly budget</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring value={spent} max={app.weeklyBudget} size={64} label={`${Math.round((spent / app.weeklyBudget) * 100)}%`} />
            <div>
              <p className="text-[17px] font-extrabold leading-tight">{gbp(spent, { always: true })}</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>of {gbp(app.weeklyBudget)}</p>
              <p className="text-[11px] font-bold mt-0.5" style={{ color: left >= 0 ? 'var(--good)' : 'var(--warn)' }}>
                {left >= 0 ? `${gbp(left, { always: true })} left` : `${gbp(-left, { always: true })} over`}
              </p>
            </div>
          </div>
        </Card>
        <Card onClick={() => goLog()}>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Calories today</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring value={app.kcalToday} max={app.kcalGoal} size={64} color="var(--series-2)" label={Math.round((app.kcalToday / app.kcalGoal) * 100) + '%'} />
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

      {/* Today's meals */}
      <Section title="Today’s meals" action="Full plan →" onAction={() => goTab('plan')} className="rise rise-2">
        <div className="space-y-2.5">
          {MEAL_SLOTS.map(({ key, label, time }) => {
            const r = todayPlan[key] ? byId(todayPlan[key]) : null;
            return r ? (
              <Card key={key} onClick={() => openRecipe(r)} className="flex items-center gap-3 !p-3">
                <FoodArt recipe={r} className="h-14 w-14 rounded-xl shrink-0" px={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>{label} · {time}</p>
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
                  <p className="font-semibold text-[14px]" style={{ color: 'var(--muted)' }}>Nothing planned — ask the AI</p>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Water + challenge row */}
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
          <p className="mt-2 text-[13px] font-bold">{app.water} <span className="font-semibold" style={{ color: 'var(--muted)' }}>/ 8 glasses</span></p>
        </Card>
        <Card>
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Weekly challenge</p>
          <p className="mt-1.5 font-bold text-[14px] flex items-center gap-1.5">
            <Glyph e={WEEKLY_CHALLENGE.emoji} size={15} /> {WEEKLY_CHALLENGE.name}
          </p>
          <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--muted)' }}>{WEEKLY_CHALLENGE.desc}</p>
          <Meter value={WEEKLY_CHALLENGE.progress} max={WEEKLY_CHALLENGE.of} />
          <p className="mt-1.5 text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
            {WEEKLY_CHALLENGE.progress}/{WEEKLY_CHALLENGE.of} done · +{WEEKLY_CHALLENGE.reward} XP
          </p>
        </Card>
      </div>

      {/* AI suggestions carousel */}
      <Section title="Made for you" className="rise rise-3">
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 snap-x">
          {AI_SUGGESTIONS.map((s) => (
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

      {/* Pantry snapshot */}
      <Section title="Smart pantry" action="Open pantry →" onAction={openPantry} className="rise rise-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Pantry value</p>
              <p className="text-[22px] font-extrabold">{gbp(pantryValue(), { always: true })}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Next shop</p>
              <p className="text-[14px] font-bold">Sat · est. {gbp(totalOf(list), { always: true })}</p>
            </div>
          </div>

          {expiring.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
              <p className="text-[12px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
                <AlarmClock size={13} /> Use soon
              </p>
              <div className="flex gap-2 flex-wrap">
                {expiring.slice(0, 4).map((p) => (
                  <Pill key={p.id} tone={p.expiryDays <= 1 ? 'danger' : 'warn'}>
                    <Glyph e={p.emoji} size={12} /> {p.name} · {p.expiryDays}d
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--muted)' }}>Running low</p>
            <div className="flex gap-2 flex-wrap">
              {RUNNING_LOW.map((p) => (
                <Pill key={p.name} tone="muted"><Glyph e={p.emoji} size={12} /> {p.name}</Pill>
              ))}
            </div>
          </div>
        </Card>
      </Section>

      {/* Leftovers */}
      <Section title="Leftovers to use" className="rise rise-4">
        <div className="grid grid-cols-2 gap-3">
          {LEFTOVERS.map((l) => (
            <Card key={l.name} className="!p-3">
              <p className="font-bold text-[14px] flex items-center gap-1.5">
                <Glyph e={l.emoji} size={15} style={{ color: 'var(--muted)' }} /> {l.name}
              </p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                {l.portions} portion{l.portions > 1 ? 's' : ''} · {l.note}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Recipe of the day */}
      <Section title="Recipe of the day" className="rise rise-4">
        <Card onClick={() => openRecipe(recipeOfDay)} className="!p-0 overflow-hidden">
          <FoodArt recipe={recipeOfDay} className="h-36 w-full" px={56} />
          <div className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-[16px]">{recipeOfDay.name}</p>
              <Pill tone="accent"><Star size={11} fill="currentColor" /> {recipeOfDay.rating}</Pill>
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
