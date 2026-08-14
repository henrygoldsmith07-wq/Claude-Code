/**
 * Browser entry point.
 *
 * Boots against the synthetic benchmark user so the app is explorable with no
 * accounts, no network and no real personal data. Real connectors are wired in
 * exactly the same way — `createSyntheticPulse` differs only in which reader
 * each connector is given.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { createSyntheticPulse } from "../synthetic/harness.js";
import "./styles.css";

async function boot(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing #root element");

  const { pulse } = await createSyntheticPulse({ days: 180 });
  pulse.discover();

  createRoot(container).render(
    <StrictMode>
      <App pulse={pulse} />
    </StrictMode>,
  );
}

void boot();
