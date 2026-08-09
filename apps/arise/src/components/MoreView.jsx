import { useRef, useState } from 'react';
import { buildExportPayload, downloadJson, parseImportFile, mergeStores } from '../lib/export.js';
import { clearStore } from '../lib/store.js';
import { EQUIPMENT, LOCATIONS, GOALS, MUSCLES, PROGRAMS, EXERCISES } from '../lib/data.js';

export default function MoreView({ store, setStore, setTab, onboardingOpen, setOnboardingOpen }){
  const [importStrategy,setImportStrategy]=useState('merge');
  const [msg,setMsg]=useState(null);
  const fileRef = useRef(null);

  const exportNow = ()=>{
    const payload = buildExportPayload(store);
    const date = new Date().toISOString().slice(0,10);
    downloadJson(`arise-backup-${date}.json`, payload);
    setMsg('Export downloaded — keep it somewhere safe.');
    setTimeout(()=> setMsg(null), 3000);
  };

  const onPickFile = async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    try{
      const imported = parseImportFile(text);
      const merged = mergeStores(store, imported, importStrategy);
      setStore(merged);
      setMsg(importStrategy==='replace' ? 'Backup restored — replaced this device.' : 'Backup merged — history combined.');
    }catch(err){
      setMsg(String(err.message || err));
    }finally{
      e.target.value='';
      setTimeout(()=> setMsg(null), 4000);
    }
  };

  const reset = ()=>{
    if(!confirm('Clear all local data on this device? This cannot be undone unless you have an export.')) return;
    clearStore();
    location.reload();
  };

  return (
    <div className="px-4 py-5 space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">More</h2>
        <p className="text-xs text-ink3">Backup, personalise, and get help testing on your phone.</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h3 className="text-sm font-bold">Backup</h3>
        <p className="text-xs text-ink3">Local-first means your history lives on this device. Export a versioned JSON backup and restore/merge it on another device. No cloud, no account.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportNow} className="btn btn-primary min-h-10 rounded-xl px-4">Export backup</button>
          <label className="btn btn-secondary min-h-10 rounded-xl px-4 cursor-pointer">
            Import backup
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPickFile} />
          </label>
        </div>
        <div className="flex gap-2 text-xs">
          <label className="flex items-center gap-1.5"><input type="radio" name="strategy" checked={importStrategy==='merge'} onChange={()=> setImportStrategy('merge')} /> Merge</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="strategy" checked={importStrategy==='replace'} onChange={()=> setImportStrategy('replace')} /> Replace</label>
          <span className="text-ink3 ml-auto">Merge de-dupes by session id; Replace overwrites.</span>
        </div>
        {msg && <p role="status" className="text-xs bg-surface2 border border-line rounded-xl px-3 py-2">{msg}</p>}
        <details className="text-xs">
          <summary className="font-semibold cursor-pointer">What’s in the backup?</summary>
          <pre className="mt-2 overflow-auto rounded-xl bg-surface2 border border-line p-3 text-[11px] leading-relaxed">{JSON.stringify({ app:'arise', version:1, exportedAt:'…', data:{ onboarding:'{goal,equipment,location,level}', activeSchedule:'{programId,sessions}', history:'[{id,date,blocks:[{exerciseId,sets:[{reps,weightKg,rpe}]}]}]', preferences:'{units,theme}' }}, null, 2)}</pre>
        </details>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h3 className="text-sm font-bold">Personalise</h3>
        <p className="text-xs text-ink3">Onboarding gates recommendations honestly — equipment and location bias the exercise browser and program picker, and we never show barbell work to a bodyweight-only setup as “recommended”.</p>
        <div className="rounded-xl border border-line bg-surface2 px-3 py-2 text-sm">
          <p className="font-semibold">Current onboarding</p>
          {!store.onboarding ? <p className="text-xs text-ink3 mt-1">Not completed — open onboarding to set goal, kit and location.</p> : (
            <ul className="text-xs text-ink3 mt-1 space-y-0.5">
              <li>Goal: <span className="font-semibold text-ink">{GOALS.find(g=>g.id===store.onboarding.goal)?.label || store.onboarding.goal}</span></li>
              <li>Location: <span className="font-semibold text-ink">{LOCATIONS.find(l=>l.id===store.onboarding.location)?.label || store.onboarding.location || '—'}</span></li>
              <li>Kit: <span className="font-semibold text-ink">{(store.onboarding.equipment||[]).join(', ') || '—'}</span></li>
              <li>Level: <span className="font-semibold text-ink">{store.onboarding.level || '—'}</span> • {store.onboarding.daysPerWeek || '—'}×/week</li>
            </ul>
          )}
        </div>
        <button onClick={()=> setOnboardingOpen(true)} className="btn btn-secondary w-full min-h-11 rounded-xl">{store.onboarding ? 'Edit onboarding' : 'Start onboarding'}</button>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-2">
        <h3 className="text-sm font-bold">Help & testing</h3>
        <details className="rounded-xl border border-line bg-surface2 px-3 py-2">
          <summary className="text-sm font-semibold cursor-pointer">Test on a real phone (30-second checklist)</summary>
          <ol className="list-decimal pl-5 text-xs text-ink2 mt-2 space-y-1">
            <li>Open this app on your phone (same Wi-Fi → use the dev URL, or deploy preview).</li>
            <li>Install to home screen (Share → Add to Home Screen / Install). Verify standalone display, icon, splash.</li>
            <li>Airplane mode → reload. Today + Exercises + last schedule should render from cache; saving a session queues locally.</li>
            <li>Log a session with varied loads — check Progress attributes and PRs update immediately and persist after reload.</li>
            <li>Export → airplane off → import on a second device (Merge) → verify history appears.</li>
            <li>Keyboard-only: Tab through Today → Train → Exercises; focus ring visible, no trap, landmarks announced.</li>
            <li>VoiceOver/TalkBack: headers, session rows, and form fields read with labels and live regions.</li>
          </ol>
        </details>
        <details className="rounded-xl border border-line bg-surface2 px-3 py-2">
          <summary className="text-sm font-semibold cursor-pointer">What this app is (and isn’t)</summary>
          <p className="text-xs text-ink3 mt-2">A game-like training companion: scheduled programs, honest load tracking, and attributes that derive from what you actually log. <span className="font-semibold text-ink">No nutrition system</span> — that would recreate Forq and dilute the training proposition.</p>
        </details>
        <button onClick={reset} className="text-xs font-semibold text-danger underline underline-offset-2 mt-1">Clear local data</button>
      </section>
    </div>
  );
}
