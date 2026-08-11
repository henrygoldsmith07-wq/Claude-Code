"use client";
import { useEffect, useState } from "react";
import { TOPICS } from "@/lib/gemini";
import { loadSavedTopics, saveSavedTopics } from "@/lib/notifications";

export default function SavedTopics() {
  const [saved, setSaved] = useState<string[]>([]);
  const [notify, setNotify] = useState(false);
  useEffect(()=> setSaved(loadSavedTopics()), []);
  useEffect(()=> { if (typeof Notification !== "undefined") setNotify(Notification.permission === "granted"); }, []);
  const toggle = (t: string) => {
    const next = saved.includes(t) ? saved.filter(x=>x!==t) : [...saved, t];
    setSaved(next); saveSavedTopics(next);
  };
  const askNotify = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotify(p === "granted");
  };
  return (
    <div className="rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saved topics &amp; notifications</p>
      <p className="mt-1 text-xs text-muted">Save topics to get notified only when a story meaningfully changes (new timeline event, correction, new conflicting claim) — not every refresh.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOPICS.map(t=> (
          <button key={t} type="button" onClick={()=>toggle(t)} className={`rounded-full border px-2.5 py-1 text-xs ${saved.includes(t)?"border-accent bg-accent/10 text-accent":"border-rule bg-panel-soft text-muted hover:border-accent"}`}>{t}{saved.includes(t)?" ✓":""}</button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={askNotify} className="rounded-full border border-rule bg-panel-soft px-3 py-1 text-xs hover:border-accent">{notify?"Notifications on":"Enable notifications"}</button>
        <span className="text-[11px] text-muted">Browser notifications for meaningful changes to saved topics.</span>
      </div>
    </div>
  );
}
