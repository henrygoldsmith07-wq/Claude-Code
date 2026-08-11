import { useMemo, useState } from 'react';
import { PROGRAMS, PROGRAM_BY_ID, PROGRAM_TEMPLATES, programHistory, availablePrograms, EXERCISE_BY_ID, plannedVsCompleted } from '../lib/data.js';
import { startProgram } from '../lib/schedule.js';

export default function TrainView({ store, setStore, onStartSession, availableEquipment }){
  const [programId,setProgramId]=useState(store.activeSchedule?.programId || PROGRAMS[0].id);
  const availIds = useMemo(()=> new Set(availablePrograms(availableEquipment).map(p=>p.id)), [availableEquipment]);
  const program = PROGRAM_BY_ID[programId];
  const active = store.activeSchedule;
  const pvc = useMemo(()=> active ? plannedVsCompleted(active, store.history||[]) : [], [active, store.history]);

  const start = ()=>{
    const next = startProgram(store, programId);
    // record version history
    const prog = PROGRAM_BY_ID[programId];
    const entry = { programId, version: prog.version||1, startDateISO: next.activeSchedule.startDateISO, endDateISO: null };
    const hist = [...(store.programHistory||[]), entry];
    setStore({ ...next, programHistory: hist });
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">Train</h2>
        <p className="text-xs text-ink3">Programs are scheduled training — picking one creates dated sessions you can run from Today. Templates are reusable blueprints; mesocycles periodise load across weeks.</p>
      </div>

      <div className="rounded-xl border border-line bg-surface2 px-3 py-2">
        <p className="text-xs font-bold">Templates</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {PROGRAM_TEMPLATES.map(t=> (
            <button key={t.id} onClick={()=> setProgramId(t.programId)} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${programId===t.programId?'bg-ink text-bg border-ink':'bg-surface border-line'}`}>{t.name}</button>
          ))}
        </div>
        <p className="text-[11px] text-ink3 mt-1">{PROGRAM_TEMPLATES.find(t=> t.programId===programId)?.description||''}</p>
      </div>

      <div className="grid gap-2">
        {PROGRAMS.map(p=>{
          const ok = availIds.has(p.id);
          const isActive = active?.programId===p.id;
          return (
            <button key={p.id} onClick={()=> setProgramId(p.id)}
              className={`text-left rounded-2xl border p-4 ${programId===p.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line hover:border-ink3'} ${!ok ? 'opacity-90' : ''}`}>
              <span className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${programId===p.id ? 'bg-bg/15 border-bg/20 text-bg' : 'bg-surface2 border-line text-ink3'}`}>{p.level} • {p.daysPerWeek}×/week</span>
                {isActive && <span className="text-xs font-bold px-2 py-1 rounded-full bg-success text-white">Active</span>}
                {!ok && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">Needs: {p.equipment.join(', ')}</span>}
                {p.mesocycle && <span className="text-[11px] text-ink3">• {p.mesocycle.weeks}w • {p.mesocycle.progression}</span>}
              </span>
              <span className={`block mt-2 font-bold ${programId===p.id?'text-bg':'text-ink'}`}>{p.name} <span className="text-xs font-semibold">v{p.version||1}</span></span>
              <span className={`block text-xs ${programId===p.id?'text-bg/80':'text-ink3'}`}>{p.tagline}</span>
            </button>
          );
        })}
      </div>

      {!availIds.has(programId) && (
        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">This program needs kit you didn’t select in onboarding. You can still start it — exercises show substitutions — but recommendations in Today will bias toward what you actually have. Update kit in More → Onboarding.</p>
      )}

      {program && program.mesocycle && (
        <p className="text-xs text-ink3">Mesocycle: {program.mesocycle.weeks} weeks • progression {program.mesocycle.progression} {program.mesocycle.deloadWeek?`• deload week ${program.mesocycle.deloadWeek}`:''}</p>
      )}

      <div className="flex gap-2">
        <button onClick={start} className="btn btn-primary flex-1 min-h-11 rounded-xl">{active?.programId===programId ? 'Restart schedule from today' : 'Schedule this program'}</button>
        {active && <button onClick={()=> setStore({...store, activeSchedule:null})} className="btn btn-secondary min-h-11 rounded-xl px-4">Clear schedule</button>}
      </div>

      {program && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold">Preview — {program.name} <span className="text-xs text-ink3">v{program.version||1}</span></h3>
          <details className="text-xs rounded-xl border border-line bg-surface2 px-3 py-2">
            <summary className="font-semibold cursor-pointer">Version history</summary>
            <ul className="mt-2 space-y-1">
              {programHistory(program.id).map(h=> <li key={h.version}><span className="font-bold">v{h.version}</span> {h.date} — {h.changes}</li>)}
            </ul>
          </details>
          {program.weeks.map(wk=> (
            <div key={wk.week} className="rounded-2xl border border-line bg-surface overflow-hidden">
              <div className="px-4 py-2 bg-surface2 border-b border-line flex items-center justify-between">
                <span className="text-xs font-bold">Week {wk.week}</span>
                <span className="text-[11px] text-ink3">{wk.workouts.length} sessions</span>
              </div>
              <div className="divide-y divide-line">
                {wk.workouts.map(w=> (
                  <div key={w.day} className="px-4 py-3">
                    <p className="text-sm font-bold">Day {w.day} — {w.title}</p>
                    <ul className="mt-2 space-y-1.5">
                      {w.blocks.map((b,i)=>{
                        const ex = EXERCISE_BY_ID[b.exerciseId];
                        return <li key={i} className="flex gap-2 text-sm"><span className="text-ink3 tabular-nums w-14 shrink-0">{b.sets}× {b.reps}</span><span className="font-medium">{ex?.name || b.exerciseId}</span><span className="ml-auto text-xs text-ink3 hidden sm:inline">{b.restSec ? `${b.restSec}s rest` : ''} {b.loadHint?`• ${b.loadHint}`:''}</span></li>
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
          <h3 className="text-sm font-bold">Your schedule</h3>
          <p className="text-xs text-ink3">Start: {active.startDateISO} • {active.sessions.length} sessions • {store.history.length} completed</p>
          <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
            {pvc.map(({ session, completed, delta, actual })=> (
              <li key={session.id} className="flex items-center gap-2 text-sm border border-line rounded-xl px-3 py-2 bg-surface2">
                <span className="text-xs font-mono tabular-nums text-ink3 w-24 shrink-0">{session.dateISO}</span>
                <span className="font-medium truncate">{session.title}</span>
                <span className={`ml-auto text-[11px] font-bold px-2 py-1 rounded-full border ${completed ? 'bg-success text-white border-success' : 'bg-surface border-line text-ink3'}`}>{completed?'done':'planned'}</span>
                {completed && delta && <span className="text-[11px] text-ink3">{delta.sets>=0?'+':''}{delta.sets} sets • {delta.volumeKg>=0?'+':''}{delta.volumeKg}kg</span>}
                {!completed && <button onClick={()=> onStartSession(session)} className="text-xs font-bold text-ink underline">Start</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
