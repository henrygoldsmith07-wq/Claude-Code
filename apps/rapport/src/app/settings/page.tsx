"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, PageHeader, TextInput, Toggle } from "@/components/ui";
import { useStore } from "@/state/store";
import { sessionMinutesFor } from "@/domain/assessment";
import { cryptoAvailable, passphraseStrength } from "@/data/crypto";
import { readRapportPulseOptIn, setRapportPulseOptIn } from "@/data/pulse-history";
import { currentEmail, isSyncConfigured, push, pull, signInWithEmail, signOut, deleteRemote } from "@/data/sync";
import type { TrainingIntensity } from "@/domain/types";

// ---------------------------------------------------------------------------
// Settings and privacy.
//
// Every permission is off until switched on, each one is separate, and each
// says exactly what turning it on means in terms of where data goes. In
// particular, "may summarise reflections" and "may be used to improve models"
// are two switches, not one — bundling them is the standard dark pattern here
// and the second is the one people actually care about.
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const store = useStore();
  const [passphrase, setPassphrase] = useState("");
  const [email, setEmail] = useState("");
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ provider: { available: boolean; name: string | null }; stats: { calls: number; fallbackRate: number; estimatedCostUsd: number } } | null>(null);
  // Start false and read after mount: localStorage differs between server and
  // client, and reading it during the hydration render would mismatch markup.
  const [pulseShared, setPulseShared] = useState(false);

  useEffect(() => {
    // Shared storage is read-only here and the log stays in IndexedDB either
    // way; reading it after mount is the hydration-safe pattern this file uses
    // for every localStorage-derived flag.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPulseShared(readRapportPulseOptIn());
    void (async () => setSignedInAs(await currentEmail()))();
    void fetch("/api/ai")
      .then((response) => response.json())
      .then(setAiStatus)
      .catch(() => setAiStatus(null));
  }, []);

  const download = async () => {
    const json = await store.exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const strength = passphrase ? passphraseStrength(passphrase) : null;

  return (
    <>
      <PageHeader title="Settings & privacy" subtitle="Everything is off by default. Nothing leaves this device unless you switch it on." />

      <Card as="section">
        <h2 className="text-base font-semibold">Training</h2>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Intensity</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["light", "steady", "focused"] as TrainingIntensity[]).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={store.preference.intensity === value ? "primary" : "secondary"}
                aria-pressed={store.preference.intensity === value}
                onClick={() =>
                  void store.updatePreference({ intensity: value, sessionMinutes: sessionMinutesFor(value) })
                }
              >
                {value} · {sessionMinutesFor(value)} min
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Prompts during practice</legend>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Normally reduced automatically as your evidence builds. Set to none to remove them entirely.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["full", "none"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={store.preference.assistLevel === value ? "primary" : "secondary"}
                aria-pressed={store.preference.assistLevel === value}
                onClick={() => void store.updatePreference({ assistLevel: value })}
              >
                {value === "full" ? "Automatic" : "None"}
              </Button>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card as="section" className="mt-4">
        <h2 className="text-base font-semibold">Appearance &amp; accessibility</h2>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">Theme</legend>
          <div className="mt-2 flex gap-2">
            {(["system", "light", "dark"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={store.preference.theme === value ? "primary" : "secondary"}
                aria-pressed={store.preference.theme === value}
                onClick={() => void store.updatePreference({ theme: value })}
              >
                {value}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
          <Toggle
            id="reduced-motion"
            checked={store.preference.reducedMotion}
            onChange={(value) => void store.updatePreference({ reducedMotion: value })}
            label="Reduce motion"
            description="Removes transitions and animation, independently of your system setting."
          />
          <Toggle
            id="voice"
            checked={store.preference.voiceEnabled}
            onChange={(value) => void store.updatePreference({ voiceEnabled: value })}
            label="Voice practice"
            description="Adds a speak button in practice conversations. Speech is transcribed by your browser; no audio is stored or sent anywhere, and only pace, fillers and pauses are measured."
          />
        </div>
      </Card>

      <Card as="section" className="mt-4">
        <h2 className="text-base font-semibold">Data &amp; permissions</h2>
        <div className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
          <Toggle
            id="ai-reflections"
            checked={store.preference.aiMayReadReflections}
            onChange={(value) => void store.updatePreference({ aiMayReadReflections: value })}
            label="Let a model summarise my written reflections"
            description="Off by default. When off, what you write after a challenge never leaves this device — the summaries are produced locally instead."
          />
          <Toggle
            id="model-training"
            checked={store.preference.allowModelTraining}
            onChange={(value) => void store.updatePreference({ allowModelTraining: value })}
            label="Allow my data to be used to improve models"
            description="Off by default and separate from the setting above. This build never sends data for training regardless; the switch exists so the answer is recorded and honoured if that ever changes."
          />
          <Toggle
            id="pulse"
            checked={pulseShared}
            onChange={(value) => {
              setRapportPulseOptIn(value);
              setPulseShared(value);
            }}
            label="Share with Pulse"
            description="Off by default. When on, a transcript-free history of your drills and challenges is written where Pulse can read it. Turning it off deletes that copy immediately."
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Keep reflection text for</legend>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            After this, the free text is deleted and only the derived signals are kept, so your progress history
            survives without the app holding years of private writing.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "Forever", value: 0 },
              { label: "1 year", value: 365 },
              { label: "6 months", value: 180 },
              { label: "30 days", value: 30 },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={store.preference.retentionDays === option.value ? "primary" : "secondary"}
                aria-pressed={store.preference.retentionDays === option.value}
                onClick={() => void store.updatePreference({ retentionDays: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Keep practice transcripts for</legend>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            After this, old practice conversations are deleted automatically the next time you open Rapport.
            Scores, progress and your event history stay; only the replayable transcripts go.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "Forever", value: 0 },
              { label: "1 year", value: 365 },
              { label: "3 months", value: 90 },
              { label: "30 days", value: 30 },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={store.preference.transcriptRetentionDays === option.value ? "primary" : "secondary"}
                aria-pressed={store.preference.transcriptRetentionDays === option.value}
                onClick={() => void store.updatePreference({ transcriptRetentionDays: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>Export everything (JSON)</Button>
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>Delete everything</Button>
        </div>
        {confirmWipe ? (
          <div className="mt-3 rounded-[10px] border p-3" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
            <p className="text-sm">
              This deletes your profile, event history, reflections and progress from this device. It cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await store.wipeData();
                  setConfirmWipe(false);
                  window.location.href = "/onboarding";
                }}
              >
                Yes, delete it all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmWipe(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card as="section" className="mt-4">
        <h2 className="text-base font-semibold">Sync</h2>
        {!isSyncConfigured() ? (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Sync is not configured for this deployment. Your data lives on this device only. Use export to move it.
          </p>
        ) : !cryptoAvailable() ? (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            This browser does not support the encryption sync requires, so sync is unavailable here.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Optional. Your data is encrypted on this device with a passphrase before it is uploaded — the server
              stores an unreadable blob. If you lose the passphrase, the synced copy cannot be recovered by anyone,
              including us.
            </p>
            {signedInAs ? (
              <p className="mt-3 text-sm">
                Signed in as <span className="font-medium">{signedInAs}</span>{" "}
                <Button size="sm" variant="ghost" onClick={async () => { await signOut(); setSignedInAs(null); }}>
                  Sign out
                </Button>
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Field id="email" label="Email">
                    <TextInput id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Field>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const result = await signInWithEmail(email);
                    setSyncMessage(result.message);
                  }}
                >
                  Send sign-in link
                </Button>
              </div>
            )}

            <div className="mt-3">
              <Field id="passphrase" label="Encryption passphrase" hint="Never transmitted. Not recoverable.">
                <TextInput
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              {strength ? (
                <p className="mt-1.5 text-xs" style={{ color: strength.ok ? "var(--accent)" : "var(--warn)" }}>
                  {strength.message}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!strength?.ok}
                onClick={async () => {
                  const result = await push(passphrase, new Date().toISOString());
                  setSyncMessage(result.status === "pushed" ? "Uploaded." : `Sync: ${result.status}`);
                }}
              >
                Upload
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!strength?.ok}
                onClick={async () => {
                  const result = await pull(passphrase, new Date().toISOString());
                  setSyncMessage(
                    result.status === "pulled"
                      ? "Downloaded — reload to see it."
                      : result.status === "error"
                        ? result.message
                        : `Sync: ${result.status}`,
                  );
                }}
              >
                Download
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const result = await deleteRemote();
                  setSyncMessage(result.status === "pushed" ? "Synced copy deleted." : `Sync: ${result.status}`);
                }}
              >
                Delete synced copy
              </Button>
            </div>
            {syncMessage ? (
              <p className="mt-2 text-sm" role="status" style={{ color: "var(--text-muted)" }}>{syncMessage}</p>
            ) : null}
          </>
        )}
      </Card>

      <Card as="section" className="mt-4">
        <h2 className="text-base font-semibold">AI</h2>
        {aiStatus ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={aiStatus.provider.available ? "accent" : "neutral"}>
                {aiStatus.provider.available ? `Provider: ${aiStatus.provider.name}` : "No provider configured"}
              </Badge>
              <Badge>{aiStatus.stats.calls} calls this instance</Badge>
              <Badge>{Math.round(aiStatus.stats.fallbackRate * 100)}% fell back</Badge>
              <Badge>~${aiStatus.stats.estimatedCostUsd.toFixed(3)} estimated</Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {aiStatus.provider.available
                ? "A model writes the wording of feedback, character replies and explanations. All measurements, skill estimates and recommendations are computed on your device and are not affected if the model is unavailable."
                : "No model is configured, so the app is running entirely on its built-in engine. Everything works; character replies are simpler."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Checking…</p>
        )}
      </Card>
    </>
  );
}
