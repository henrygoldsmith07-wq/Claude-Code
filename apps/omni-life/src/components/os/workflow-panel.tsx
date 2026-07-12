'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DATA_EVENT, toneCls } from '@/lib/os/signals';
import { runWorkflows, Suggestion } from '@/lib/os/workflows';

const osLabels: Record<Suggestion['os'], string> = {
  study: '📚 Study',
  builder: '🛠️ Builder',
  health: '❤️ Health',
  money: '💷 Money',
};

/**
 * The agentic layer: shows what the workflows have decided needs doing for
 * this scope ('' = whole Life OS, or one area slug). Suggestions with an
 * action execute in one click and every open view recomputes via DATA_EVENT.
 */
export default function WorkflowPanel({ scope }: { scope: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    const compute = () => setSuggestions(runWorkflows(scope));
    compute();
    window.addEventListener(DATA_EVENT, compute);
    return () => window.removeEventListener(DATA_EVENT, compute);
  }, [scope]);

  if (suggestions === null || suggestions.length === 0) return null;

  return (
    <section className="bg-gray-950 border border-blue-500/20 rounded-2xl p-5">
      <h2 className="text-sm uppercase tracking-widest text-blue-400 mb-4">
        ⚡ Workflows · {suggestions.length} action{suggestions.length === 1 ? '' : 's'} suggested
      </h2>
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-300">
              {scope === '' && (
                <span className="text-gray-600 text-xs uppercase tracking-widest mr-2">
                  {osLabels[s.os]}
                </span>
              )}
              <span className={toneCls[s.tone]}>▮</span> {s.text}
            </p>
            <span className="flex items-center gap-2">
              {s.action && (
                <button
                  onClick={s.action.apply}
                  className="bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-600/20 transition-colors">
                  {s.action.label}
                </button>
              )}
              {s.href && (
                <Link href={s.href}
                  className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-4">
                  open
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
