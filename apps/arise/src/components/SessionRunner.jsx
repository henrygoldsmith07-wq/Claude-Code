import { useEffect, useMemo, useState } from 'react';
import { EXERCISE_BY_ID } from '../lib/data.js';

function parseNum(v){ const n=Number(v); return Number.isFinite(n)? n : 0; }

export default function SessionRunner({ session, onSave, onCancel }){
  const [blocks,setBlocks]=useState(()=> session.blocks.map(b=> ({
    exerciseId: b.exerciseId,
    sets: Array.from({length: b.sets}, ()=> ({ reps: firstInt(b.reps), weightKg: '', rpe: '' })),
    restSec: b.restSec,
  })));
  const [note,setNote]=useState('');

  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const volume = useMemo(()=>{
    let total=0;
    for(const b of blocks) for(const s of b.sets) total += parseNum(s.reps) * parseNum(s.weightKg);
    return Math.round(total);
  },[blocks]);

  const updateSet = (bi, si, patch)=>{
    setBlocks(prev=> prev.map((b,i)=> i!==bi? b : { ...b, sets: b.sets.map((s,j)=> j!==si? s : { ...s, ...patch }) }));
  };
  const addSet = (bi)=> setBlocks(prev=> prev.map((b,i)=> i!==bi? b : { ...b, sets: [...b.sets, { reps: '', weightKg:'', rpe:'' }] }));
  const removeSet = (bi, si)=> setBlocks(prev=> prev.map((b,i)=> i!==bi? b : { ...b, sets: b.sets.filter((_,j)=> j!==si) }));

  const canSave = blocks.every(b=> b.sets.length>0 && b.sets.every(s=> String(s.reps).trim()!=='' ));

  const save = ()=>{
    const payload = {
      id: session.id,
      dateISO: session.dateISO,
      programId: session.programId,
      week: session.week,
      day: session.day,
      title: session.title,
      blocks: blocks.map(b=> ({ exerciseId: b.exerciseId, sets: b.sets.map(s=> ({ reps: String(s.reps).trim(), weightKg: String(s.weightKg).trim(), rpe: String(s.rpe).trim() })) })),
      note: note.trim() || undefined,
      savedAt: new Date().toISOString(),
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-40 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label={`Session — ${session.title}`}>
      <div className="sticky top-0 flex items-center gap-3 px-4 py-3 border-b border-line bg-surface">
        <button onClick={onCancel} className="w-9 h-9 grid place-items-center rounded-full border border-line bg-surface2" aria-label="Close session">✕</button>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink3">Session</p>
          <p className="font-bold truncate">{session.title} • {session.dateISO}</p>
        </div>
        <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-surface2 border border-line tabular-nums">{volume} kg volume</span>
      </div>

      <div className="flex-1 overflow-auto px-4 py-5 space-y-4 max-w-3xl w-full mx-auto">
        <p className="text-xs text-ink3">Log resistance honestly — weight × reps × sets. Leave weight blank for bodyweight. Attributes and PRs derive from what you log, not what the program says.</p>
        {blocks.map((b,bi)=>{
          const ex = EXERCISE_BY_ID[b.exerciseId];
          return (
            <div key={bi} className="rounded-2xl border border-line bg-surface p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{ex?.name || b.exerciseId}</p>
                  <p className="text-xs text-ink3">{ex?.muscle} • {ex?.level} • {ex?.equipment.join(', ')}</p>
                  {ex?.cues?.[0] && <p className="text-xs text-ink3 mt-1">Cue: {ex.cues[0]}</p>}
                </div>
                <button onClick={()=> addSet(bi)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-ink text-bg">+ Set</button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[48px_1fr_1fr_52px_36px] gap-2 text-[11px] font-bold uppercase tracking-widest text-ink3 px-1">
                  <span>Set</span><span>Reps</span><span>Load (kg)</span><span>RPE</span><span></span>
                </div>
                {b.sets.map((s,si)=> (
                  <div key={si} className="grid grid-cols-[48px_1fr_1fr_52px_36px] gap-2 items-center">
                    <span className="w-8 h-8 grid place-items-center rounded-full bg-surface2 border border-line text-xs font-bold tabular-nums">{si+1}</span>
                    <input inputMode="numeric" value={s.reps} onChange={e=> updateSet(bi,si,{reps:e.target.value})} placeholder="8" aria-label={`Reps set ${si+1}`} className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm tabular-nums" />
                    <input inputMode="decimal" value={s.weightKg} onChange={e=> updateSet(bi,si,{weightKg:e.target.value})} placeholder="— bodyweight" aria-label={`Load set ${si+1}`} className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm tabular-nums" />
                    <input inputMode="decimal" value={s.rpe} onChange={e=> updateSet(bi,si,{rpe:e.target.value})} placeholder="7" aria-label={`RPE set ${si+1}`} className="rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm tabular-nums" />
                    <button onClick={()=> removeSet(bi,si)} aria-label={`Remove set ${si+1}`} className="w-8 h-8 grid place-items-center rounded-full border border-line text-ink3">×</button>
                  </div>
                ))}
                {!b.sets.length && <p className="text-xs text-ink3">No sets — add one.</p>}
              </div>
            </div>
          );
        })}

        <label className="block">
          <span className="text-xs font-semibold">Session note (optional)</span>
          <textarea value={note} onChange={e=> setNote(e.target.value)} rows={2} placeholder="How did it feel? Anything to adjust next time?" className="mt-1 w-full rounded-xl border border-line bg-surface2 px-3 py-2.5 text-sm" />
        </label>

        <div className="flex gap-2 pb-6">
          <button onClick={onCancel} className="btn btn-secondary flex-1 min-h-11 rounded-xl">Cancel</button>
          <button onClick={save} disabled={!canSave} className="btn btn-primary flex-1 min-h-11 rounded-xl disabled:opacity-40">Save session</button>
        </div>
        {!canSave && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Fill reps for every set before saving. Weight can be blank for bodyweight.</p>}
      </div>
    </div>
  );
}

function firstInt(reps){
  const m = String(reps).match(/\d+/);
  return m? m[0] : '';
}
