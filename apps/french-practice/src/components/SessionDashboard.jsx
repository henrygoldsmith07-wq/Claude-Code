import { useEffect, useState } from 'react';
import { Modal, Spinner } from './ui';
import { ProgressRing, RadarChart, TrendChart, renderShareCard } from './charts';
import { sessionReport } from '../lib/groq';
import { saveSession, getSessions, getStreak } from '../lib/storage';

// "Terminer la Session" overlay: report card + rings + radar + trends + share.

const RADAR_AXES = ['Grammaire', 'Fluidité', 'Vocabulaire', 'Prononciation', 'Rapidité'];

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
        const file = new File([blob], 'progres-francais.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <Modal open={open} onClose={close} wide>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Bilan de session 📋</h2>
            <p className="text-xs text-slate-400 mt-0.5">{scenario.title} · {history.length} tour{history.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={close} aria-label="Fermer" className="w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-800">✕</button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">{error}</p>
        )}
        {!report && !error && (
          <div className="py-16 text-center"><Spinner label="Votre professeur rédige le bilan…" /></div>
        )}

        {report && (
          <div className="space-y-6 fade-in">
            {/* grade + streak + rings */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className="text-6xl font-black text-emerald-400">{report.session_grade}</div>
                <div className="text-[11px] text-slate-500 mt-1">Note globale</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-amber-400">{streak.count}🔥</div>
                <div className="text-[11px] text-slate-500 mt-1">Jours d'affilée</div>
              </div>
              <div className="flex flex-wrap gap-3 ml-auto">
                <ProgressRing value={report.average_scores.overall} label="Global" />
                <ProgressRing value={report.average_scores.grammar} label="Grammaire" size={70} />
                <ProgressRing value={report.average_scores.fluency} label="Fluidité" size={70} />
              </div>
            </div>

            {/* radar + written feedback */}
            <div className="grid sm:grid-cols-2 gap-6 items-center">
              <div className="flex justify-center">
                <RadarChart axes={RADAR_AXES} values={radarValues(report.average_scores, history)} />
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">💪 Points forts</h3>
                  <ul className="space-y-1 text-slate-200">
                    {report.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1.5">🔁 Habitudes tenaces</h3>
                  <ul className="space-y-1 text-slate-200">
                    {report.stubborn_habits.map((s, i) => <li key={i} className="flex gap-2"><span className="text-rose-500">•</span>{s}</li>)}
                  </ul>
                </div>
                <div className="bg-teal-500/10 border border-teal-500/25 rounded-xl px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 mb-1">🎯 Focus de demain</h3>
                  <p className="text-slate-100">{report.tomorrow_focus}</p>
                </div>
              </div>
            </div>

            {/* trend over the last 10 sessions */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Progression ({pastSessions.length} dernière{pastSessions.length > 1 ? 's' : ''} session{pastSessions.length > 1 ? 's' : ''})
              </h3>
              <TrendChart sessions={pastSessions} />
            </div>

            {/* share card */}
            <div className="flex flex-col items-center gap-3 pt-2 border-t border-slate-800">
              {shareUrl && (
                <img src={shareUrl} alt="Carte de progrès partageable" className="rounded-xl max-w-full sm:max-w-md border border-slate-700" />
              )}
              <div className="flex gap-3">
                <button
                  onClick={share}
                  className="min-h-11 px-5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400 active:scale-95 transition"
                >
                  📤 Carte de progrès
                </button>
                {shareUrl && (
                  <a
                    href={shareUrl}
                    download="progres-francais.png"
                    className="min-h-11 px-5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold grid place-items-center hover:bg-slate-700"
                  >
                    ⬇ Télécharger
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
