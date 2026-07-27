import { useState } from 'react';
import { ScoreBadge, scoreColor } from './ui';
import { compositeScore } from '../lib/groq';

// Live per-turn scores: bottom sheet on mobile, side pane on desktop.
// S = 0.30·Grammaire + 0.30·Naturel + 0.20·Pertinence + 0.20·Fluidité

const ROWS = [
  ['grammar', 'Grammar', 0.3],
  ['naturalness', 'Naturalness', 0.3],
  ['relevance', 'Relevance', 0.2],
  ['fluency', 'Fluency', 0.2],
];

function ScoreRows({ scores }) {
  return (
    <div className="space-y-2.5">
      {ROWS.map(([key, label, weight]) => {
        const v = scores[key];
        const c = scoreColor(v);
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-ink2">
                {label} <span className="text-ink3">×{weight.toFixed(2)}</span>
              </span>
              <span className={`font-bold font-mono ${c.text}`}>{v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${v}%`, background: c.ring }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FeedbackWidget({ scores, turnCount }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (!scores) return null;
  const composite = compositeScore(scores);

  return (
    <>
      {/* Desktop: persistent side pane */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-line bg-surface p-5 gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">This turn</h3>
          <span className="text-[11px] text-ink3">Turn {turnCount}</span>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge value={composite} size="lg" />
          <p className="text-[11px] text-ink3 leading-snug">
            Weighted score<br />0.30 G + 0.30 N + 0.20 R + 0.20 F
          </p>
        </div>
        <ScoreRows scores={scores} />
      </aside>

      {/* Mobile: floating pill that opens a bottom sheet. It sits over the
          transcript, so it reads as an overlay control (own surface + border
          + elevation) rather than as part of whichever bubble is behind it. */}
      <button
        onClick={() => setSheetOpen(true)}
        aria-label={`Turn score: ${composite}. See details`}
        className="lg:hidden fixed bottom-36 right-3 z-30 flex items-center gap-1.5 rounded-full bg-surface border border-line elev-pop pl-3 pr-1.5 py-1.5 active:scale-95 transition"
      >
        <span className="text-[11px] font-semibold text-ink2">Turn {turnCount}</span>
        <ScoreBadge value={composite} />
      </button>
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 flex items-end"
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Score details"
            onClick={(e) => e.stopPropagation()}
            className="sheet-enter w-full bg-surface border-t border-line rounded-t-3xl p-5 pb-safe space-y-4"
          >
            <div className="w-10 h-1 rounded-full bg-line mx-auto" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <ScoreBadge value={composite} size="lg" />
              <div>
                <h3 className="text-sm font-bold text-ink">Turn {turnCount} score</h3>
                <p className="text-[11px] text-ink3">0.30 G + 0.30 N + 0.20 R + 0.20 F</p>
              </div>
            </div>
            <ScoreRows scores={scores} />
            <button
              onClick={() => setSheetOpen(false)}
              className="w-full min-h-11 rounded-xl bg-surface2 text-ink2 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
