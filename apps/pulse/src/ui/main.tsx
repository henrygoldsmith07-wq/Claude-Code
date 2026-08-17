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
import type { Pulse } from "../pulse.js";
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

  const { pulse } = await createSyntheticPulse({ days: 180 });
  pulse.discover();
  pulse.proposeHypotheses();
  seedDemoClaims(pulse);

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

/**
 * Demo-only authored beliefs, seeded against the benchmark user's findings.
 *
 * They show two honest states the derived graph cannot: a belief that
 * overreaches its evidence (causal wording backed only by a correlation) and a
 * belief with no evidence at all. Both are authored rather than computed, and
 * the UI labels them as such.
 */
function seedDemoClaims(pulse: Pulse): void {
  const findings = pulse.findings();
  const training = findings.find(
    (finding) => finding.tags.includes("exposure-window") && finding.sources.includes("arise"),
  );

  if (training) {
    pulse.recordClaim({
      statement: "Training sharpens my study accuracy.",
      supportBy: [training.id],
      tags: ["authored"],
    });
    // The same belief stated causally: the engine must refuse to endorse it,
    // because a correlation is not an experiment.
    pulse.recordClaim({
      statement: "Training leads to more accurate study sessions.",
      supportBy: [training.id],
      tags: ["authored"],
    });
  }
  pulse.recordClaim({
    statement: "I retain vocabulary better at weekends.",
    tags: ["authored"],
  });
}
