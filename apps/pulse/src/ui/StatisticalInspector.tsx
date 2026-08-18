import type { DiscoveryReport } from "../discovery/engine.js";
import {
  createDefaultStatisticalInspectorOptions,
  normaliseStatisticalInspectorOptions,
  sameStatisticalInspectorOptions,
  type StatisticalInspectorOptions,
} from "../statistics/inspector.js";

const FDR_LEVELS = [
  { value: 0.01, label: "1% — strict" },
  { value: 0.05, label: "5% — default" },
  { value: 0.1, label: "10% — exploratory" },
];

const EXPOSURE_WINDOWS = [1, 4, 12, 24, 72];
const MAX_LAG_DAYS = [0, 1, 2, 4, 7, 14];

export interface StatisticalInspectorProps {
  discovery: DiscoveryReport;
  options: StatisticalInspectorOptions;
  onOptionsChange: (options: StatisticalInspectorOptions) => void;
}

export function StatisticalInspector({ discovery, options, onOptionsChange }: StatisticalInspectorProps): React.JSX.Element {
  const defaults = createDefaultStatisticalInspectorOptions();
  const update = (patch: Partial<StatisticalInspectorOptions>): void => {
    onOptionsChange(normaliseStatisticalInspectorOptions({ ...options, ...patch }));
  };

  const toggleExposureWindow = (windowHours: number): void => {
    const selected = options.exposureWindowsHours.includes(windowHours);
    if (selected && options.exposureWindowsHours.length === 1) return;
    update({
      exposureWindowsHours: selected
        ? options.exposureWindowsHours.filter((value) => value !== windowHours)
        : [...options.exposureWindowsHours, windowHours],
    });
  };

  return (
    <details className="statistical-inspector">
      <summary>User-controlled advanced statistical inspector</summary>
      <p className="statistical-inspector__intro">
        Re-run Pulse&apos;s predefined questions with different reporting thresholds. Measurements never change, and
        preview scans are not added to confidence history.
      </p>

      <div className="statistical-inspector__controls">
        <label className="statistical-inspector__field" htmlFor="inspector-fdr">
          <span>False discovery rate</span>
          <select
            id="inspector-fdr"
            value={options.fdrLevel}
            onChange={(event) => update({ fdrLevel: Number(event.target.value) })}
          >
            {FDR_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>

        <label className="statistical-inspector__field" htmlFor="inspector-min-effect">
          <span>
            Minimum meaningful effect <output aria-live="polite">{options.minEffect.toFixed(2)} SD</output>
          </span>
          <input
            id="inspector-min-effect"
            type="range"
            min="0.05"
            max="1.5"
            step="0.05"
            value={options.minEffect}
            onChange={(event) => update({ minEffect: Number(event.target.value) })}
          />
        </label>

        <label className="statistical-inspector__field" htmlFor="inspector-max-lag">
          <span>Maximum daily lag</span>
          <select
            id="inspector-max-lag"
            value={options.maxLagDays}
            onChange={(event) => update({ maxLagDays: Number(event.target.value) })}
          >
            {MAX_LAG_DAYS.map((days) => (
              <option key={days} value={days}>
                {days === 0 ? "Same day only" : `${days} day${days === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="statistical-inspector__windows">
        <legend>Exposure windows to test</legend>
        <div>
          {EXPOSURE_WINDOWS.map((windowHours) => {
            const checked = options.exposureWindowsHours.includes(windowHours);
            return (
              <label key={windowHours}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && options.exposureWindowsHours.length === 1}
                  onChange={() => toggleExposureWindow(windowHours)}
                />
                {windowHours < 24 ? `${windowHours} hour${windowHours === 1 ? "" : "s"}` : `${windowHours / 24} day${windowHours === 24 ? "" : "s"}`}
              </label>
            );
          })}
        </div>
      </fieldset>

      <dl className="statistical-inspector__results" aria-label="Current statistical inspection">
        <div>
          <dt>Findings shown</dt>
          <dd>{discovery.findings.length}</dd>
        </div>
        <div>
          <dt>Questions tested</dt>
          <dd>{discovery.candidatesEvaluated} of {discovery.candidatesGenerated}</dd>
        </div>
        <div>
          <dt>Correction families</dt>
          <dd>{discovery.familyCount} · largest {discovery.largestFamilySize}</dd>
        </div>
        <div>
          <dt>Expected false discoveries</dt>
          <dd>{discovery.expectedFalseDiscoveries.toFixed(1)}</dd>
        </div>
      </dl>

      <div className="statistical-inspector__footer">
        <p className="muted" role="status">
          Showing a {Math.round(options.fdrLevel * 100)}% FDR and {options.minEffect.toFixed(2)} SD effect floor.
        </p>
        <button type="button" onClick={() => onOptionsChange(defaults)} disabled={sameStatisticalInspectorOptions(options, defaults)}>
          Reset defaults
        </button>
      </div>
    </details>
  );
}
