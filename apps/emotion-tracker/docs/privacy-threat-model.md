# Reflect — privacy threat model

Scope: the Reflect app (`apps/emotion-tracker`). Everything here describes the
system as built and tested in `src/lib/privacy.ts`, `crypto.ts`, `pulse.ts`,
`adversarial.ts` and the API route — not aspirations.

## Assets

1. **Reflection content** — events, observations, assumptions, messages. The
   most sensitive data in the system.
2. **Derived interpretations** — patterns, biases, calibration. Sensitive by
   inference even when individually small.
3. **API key** (BYOK) — stored locally; grants paid model access.
4. **Study/event logs** — opt-in only; timestamps and counts, never text.

## Actors

| Actor | Access | Mitigations |
|---|---|---|
| User | Full local access to their own data | Vault encryption; explicit destructive-action confirms; export/delete verification |
| Other users of same device / browser profile | Anything in localStorage without OS-level protection | Optional encrypted vault + "encrypt & clear"; no accounts, nothing server-side |
| Reflect server | Receives only what one request carries | Stateless route: no logging of bodies, generic errors, rate limits; BYOK or operator key |
| AI provider | The current conversation + ≤8 label-only entry hints per request | Data minimisation by construction (`memory.ts` caps; hints carry id/emotion/trigger labels, never verbatim); local-only mode sends nothing |
| Network observer | Traffic in transit | HTTPS everywhere; API key sent per-request over TLS, never persisted server-side |
| Pulse aggregator (opt-in) | CustomEvent snapshot dispatched on the page only when user opted in | Counts-only summary (`pulseSafeSummary`); verbatim-leak tests guard the contract |

## Trust boundaries

- **Import** — untrusted file → `parseImport` sanitises every row (shape,
  sizes, dedupe, cap). Malformed input degrades to warnings, never corruption.
- **Provider output** — untrusted model response → validation layers reject
  unhedged/unsupported/malformed output before it reaches storage.
- **Storage** — quota/blocked-storage guarded writes; corrupt JSON rejected at
  read time.

## Attack scenarios & status

| Scenario | Status |
|---|---|
| Prompt injection via reflection text | Detected (`adversarial.ts`); pure injection blocked at the route (≥0.9 confidence) |
| Sensitive data pasted into a journal (emails/cards/credentials) | Detected locally (`detectSensitiveData`) so the user can redact before sending |
| Verbatim content leaking through aggregates (Pulse/hints) | Blocked and tested (`containsVerbatimEntryText`, `pulseSafeSummary`) |
| Silent data loss on delete/export | Verified post-action (`verifyExport`, `verifyDeletion`) |
| Stale data lingering indefinitely | Opt-in retention windows with explicit confirmed purge (`retention.ts`) |
| Weak passphrase reuse | Strength meter; PBKDF2-SHA-256 120k iterations, per-vault random salt; `verifyPassphrase` before restore |

## Accepted limitations

- localStorage is readable by any code running in the page origin (XSS risk is
  mitigated by React escaping and zero `dangerouslySetInnerHTML`, but not
  eliminable). The vault exists precisely for this reason.
- The server fallback key means anonymous use bills the operator; abuse is
  bounded by rate limits keyed behind `TRUST_PROXY`.
- Lexical privacy audits can miss paraphrased leaks; they are a tripwire, not
  proof.
