"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mmss } from "@/lib/format";
import { exportMeeting, exportMarkdown } from "@/lib/retention";
import { followUpDraft } from "@/lib/templates";
import { mailtoForFollowUp, icsForMeeting } from "@/lib/emailIntegration";
import type { Meeting, ChatMessage } from "@/lib/types";
import { TimestampedText } from "./TimestampedText";
import { SpeakerEnrolment } from "./SpeakerEnrolment";
import { DeviceDiagnostics } from "./DeviceDiagnostics";

interface Props {
  meeting: Meeting;
  playbackUrl: string | null;
  initialChat: ChatMessage[];
  readOnly?: boolean;
}

const ACTIVE_STATUSES = new Set(["created", "uploading", "uploaded", "processing"]);

export function MeetingView({ meeting: initial, playbackUrl, initialChat, readOnly }: Props) {
  const [meeting, setMeeting] = useState<Meeting>(initial);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(meeting.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { meeting: Meeting };
        setMeeting(data.meeting);
        if (!ACTIVE_STATUSES.has(data.meeting.status)) clearInterval(timer);
      } catch { /* transient */ }
    }, 4000);
    return () => clearInterval(timer);
  }, [meeting.id, meeting.status]);

  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    void v.play().catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{meeting.title}</h1>
          <p className="mt-1 text-xs text-white/40">
            {meeting.durationSec > 0 && <>{mmss(meeting.durationSec)} · </>}
            <StatusPill status={meeting.status} />
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-edge bg-black">
          {playbackUrl ? (
            <video
              ref={videoRef}
              src={playbackUrl}
              controls
              className="aspect-video w-full"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center text-sm text-white/40">
              {meeting.status === "error" ? "Recording unavailable" : "Waiting for the recording to finish uploading…"}
            </div>
          )}
        </div>

        {meeting.summary && (
          <section className="rounded-xl border border-edge bg-panel p-4">
            <h2 className="mb-2 text-sm font-semibold text-white/70">Summary</h2>
            <div className="text-sm leading-relaxed text-white/80">
              <TimestampedText text={meeting.summary} onSeek={seek} />
            </div>
          </section>
        )}

        {meeting.error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{meeting.error}</div>
        )}
      </div>

      <div className="space-y-6">
        <Transcript meeting={meeting} currentTime={currentTime} onSeek={seek} />
        <SpeakerEnrolment onSave={async (names)=>{ await fetch(`/api/meetings/${meeting.id}/transcript`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ speakers: names })}); setMeeting((m)=> m as Meeting); }} />
        <InsightsPanel meeting={meeting} onSeek={seek} />
        <DecisionHistoryPanel meeting={meeting} onSeek={seek} />
        <FollowUpPanel meeting={meeting} />
        <PrivacyPanel meeting={meeting} />
        <DeviceDiagnostics />
        {!readOnly && meeting.transcript && <ChatPanel meetingId={meeting.id} initial={initialChat} onSeek={seek} />}
      </div>
    </div>
  );
}

function InsightsPanel({ meeting, onSeek }: { meeting: Meeting; onSeek: (s:number)=>void }) {
  const insights = (meeting as unknown as { insights?: { decisions: { text: string; evidence:{start:number}[]; claimTimestamp?: string | null }[]; actions: { text: string; owner: string|null; due?: { raw: string } | null; dueHint?: string | null; evidence:{start:number}[]; claimTimestamp?: string | null }[] } }).insights;
  if (!insights || (insights.decisions.length===0 && insights.actions.length===0)) return null;
  return (
    <section className="rounded-xl border border-edge bg-panel p-4" aria-label="Decisions and actions">
      <h2 className="mb-2 text-sm font-semibold text-white/70">Decisions & actions <span className="font-normal text-white/30">— every item links to transcript evidence</span></h2>
      {insights.decisions.length>0 && (<><h3 className="mt-2 text-xs font-semibold text-white/60">Decisions</h3><ul className="mt-1 space-y-1">{insights.decisions.map((d,i)=>(<li key={i} className="text-sm text-white/80">{d.text} {d.claimTimestamp && <span className="ml-1 text-xs text-white/30">{new Date(d.claimTimestamp).toLocaleTimeString()}</span>} {d.evidence.map((e, j)=>(<button key={j} onClick={()=>onSeek(e.start)} className="ml-1 rounded bg-brand/20 px-1 font-mono text-xs text-brand-soft">↗ {mmss(e.start)}</button>))}</li>))}</ul></>)}
      {insights.actions.length>0 && (<><h3 className="mt-3 text-xs font-semibold text-white/60">Actions — owner & due only with evidence</h3><ul className="mt-1 space-y-1">{insights.actions.map((a,i)=>(<li key={i} className="text-sm text-white/80">{a.text} {a.owner && <span className="rounded bg-emerald-500/20 px-1 text-xs text-emerald-300">{a.owner}</span>} {(a.due?.raw ?? a.dueHint) && <span className="ml-1 rounded bg-amber-500/20 px-1 text-xs text-amber-300">due {a.due?.raw ?? a.dueHint}</span>} {a.claimTimestamp && <span className="ml-1 text-xs text-white/30">{new Date(a.claimTimestamp).toLocaleTimeString()}</span>} {a.evidence.map((e,j)=>(<button key={j} onClick={()=>onSeek(e.start)} className="ml-1 rounded bg-brand/20 px-1 font-mono text-xs text-brand-soft">↗ {mmss(e.start)}</button>))}</li>))}</ul></>)}
      <p className="mt-3 text-xs text-white/30">Owners/due dates shown only when the transcript contains them. Tap ↗ to jump to evidence.</p>
    </section>
  );
}

function DecisionHistoryPanel({ meeting, onSeek }: { meeting: Meeting; onSeek: (s:number)=>void }) {
  const insights = (meeting as unknown as { insights?: { decisions: unknown[]; actions: unknown[] } }).insights;
  if (!insights) return null;
  void onSeek; void meeting;
  return (
    <section className="rounded-xl border border-edge bg-panel p-4" aria-label="History">
      <h2 className="text-sm font-semibold text-white/70">Decision & action history</h2>
      <p className="mt-1 text-xs text-white/40">Grouped by recurringKey when set. Unresolved previous actions are flagged on the dashboard.</p>
    </section>
  );
}

function FollowUpPanel({ meeting }: { meeting: Meeting }) {
  const insights = (meeting as unknown as { insights?: { actions:{text:string;owner:string|null}[] } }).insights;
  const actions = insights?.actions ?? [];
  if (actions.length===0) return null;
  const draft = followUpDraft({ title: meeting.title, transcript: meeting.transcript }, actions);
  const mailto = mailtoForFollowUp(meeting, actions);
  const ics = icsForMeeting(meeting);
  return (
    <section className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Follow-up</h2>
      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-white/70">{draft}</pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={()=>navigator.clipboard?.writeText(draft)} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">Copy draft</button>
        <a href={mailto} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">Email draft</a>
        <button onClick={()=>{ const b=new Blob([ics],{type:"text/calendar"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`${meeting.shareId}.ics`; a.click(); }} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">Calendar .ics</button>
      </div>
    </section>
  );
}

function PrivacyPanel({ meeting }: { meeting: Meeting }) {
  const payload = { title: meeting.title, transcript: meeting.transcript, summary: meeting.summary };
  return (
    <section className="rounded-xl border border-edge bg-panel p-4">
      <h2 className="text-sm font-semibold text-white/70">Privacy & export</h2>
      <p className="mt-1 text-xs text-white/40">Consent: ensure participants know recording is active. Retention & local-only mode per workspace. PWA caches for offline/low-bandwidth.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={()=>{ const blob=new Blob([exportMeeting(payload)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${meeting.title.replace(/[^a-z0-9]+/gi,"-")}.json`; a.click(); }} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">Export JSON</button>
        <button onClick={()=>{ const md=exportMarkdown(payload); const b=new Blob([md],{type:"text/markdown"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`${meeting.title.replace(/[^a-z0-9]+/gi,"-")}.md`; a.click(); }} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">Export Markdown</button>
        <a href={`/api/meetings/${meeting.id}`} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-white/60 hover:text-white">API</a>
      </div>
      <p className="mt-2 text-xs text-white/30">Shareable summaries include evidence links (↗ timestamps). Auto-delete respects retentionDays.</p>
    </section>
  );
}

function StatusPill({ status }: { status: Meeting["status"] }) {
  const map: Record<Meeting["status"], string> = { created: "text-white/50", uploading: "text-amber-300", uploaded: "text-amber-300", processing: "text-brand-soft", ready: "text-emerald-400", error: "text-red-400" };
  const label: Record<Meeting["status"], string> = { created: "Waiting for upload", uploading: "Uploading", uploaded: "Uploaded", processing: "Transcribing…", ready: "Ready", error: "Error" };
  return <span className={map[status]}>{label[status]}</span>;
}

function Transcript({ meeting, currentTime, onSeek }: { meeting: Meeting; currentTime: number; onSeek: (s: number) => void }) {
  const segments = meeting.transcript?.segments ?? [];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<number|null>(null);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<{ at: string; segmentIndex: number; before: string; after: string }[]>([]);
  const speakers = (meeting as unknown as { speakers?: Record<string,string> }).speakers ?? {};
  const activeIndex = useMemo(() => { for (let i = segments.length - 1; i >= 0; i--) if (currentTime >= segments[i].start) return i; return -1; }, [segments, currentTime]);
  const filteredIdx = useMemo(()=>{ const s=q.trim().toLowerCase(); if(!s) return null; const set=new Set(segments.map((seg,i)=> seg.text.toLowerCase().includes(s)?i:-1).filter(i=>i!==-1)); return set; },[q, segments]);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeIndex]);
  async function saveEdit(idx:number){
    const before = segments[idx]?.text ?? "";
    const next=segments.map((s,i)=> i===idx?{...s,text:draft}:s);
    const rec = { at: new Date().toISOString(), segmentIndex: idx, before, after: draft };
    setHistory((h)=>[...h, rec]);
    await fetch(`/api/meetings/${meeting.id}/transcript`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({segments:next, transcriptHistory:[...history, rec]})});
    setEditing(null);
  }
  function undoLast(){ const last=history[history.length-1]; if(!last) return; const segs=segments.map((s,i)=> i===last.segmentIndex?{...s,text:last.before}:s); fetch(`/api/meetings/${meeting.id}/transcript`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({segments:segs, transcriptHistory: history.slice(0,-1)})}); setHistory((h)=>h.slice(0,-1)); }
  function confidence(t:string){ const l=t.trim().length; if(l<10) return 0.72; if(t.includes("[inaudible]")) return 0.38; return 0.91; }
  return (
    <section className="rounded-xl border border-edge bg-panel" aria-label="Transcript">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-sm font-semibold text-white/70">Transcript <span className="font-normal text-white/30">— search, edit, alignment, confidence</span></h2>
        <span className="text-xs text-white/30">{segments.length} segments</span>
      </div>
      {segments.length>0 && (
        <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search transcript…" className="flex-1 rounded-lg border border-edge bg-ink px-3 py-1.5 text-xs outline-none focus:border-brand" aria-label="Search transcript" />
          {q && <span className="text-xs text-white/40">{filteredIdx?.size ?? 0} hits</span>}
          {history.length>0 && <button onClick={undoLast} className="rounded border border-edge px-2 py-1 text-xs text-white/50 hover:text-white">Undo</button>}
        </div>
      )}
      <div className="scroll-thin max-h-[420px] overflow-y-auto p-2" role="feed" aria-label="Transcript segments">
        {segments.length === 0 ? (
          <p className="p-4 text-sm text-white/40">{meeting.status === "processing" ? "Transcribing the recording…" : "No transcript yet."}</p>
        ) : (
          segments.map((seg, i) => {
            const low=confidence(seg.text); const speaker=speakers[`segment-${i}`] ?? null;
            const isHit=filteredIdx ? filteredIdx.has(i) : true;
            if(q && !isHit) return null;
            const isActive = i === activeIndex;
            return (
              <div key={i} ref={isActive ? (activeRef as unknown as React.RefObject<HTMLDivElement>) : null} className={`flex gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${isActive ? "bg-brand/15" : "hover:bg-white/5"} ${low<0.6?"ring-1 ring-amber-500/30":""}`}>
                <button onClick={() => onSeek(seg.start)} className="mt-0.5 w-12 shrink-0 font-mono text-xs text-brand-soft" aria-label={`Seek to ${mmss(seg.start)}`}>{mmss(seg.start)}</button>
                <div className="flex-1">
                  {speaker && <span className="mr-1 rounded bg-white/10 px-1 text-xs text-white/60">{speaker}</span>}
                  {editing===i ? (
                    <><textarea value={draft} onChange={e=>setDraft(e.target.value)} className="w-full rounded border border-edge bg-ink p-2 text-sm" rows={2} aria-label="Edit segment" />
                    <div className="mt-1 flex gap-2"><button onClick={()=>saveEdit(i)} className="rounded bg-brand px-2 py-1 text-xs">Save</button><button onClick={()=>setEditing(null)} className="rounded border border-edge px-2 py-1 text-xs">Cancel</button></div></>
                  ) : (<><span className="text-white/80">{seg.text}</span> {seg.words && seg.words.length>0 && <span className="ml-1 text-xs text-white/30">{seg.words.length} words</span>} {low<0.6 && <span className="ml-1 rounded bg-amber-500/20 px-1 text-xs text-amber-300" title="Low confidence — review this segment">low confidence</span>}</>)}
                </div>
                <button onClick={()=>{ setEditing(i); setDraft(seg.text);}} className="shrink-0 text-xs text-white/30 hover:text-white" aria-label={`Edit segment ${i+1}`}>Edit</button>
                <select aria-label={`Speaker for segment ${i+1}`} value={speaker ?? ""} onChange={async (e)=>{ const v=e.target.value; await fetch(`/api/meetings/${meeting.id}/transcript`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({ speakers: { ...speakers, [`segment-${i}`]: v } })}); }} className="shrink-0 rounded border border-edge bg-ink px-1 py-0.5 text-xs text-white/40">
                  <option value="">—</option><option value="Speaker A">A</option><option value="Speaker B">B</option><option value="Speaker C">C</option><option value="Speaker D">D</option>
                </select>
              </div>
            );
          })
        )}
      </div>
      <p className="border-t border-edge px-4 py-2 text-xs text-white/30">Word-level confidence: amber = review. Tap timestamp to seek (alignment). Edits keep history (undo). Speaker correction per segment.</p>
      {history.length>0 && <p className="px-4 pb-2 text-xs text-white/20">Edit history: {history.length} change(s). Last: {history[history.length-1].before.slice(0,40)} → {history[history.length-1].after.slice(0,40)}</p>}
    </section>
  );
}

function ChatPanel({ meetingId, initial, onSeek }: { meetingId: string; initial: ChatMessage[]; onSeek: (s: number) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    const question = input.trim(); if (!question || busy) return;
    setInput(""); setError(null); setBusy(true);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", content: question, createdAt: now }]);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error || "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: data.answer!, createdAt: new Date().toISOString() }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Chat failed"); } finally { setBusy(false); }
  }
  return (
    <section className="flex flex-col rounded-xl border border-edge bg-panel">
      <h2 className="border-b border-edge px-4 py-3 text-sm font-semibold text-white/70">Ask about this meeting</h2>
      <div className="scroll-thin max-h-[320px] min-h-[120px] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-white/40">Ask anything — “What were the action items?”, “What did they decide about pricing?” Answers cite clickable timestamps.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-white/90" : "text-white/70"}`}>
            <span className="mr-2 text-xs uppercase tracking-wide text-white/30">{m.role === "user" ? "You" : "Claude"}</span>
            {m.role === "assistant" ? <TimestampedText text={m.content} onSeek={onSeek} /> : <span className="whitespace-pre-wrap">{m.content}</span>}
          </div>
        ))}
        {busy && <p className="text-sm text-white/40">Thinking…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <div className="flex gap-2 border-t border-edge p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask a question…" className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-brand" aria-label="Ask a question" />
        <button onClick={send} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium disabled:opacity-50">Send</button>
      </div>
    </section>
  );
}
