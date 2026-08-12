"use client";

import { useState } from "react";
import { Button, Card, Field, TextArea } from "@/components/ui";
import { REFLECTION_PROMPTS } from "@/domain/reflection";
import { useStore } from "@/state/store";
import type { ChallengeOutcome } from "@/domain/types";

// ---------------------------------------------------------------------------
// Reflection.
//
// Two taps and two optional lines. Everything about this form is arranged so
// that the minimum viable reflection — tap "yes", tap a number — is complete
// and useful, because that is the version people will still be doing in week
// six.
//
// The text fields never leave the device unless the user has explicitly turned
// that on in settings, and the form says so where they are typing.
// ---------------------------------------------------------------------------

export function ReflectionForm({ attemptId, onDone }: { attemptId: string; onDone: () => void }) {
  const store = useStore();
  const [attempted, setAttempted] = useState<ChallengeOutcome | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [wentWell, setWentWell] = useState("");
  const [wouldChange, setWouldChange] = useState("");
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const attempt = store.attempts.find((item) => item.id === attemptId);
  const outcomeOptions = REFLECTION_PROMPTS[0]?.options ?? [];

  const submit = async () => {
    if (!attempted || difficulty === null) return;
    setSaving(true);
    const result = await store.completeChallenge(attemptId, {
      attempted,
      difficulty,
      wentWell: wentWell.trim() || undefined,
      wouldChange: wouldChange.trim() || undefined,
      skillIds: attempt ? [attempt.challenge.skillId] : [],
    });
    setSaving(false);
    if (result.warning) {
      setWarning(result.warning);
      return;
    }
    onDone();
  };

  if (warning) {
    return (
      <Card className="rise">
        <p className="text-[15px] leading-relaxed">{warning}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={onDone}>Close</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rise">
      <h3 className="text-base font-semibold">How did it go?</h3>
      {attempt ? (
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{attempt.challenge.objective}</p>
      ) : null}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Did you attempt it?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {outcomeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={attempted === option.value ? "primary" : "secondary"}
              aria-pressed={attempted === option.value}
              onClick={() => setAttempted(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">How difficult did it feel?</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Difficulty from 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={difficulty === value ? "primary" : "secondary"}
              aria-pressed={difficulty === value}
              aria-label={`${value} out of 5`}
              onClick={() => setDifficulty(value)}
              className="w-11"
            >
              {value}
            </Button>
          ))}
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          1 = easy, 5 = very hard. This is the main signal for whether things are getting easier.
        </p>
      </fieldset>

      <div className="mt-4 space-y-3">
        <Field id="went-well" label="What went well?" hint="Optional. One line is plenty.">
          <TextArea id="went-well" rows={2} value={wentWell} onChange={(event) => setWentWell(event.target.value)} />
        </Field>
        <Field id="would-change" label="What would you do differently?" hint="Optional.">
          <TextArea id="would-change" rows={2} value={wouldChange} onChange={(event) => setWouldChange(event.target.value)} />
        </Field>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
        {store.preference.aiMayReadReflections
          ? "You have allowed reflection text to be summarised by a model. You can turn this off in settings."
          : "What you write here stays on this device. It is not sent to any model."}
      </p>

      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={!attempted || difficulty === null || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onDone}>Later</Button>
      </div>
    </Card>
  );
}
