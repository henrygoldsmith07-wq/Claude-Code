import { useMemo, useState } from "react";
import type { Pulse } from "../pulse.js";
import {
  DEFAULT_STATISTICAL_INSPECTOR_OPTIONS,
  type InspectorCheck,
  type MultipleTestingMethod,
  type StatisticalInspection,
  type StatisticalInspectorOptions,
} from "../statistics/index.js";

export interface StatisticalInspectorProps {
  pulse: Pulse;
  revision: number;
}

interface InspectorDraft {
  outcomeMetricId: string;
  exposureMetricId: string;
  negativeControlMetricId: string;
  alpha: number;
  correction: MultipleTestingMethod;
  autocorrelationLag: number;
  maxLagDays: number;
  holdoutFraction: number;
  outlierCutoff: number;
  reliabilityWeighting: boolean;
  excludeUncertainTimestamps: boolean;
  adjustForWeekday: boolean;
  adjustForTrend: boolean;
  adjustForSeason: boolean;
}

export function StatisticalInspector({ pulse, revision }: StatisticalInspectorProps): React.JSX.Element {
  // Pulse is an external mutable engine; revision deliberately invalidates these memos.
  /* eslint-disable react-hooks/exhaustive-deps */
  const available = useMemo(() => pulse.registry.available(pulse.events()), [pulse, revision]);
  const initial = useMemo(() => initialDraft(pulse, available), [pulse, available]);
  const [draft, setDraft] = useState<InspectorDraft>(initial);
  const [applied, setApplied] = useState<InspectorDraft>(initial);

  const report = useMemo(() => {
    if (!applied.outcomeMetricId) return null;
    return pulse.inspectStatistics(toOptions(applied));
  }, [applied, pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const outcomeOptions = available.filter((definition) => definition.role === "outcome");
  const exposureOptions = available.filter((definition) => definition.id !== draft.outcomeMetricId);
  const negativeControlOptions = available.filter(
    (definition) => definition.id !== draft.outcomeMetricId && definition.id !== draft.exposureMetricId,
  );

  return (
    <section role="tabpanel" id="panel-inspector" aria-labelledby="tab-inspector" tabIndex={-1}>
      <p className="eyebrow">User-controlled analysis</p>
      <h2>User-controlled advanced statistical inspector</h2>
      <p className="muted">
        Re-run the safeguards on a metric pair from your local data. This is a diagnostic view: it never edits findings,
        promotes a correlation to a claim, or sends data anywhere.
      </p>

      <form
        className="inspector__controls card"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...draft });
        }}
      >
        <fieldset>
          <legend>Choose what to inspect</legend>
          <div className="inspector__control-grid">
            <label className="inspector__control" htmlFor="inspector-outcome">
              Outcome metric
              <select
                id="inspector-outcome"
                value={draft.outcomeMetricId}
                onChange={(event) => setDraft((current) => ({ ...current, outcomeMetricId: event.target.value }))}
              >
                {outcomeOptions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inspector__control" htmlFor="inspector-exposure">
              Exposure metric
              <select
                id="inspector-exposure"
                value={draft.exposureMetricId}
                onChange={(event) => setDraft((current) => ({ ...current, exposureMetricId: event.target.value }))}
              >
                <option value="">None — inspect the outcome series only</option>
                {exposureOptions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inspector__control" htmlFor="inspector-negative-control">
              Negative-control metric
              <select
                id="inspector-negative-control"
                value={draft.negativeControlMetricId}
                onChange={(event) => setDraft((current) => ({ ...current, negativeControlMetricId: event.target.value }))}
              >
                <option value="">None selected</option>
                {negativeControlOptions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
              <span className="muted">Choose a metric that should not track the exposure if the relationship is specific.</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Statistical policy</legend>
          <div className="inspector__control-grid">
            <label className="inspector__control" htmlFor="inspector-correction">
              Multiple-testing method
              <select
                id="inspector-correction"
                value={draft.correction}
                onChange={(event) => setDraft((current) => ({ ...current, correction: event.target.value as MultipleTestingMethod }))}
              >
                <option value="benjamini-hochberg">Benjamini–Hochberg (exploratory)</option>
                <option value="holm">Holm (confirmatory)</option>
                <option value="bonferroni">Bonferroni (strict)</option>
              </select>
            </label>
            <label className="inspector__control" htmlFor="inspector-alpha">
              Significance level (α)
              <input
                id="inspector-alpha"
                type="number"
                min="0.001"
                max="0.2"
                step="0.01"
                value={draft.alpha}
                onChange={(event) => setDraft((current) => ({ ...current, alpha: Number(event.target.value) }))}
              />
            </label>
            <label className="inspector__control" htmlFor="inspector-autocorrelation-lag">
              Autocorrelation lags
              <input
                id="inspector-autocorrelation-lag"
                type="number"
                min="1"
                max="30"
                step="1"
                value={draft.autocorrelationLag}
                onChange={(event) => setDraft((current) => ({ ...current, autocorrelationLag: Number(event.target.value) }))}
              />
            </label>
            <label className="inspector__control" htmlFor="inspector-outlier-cutoff">
              Outlier cutoff (MAD)
              <input
                id="inspector-outlier-cutoff"
                type="number"
                min="2"
                max="6"
                step="0.5"
                value={draft.outlierCutoff}
                onChange={(event) => setDraft((current) => ({ ...current, outlierCutoff: Number(event.target.value) }))}
              />
            </label>
            <label className="inspector__control" htmlFor="inspector-max-lag">
              Maximum forward lag (days)
              <input
                id="inspector-max-lag"
                type="number"
                min="0"
                max="14"
                step="1"
                value={draft.maxLagDays}
                onChange={(event) => setDraft((current) => ({ ...current, maxLagDays: Number(event.target.value) }))}
              />
              <span className="muted">Positive lag means the exposure precedes the outcome; every tested lag joins the correction family.</span>
            </label>
            <label className="inspector__control" htmlFor="inspector-holdout-fraction">
              Holdout fraction <output htmlFor="inspector-holdout-fraction">{Math.round(draft.holdoutFraction * 100)}%</output>
              <input
                id="inspector-holdout-fraction"
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={draft.holdoutFraction}
                onChange={(event) => setDraft((current) => ({ ...current, holdoutFraction: Number(event.target.value) }))}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Safeguards to apply</legend>
          <div className="inspector__checks">
            <label>
              <input
                type="checkbox"
                checked={draft.reliabilityWeighting}
                onChange={(event) => setDraft((current) => ({ ...current, reliabilityWeighting: event.target.checked }))}
              />
              Reliability-weight evidence
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.excludeUncertainTimestamps}
                onChange={(event) => setDraft((current) => ({ ...current, excludeUncertainTimestamps: event.target.checked }))}
              />
              Exclude uncertain timestamps
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.adjustForWeekday}
                onChange={(event) => setDraft((current) => ({ ...current, adjustForWeekday: event.target.checked }))}
              />
              Adjust for weekday/weekend
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.adjustForTrend}
                onChange={(event) => setDraft((current) => ({ ...current, adjustForTrend: event.target.checked }))}
              />
              Adjust for calendar trend
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.adjustForSeason}
                onChange={(event) => setDraft((current) => ({ ...current, adjustForSeason: event.target.checked }))}
              />
              Adjust for seasonal cycle
            </label>
          </div>
        </fieldset>

        <div className="actions">
          <button type="submit">Run inspection</button>
          {!sameDraft(draft, applied) ? <span className="muted">Changes are ready but not applied.</span> : null}
        </div>
      </form>

      {!report ? (
        <p className="empty">There are not enough declared metrics in the current data to start an inspection.</p>
      ) : (
        <InspectorReport report={report} />
      )}
    </section>
  );
}

function InspectorReport({ report }: { report: StatisticalInspection }): React.JSX.Element {
  const correlation = report.primary.spearman ?? report.primary.pearson;
  return (
    <>
      <section className="inspector__summary card" aria-labelledby="inspector-result-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current run</p>
            <h3 id="inspector-result-heading">
              {report.outcome.name}
              {report.exposure ? ` against ${report.exposure.name}` : " series"}
            </h3>
          </div>
          <span className={`status status--${report.sampleGate.sufficient ? "controlled" : "uncontrolled"}`}>
            {report.sampleGate.sufficient ? "sample gate passed" : "sample gate not met"}
          </span>
        </div>
        <dl className="finding__stats">
          <div>
            <dt>Independent paired days</dt>
            <dd>{report.pairedDays}</dd>
          </div>
          <div>
            <dt>Date range</dt>
            <dd>{report.dateRange ? `${report.dateRange.from} to ${report.dateRange.to}` : "—"}</dd>
          </div>
          <div>
            <dt>Spearman association</dt>
            <dd>{correlation ? `${format(correlation.r)} · p ${format(correlation.pValue, 3)}` : "Not estimable"}</dd>
          </div>
          <div>
            <dt>Corrected p-value</dt>
            <dd>{Number.isFinite(report.correction.adjustedP) ? format(report.correction.adjustedP, 3) : "—"}</dd>
          </div>
          <div>
            <dt>Correction family</dt>
            <dd>{correctionLabel(report.correction.method)} · {report.correction.familySize} tests</dd>
          </div>
          <div>
            <dt>95% interval</dt>
            <dd>{correlation ? `${format(correlation.ci.low)} to ${format(correlation.ci.high)}` : "—"}</dd>
          </div>
        </dl>
        <p className="finding__caveat" role="note">
          This is a diagnostic association, not a causal claim. The selected controls change what is shown here, not what
          Pulse believes.
        </p>
      </section>

      <section aria-labelledby="inspector-checks-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Safeguard ledger</p>
            <h3 id="inspector-checks-heading">What the controls found</h3>
          </div>
          <span className="muted">{report.checks.filter((check) => check.status === "pass").length} checks passed</span>
        </div>
        <ul className="inspector__check-list">
          {report.checks.map((check) => (
            <InspectorCheckRow key={check.id} check={check} />
          ))}
        </ul>
      </section>

      {report.exposure ? (
        <section className="card" aria-labelledby="inspector-lag-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Temporal structure</p>
              <h3 id="inspector-lag-heading">Forward lag scan</h3>
            </div>
            <span className="muted">Peak: {report.primary.bestLagDays === null ? "not estimable" : `${report.primary.bestLagDays} day(s)`}</span>
          </div>
          <p className="muted">
            Positive lags test whether the exposure comes before the outcome. Precedence is informative, but it does not establish causation.
          </p>
          {report.primary.lags.length ? (
            <table>
              <caption className="visually-hidden">Multiple-testing-adjusted forward lag results</caption>
              <thead>
                <tr>
                  <th scope="col">Lag</th>
                  <th scope="col">Paired days</th>
                  <th scope="col">Spearman r</th>
                  <th scope="col">Raw p</th>
                  <th scope="col">Adjusted p</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {report.primary.lags.map((lag) => (
                  <tr key={lag.lagDays}>
                    <th scope="row">{lag.lagDays === 0 ? "Same day" : `+${lag.lagDays} day(s)`}</th>
                    <td>{lag.n}</td>
                    <td>{format(lag.r)}</td>
                    <td>{format(lag.pValue, 3)}</td>
                    <td>{format(lag.adjustedP, 3)}</td>
                    <td>{lag.significant ? "Survives correction" : "Does not survive correction"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">No tested lag has enough paired days.</p>
          )}
        </section>
      ) : null}

      <details className="card inspector__details">
        <summary>Detailed calculations</summary>
        <dl className="finding__stats">
          <div>
            <dt>Pearson r</dt>
            <dd>{report.primary.pearson ? format(report.primary.pearson.r) : "—"}</dd>
          </div>
          <div>
            <dt>Autocorrelation effective n</dt>
            <dd>{report.primary.autocorrelation ? `${format(report.primary.autocorrelation.effectiveSampleSize, 1)} / ${report.primary.autocorrelation.n}` : "—"}</dd>
          </div>
          <div>
            <dt>Standard-error multiplier</dt>
            <dd>{report.primary.autocorrelation ? format(report.primary.autocorrelation.standardErrorMultiplier) : "—"}</dd>
          </div>
          <div>
            <dt>Reliability-weighted n</dt>
            <dd>{report.primary.reliability ? format(report.primary.reliability.effectiveSampleSize, 1) : "Off"}</dd>
          </div>
          <div>
            <dt>Holdout direction</dt>
            <dd>{report.holdout.sameDirection === null ? "Not estimable" : report.holdout.sameDirection ? "Agrees" : "Differs"}</dd>
          </div>
          <div>
            <dt>Negative control</dt>
            <dd>{report.robustness.negativeControl ? `${format(report.robustness.negativeControl.r)} · ${report.robustness.negativeControl.passes ? "passes" : "fails"}` : "Not selected"}</dd>
          </div>
        </dl>
        {report.robustness.confounders.length ? (
          <>
            <h4>Calendar sensitivity</h4>
            <ul>
              {report.robustness.confounders.map((confounder) => (
                <li key={confounder.name}>
                  {confounder.name}: {format(confounder.r)} · {Math.round(confounder.retention * 100)}% effect retained · {confounder.stable ? "stable" : "sensitive"}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {report.robustness.measurementError ? (
          <p>
            Measurement error widened the standard error to {format(report.robustness.measurementError.standardError)} and
            produced a {format(report.robustness.measurementError.reliabilityRatio * 100, 0)}% reliability ratio.
          </p>
        ) : null}
      </details>

      {report.limitations.length ? (
        <section className="card" aria-labelledby="inspector-limitations-heading">
          <h3 id="inspector-limitations-heading">Read before acting</h3>
          <ul>
            {report.limitations.map((limitation) => (
              <li key={limitation} className="warn">{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function InspectorCheckRow({ check }: { check: InspectorCheck }): React.JSX.Element {
  return (
    <li className={`inspector__check inspector__check--${check.status}`}>
      <span className="inspector__check-status">{statusLabel(check.status)}</span>
      <div>
        <strong>{check.label}</strong>
        <span>{check.summary}</span>
        <small>{check.detail}</small>
      </div>
    </li>
  );
}

function initialDraft(pulse: Pulse, available: ReturnType<Pulse["registry"]["available"]>): InspectorDraft {
  const firstFinding = pulse.findings()[0];
  const outcome = firstFinding?.metricIds.find((id) => available.some((definition) => definition.id === id))
    ?? available.find((definition) => definition.role === "outcome")?.id
    ?? available[0]?.id
    ?? "";
  const exposure = firstFinding?.metricIds.find((id) => id !== outcome && available.some((definition) => definition.id === id))
    ?? available.find((definition) => definition.id !== outcome && definition.role === "behaviour")?.id
    ?? available.find((definition) => definition.id !== outcome)?.id
    ?? "";
  const negative = available.find((definition) => definition.id !== outcome && definition.id !== exposure)?.id ?? "";
  return {
    outcomeMetricId: outcome,
    exposureMetricId: exposure,
    negativeControlMetricId: negative,
    alpha: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.alpha,
    correction: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.correction,
    autocorrelationLag: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.autocorrelationLag,
    maxLagDays: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.maxLagDays,
    holdoutFraction: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.holdoutFraction,
    outlierCutoff: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.outlierCutoff,
    reliabilityWeighting: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.reliabilityWeighting,
    excludeUncertainTimestamps: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.excludeUncertainTimestamps,
    adjustForWeekday: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForWeekday,
    adjustForTrend: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForTrend,
    adjustForSeason: DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForSeason,
  };
}

function toOptions(draft: InspectorDraft): StatisticalInspectorOptions {
  return {
    outcomeMetricId: draft.outcomeMetricId,
    exposureMetricId: draft.exposureMetricId || null,
    negativeControlMetricId: draft.negativeControlMetricId || null,
    alpha: draft.alpha,
    correction: draft.correction,
    autocorrelationLag: draft.autocorrelationLag,
    maxLagDays: draft.maxLagDays,
    holdoutFraction: draft.holdoutFraction,
    outlierCutoff: draft.outlierCutoff,
    reliabilityWeighting: draft.reliabilityWeighting,
    excludeUncertainTimestamps: draft.excludeUncertainTimestamps,
    adjustForWeekday: draft.adjustForWeekday,
    adjustForTrend: draft.adjustForTrend,
    adjustForSeason: draft.adjustForSeason,
  };
}

function sameDraft(a: InspectorDraft, b: InspectorDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function correctionLabel(method: MultipleTestingMethod): string {
  switch (method) {
    case "holm":
      return "Holm";
    case "bonferroni":
      return "Bonferroni";
    default:
      return "Benjamini–Hochberg";
  }
}

function statusLabel(status: InspectorCheck["status"]): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "caution":
      return "Caution";
    default:
      return "Not available";
  }
}
