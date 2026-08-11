"use client";
import { useState } from "react";

export function SpeakerEnrolment({ onSave }: { onSave: (names: Record<string,string>)=>void }) {
  const [a, setA] = useState(""); const [b, setB] = useState("");
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Speaker enrolment</h2>
      <p className="mt-1 text-xs text-white/40">Name speakers so future meetings are labelled. Correction is per-segment in the transcript.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={a} onChange={(e)=>setA(e.target.value)} placeholder="Speaker A name" className="rounded border border-edge bg-ink px-2 py-1.5 text-sm" aria-label="Speaker A name" />
        <input value={b} onChange={(e)=>setB(e.target.value)} placeholder="Speaker B name" className="rounded border border-edge bg-ink px-2 py-1.5 text-sm" aria-label="Speaker B name" />
      </div>
      <button onClick={()=>{ const m: Record<string,string> = {}; if (a.trim()) m["Speaker A"]=a.trim(); if (b.trim()) m["Speaker B"]=b.trim(); onSave(m); }} className="mt-3 rounded bg-brand px-3 py-1.5 text-xs font-medium text-white">Save names</button>
    </div>
  );
}
