/**
 * Browser entry point.
 *
 * Boots against the synthetic benchmark user so the app is explorable with no
 * accounts, no network and no real personal data. Real connectors are wired in
 * exactly the same way — `createSyntheticPulse` differs only in which reader
 * each connector is given.
 *
 * The order below is deliberate: the fallback that ships in index.html must be
 * on screen before the engine takes the main thread, and a failure must reach
 * the page rather than only the console. See `boot.ts`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { afterPaint, renderBootFailure } from "./boot.js";
import { createSyntheticPulse } from "../synthetic/harness.js";
import { addDays, localDayEnd } from "../events/time.js";
import { createEncryptedBlobAdapter, createLocalStorageBlobStorage } from "../privacy/encryption.js";
import type { InsightHistorySnapshot } from "../history/insight-history.js";
import "./styles.css";

function rootElement(): Element {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing #root element");
  return container;
}

async function boot(): Promise<void> {
  const container = rootElement();

  // Hand the browser a frame to paint the fallback. Generating and scanning
  // 180 days blocks everything that follows, so without this yield the reader
  // waits on a blank page for the whole boot.
  await afterPaint();

  // The demo carries synthetic data only, so the at-rest key is a fixed demo
  // passphrase — a real deployment would prompt for one, as with the event
  // store. Encryption at rest is still exercised: what reaches localStorage
  // is ciphertext, never the snapshots.
  const historyAdapter = createEncryptedBlobAdapter<InsightHistorySnapshot>(
    createLocalStorageBlobStorage("pulse.insight-history"),
    "pulse-demo-synthetic-only",
  );
  const { pulse, user } = await createSyntheticPulse({ days: 180, historyAdapter });

  // Restore the persisted insight history before the scans below run, so a
  // reload replays them against what is already recorded rather than growing
  // the history with duplicates.
  await pulse.load();

  // Reconstruct the insight history as the data accumulated, so the history
  // view shows the journey — insights appearing, strengthening and fading —
  // rather than a single point-in-time photograph.
  const timezone = user.timezone;
  const throughDay = (dayIndex: number): string =>
    new Date(localDayEnd(addDays(user.startDate, dayIndex), timezone)).toISOString();
  pulse.discover({ through: throughDay(59) });
  pulse.discover({ through: throughDay(119) });
  pulse.discover();

  createRoot(container).render(
    <StrictMode>
      <App pulse={pulse} />
    </StrictMode>,
  );
}

void boot().catch((error: unknown) => {
  console.error("Pulse failed to start", error);
  const container = document.getElementById("root");
  if (container) renderBootFailure(container, error);
});
