import { useEffect, useMemo, useState } from 'react';
import AppShell from './components/AppShell.jsx';
import TodayView from './components/TodayView.jsx';
import TrainView from './components/TrainView.jsx';
import ExerciseBrowser from './components/ExerciseBrowser.jsx';
import ProgressView from './components/ProgressView.jsx';
import MoreView from './components/MoreView.jsx';
import SessionRunner from './components/SessionRunner.jsx';
import Onboarding from './components/Onboarding.jsx';
import { loadStore, saveStore } from './lib/store.js';
import { recommendExercises } from './lib/data.js';
import { recordEvent } from './lib/telemetry.js';
import { pushToPulse } from './lib/pulse.js';

export default function App(){
  const [store,setStoreState]=useState(()=> loadStore());
  const [tab,setTab]=useState('today');
  const [activeSession,setActiveSession]=useState(null);
  const [onboardingOpen,setOnboardingOpen]=useState(()=> !loadStore().onboarding);
  const [updateReady,setUpdateReady]=useState(false);

  const setStore = (next)=>{
    setStoreState(next);
    saveStore(next);
  };

  useEffect(()=>{
    saveStore(store);
  },[store]);

  useEffect(()=>{
    const isDark = store.preferences?.theme ? store.preferences.theme==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  },[store.preferences?.theme]);

  // PWA lifecycle: listen for SW update
  useEffect(()=>{
    if(!('serviceWorker' in navigator)) return;
    let reg;
    navigator.serviceWorker.getRegistration().then(r=> { reg=r; });
    const onControllerChange = ()=> window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    // Check for waiting SW on load
    navigator.serviceWorker.getRegistration().then(r=>{
      if(r?.waiting) setUpdateReady(true);
      if(r) r.addEventListener('updatefound', ()=>{
        const nw = r.installing;
        if(nw) nw.addEventListener('statechange', ()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller) setUpdateReady(true); });
      });
    });
    return ()=> navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  },[]);

  // Global error telemetry (privacy-gated, local only)
  useEffect(()=>{
    const onError = (e)=>{
      try { recordEvent('error', { message: String(e.message||e.error||e), at: new Date().toISOString() }); } catch {}
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', (e)=> onError(e.reason||e));
    return ()=> { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError); };
  },[]);

  const recs = useMemo(()=>{
    if(!store.onboarding) return [];
    return recommendExercises({ goal: store.onboarding.goal, availableEquipment: store.onboarding.equipment, limit: 4 });
  },[store.onboarding]);

  const handleCompleteOnboarding = (payload)=>{
    const next = { ...store, onboarding: payload };
    setStore(next);
  };

  const handleStartSession = (session)=>{
    setActiveSession(session);
    try { recordEvent('session:start', { sessionId: session.id, title: session.title }); } catch {}
  };

  const handleSaveSession = (payload)=>{
    let next = { ...store };
    const hist = [...(next.history||[]), payload];
    let activeSchedule = next.activeSchedule;
    if(activeSchedule){
      activeSchedule = { ...activeSchedule, sessions: activeSchedule.sessions.map(s=> s.id===payload.id ? { ...s, status:'done' } : s) };
    }
    next = { ...next, history: hist, activeSchedule };
    setStore(next);
    setActiveSession(null);
    setTab('progress');
    try { recordEvent('session:complete', { sessionId: payload.id, blocks: payload.blocks.length }); } catch {}
    // Pulse push if enabled and adapter present (adapter injected via window.__PULSE_ADAPTER__ for now)
    try {
      const adapter = typeof window !== 'undefined' ? window.__PULSE_ADAPTER__ : null;
      if(next.preferences?.pulseEnabled && adapter) pushToPulse(payload, hist, adapter);
    } catch {}
  };
  const handleCancelSession = ()=>{
    if(activeSession) try { recordEvent('session:abandon', { sessionId: activeSession.id }); } catch {}
    setActiveSession(null);
  };

  const applyUpdate = ()=>{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistration().then(r=>{
        if(r?.waiting) r.waiting.postMessage('SKIP_WAITING');
        else window.location.reload();
      });
    }
  };

  return (
    <AppShell tab={tab} setTab={setTab} storeVersion={store.version}>
      {updateReady && (
        <div className="mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs">
          <span className="font-bold">Update available</span>
          <span className="text-ink3">New version cached — reload to apply.</span>
          <button onClick={applyUpdate} className="ml-auto btn btn-primary min-h-8 rounded-xl px-3 text-xs">Update</button>
        </div>
      )}
      {tab==='today' && (
        <TodayView
          store={store}
          setStore={setStore}
          onStartSession={handleStartSession}
          onOpenTrain={()=> setTab('train')}
        />
      )}
      {tab==='train' && (
        <TrainView
          store={store}
          setStore={setStore}
          onStartSession={handleStartSession}
          availableEquipment={store.onboarding?.equipment || []}
        />
      )}
      {tab==='exercises' && (
        <>
          <ExerciseBrowser availableEquipment={store.onboarding?.equipment || []} />
          {!!recs.length && (
            <div className="px-4 pb-4 -mt-2">
              <div className="rounded-2xl border border-line bg-surface p-3">
                <p className="text-xs font-bold">Recommended for you</p>
                <p className="text-[11px] text-ink3 mt-1">Based on onboarding: goal <span className="font-semibold text-ink">{store.onboarding.goal}</span> • location <span className="font-semibold text-ink">{store.onboarding.location}</span> • kit {(store.onboarding.equipment||[]).join(', ')}</p>
                <ul className="mt-2 grid gap-1.5">
                  {recs.map(r=> <li key={r.id} className="text-sm flex gap-2"><span className="font-semibold">{r.name}</span><span className="text-xs text-ink3 ml-auto">{r.muscle} • {r.equipment.join(', ')}</span></li>)}
                </ul>
                <p className="text-[11px] text-ink3 mt-2">Change kit or location in More → Edit onboarding to see this update.</p>
              </div>
            </div>
          )}
        </>
      )}
      {tab==='progress' && <ProgressView store={store} />}
      {tab==='more' && <MoreView store={store} setStore={setStore} setTab={setTab} onboardingOpen={onboardingOpen} setOnboardingOpen={setOnboardingOpen} />}

      {activeSession && (
        <SessionRunner session={activeSession} history={store.history || []} onSave={handleSaveSession} onCancel={handleCancelSession} />
      )}

      <Onboarding
        open={onboardingOpen}
        onClose={()=> setOnboardingOpen(false)}
        onComplete={handleCompleteOnboarding}
        initial={store.onboarding}
      />

      {!store.onboarding && !onboardingOpen && (
        <div className="fixed bottom-20 inset-x-4 z-10 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <span className="text-sm">👋</span>
          <span className="text-sm flex-1"><span className="font-bold">Set up Arise</span> — 30 seconds so recommendations actually match your kit.</span>
          <button onClick={()=> setOnboardingOpen(true)} className="btn btn-primary min-h-9 rounded-xl px-3 text-xs">Set up</button>
        </div>
      )}
    </AppShell>
  );
}
