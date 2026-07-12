'use client';

import React, { useEffect, useRef, useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Session {
  id: string;
  date: string;
  minutes: number;
  subject: string;
}

const presets = [15, 25, 50];

export default function FocusTimerPage() {
  const [sessions, setSessions] = useStoredState<Session[]>('os.study.focus', []);
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          setRunning(false);
          setSessions([
            { id: uid(), date: today(), minutes: duration, subject: subject.trim() || 'General' },
            ...sessionsRef.current,
          ]);
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, duration, subject]);

  const start = () => {
    setSecondsLeft(duration * 60);
    setRunning(true);
  };

  const todayMinutes = sessions.filter((s) => s.date === today()).reduce((sum, s) => sum + s.minutes, 0);
  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : duration;
  const ss = secondsLeft !== null ? secondsLeft % 60 : 0;

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Study OS', href: '/os/study' },
        { name: 'Focus Timer' },
      ]}
      icon="⏲️"
      title="Focus Timer"
      tagline="Pomodoro blocks with a running log of deep-work minutes."
    >
      <section className={`${panelCls} text-center`}>
        <p className="text-7xl font-bold tabular-nums text-white">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {presets.map((m) => (
            <button key={m}
              className={`${inputCls} ${duration === m && secondsLeft === null ? 'border-blue-500/60 text-blue-400' : ''}`}
              disabled={secondsLeft !== null}
              onClick={() => setDuration(m)}>
              {m} min
            </button>
          ))}
          <input className={inputCls} placeholder="Subject (optional)" value={subject}
            onChange={(e) => setSubject(e.target.value)} />
          {secondsLeft === null ? (
            <button className={btnCls} onClick={start}>Start</button>
          ) : (
            <>
              <button className={btnCls} onClick={() => setRunning(!running)}>
                {running ? 'Pause' : 'Resume'}
              </button>
              <button className={btnCls} onClick={() => { setRunning(false); setSecondsLeft(null); }}>
                Abandon
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-4">Only completed blocks are logged — abandoning counts for nothing, deliberately.</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Focused today</p>
          <p className="text-4xl font-bold text-white mt-2">{todayMinutes} min</p>
        </div>
        <div className={panelCls}>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Blocks completed (all time)</p>
          <p className="text-4xl font-bold text-white mt-2">{sessions.length}</p>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Recent blocks</h2>
        {sessions.length === 0 && <p className="text-sm text-gray-600">No completed blocks yet.</p>}
        <ul className="divide-y divide-gray-900">
          {sessions.slice(0, 10).map((s) => (
            <li key={s.id} className="py-2 flex justify-between text-sm">
              <span className="text-gray-200">{s.subject}</span>
              <span className="text-gray-500">{s.date} · {s.minutes} min</span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
