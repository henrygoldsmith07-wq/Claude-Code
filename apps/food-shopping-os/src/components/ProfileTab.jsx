import { Banknote, Flame, Recycle } from 'lucide-react';
import { useApp, levelFromXp, xpIntoLevel, XP_PER_LEVEL } from '../lib/store.jsx';
import { Glyph } from './icons.jsx';
import { BADGES, SPEND_HISTORY, KCAL_WEEK, CUISINE_SPLIT, ANALYTICS_STATS, INTEGRATIONS } from '../data/plan.js';
import { snackSummary, timingInsight } from '../lib/nutrition.js';
import { Section, Card, Ring, Pill, Meter, Bars, Toggle } from './ui.jsx';

const ACCENTS = [
  ['mono', 'var(--ink)'],
  ['forest', '#3d5c4b'],
  ['ocean', '#3b5b73'],
  ['wine', '#6e4550'],
  ['honey', '#8a6a3b'],
];

export default function ProfileTab() {
  const app = useApp();
  const snacks = snackSummary(app.entries);
  const timing = timingInsight(app.entries);
  /* The week chart reads the diary; days before the app was used fall back to
     the historic series so the chart is never half-empty. */
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const stamp = d.toISOString().slice(0, 10);
    const logged = app.kcalFor(stamp);
    return {
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3),
      value: logged || KCAL_WEEK[i],
    };
  });
  const macros = [
    { label: 'Protein', now: app.proteinToday, goal: app.proteinGoal, color: 'var(--series-1)' },
    { label: 'Carbs', now: app.carbsToday, goal: app.carbsGoal, color: 'var(--series-3)' },
    { label: 'Fat', now: app.fatToday, goal: app.fatGoal, color: 'var(--series-2)' },
  ];

  return (
    <div className="pb-6 space-y-6">
      {/* Header */}
      <div className="hero-gradient px-5 pt-14 pb-2">
        <div className="flex items-center gap-4 rise">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-extrabold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            {app.name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight">{app.name}</h1>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>Level {levelFromXp(app.xp)} Home Chef · {app.xp.toLocaleString()} XP</p>
            <div className="mt-1.5"><Meter value={xpIntoLevel(app.xp)} max={XP_PER_LEVEL} height={5} /></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5 rise rise-1">
          {[
            [Flame, app.streak, 'cook streak'],
            [Banknote, app.budgetStreak, 'weeks on budget'],
            [Recycle, app.wasteStreak, 'no-waste weeks'],
          ].map(([Icon, v, label]) => (
            <Card key={label} className="!p-3 text-center">
              <p className="text-[17px] font-extrabold inline-flex items-center gap-1.5">
                <Icon size={15} style={{ color: 'var(--muted)' }} /> {v}
              </p>
              <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Nutrition dashboard */}
      <Section title="Nutrition today" className="rise rise-1">
        <Card>
          <div className="flex items-center gap-5">
            <Ring value={app.kcalToday} max={app.kcalGoal} size={92} stroke={9} color="var(--series-2)"
              label={app.kcalToday.toLocaleString()} sub={`of ${app.kcalGoal.toLocaleString()} kcal`} />
            <div className="flex-1 space-y-2.5">
              {macros.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-[12px] font-bold mb-1">
                    <span>{m.label}</span>
                    <span style={{ color: 'var(--muted)' }}>{m.now}g / {m.goal}g</span>
                  </div>
                  <Meter value={m.now} max={m.goal} color={m.color} height={5} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--line)' }}>
            <Pill tone={app.fibreToday >= 30 ? 'good' : 'muted'}>Fibre {app.fibreToday}g</Pill>
            <Pill tone="muted">{app.entries.length} items logged</Pill>
            <Pill tone={snacks.count > 3 ? 'warn' : 'muted'}>{snacks.count} snacks · {snacks.kcal} kcal</Pill>
            {timing && <Pill tone="muted">{timing.first}–{timing.last}</Pill>}
            <Pill tone="accent">Nutrition score 84</Pill>
          </div>
        </Card>
      </Section>

      {/* Weekly kcal chart */}
      <Section title="This week" className="rise rise-2">
        <Card>
          <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--faint)' }}>Calories per day</p>
          <Bars data={week} color="var(--series-2)" format={(v) => v.toLocaleString()} />
          <p className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            Today is in progress — trending 6% under your weekly goal.
          </p>
        </Card>
      </Section>

      {/* Spend analytics */}
      <Section title="Spending" className="rise rise-2">
        <Card>
          <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--faint)' }}>Monthly grocery spend (£)</p>
          <Bars
            data={SPEND_HISTORY.map((m) => ({ label: m.month, value: m.spend }))}
            color="var(--series-1)"
            format={(v) => `£${v}`}
          />
          <p className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
            July is mid-month. Spend has fallen five months running — £68/month less than February.
          </p>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {ANALYTICS_STATS.map((s) => (
            <Card key={s.label} className="!p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{s.label}</p>
              <p className="mt-0.5 text-[17px] font-extrabold">{s.value}</p>
              <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>{s.sub}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Cuisines */}
      <Section title="Favourite cuisines" className="rise rise-3">
        <Card>
          <div className="space-y-2.5">
            {CUISINE_SPLIT.map((c, i) => (
              <div key={c.name}>
                <div className="flex justify-between text-[12.5px] font-bold mb-1">
                  <span>{c.name}</span>
                  <span style={{ color: 'var(--muted)' }}>{c.pct}%</span>
                </div>
                <Meter value={c.pct} max={CUISINE_SPLIT[0].pct} color={i === 0 ? 'var(--series-1)' : 'color-mix(in srgb, var(--series-1) 45%, var(--card-2))'} height={5} />
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Badges */}
      <Section title="Achievements" className="rise rise-3">
        <div className="grid grid-cols-2 gap-3">
          {BADGES.map((b) => (
            <Card key={b.id} className={b.earned ? '' : 'opacity-75'}>
              <div className="flex items-center gap-2">
                <Glyph e={b.emoji} size={22} style={{ color: b.earned ? 'var(--ink)' : 'var(--faint)' }} />
                {b.earned && <Pill tone="good">Earned</Pill>}
              </div>
              <p className="mt-1.5 font-bold text-[13.5px]">{b.name}</p>
              <p className="text-[11.5px] font-semibold leading-snug" style={{ color: 'var(--muted)' }}>{b.desc}</p>
              {!b.earned && b.progress !== undefined && (
                <div className="mt-2">
                  <Meter value={b.progress} max={b.of} height={4} />
                  <p className="mt-1 text-[10.5px] font-bold" style={{ color: 'var(--faint)' }}>{b.progress}/{b.of}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" className="rise rise-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-[14px]">Dark mode</p>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>Follows your accent everywhere</p>
            </div>
            <Toggle on={app.theme === 'dark'} onChange={app.toggleTheme} />
          </div>
          <div>
            <p className="font-bold text-[14px] mb-2">Accent colour</p>
            <div className="flex gap-3">
              {ACCENTS.map(([id, hex]) => (
                <button
                  key={id}
                  onClick={() => app.setAccent(id)}
                  aria-label={id}
                  className="press h-9 w-9 rounded-full border-4"
                  style={{ background: hex, borderColor: app.accent === id ? 'var(--ink)' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </Card>
      </Section>

      {/* Integrations */}
      <Section title="Integrations" className="rise rise-4">
        <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
          {INTEGRATIONS.map((it) => {
            const on = app.integrations[it.name];
            return (
              <div key={it.name} className="flex items-center gap-3 p-3.5" style={{ borderColor: 'var(--line)' }}>
                <Glyph e={it.emoji} size={19} style={{ color: 'var(--muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13.5px]">{it.name}</p>
                  <p className="text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>{on ? 'Connected' : it.desc}</p>
                </div>
                <Toggle on={on} onChange={() => app.toggleIntegration(it.name)} />
              </div>
            );
          })}
        </Card>
      </Section>
    </div>
  );
}
