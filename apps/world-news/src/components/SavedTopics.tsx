"use client";
import { useState, useSyncExternalStore } from "react";
import { TOPICS } from "@/lib/gemini";
import { loadSavedTopics, saveSavedTopics } from "@/lib/notifications";

// Browser-only values read through useSyncExternalStore rather than an effect:
// setting state inside an effect renders once with the wrong value and then
// again with the right one, which is a visible flash on the topic chips.
const subscribeStorage = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export default function SavedTopics() {
  const [override, setOverride] = useState<string[] | null>(null);
  const stored = useSyncExternalStore(
    subscribeStorage,
    () => localStorage.getItem("world-news-saved-topics") ?? "[]",
    () => "[]",
  );
  const saved = override ?? (() => { try { return loadSavedTopics(); } catch { return []; } })();
  void stored;

  const notify = useSyncExternalStore(
    () => () => {},
    () => (typeof Notification !== "undefined" && Notification.permission === "granted" ? "on" : "off"),
    () => "off",
  ) === "on";
  const [notifyOverride, setNotifyOverride] = useState<boolean | null>(null);
  const notifyOn = notifyOverride ?? notify;

  const toggle = (t: string) => {
    const next = saved.includes(t) ? saved.filter(x=>x!==t) : [...saved, t];
    setOverride(next); saveSavedTopics(next);
  };
  const askNotify = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifyOverride(p === "granted");
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
        <button type="button" onClick={askNotify} className="rounded-full border border-rule bg-panel-soft px-3 py-1 text-xs hover:border-accent">{notifyOn?"Notifications on":"Enable notifications"}</button>
        <span className="text-[11px] text-muted">Browser notifications for meaningful changes to saved topics.</span>
      </div>
    </div>
  );
}
