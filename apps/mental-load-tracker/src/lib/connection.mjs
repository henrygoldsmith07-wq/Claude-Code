/**
 * Pure connection-reliability primitives for Noticed's realtime board.
 *
 * Kept free of I/O so `node --test` can exercise sleep/wake, dropped
 * websocket, duplicate-event, and convergence behaviour directly.
 */

const RESUBSCRIBE_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

/** Should a Realtime subscription status trigger a re-subscribe attempt? */
export function shouldResubscribe(status) {
  return RESUBSCRIBE_STATUSES.has(status);
}

/** Exponential backoff with full jitter, capped. */
export function nextBackoffMs(attempt, baseMs = 1_000, capMs = 30_000) {
  const boundedAttempt = Math.max(0, Math.floor(attempt));
  const exponential = Math.min(capMs, baseMs * 2 ** boundedAttempt);
  return Math.floor(Math.random() * exponential);
}

/**
 * Writes that failed for transient reasons stay queued for a retry; writes
 * rejected by validation or permissions are surfaced immediately instead.
 */
export function isRetryableWriteError(message) {
  const text = String(message ?? "").toLowerCase();
  return (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("failed to") ||
    /\b5\d{2}\b/.test(text)
  );
}

/**
 * Merge authoritative server rows with locally-pending optimistic creates.
 *
 * - Pending rows whose nonce the server already confirmed are dropped
 *   (the authoritative copy wins).
 * - Remaining pending rows render below the newest server row so the user
 *   always sees their unsaved capture.
 * - Output is deterministically ordered newest-first, so delayed, duplicated,
 *   or out-of-order events all converge to the same list.
 */
export function convergeItems(serverItems, pendingWrites, confirmedNonces = new Set()) {
  const serverRows = Array.isArray(serverItems) ? serverItems : [];
  const pending = Array.isArray(pendingWrites) ? pendingWrites : [];

  const livePending = pending.filter(
    (entry) => entry && !confirmedNonces.has(entry.nonce),
  );

  const merged = [
    ...serverRows,
    ...livePending.map((entry) => ({
      id: `pending:${entry.nonce}`,
      household_id: null,
      text: entry.text,
      noticed_by: entry.noticedBy,
      noticed_by_color: entry.color,
      created_by: null,
      created_at: entry.createdAt,
      resolved: false,
      resolved_by: null,
      resolved_by_user_id: null,
      resolved_at: null,
      pending: true,
    })),
  ];

  return merged.sort((a, b) => {
    const at = new Date(a.created_at).getTime();
    const bt = new Date(b.created_at).getTime();
    return bt - at;
  });
}

/**
 * Collapse duplicate, delayed, or out-of-order realtime events into at most
 * one refresh per coalescing window. Returns true when a refresh should run
 * for this event given what was already seen inside the window.
 */
export function createEventCoalescer(windowMs = 500) {
  let lastRefreshAt = 0;
  return function shouldRefresh(now = Date.now()) {
    if (now - lastRefreshAt >= windowMs) {
      lastRefreshAt = now;
      return true;
    }
    return false;
  };
}

/** A monotonic sequence detector for spotting out-of-order deliveries. */
export function createSequenceTracker() {
  let highestSeen = -1;
  return function classify(sequence) {
    if (sequence > highestSeen) {
      highestSeen = sequence;
      return "in-order";
    }
    return sequence === highestSeen ? "duplicate" : "out-of-order";
  };
}
