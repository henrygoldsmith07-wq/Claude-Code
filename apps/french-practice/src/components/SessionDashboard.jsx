import { useEffect, useState } from 'react';
import { Modal, Spinner } from './ui';
import { ProgressRing, RadarChart, TrendChart, renderShareCard } from './charts';
import { sessionReport } from '../lib/groq';
import { saveSession, getSessions, getStreak } from '../lib/storage';
import { Flame, Share as ShareIcon, Download as DownloadIcon, X as XIcon } from './icons';

// "Terminer la Session" overlay: report card + rings + radar + trends + share.

const RADAR_AXES = ['Grammar', 'Fluency', 'Vocabulary', 'Pronunciation', 'Speed'];

function radarValues(avg, history) {
  // Vocabulary/pronunciation/speed are derived proxies from what we measure.
  const words = history.flatMap((t) => t.userText.split(/\s+/));
  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-zà-ÿ'-]/g, ''))).size;
  const vocab = Math.min(100, Math.round((unique / Math.max(1, words.length)) * 130));
  return [
    avg.grammar,
    avg.fluency,
    vocab,
    Math.round((avg.fluency + avg.naturalness) / 2), // pronunciation proxy
    Math.min(100, Math.round(avg.relevance * 0.6 + avg.fluency * 0.4)), // speed proxy
  ];
}

export default function SessionDashboard({ open, onClose, apiKey, mockMode, scenario, history, onSessionSaved }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const streak = getStreak();
  const pastSessions = getSessions();

  useEffect(() => {
    if (!open || report) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await sessionReport(apiKey, { scenario, history, mock: mockMode });
        if (cancelled) return;
        setReport(r);
        saveSession({ scenarioId: scenario.id, turns: history.length, report: r });
        onSessionSaved?.();
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setReport(null);
    setError(null);
    setShareUrl(null);
    onClose();
  };

  const share = async () => {
    const url = renderShareCard({
      grade: report.session_grade,
      scores: report.average_scores,
      streak: getStreak().count,
      scenarioTitle: scenario.title,
    });
    setShareUrl(url);
    // Native share where available (mobile), otherwise the preview + download shows.
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'french-progress.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <Modal open={open} onClose={close} wide>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Session Report</h2>
            <p className="text-xs text-ink2 mt-0.5">{scenario.title} · {history.length} turn{history.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={close} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2"><XIcon size={16} /></button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-ink bg-surface2 border border-line rounded-xl px-4 py-3">{error}</p>
        )}
        {!report && !error && (
          <div className="py-16 text-center"><Spinner label="Your teacher is writing the report…" /></div>
        )}

        {report && (
          <div className="space-y-6 fade-in">
            {/* grade + streak + rings */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-ink">{report.session_grade}</div>
                <div className="text-[11px] text-ink3 mt-1">Overall grade</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-4xl font-bold text-ink"><Flame size={26} />{streak.count}</div>
                <div className="text-[11px] text-ink3 mt-1">Day streak</div>
              </div>
              <div className="flex flex-wrap gap-3 ml-auto">
                <ProgressRing value={report.average_scores.overall} label="Overall" />
                <ProgressRing value={report.average_scores.grammar} label="Grammar" size={70} />
                <ProgressRing value={report.average_scores.fluency} label="Fluency" size={70} />
              </div>
            </div>

            {/* radar + written feedback */}
            <div className="grid sm:grid-cols-2 gap-6 items-center">
              <div className="flex justify-center">
                <RadarChart axes={RADAR_AXES} values={radarValues(report.average_scores, history)} />
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-1.5">Strengths</h3>
                  <ul className="space-y-1 text-ink">
                    {report.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-ink2">•</span>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-1.5">Stubborn habits</h3>
                  <ul className="space-y-1 text-ink">
                    {report.stubborn_habits.map((s, i) => <li key={i} className="flex gap-2"><span className="text-ink2">•</span>{s}</li>)}
                  </ul>
                </div>
                <div className="bg-surface2 border border-line rounded-xl px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink2 mb-1">Tomorrow's focus</h3>
                  <p className="text-ink">{report.tomorrow_focus}</p>
                </div>
              </div>
            </div>

            {/* trend over the last 10 sessions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink2 mb-2">
                Progress (last {pastSessions.length} session{pastSessions.length > 1 ? 's' : ''})
              </h3>
              <TrendChart sessions={pastSessions} />
            </div>

            {/* share card */}
            <div className="flex flex-col items-center gap-3 pt-2 border-t border-line">
              {shareUrl && (
                <img src={shareUrl} alt="Shareable progress card" className="rounded-xl max-w-full sm:max-w-md border border-line" />
              )}
              <div className="flex gap-3">
                <button
                  onClick={share}
                  className="btn btn-primary min-h-11 px-5 rounded-xl text-sm"
                >
                  <ShareIcon size={14} /> Progress card
                </button>
                {shareUrl && (
                  <a
                    href={shareUrl}
                    download="french-progress.png"
                    className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm"
                  >
                    <DownloadIcon size={14} /> Download
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
