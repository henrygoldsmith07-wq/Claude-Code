import { useMemo, useState } from 'react';
import { WRITING_PROMPTS, ESSAY_PROMPTS, randomFrom } from '../lib/writing';
import { writingFeedback } from '../lib/groq';
import { Markdown, Spinner } from './ui';
import { Check, RefreshCw } from './icons';

// Free writing (quick correction) and Essay studio (structured feedback):
// prompt → write → AI review with corrections, strengths, suggestions and
// scores. Word count guides length; XP scales with the overall score.

export default function WritingStudio({ depth, apiKey, mockMode, level, onXp }) {
  const essay = depth === 'essay';
  const prompts = essay ? ESSAY_PROMPTS : WRITING_PROMPTS;
  const minWords = essay ? 80 : 25;

  const [prompt, setPrompt] = useState(() => randomFrom(prompts));
  const [text, setText] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);

  const submit = async () => {
    setReviewing(true);
    setError(null);
    try {
      const r = await writingFeedback(apiKey, { text: text.trim(), prompt: prompt.fr, level, depth, mock: mockMode });
      onXp(Math.max(2, Math.round((r.scores.overall || 50) / 10)));
      setReview(r);
    } catch (e) {
      setError(e.message);
    }
    setReviewing(false);
  };

  const restart = (newPrompt) => {
    if (newPrompt) setPrompt(randomFrom(prompts, prompt));
    setText('');
    setReview(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">
            {essay ? 'Essay topic' : 'Prompt'} · aim for {minWords}+ words
          </p>
          <button onClick={() => restart(true)} className="text-[11px] text-ink3 hover:text-ink shrink-0">
            Change
          </button>
        </div>
        <p className="text-[15px] text-ink font-medium leading-snug" lang="fr">{prompt.fr}</p>
        <p className="text-xs text-ink3 italic">{prompt.en}</p>
      </div>

      {!review ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={essay ? 10 : 5}
            lang="fr"
            placeholder="Écrivez en français…"
            aria-label="Your text"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink leading-relaxed placeholder:text-ink3 focus:outline-none focus:border-ink resize-y"
          />
          <div className="flex items-center justify-between">
            <span className={`text-[11px] tabular-nums ${wordCount >= minWords ? 'text-ink2' : 'text-ink3'}`}>
              {wordCount} word{wordCount !== 1 ? 's' : ''}{wordCount < minWords ? ` — ${minWords - wordCount} to go` : ''}
            </span>
          </div>
          {reviewing ? (
            <Spinner label={essay ? 'Your teacher is reading the essay…' : 'Correcting your text…'} />
          ) : (
            <button
              onClick={submit}
              disabled={wordCount < Math.min(10, minWords)}
              className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
            >
              <Check size={14} /> {essay ? 'Get essay feedback' : 'Correct my writing'}
            </button>
          )}
          {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
        </div>
      ) : (
        <div className="fade-in space-y-4">
          {/* scores */}
          <div className="bg-surface border border-line rounded-2xl p-5">
            <div className="flex items-center justify-around text-center">
              {Object.entries(review.scores).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xl font-bold text-ink tabular-nums">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink3">{k}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1.5">Corrections</h4>
              <Markdown className="text-[13px] text-ink leading-relaxed">{review.corrections}</Markdown>
            </div>
            {review.strengths.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1.5">What worked</h4>
                <ul className="space-y-1 text-[13px] text-ink">
                  {review.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-ink3">•</span>{s}</li>)}
                </ul>
              </div>
            )}
            {review.suggestions.length > 0 && (
              <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Next time</h4>
                <ul className="space-y-1 text-xs text-ink2">
                  {review.suggestions.map((s, i) => <li key={i} className="flex gap-2"><span>•</span>{s}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1.5">Your text</h4>
            <p className="text-[13px] text-ink2 leading-relaxed whitespace-pre-wrap" lang="fr">{text}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setReview(null)} className="btn btn-secondary flex-1 min-h-11 rounded-xl text-sm">
              Revise it
            </button>
            <button onClick={() => restart(true)} className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm">
              <RefreshCw size={13} /> New {essay ? 'topic' : 'prompt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
