"use client";
import { useEffect, useState } from "react";
import { enumerateDevices, checkMicrophone, platformNote } from "@/lib/deviceDiagnostics";

export function DeviceDiagnostics() {
  const [devices, setDevices] = useState<{ deviceId: string; label: string; kind: string }[]>([]);
  const [status, setStatus] = useState<string>("");
  useEffect(()=>{ enumerateDevices().then(setDevices).catch(()=>{}); },[]);
  async function test(){ setStatus("Testing…"); const r=await checkMicrophone(); setStatus(r.ok ? `Microphone OK${r.label?` — ${r.label}`:""}` : `Failed: ${r.reason}`); }
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Microphone & devices</h2>
      <p className="mt-1 text-xs text-white/30">{platformNote(typeof navigator!=="undefined" ? (navigator as unknown as { platform?: string }).platform ?? "" : "")} Noise suppression & echo cancellation on by default.</p>
      <ul className="mt-2 max-h-28 overflow-auto rounded border border-edge bg-ink p-2 text-xs" aria-label="Audio devices">
        {devices.filter((d)=>d.kind==="audioinput").map((d)=> <li key={d.deviceId} className="py-0.5 text-white/60">{d.label || d.deviceId.slice(0,12)}</li>)}
        {devices.length===0 && <li className="text-white/30">No devices enumerated (grant permission first).</li>}
      </ul>
      <div className="mt-3 flex gap-2">
        <button onClick={test} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/70 hover:text-white">Test microphone</button>
        <span className="text-xs text-white/40" aria-live="polite">{status}</span>
      </div>
    </div>
  );
}
