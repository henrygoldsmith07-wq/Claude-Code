import { useMemo, useState } from 'react';
import {
  getXp, getStreak, getSessions, getReviewLog, getNotebook, getGrammarProgress,
  getXpLog, getWeekXp, getCollectibles, getAchievements,
  getFreezes, buyFreeze, FREEZE_COST, MAX_FREEZES, getCoins,
  getVacationUntil, setVacationDays, getRepairableStreak, repairStreak, REPAIR_COST,
} from '../lib/storage';
import { MILESTONES, CERTIFICATES } from '../lib/game';
import { totalReviews } from '../lib/memory';
import { renderCertificate } from './charts';
import { Check, Lock, Download, Flame, Coins } from './icons';

// Motivation panel inside the profile: weekly goal, learning statistics,
// the learning calendar, streak freezes, milestones and certificates.

export default function Stats({ weeklyGoal, onCoinsChange }) {
  const [tick, setTick] = useState(0);

  const s = useMemo(() => {
    void tick;
    const xp = getXp();
    return {
      xp,
      streak: getStreak().count,
      sessions: getSessions().length,
      reviews: totalReviews(getReviewLog()),
      notebook: getNotebook().length,
      grammarMastered: Object.values(getGrammarProgress()).filter((g) => g.best >= 80).length,
      badges: Object.keys(getAchievements()).length,
      collectibles: Object.keys(getCollectibles()).length,
      weekXp: getWeekXp(),
      xpLog: getXpLog(),
      freezes: getFreezes(),
      coins: getCoins(),
      activeDays: Object.keys(getXpLog()).length,
    };
  }, [tick]);

  const weekPct = Math.min(100, Math.round((s.weekXp / Math.max(1, weeklyGoal)) * 100));

  const buy = () => {
    if (buyFreeze() != null) {
      onCoinsChange?.(getCoins());
      setTick((t) => t + 1);
    }
  };

  return (
    <>
      {/* weekly goal */}
      <section className="bg-surface border border-line rounded-2xl p-5 space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Weekly goal</h3>
          <span className="text-[11px] text-ink3 tabular-nums">{s.weekXp}/{weeklyGoal} XP</span>
        </div>
        <div className="h-2 rounded-full bg-surface2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${weekPct >= 100 ? 'bg-line' : 'bg-accent'}`} style={{ width: `${weekPct}%` }} />
        </div>
        <p className="text-[11px] text-ink3">
          {weekPct >= 100 ? 'Weekly goal reached — superbe régularité.' : `Monday to Sunday — ${weeklyGoal - s.weekXp} XP to go. Adjust it in Settings.`}
        </p>
      </section>

      {/* streak freeze */}
      <section className="bg-surface border border-line rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Flame size={18} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">Streak freeze</p>
            <p className="text-xs text-ink3">
              Owned: {s.freezes}/{MAX_FREEZES} — auto-used to cover one missed day
            </p>
          </div>
          {s.freezes < MAX_FREEZES ? (
            <button
              onClick={buy}
              disabled={s.coins < FREEZE_COST}
              className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs disabled:opacity-50"
            >
              <Coins size={12} /> {FREEZE_COST}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink2"><Check size={13} /> Full</span>
          )}
        </div>

        {/* streak repair: buy back a recently broken streak */}
        {getRepairableStreak() != null && (
          <div className="flex items-center gap-3 pt-1 border-t border-line">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Repair your streak</p>
              <p className="text-xs text-ink3">Restore your {getRepairableStreak()}-day streak (window closes after 3 days)</p>
            </div>
            <button
              onClick={() => { if (repairStreak() != null) { onCoinsChange?.(getCoins()); setTick((t) => t + 1); } }}
              disabled={s.coins < REPAIR_COST}
              className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs disabled:opacity-50"
            >
              <Coins size={12} /> {REPAIR_COST}
            </button>
          </div>
        )}

        {/* vacation mode */}
        <div className="flex items-center gap-3 pt-1 border-t border-line">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">Vacation mode</p>
            <p className="text-xs text-ink3">
              {getVacationUntil() && getVacationUntil() >= new Date().toISOString().slice(0, 10)
                ? `On — streak protected until ${getVacationUntil()}`
                : 'Pause streak loss while you are away (up to 14 days)'}
            </p>
          </div>
          {getVacationUntil() && getVacationUntil() >= new Date().toISOString().slice(0, 10) ? (
            <button onClick={() => { setVacationDays(0); setTick((t) => t + 1); }} className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs">
              End now
            </button>
          ) : (
            <button onClick={() => { setVacationDays(14); setTick((t) => t + 1); }} className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs">
              Start 14 days
            </button>
          )}
        </div>
      </section>

      {/* learning statistics */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Learning statistics</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ['Total XP', s.xp.toLocaleString('en-GB')],
            ['Active days', s.activeDays],
            ['Sessions', s.sessions],
            ['Reviews', s.reviews],
            ['Words saved', s.notebook],
            ['Grammar ✓', s.grammarMastered],
            ['Badges', s.badges],
            ['Postcards', s.collectibles],
          ].map(([label, v]) => (
            <div key={label} className="bg-surface border border-line rounded-2xl py-3 px-1">
              <p className="text-base font-bold text-ink tabular-nums">{v}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink3">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <Calendar xpLog={s.xpLog} />
      <Milestones stats={s} />
      <Certificates stats={s} />
    </>
  );
}

// Current-month grid; day cells shade with the XP earned that day.
function Calendar({ xpLog }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const today = now.getDate();
  const stampOf = (d) => new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
  const max = Math.max(1, ...Array.from({ length: daysInMonth }, (_, i) => xpLog[stampOf(i + 1)] || 0));

  return (
    <section className="bg-surface border border-line rounded-2xl p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Learning calendar</h3>
        <span className="text-[11px] text-ink3">{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-[9px] font-bold text-ink3">{d}</span>
        ))}
        {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const xp = xpLog[stampOf(day)] || 0;
          const intensity = xp === 0 ? 0 : Math.min(4, Math.ceil((xp / max) * 4));
          const shades = ['', 'bg-line', 'bg-ink3 text-bg', 'bg-ink2 text-bg', 'bg-ink text-bg'];
          return (
            <span
              key={day}
              title={xp ? `${xp} XP` : 'No activity'}
              className={`aspect-square grid place-items-center rounded-lg text-[10px] tabular-nums ${
                intensity ? `${shades[intensity]} font-semibold` : 'text-ink3'
              } ${day === today ? 'ring-1 ring-ink' : ''}`}
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="text-[11px] text-ink3">Darker days = more XP. Keep the month unbroken.</p>
    </section>
  );
}

function Milestones({ stats }) {
  const value = (m) => stats[m.metric] || 0;
  const nextIdx = MILESTONES.findIndex((m) => value(m) < m.target);
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Milestones</h3>
      <ol className="bg-surface border border-line rounded-2xl px-4 py-2 divide-y divide-line">
        {MILESTONES.map((m, i) => {
          const reached = value(m) >= m.target;
          const isNext = i === nextIdx;
          return (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className={`w-6 h-6 shrink-0 grid place-items-center rounded-full border ${
                reached ? 'bg-accent text-onaccent border-accent' : isNext ? 'border-ink text-ink' : 'border-line text-ink3'
              }`}>
                {reached ? <Check size={12} /> : <span className="text-[9px] font-bold">{i + 1}</span>}
              </span>
              <span className={`flex-1 text-sm ${reached ? 'text-ink' : isNext ? 'text-ink font-semibold' : 'text-ink3'}`}>
                {m.label}
              </span>
              {!reached && (
                <span className="text-[11px] text-ink3 tabular-nums">{value(m)}/{m.target}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Certificates({ stats }) {
  const [preview, setPreview] = useState(null); // { cert, url }

  const open = (cert) => {
    const url = renderCertificate({
      title: cert.title,
      requirement: `Awarded for: ${cert.requirement.toLowerCase()}`,
      stat: cert.metric === 'xp' ? `${stats.xp.toLocaleString('en-GB')} XP earned` : `${stats.streak}-day streak`,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
    setPreview({ cert, url });
  };

  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Certificates</h3>
      <div className="space-y-2">
        {CERTIFICATES.map((c) => {
          const earned = (stats[c.metric] || 0) >= c.target;
          return (
            <div key={c.id} className={`flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3 ${earned ? '' : 'opacity-55'}`}>
              <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
                {earned ? <Check size={16} /> : <Lock size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink" lang="fr">{c.title}</p>
                <p className="text-[11px] text-ink3">{c.requirement}</p>
              </div>
              {earned && (
                <button onClick={() => open(c)} className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs">
                  View
                </button>
              )}
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="fade-in space-y-2">
          <img src={preview.url} alt={`${preview.cert.title} certificate`} className="rounded-xl border border-line max-w-full" />
          <div className="flex gap-2">
            <a
              href={preview.url}
              download={`le-studio-${preview.cert.id}.png`}
              className="btn btn-primary flex-1 min-h-10 rounded-xl text-xs"
            >
              <Download size={13} /> Download
            </a>
            <button onClick={() => setPreview(null)} className="btn btn-secondary flex-1 min-h-10 rounded-xl text-xs">
              Close preview
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
