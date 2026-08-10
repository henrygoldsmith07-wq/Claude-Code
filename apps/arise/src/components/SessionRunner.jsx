import { useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISE_BY_ID } from '../lib/data.js';
import { lastExerciseSets } from '../lib/store.js';

function parseNum(v){ const n=Number(v); return Number.isFinite(n)? n : 0; }
function fmtRest(s){ const m=Math.floor(s/60); const r=s%60; return m? `${m}:${String(r).padStart(2,'0')}` : `${r}s`; }

export default function SessionRunner({ session, history = [], onSave, onCancel }){
  const [blocks,setBlocks]=useState(()=> session.blocks.map(b=> ({
    exerciseId: b.exerciseId,
    sets: Array.from({length: b.sets}, ()=> ({ reps: firstInt(b.reps), weightKg: '', rpe: '' })),
    restSec: b.restSec,
  })));
  const [note,setNote]=useState('');
  const [restLeft,setRestLeft]=useState(null);
  const [restLabel,setRestLabel]=useState('');
  const restRef=useRef(null);

  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(()=>{
    if(restLeft===null) return;
    if(restLeft<=0){
      try{ navigator.vibrate?.(180); }catch{}
      setRestLeft(null);
      return;
    }
    const id=setTimeout(()=> setRestLeft(v=> (v===null?null:Math.max(0,v-1))), 1000);
    return ()=> clearTimeout(id);
  }, [restLeft]);

  const startRest=(sec,label)=>{
    if(!sec) return;
    setRestLabel(label);
    setRestLeft(sec);
    clearTimeout(restRef.current);
  };

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

  const warmupSetsFor = (exId)=>{ const ex=(EXERCISE_BY_ID[exId]||{}); if(ex.muscle==='Cardio') return []; return [{reps:'5', weightKg:''}]; };
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
        <p className="text-xs text-ink3">Log resistance honestly — notes and RPE feed next-session recommendations (reps/load) so be specific.</p>
        <p className="text-xs text-ink3 hidden">Supersets: pair push+pull or legs+core; rest automation runs per-block.</p>
        {blocks.map((b,bi)=>{
          const ex = EXERCISE_BY_ID[b.exerciseId];
          const prev = lastExerciseSets(history, b.exerciseId);
          return (
            <div key={bi} className="rounded-2xl border border-line bg-surface p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{ex?.name || b.exerciseId}</p>
                  <p className="text-xs text-ink3">{ex?.muscle} • {ex?.level} • {ex?.equipment.join(', ')}</p>
                  {ex?.cues?.[0] && <p className="text-xs text-ink3 mt-1">Cue: {ex.cues[0]}</p>}
                  {prev ? (
                    <p className="text-[11px] text-ink3 mt-1">Last: {prev.dateISO} • {prev.sets.map(s=> `${s.reps}${s.weightKg?`@${s.weightKg}kg`:''}`).join(', ')}</p>
                  ) : (
                    <p className="text-[11px] text-ink3 mt-1">No prior log for this exercise — first time.</p>
                  )}
                  {b.restSec ? <p className="text-[11px] text-ink3">Rest {fmtRest(b.restSec)} • load hint: {session.blocks[bi]?.loadHint || '—'}</p> : null}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {b.restSec ? <button onClick={()=> startRest(b.restSec, ex?.name || b.exerciseId)} className="text-xs font-bold px-3 py-1.5 rounded-full border border-line bg-surface2">Rest {fmtRest(b.restSec)}</button> : null}
                  <button onClick={()=> addSet(bi)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-ink text-bg">+ Set</button>
                </div>
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

        {restLeft!==null && (
          <div className="sticky bottom-4 z-10 rounded-2xl border border-line bg-ink text-bg px-4 py-3 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Rest • {restLabel}</span>
            <span className="ml-auto text-lg font-black tabular-nums">{fmtRest(restLeft)}</span>
            <button onClick={()=> setRestLeft(null)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-ink">Skip</button>
          </div>
        )}

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
