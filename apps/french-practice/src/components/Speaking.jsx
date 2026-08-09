import { useState } from 'react';
import DailyChallenge from './DailyChallenge';
import Pronunciation from './Pronunciation';
import { Mic, Clock, MessageCircle, ChevronLeft, ChevronRight } from './icons';

// Speaking hub: the practice drills that aren't full conversations.
// Pronunciation (read aloud) and Shadowing (listen & repeat) score your
// speech via Whisper; Quick Fire builds flow.

const MODES = [
  {
    id: 'pronunciation',
    icon: Mic,
    title: 'Pronunciation',
    subtitle: 'Read a sentence aloud — get a clarity score and accent feedback',
  },
  {
    id: 'shadow',
    icon: MessageCircle,
    title: 'Shadowing',
    subtitle: 'Listen to the native rhythm, then repeat and get scored',
  },
  {
    id: 'quickfire',
    icon: Clock,
    title: 'Quick Fire',
    subtitle: '45 seconds of open improv with WPM tracking',
  },
];

export default function Speaking({ mode, onModeChange, apiKey, mockMode, ttsRate, level, onXp, onActivity }) {
  // mode is controlled by App so Home cards and path lessons can deep-link.
  const active = MODES.find((m) => m.id === mode) || null;

  if (!active) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">Speaking practice</h2>
            <p className="text-xs text-ink2 mt-1">
              Short drills for the mouth. Full conversations live in the Arena; ear training in Listening.
            </p>
          </div>
          <div className="space-y-2.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
                  <m.icon size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{m.title}</span>
                  <span className="block text-xs text-ink3">{m.subtitle}</span>
                </span>
                <ChevronRight size={16} className="text-ink3 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onModeChange(null)}
            aria-label="Back to speaking practice"
            className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink">{active.title}</h2>
          <span className="w-10" aria-hidden="true" />
        </div>

        {mode === 'pronunciation' && (
          <Pronunciation mode="read" apiKey={apiKey} mockMode={mockMode} ttsRate={ttsRate} level={level} onXp={onXp} />
        )}
        {mode === 'shadow' && (
          <Pronunciation mode="shadow" apiKey={apiKey} mockMode={mockMode} ttsRate={ttsRate} level={level} onXp={onXp} />
        )}
        {mode === 'quickfire' && <DailyChallenge apiKey={apiKey} mockMode={mockMode} onActivity={onActivity} />}
      </div>
    </div>
  );
}
