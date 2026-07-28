import { useMemo, useState } from 'react';
import {
  Activity, ArrowRight, CalendarClock, Lightbulb, ShoppingBasket, Store, TrendingUp, Utensils,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { gbp } from '../lib/utils.js';
import { dailySummary, habitAnalysis, predictProgress, trend } from '../lib/coach.js';
import {
  groceryRecommendations, macroAdvice, mealFeedback, personalTips, restaurantPicks,
} from '../lib/advice.js';
import { MEAL_KEYS } from '../lib/nutrition.js';
import { Card, Chip, Meter, Pill } from './ui.jsx';
import { Glyph } from './icons.jsx';

const VIEWS = [
  ['today', 'Today', Utensils],
  ['habits', 'Habits', Activity],
  ['progress', 'Progress', TrendingUp],
  ['ideas', 'Ideas', Lightbulb],
];

const Empty = ({ children }) => (
  <Card className="text-center py-8">
    <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{children}</p>
  </Card>
);

const Row = ({ label, value, sub }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <span className="text-[13px] font-bold">{label}</span>
    <span className="text-[13px] font-semibold text-right" style={{ color: 'var(--muted)' }}>
      {value}{sub && <span style={{ color: 'var(--faint)' }}> · {sub}</span>}
    </span>
  </div>
);

/**
 * The coach as a page rather than a conversation: today read back to you, the
 * habits your diary shows, where the current pace leads, and ideas drawn from
 * the same numbers. Everything states how many days it was computed from, and
 * says nothing at all when there isn't enough to say.
 */
export default function CoachPanel() {
  const app = useApp();
  const [view, setView] = useState('today');

  const summary = useMemo(() => dailySummary(app, { today: app.day }), [app]);
  const habits = useMemo(() => habitAnalysis(app.log, { today: app.day }), [app.log, app.day]);
  const progress = useMemo(() => predictProgress(app, { today: app.day }), [app]);
  const tips = useMemo(() => personalTips(app, { today: app.day }), [app]);
  const groceries = useMemo(() => groceryRecommendations(app, { today: app.day }), [app]);
  const macros = useMemo(() => macroAdvice(app, { today: app.day }), [app]);
  const eatingOut = useMemo(() => restaurantPicks(app, { today: app.day }), [app]);
  const kcalTrend = useMemo(() => trend(app.log, 'kcal', { today: app.day }), [app.log, app.day]);

  const feedback = MEAL_KEYS
    .map((meal) => mealFeedback(app.entries, meal, { targets: app.targets }))
    .filter(Boolean);

  return (
    <div className="px-5 pb-10 space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {VIEWS.map(([key, label, Icon]) => (
          <Chip key={key} active={view === key} onClick={() => setView(key)}>
            <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
          </Chip>
        ))}
      </div>

      {view === 'today' && (
        <>
          <Card>
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Today so far</p>
            {summary.logged === 0 ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                Nothing logged yet. Everything on this page is read off your diary, so today is a blank
                page until you put something in it.
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-[22px] font-extrabold">
                  {Math.round(summary.totals.kcal).toLocaleString()} kcal
                  <span className="text-[13px] font-semibold ml-1.5" style={{ color: 'var(--muted)' }}>
                    of {app.targets.kcal.toLocaleString()}
                  </span>
                </p>
                <div className="mt-2"><Meter value={summary.totals.kcal} max={app.targets.kcal} /></div>
                <div className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
                  <Row label="Protein" value={`${Math.round(summary.totals.protein)}g`} sub={summary.left.protein > 0 ? `${summary.left.protein}g to go` : 'target met'} />
                  <Row label="Fibre" value={`${summary.fibre}g`} />
                  <Row label="Meals logged" value={summary.meals.map((m) => m.label).join(', ') || 'none'} />
                  {summary.plannedMeals > 0 && <Row label="Planned today" value={`${summary.plannedMeals} meal${summary.plannedMeals === 1 ? '' : 's'}`} />}
                </div>
              </>
            )}
          </Card>

          {feedback.map((f) => (
            <Card key={f.meal}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{f.label}</p>
                <Pill tone={f.proteinShare >= 25 ? 'good' : 'muted'}>{f.kcalShare}% of the day</Pill>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {f.points.map((p) => (
                  <li key={p} className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{p}</li>
                ))}
              </ul>
              {f.suggestion && <p className="mt-1.5 text-[13px] font-semibold">{f.suggestion}</p>}
            </Card>
          ))}
        </>
      )}

      {view === 'habits' && (
        habits.days === 0 ? (
          <Empty>Nothing to read yet. A few logged days and this page fills itself in.</Empty>
        ) : (
          <>
            <Card>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
                From {habits.days} logged day{habits.days === 1 ? '' : 's'}
              </p>
              <div className="mt-1 divide-y" style={{ borderColor: 'var(--line)' }}>
                <Row label="Entries a day" value={habits.perDay} />
                {habits.window && <Row label="Eating window" value={`${habits.window.first}–${habits.window.last}`} sub={`${habits.window.hours} h`} />}
                <Row label="Calories from snacks" value={`${habits.snackShare}%`} />
                {habits.weekendGap !== null && (
                  <Row
                    label="Weekend vs weekday"
                    value={`${habits.weekendGap > 0 ? '+' : ''}${habits.weekendGap} kcal`}
                    sub={`${habits.weekday} → ${habits.weekend}`}
                  />
                )}
                <Row label="Logged in the last fortnight" value={`${habits.consistency}%`} />
              </div>
            </Card>

            {habits.skipped.length > 0 && (
              <Card>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Rarely logged</p>
                {habits.skipped.map((s) => (
                  <p key={s.key} className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                    {s.label} — on {s.days} of {habits.days} days
                  </p>
                ))}
              </Card>
            )}

            {habits.topFoods.length > 0 && (
              <Card>
                <p className="text-[12px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>What you eat most</p>
                {habits.topFoods.map((f) => <Row key={f.name} label={f.name} value={`${f.times}×`} />)}
              </Card>
            )}
          </>
        )
      )}

      {view === 'progress' && (
        <>
          <Card>
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Where this pace leads</p>
            {!progress.ready ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>{progress.reason}</p>
            ) : (
              <>
                <p className="mt-0.5 text-[22px] font-extrabold">
                  {progress.perWeekKg > 0 ? '+' : ''}{progress.perWeekKg} kg a week
                </p>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
                  {progress.avgKcal.toLocaleString()} kcal a day against {progress.maintenance.toLocaleString()} maintenance,
                  over {progress.days} logged days — {progress.direction}.
                </p>
                {progress.toTarget?.weeks && (
                  <p className="mt-2 text-[13px] font-semibold inline-flex items-center gap-1.5">
                    <CalendarClock size={14} style={{ color: 'var(--muted)' }} />
                    {Math.abs(progress.toTarget.gapKg)} kg to go — about {progress.toTarget.weeks} weeks at this rate.
                  </p>
                )}
                <p className="mt-2 text-[12px] font-semibold" style={{ color: 'var(--faint)' }}>{progress.caveat}</p>
                {!progress.onCourse && (
                  <p className="mt-2"><Pill tone="warn">not the direction your goal asks for</Pill></p>
                )}
              </>
            )}
          </Card>

          {kcalTrend && (
            <Card>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Calorie trend</p>
              <p className="mt-0.5 text-[13.5px] font-semibold">
                {kcalTrend.direction === 'steady'
                  ? `Steady around ${kcalTrend.after.toLocaleString()} kcal.`
                  : `${kcalTrend.direction === 'up' ? 'Up' : 'Down'} ${Math.abs(kcalTrend.change).toLocaleString()} kcal a day — ${kcalTrend.before.toLocaleString()} → ${kcalTrend.after.toLocaleString()}.`}
              </p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                Comparing the two halves of your last {kcalTrend.days} logged days.
              </p>
            </Card>
          )}

          <Card>
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Your targets</p>
            {!macros.ready ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>{macros.reason}</p>
            ) : macros.changes.length === 0 ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                Your targets and your days broadly agree — {macros.stats.kcalHit} of {macros.stats.days} days
                within 10% on calories. Nothing worth changing.
              </p>
            ) : (
              macros.changes.map((c) => (
                <div key={c.key} className="mt-2">
                  <p className="text-[13.5px] font-bold inline-flex items-center gap-1.5">
                    {c.key === 'kcal' ? 'Calories' : 'Protein'} {c.from.toLocaleString()}
                    <ArrowRight size={13} /> {c.to.toLocaleString()}
                  </p>
                  <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>{c.why}</p>
                  <button
                    onClick={() => app.setTarget(c.key, c.to)}
                    className="press mt-1.5 rounded-full border px-3 py-1.5 text-[12px] font-extrabold"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    Use {c.to.toLocaleString()}
                  </button>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {view === 'ideas' && (
        <>
          {tips.map((tip) => (
            <Card key={tip.title}>
              <p className="text-[14px] font-extrabold leading-tight">{tip.title}</p>
              <p className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{tip.detail}</p>
              <p className="mt-1.5"><Pill tone="faint">{tip.evidence}</Pill></p>
            </Card>
          ))}

          <Card>
            <p className="text-[12px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
              <ShoppingBasket size={12} /> Worth buying
            </p>
            {!groceries.ready ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>{groceries.reason}</p>
            ) : groceries.items.length === 0 ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                Nothing obviously short across your last {groceries.days} logged days.
              </p>
            ) : (
              groceries.items.map(({ food, why }) => (
                <div key={food.id} className="mt-2 flex items-center gap-3">
                  <Glyph e={food.emoji} size={18} style={{ color: 'var(--muted)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold truncate">{food.name}</p>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>{why}</p>
                  </div>
                  <button
                    onClick={() => app.addToList({ name: food.name, emoji: food.emoji })}
                    className="press rounded-full border px-3 py-1.5 text-[12px] font-extrabold shrink-0"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    Add
                  </button>
                </div>
              ))
            )}
          </Card>

          <Card>
            <p className="text-[12px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color: 'var(--faint)' }}>
              <Store size={12} /> Eating out
            </p>
            {eatingOut.picks.length === 0 ? (
              <p className="mt-1 text-[13.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                Nothing on the bundled menus fits what’s left of today. These are the few chains the app
                ships figures for — it doesn’t know your local places.
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                  {eatingOut.kcalLeft
                    ? `${eatingOut.kcalLeft.toLocaleString()} kcal left today — best protein per calorie from the menus the app ships.`
                    : 'Best protein per calorie from the menus the app ships.'}
                </p>
                {eatingOut.picks.map(({ food, kcal, protein }) => (
                  <div key={food.id} className="mt-2 flex items-center gap-3">
                    <Glyph e={food.emoji} size={18} style={{ color: 'var(--muted)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold truncate">{food.name}</p>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
                        {food.chain} · {kcal} kcal · {protein}g protein
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </Card>

          {app.weeklyBudget > 0 && (
            <p className="text-[12px] font-semibold text-center" style={{ color: 'var(--faint)' }}>
              {gbp(app.weeklyBudget - app.spentThisWeek, { always: true })} of this week’s budget left.
            </p>
          )}
        </>
      )}
    </div>
  );
}
