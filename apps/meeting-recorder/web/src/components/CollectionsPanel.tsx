"use client";
import { useState } from "react";
import type { Meeting } from "@/lib/types";
import type { Collection } from "@/lib/collections";
import { createCollection, addToCollection } from "@/lib/collections";

export function CollectionsPanel({ meetings, collections, onCreate }: { meetings: Meeting[]; collections: Collection[]; onCreate: (c: Collection)=>void }) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Collections</h2>
      <p className="mt-1 text-xs text-white/40">Group meetings by topic/project. Recurring meetings auto-link via recurringKey.</p>
      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Collection name" className="flex-1 rounded border border-edge bg-ink px-2 py-1.5 text-sm" />
        <input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="Topic (optional)" className="flex-1 rounded border border-edge bg-ink px-2 py-1.5 text-sm" />
        <button onClick={()=>{ if(!name.trim()) return; onCreate(createCollection(name.trim(), meetings.slice(0,3).map((m)=>m.id), topic.trim()||undefined)); setName(""); setTopic(""); }} className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-onaccent">Create</button>
      </div>
      <ul className="mt-3 space-y-1">
        {collections.map((c)=>(
          <li key={c.id} className="rounded border border-edge bg-ink px-3 py-2 text-sm">
            <span className="font-medium">{c.name}</span>{c.topic && <span className="ml-2 text-xs text-white/40">{c.topic}</span>} <span className="ml-2 text-xs text-white/30">{c.meetingIds.length} meetings</span>
          </li>
        ))}
        {collections.length===0 && <li className="text-xs text-white/30">No collections yet.</li>}
      </ul>
    </div>
  );
}
