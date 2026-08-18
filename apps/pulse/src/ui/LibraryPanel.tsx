/**
 * The personal causal hypothesis library view.
 *
 * The one place in Pulse that belongs to the user's own beliefs rather than
 * to the engine's findings: what they think changes what, with the evidence
 * (findings and experiment verdicts) filed under each belief and a standing
 * that follows that evidence. The engine proposes; the user disposes.
 */

import { useMemo, useState } from "react";
import type { Pulse } from "../pulse.js";
import type { Finding } from "../discovery/finding.js";
import type { CausalDirection, CausalLibraryEntry, CausalStanding } from "../hypotheses/library.js";

const STANDINGS: CausalStanding[] = [
  "untested",
  "plausible",
  "strengthening",
  "confirmed",
  "refuted",
  "retired",
];

interface LibraryPanelProps {
  pulse: Pulse;
  findings: readonly Finding[];
  revision: number;
  onChange: () => void;
}

export function LibraryPanel({ pulse, findings, revision, onChange }: LibraryPanelProps): React.JSX.Element {
  // `revision` is how this view learns the engine changed, as elsewhere.
  /* eslint-disable react-hooks/exhaustive-deps */
  const entries = useMemo(() => pulse.causalLibrary.list(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const promotedIds = useMemo(
    () => new Set(entries.flatMap((entry) => entry.evidence.map((evidence) => evidence.id))),
    [entries],
  );
  const promotable = findings.filter((finding) => !promotedIds.has(finding.id));

  const [statement, setStatement] = useState("");
  const [cause, setCause] = useState("");
  const [effect, setEffect] = useState("");
  const [direction, setDirection] = useState<CausalDirection>("increase");
  const [notes, setNotes] = useState("");

  const addBelief = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!statement.trim() || !cause.trim() || !effect.trim()) return;
    pulse.causalLibrary.add({
      statement: statement.trim(),
      cause: cause.trim(),
      effect: effect.trim(),
      direction,
      notes: notes.trim(),
    });
    onChange();
    setStatement("");
    setCause("");
    setEffect("");
    setNotes("");
  };

  return (
    <section role="tabpanel" id="panel-library" aria-labelledby="tab-library" tabIndex={-1}>
      <h2>Personal causal hypothesis library</h2>
      <p className="muted">
        Beliefs you hold about what changes what, with the evidence — findings and experiment
        verdicts — filed under each one. Standing follows the evidence (untested → plausible →
        strengthening → confirmed or refuted); you can override it, and only &ldquo;retired&rdquo;
        is sticky.
      </p>

      <div className="card">
        <h3>Add a belief</h3>
        <form onSubmit={addBelief}>
          <p>
            <label htmlFor="lib-statement">Statement</label>
            <input
              id="lib-statement"
              type="text"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="Coffee after 2pm keeps me up."
            />
          </p>
          <p>
            <label htmlFor="lib-cause">Cause</label>
            <input
              id="lib-cause"
              type="text"
              value={cause}
              onChange={(event) => setCause(event.target.value)}
              placeholder="afternoon coffee"
            />
          </p>
          <p>
            <label htmlFor="lib-effect">Effect</label>
            <input
              id="lib-effect"
              type="text"
              value={effect}
              onChange={(event) => setEffect(event.target.value)}
              placeholder="sleep"
            />
          </p>
          <p>
            <label htmlFor="lib-direction">Direction</label>
            <select
              id="lib-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as CausalDirection)}
            >
              <option value="increase">increase</option>
              <option value="decrease">decrease</option>
            </select>
          </p>
          <p>
            <label htmlFor="lib-notes">Notes</label>
            <input id="lib-notes" type="text" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </p>
          <div className="actions">
            <button type="submit">Save belief</button>
          </div>
        </form>
      </div>

      {entries.length === 0 ? (
        <p className="empty">
          Your library is empty. Add a belief you want to test, or promote an insight below.
        </p>
      ) : (
        entries.map((entry) => (
          <LibraryEntryCard key={entry.id} entry={entry} pulse={pulse} onChange={onChange} />
        ))
      )}

      <h3>From your findings</h3>
      <p className="muted">
        Insights Pulse has found that you can start tracking as a belief. Promoting one files the
        finding as its first evidence.
      </p>
      {promotable.length === 0 ? (
        <p className="empty">Every current finding is already in your library.</p>
      ) : (
        <ul className="library-promotable">
          {promotable.map((finding) => (
            <li key={finding.id} className="card">
              <span>{finding.title}</span>
              <button
                type="button"
                onClick={() => {
                  pulse.promoteFindingToLibrary(finding);
                  onChange();
                }}
              >
                Add to library
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LibraryEntryCard({
  entry,
  pulse,
  onChange,
}: {
  entry: CausalLibraryEntry;
  pulse: Pulse;
  onChange: () => void;
}): React.JSX.Element {
  return (
    <article className="card library-entry">
      <h3>{entry.statement}</h3>
      <p>
        <span className={`standing standing--${entry.standing}`}>{entry.standing}</span>{" "}
        <span className="muted">{entry.standingNote}</span>
      </p>
      <p className="muted">
        {entry.cause} → {entry.effect} ({entry.direction})
      </p>
      {entry.notes ? <p className="muted">{entry.notes}</p> : null}
      {entry.evidence.length > 0 ? (
        <ul className="library-evidence">
          {entry.evidence.map((evidence) => (
            <li key={evidence.id}>
              <strong>{evidence.kind === "experiment" ? "Experiment" : "Finding"}</strong>{" "}
              <span className={evidence.supports === null ? "muted" : evidence.supports ? "ok" : "warn"}>
                {evidence.supports === null ? "inconclusive" : evidence.supports ? "supports" : "contradicts"}
              </span>{" "}
              {evidence.title}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.standingHistory.length > 0 ? (
        <details>
          <summary>Standing history ({entry.standingHistory.length})</summary>
          <ul className="history-episodes">
            {entry.standingHistory.map((change, index) => (
              <li key={`${change.at}-${index}`}>
                <time>{change.at.slice(0, 10)}</time>
                <span>{change.standing}</span>
                <span className="muted">{change.note}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="actions">
        <StandingControl entry={entry} pulse={pulse} onChange={onChange} />
        <button
          type="button"
          onClick={() => {
            pulse.causalLibrary.remove(entry.id);
            onChange();
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function StandingControl({
  entry,
  pulse,
  onChange,
}: {
  entry: CausalLibraryEntry;
  pulse: Pulse;
  onChange: () => void;
}): React.JSX.Element {
  const [value, setValue] = useState<CausalStanding>(entry.standing);
  return (
    <span className="standing-control">
      <label htmlFor={`standing-${entry.id}`}>Standing</label>
      <select id={`standing-${entry.id}`} value={value} onChange={(event) => setValue(event.target.value as CausalStanding)}>
        {STANDINGS.map((standing) => (
          <option key={standing} value={standing}>
            {standing}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          pulse.causalLibrary.setStanding(entry.id, value, `You marked this belief ${value}`);
          onChange();
        }}
      >
        Update standing
      </button>
    </span>
  );
}
