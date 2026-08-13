# Privacy

Reflections here contain what someone finds hard about talking to people, what
went wrong last week, and what they wrote about it afterwards. The design
assumption is that this is among the most sensitive data a personal app can
hold, and that the cheapest way to protect it is not to have it.

## What the defaults are

Every one of these is **off** until the user turns it on, and each is separate:

| Setting | Default | What turning it on means |
|---|---|---|
| Sync | off | An encrypted blob is stored on a server. |
| AI may summarise reflections | off | Reflection text is sent to the configured model. |
| Use my data to improve models | off | Nothing in this build ever does this; the switch records the answer. |
| Voice practice | off | The browser transcribes speech locally. No audio is stored or sent. |
| Retention window | keep forever | Free text older than the window is deleted; derived signals stay. |

"AI may summarise reflections" and "use my data to improve models" are two
switches rather than one. Bundling them is the standard dark pattern in this
category, and the second is the one people actually care about.

## Where data lives

Everything is in IndexedDB on the device. There is no account, no telemetry
beacon, no analytics SDK, and no server round-trip on the critical path. The app
is fully functional with the network off.

The server component is a single Next.js route (`/api/ai`) which:

- validates every request server-side with zod, regardless of what the client did;
- **refuses** `summarise-reflection` outright unless the request declares the
  explicit opt-in — a client bug cannot quietly start sending journal text;
- rate-limits per caller using a truncated hash of IP and user agent, so the
  limiter cannot become a record of who used the app when;
- returns a deterministic answer when no provider is configured.

## Encryption

Sync, when enabled, seals the entire export with AES-GCM under a key derived by
PBKDF2-SHA-256 (310,000 iterations) from a passphrase that never leaves the
device. The server stores `{ciphertext, iv, salt}` and a timestamp. It cannot
read a single reflection, skill estimate or goal.

The trade-off is stated in the UI: lose the passphrase and the synced copy is
unrecoverable. There is no reset, because a reset would mean the server could
decrypt. Passphrase strength is checked before sync can be enabled — a weak
passphrase on an encrypted blob is worse than no encryption, because it looks
like protection.

The database migration enforces the shape server-side: a `CHECK` constraint
rejects any payload that is not a sealed envelope, so a client bug cannot write
plaintext. Row-level security grants access only to the row's owner, and there
is no policy permitting any cross-user read — "no public social graph by
default" is a property of the schema, not of the interface.

## Logging

`src/ai/telemetry.ts` records task name, outcome, latency, token counts and
estimated cost. It has no field for user content and no identifier that could be
joined to a person. That is deliberate: an operational log is exactly where
sensitive text tends to leak, and making the record structurally incapable of
holding it is cheaper than auditing it forever.

Provider error messages can echo request content, so only the first 40
characters of the error *shape* are surfaced, never the body.

## Retention and deletion

- **Per-entry deletion** — any reflection can be deleted, along with its derived
  signal.
- **Retention window** — 30 days, 6 months, 1 year, or forever. When it expires,
  the free text is stripped and the entry is kept, so counts, difficulty trends
  and progress history survive without holding years of private writing.
- **Export** — full JSON: the snapshot plus the raw event log, enough to
  reconstruct everything elsewhere.
- **Delete everything** — empties every object store including the event log. It
  is not a soft delete and there are no tombstones. The synced copy is deleted
  separately and explicitly.

## What the product will not do

- No appearance scoring. `checkFeedbackLanguage` blocks it in model output, in
  lessons and in the interface copy, and it is tested.
- No inference of personality, mental health, intelligence, ethnicity or any
  other characteristic from text or from voice. The voice extractor takes only a
  transcript and its timings, so those inferences are not computable from what
  is stored.
- No diagnosis from reflections. Signal extraction maps to a fixed behaviour
  vocabulary and a list of named obstacles; "found no opening" is an obstacle,
  "struggles with confidence" is a diagnosis and is out of scope.
- No leaderboards, no social graph, no comparison to other users. The product's
  premise is that other people's reactions are not the measure.

## Distress

Some free text is a person telling us they are in trouble. That is not a
moderation category. `checkForDistress` stops the training flow, says something
plain, and points to a real service — no reframing as a communication problem,
no exercise suggestion, no cheerfulness. The note stays on the device.

The patterns are written to catch inflected forms, and are tested in both
directions: they must fire on "thinking about ending it all" and must **not**
fire on "end the conversation deliberately". Over-firing is not a safe default —
it would make the app unusable and dilute the response when it matters.
