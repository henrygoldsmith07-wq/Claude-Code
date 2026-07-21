import { useEffect, useRef, useState } from 'react';
import { VOCAB_PACKS } from '../lib/vocab';
import { speak, stopSpeaking } from '../lib/tts';
import { Play, Square, ChevronRight } from './icons';

// Hands-free audio course (Pimsleur-style): pick a pack, press play, put the
// phone down. Each item runs listen → pause to repeat aloud → listen again →
// example sentence → pause, then advances automatically. No taps required.

const PAUSE_MS = 2600; // repeat-aloud gap

export default function AudioCourse({ ttsRate, onXp }) {
  const [packId, setPackId] = useState(null);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('idle'); // listen | repeat | again | example | done
  const timer = useRef(null);
  const cancelled = useRef(false);

  const pack = VOCAB_PACKS.find((p) => p.id === packId) || null;
  const entries = pack ? pack.entries : [];

  useEffect(() => () => { cancelled.current = true; clearTimeout(timer.current); stopSpeaking(); }, []);

  const wait = (ms) => new Promise((res) => { timer.current = setTimeout(res, ms); });
  const say = (text, rate) => new Promise((res) => speak(text, { rate, onEnd: res }));

  const run = async (startAt = 0) => {
    cancelled.current = false;
    setRunning(true);
    for (let i = startAt; i < entries.length; i += 1) {
      if (cancelled.current) return;
      const e = entries[i];
      setIndex(i);
      setPhase('listen');
      await say(e.fr, ttsRate);
      if (cancelled.current) return;
      setPhase('repeat');
      await wait(PAUSE_MS);
      if (cancelled.current) return;
      setPhase('again');
      await say(e.fr, Math.min(ttsRate, 0.9));
      if (cancelled.current) return;
      // Frequency-lexicon cards carry no example — skip the phase rather
      // than narrate silence.
      if (e.example) {
        setPhase('example');
        await say(e.example, ttsRate);
        if (cancelled.current) return;
        await wait(PAUSE_MS);
      }
    }
    if (!cancelled.current) {
      setPhase('done');
      setRunning(false);
      onXp(Math.max(3, Math.round(entries.length / 2)));
    }
  };

  const stop = () => {
    cancelled.current = true;
    clearTimeout(timer.current);
    stopSpeaking();
    setRunning(false);
    setPhase('idle');
  };

  if (!pack) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-ink2">
          Pick a pack, press play, and put the phone down — each word plays, waits for
          you to repeat aloud, replays slowly, then gives the example sentence. Fully hands-free.
        </p>
        {VOCAB_PACKS.filter((p) => p.entries.length > 0).map((p) => (
          <button
            key={p.id}
            onClick={() => { setPackId(p.id); setIndex(0); setPhase('idle'); }}
            className="w-full flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-2.5 text-left hover:border-ink3 transition-colors"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink truncate">{p.title}</span>
              <span className="block text-[11px] text-ink3">{p.entries.length} items · ~{Math.round(p.entries.length * 0.4)} min</span>
            </span>
            <ChevronRight size={14} className="text-ink3 shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  const current = entries[Math.min(index, entries.length - 1)];
  const PHASE_LABEL = {
    idle: 'Ready when you are.',
    listen: 'Listen…',
    repeat: '🗣️ Your turn — say it out loud',
    again: 'Once more, slowly…',
    example: 'In a sentence…',
    done: `Done — ${entries.length} items. Nice work.`,
  };

  return (
    <div className="space-y-4">
      <button onClick={() => { stop(); setPackId(null); }} className="text-[11px] font-semibold text-ink3 hover:text-ink">
        ← All packs
      </button>
      <div className="bg-surface border border-line rounded-2xl p-6 text-center space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">{pack.title}</p>
        <p className="text-2xl font-bold text-ink" lang="fr">{phase === 'idle' || phase === 'done' ? '🎧' : current.fr}</p>
        {phase !== 'idle' && phase !== 'done' && (
          <p className="text-xs text-ink3">{current.en}</p>
        )}
        <p className="text-sm text-ink2" role="status">{PHASE_LABEL[phase]}</p>
        <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
          <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${((phase === 'done' ? entries.length : index) / entries.length) * 100}%` }} />
        </div>
        <p className="text-[11px] text-ink3 tabular-nums">{Math.min(index + 1, entries.length)} / {entries.length}</p>
        {running ? (
          <button onClick={stop} aria-label="Stop course" className="btn btn-primary w-14 h-14 rounded-full mx-auto"><Square size={18} /></button>
        ) : (
          <button onClick={() => run(phase === 'done' ? 0 : index)} aria-label="Start course" className="btn btn-primary w-14 h-14 rounded-full mx-auto"><Play size={18} /></button>
        )}
      </div>
    </div>
  );
}
