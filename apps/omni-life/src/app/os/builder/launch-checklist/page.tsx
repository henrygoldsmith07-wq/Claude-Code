'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls } from '@/components/os/shell';
import { useStoredState } from '@/lib/os/storage';

const apps = [
  'Omni-Life', 'WJEC Study Hub', 'Emotion Tracker', 'Subscription Tracker',
  'Daily Debate', 'World News', 'Podcast Repurposer', 'RTK',
];

const checklist = [
  'Deployed to production URL',
  'Custom domain connected',
  'Auth works end-to-end',
  'Analytics installed',
  'Payments / monetisation wired',
  'SEO basics (title, description, OG image)',
  'Error monitoring on',
  'Announced somewhere public',
];

/** app name -> completed checklist items */
type Progress = Record<string, string[]>;

export default function LaunchChecklistPage() {
  const [progress, setProgress] = useStoredState<Progress>('os.builder.launch', {});
  const [selected, setSelected] = useState(apps[0]);

  const done = progress[selected] ?? [];
  const toggle = (item: string) => {
    const next = done.includes(item) ? done.filter((i) => i !== item) : [...done, item];
    setProgress({ ...progress, [selected]: next });
  };

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Builder OS', href: '/os/builder' },
        { name: 'Launch Checklist' },
      ]}
      icon="🧾"
      title="Launch Checklist"
      tagline="The same eight steps for every app — shipped means all boxes ticked."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-2 mb-6">
          {apps.map((app) => {
            const count = (progress[app] ?? []).length;
            const complete = count === checklist.length;
            return (
              <button key={app} onClick={() => setSelected(app)}
                className={`${inputCls} ${selected === app ? '!border-blue-500/60 text-blue-400' : ''}`}>
                {app} <span className={complete ? 'text-green-400' : 'text-gray-600'}>
                  {count}/{checklist.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${(done.length / checklist.length) * 100}%` }} />
        </div>

        <ul className="space-y-3">
          {checklist.map((item) => {
            const ticked = done.includes(item);
            return (
              <li key={item}>
                <button onClick={() => toggle(item)} className="flex items-center gap-3 text-left w-full group">
                  <span className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center text-sm transition-colors ${
                    ticked
                      ? 'bg-green-500/20 border-green-500/40 text-green-400'
                      : 'bg-gray-900 border-gray-700 text-transparent group-hover:border-green-500/40'
                  }`}>✓</span>
                  <span className={`text-sm ${ticked ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {item}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-3">Portfolio launch status</h2>
        <ul className="space-y-2">
          {apps.map((app) => {
            const count = (progress[app] ?? []).length;
            return (
              <li key={app} className="flex items-center gap-3 text-sm">
                <span className="w-44 text-gray-300 truncate">{app}</span>
                <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${count === checklist.length ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${(count / checklist.length) * 100}%` }} />
                </div>
                <span className="text-gray-600 text-xs w-8 text-right">{count}/{checklist.length}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </OsShell>
  );
}
