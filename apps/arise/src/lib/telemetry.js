// telemetry.js — local, privacy-gated event log for workout completion & recommendation acceptance.
// No network. User can export/delete via More → Data. Respects preferences.telemetryEnabled.

const KEY = 'arise.telemetry.v1';

function load(){
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : { events: [] }; } catch { return { events: [] }; }
}
function save(state){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

export function recordEvent(type, payload={}){
  // Gate: only when telemetryEnabled
  try {
    const storeRaw = localStorage.getItem('arise.store.v1');
    const store = storeRaw ? JSON.parse(storeRaw) : null;
    if(store?.preferences && store.preferences.telemetryEnabled === false) return;
    // default is enabled unless explicitly false — but never send off-device
  } catch {}
  const s = load();
  s.events.push({ type, at: new Date().toISOString(), ...payload });
  // cap to 500 events
  if(s.events.length > 500) s.events = s.events.slice(-500);
  save(s);
}

export function getTelemetry(){
  return load();
}
export function clearTelemetry(){
  try { localStorage.removeItem(KEY); } catch {}
}

export function workoutCompletionStats(){
  const { events } = load();
  const started = events.filter(e=> e.type==='session:start').length;
  const completed = events.filter(e=> e.type==='session:complete').length;
  const abandoned = events.filter(e=> e.type==='session:abandon').length;
  const rate = started ? Math.round(completed/started*100)/100 : null;
  return { started, completed, abandoned, completionRate: rate };
}

export function recommendationAcceptanceStats(){
  const { events } = load();
  const shown = events.filter(e=> e.type==='recommendation:shown').length;
  const accepted = events.filter(e=> e.type==='recommendation:accepted').length;
  const dismissed = events.filter(e=> e.type==='recommendation:dismissed').length;
  const rate = shown ? Math.round(accepted/shown*100)/100 : null;
  return { shown, accepted, dismissed, acceptanceRate: rate };
}

export function telemetrySummary(){
  return {
    completion: workoutCompletionStats(),
    recommendation: recommendationAcceptanceStats(),
    totalEvents: load().events.length,
  };
}
