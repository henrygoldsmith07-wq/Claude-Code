import { useMemo } from 'react';
import { deriveAttributes, levelFromAttributes } from '../lib/attributes.js';
import { totalVolumeKg, streakDays } from '../lib/store.js';
import { EXERCISE_BY_ID } from '../lib/data.js';

export default function ProgressView({ store }){
  const attrs = useMemo(()=> deriveAttributes(store.history), [store.history]);
  const lvl = useMemo(()=> levelFromAttributes(attrs), [attrs]);
  const history = store.history || [];
  const vol = totalVolumeKg(history);
  const streak = streakDays(history);

  const prs = useMemo(()=> computePRs(history), [history]);

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">Progress</h2>
        <p className="text-xs text-ink3">Derived from logged history — not from what you *planned* to do.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-ink text-bg grid place-items-center font-black text-lg">{lvl.level}</div>
        <div>
          <p className="text-sm font-bold">Level {lvl.level} — {lvl.title}</p>
          <p className="text-xs text-ink3">Avg {lvl.avg}/100 • {history.length} sessions</p>
          <div className="mt-2 h-1.5 rounded-full bg-surface2 w-40 overflow-hidden"><div className="h-full bg-ink" style={{width:`${lvl.avg}%`}} /></div>
        </div>
        <div className="ml-auto text-right text-xs">
          <p className="font-bold tabular-nums">{vol.toLocaleString()} kg</p><p className="text-ink3">total volume</p>
          <p className="font-bold tabular-nums mt-1">{streak} days</p><p className="text-ink3">streak</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {attrs.map(a=> (
          <div key={a.id} className="rounded-2xl border border-line bg-surface p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink3">{a.label}</p>
            <p className="text-lg font-black tabular-nums">{a.value}<span className="text-xs text-ink3">/100</span></p>
            <div className="mt-1 h-1 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-ink" style={{width:`${a.value}%`}} /></div>
            <p className="text-[11px] text-ink3 mt-1.5">{a.blurb}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-bold">Personal records — best estimated 1RM (Epley)</h3>
        <p className="text-xs text-ink3">Weight × (1 + reps/30). Bodyweight entries are ignored — log load to see PRs grow.</p>
        {!prs.length ? (
          <p className="text-sm text-ink3 mt-3 border border-dashed border-line rounded-xl p-4 text-center">No loaded sets yet. Log weight to track progressive overload.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prs.slice(0,8).map(r=> (
              <li key={r.exerciseId} className="flex items-center gap-3 text-sm border border-line rounded-xl px-3 py-2 bg-surface2">
                <span className="font-bold truncate">{EXERCISE_BY_ID[r.exerciseId]?.name || r.exerciseId}</span>
                <span className="ml-auto tabular-nums font-black">{Math.round(r.e1rm)} kg</span>
                <span className="text-xs text-ink3 tabular-nums">{r.weight}×{r.reps} on {r.dateISO}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-bold">History</h3>
        {!history.length ? <p className="text-sm text-ink3 mt-2">No sessions yet — schedule a program and run it from Today.</p> : (
          <ul className="mt-2 space-y-2 max-h-80 overflow-auto pr-1">
            {[...history].slice().reverse().map(h=> (
              <li key={h.id} className="rounded-xl border border-line bg-surface2 px-3 py-2">
                <p className="text-sm font-bold">{h.title} <span className="text-xs text-ink3">• {h.dateISO} • W{h.week} D{h.day}</span></p>
                <p className="text-xs text-ink3">{h.blocks.map(b=> `${EXERCISE_BY_ID[b.exerciseId]?.name || b.exerciseId}: ${b.sets.map(s=> `${s.reps}${s.weightKg?`@${s.weightKg}kg`:''}`).join(', ')}`).join(' • ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function computePRs(history){
  const best = new Map();
  for(const h of history) for(const b of h.blocks||[]) for(const s of b.sets||[]){
    const w = Number(s.weightKg), r = Number(String(s.reps).match(/\d+/)?.[0] || s.reps);
    if(!(w>0 && r>0)) continue;
    const e1rm = w * (1 + r/30);
    const prev = best.get(b.exerciseId);
    if(!prev || e1rm > prev.e1rm) best.set(b.exerciseId, { exerciseId: b.exerciseId, e1rm, weight: w, reps: r, dateISO: h.dateISO });
  }
  return [...best.values()].sort((a,b)=> b.e1rm - a.e1rm);
}
