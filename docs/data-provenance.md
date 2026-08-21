# Data Provenance Standard

For any product that derives recommendations, insights, or scores from external or historical data.

---

## 1. Required concepts

Every derived insight must be traceable through:

| Field | Meaning | Example |
|-------|---------|---------|
| **source** | Where the data came from (system + table/URL) | `supabase:review_logs`, `Forq:pantry/localStorage`, `user notes text` |
| **timestamp** | When the source was captured or last updated | `2026-08-19T14:20:00Z` (ISO 8601) |
| **freshness** | How stale the source was at derivation time | `fresh: 2h`, `stale: 14d`, `realtime` |
| **transformation** | What was done to turn source into the displayed value | `deduplicated, FSRS v5, normalised 0–1` |
| **confidence** | Algorithm's or model's self-assessed confidence | `0.72` (0..1), or a labelled band with thresholds |
| **algorithm / version** | Which code or prompt produced it | `recommender@3.1.2`, `rapport:coach-explain v4` |

These six slots are the **provenance record**. If an app cannot fill one, it must say so in the UI rather than omit the slot silently.

---

## 2. Types

Canonical TypeScript (copy from `packages/observability/index.ts`):

```ts
interface DataProvenance {
  source: string;
  timestamp: string;          // ISO 8601
  freshness: string;          // e.g. "2h", "stale: 14d"
  transformation: string;
  confidence: number;         // 0..1
  algorithmVersion: string;
}
```

For richer evidence (statistics, confounders, replication), reuse the full structures that already exist:

- **Pulse**: `apps/pulse/src/discovery/finding.ts` — `Finding` carries sources, sample size, effect, confidence, confounders, causality note, evidence refs, replication status.
- **Rapport**: `apps/rapport/src/domain/evidence.ts` — `BehaviourEvidenceProfile` keeps evidence channels separate (`simulator`, `self-reported-mission`, `human-rated`, `validated-transfer`) with amount-of-evidence, confidence, uncertainty.

Reuse those rather than inventing a new flat object when the product has multiple evidence channels.

---

## 3. Display rules

- Every recommendation that is not a literal fact from the user's own input must show or link to its provenance — including why ("4 mistakes in this topic in 14 days"), which algorithm produced it, and its confidence.
- When `source` is a model, state the model and prompt version. The AI envelope already carries this.
- When data is stale (`freshness: stale`), surface it in words. Do not hide staleness behind a number.

---

## 4. Adoption

| App | Current state |
|-----|---------------|
| **Pulse** | Reference implementation. Provenance is structural; `validateFinding` rejects incomplete findings. |
| **Rapport** | Strong. Evidence ledger separates channels and reports uncertainty; adopt `DataProvenance` for coach explanations. |
| **Revise** | Partial. Envelope gives provider per task; recommender actions should attach a full provenance record. |
| **Forq / Habit / Arise / French / Noticed** | Light. Local-first logs — provenance is "your own log on this device, last written <timestamp>". No further ceremony until the app generates recommendations. |
| **Daily Debate / Reflect** | Model-grounded content cites homepage-only sources and structured traces; extend to full six-slot records for shared topics and longitudinal calibration. |
