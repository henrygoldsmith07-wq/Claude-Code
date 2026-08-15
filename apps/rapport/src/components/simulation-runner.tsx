"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";
import { Badge, Button, Card, Evidence, Hedged, SourceNote, TextArea } from "@/components/ui";
import { useStore } from "@/state/store";
import { nowIso, useNow } from "@/state/clock";
import { getSkill } from "@/domain/skills";
import { applyPlan, newMemory, planTurn, seededRng, shouldEnd, updateEngagement } from "@/domain/simulator";
import { floorSnapshot, maxConsecutiveCharacterTurns, nextSpeaker } from "@/domain/floor";
import { namesAddressed } from "@/domain/addressing";
import type { CharacterMemory } from "@/domain/simulator";
import { analyseTurn, feedbackFor, wordsFromTranscript } from "@/domain/voice";
import type {
  AssistLevel,
  Simulation,
  SimulationEvaluation,
  SimulationScenario,
  SimulationTurn,
  VoiceTurnMetrics,
} from "@/domain/types";
import { FeedbackPanel } from "@/components/feedback-panel";

// ---------------------------------------------------------------------------
// The practice conversation.
//
// The engine (src/domain/simulator.ts) decides what kind of turn the character
// takes — how long, whether it volunteers anything, whether it asks back — and
// the model, if one is configured, only writes the words. That split is what
// keeps difficulty controllable: a model asked to "be a quiet person" drifts
// helpful within three turns, whereas a turn plan does not.
//
// Hints fade as competence rises (see suggestedAssistLevel). At "none" the user
// gets nothing but the conversation, which is the state the product is trying
// to reach.
// ---------------------------------------------------------------------------

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
}

const HINTS: Record<string, string[]> = {
  "conv.follow-up": [
    "Pick one specific noun from their last line and ask about it.",
    "Explore before you relate — their detail first, yours after.",
  ],
  "conv.open-questions": ["Start with what, how or which.", "One question at a time."],
  "conv.balance": ["If you have had two turns, hand the floor back with a question."],
  "asrt.no": ["Decline in the first sentence.", "One reason is enough."],
  "emp.validation": ["Say the reaction makes sense before anything else.", "No 'but', no 'at least'."],
  "conf.groups": ["Build on something someone already said.", "Short enough to hand back."],
  default: ["Reply to the last thing they said before adding anything new."],
};

export function SimulationRunner({
  scenario,
  assistLevel: initialAssistLevel,
  difficulty: initialDifficulty,
}: {
  scenario: SimulationScenario;
  /** Captured when the conversation starts; later changes are ignored. */
  assistLevel: AssistLevel;
  difficulty: number;
}) {
  const store = useStore();
  // Difficulty and assistance are fixed at the moment the conversation begins.
  // Finishing one updates the user's difficulty tolerance, and letting that
  // flow back in mid-session would change the exercise underneath them — and,
  // when it fed a React key, discard the transcript and the feedback with it.
  const [difficulty] = useState(initialDifficulty);
  const [assistLevel] = useState(initialAssistLevel);
  const [turns, setTurns] = useState<SimulationTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [evaluation, setEvaluation] = useState<SimulationEvaluation | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceTurnMetrics[]>([]);
  const [listening, setListening] = useState(false);
  const memories = useRef(new Map<string, CharacterMemory>());
  const speechStartedAt = useRef<number>(0);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const transcriptEnd = useRef<HTMLDivElement | null>(null);

  const character = scenario.characters[0];
  const startedAt = useNow();
  const simulationId = useMemo(() => `sim.${scenario.id}.${startedAt}`, [scenario.id, startedAt]);
  const rng = useMemo(() => seededRng(simulationId), [simulationId]);

  useEffect(() => {
    for (const item of scenario.characters) {
      if (!memories.current.has(item.id)) memories.current.set(item.id, newMemory(item));
    }
  }, [scenario.characters]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length]);

  /** The in-progress simulation, so the floor engine and the evaluator see the same object. */
  const asSimulation = useCallback(
    (turnList: SimulationTurn[]): Simulation => ({
      id: simulationId,
      userId: "local",
      scenarioId: scenario.id,
      scenario,
      mode: voiceMetrics.length > 0 ? "voice" : "text",
      startedAt: turnList[0]?.createdAt ?? nowIso(),
      deliveredDifficulty: difficulty,
      assistLevel,
      turns: turnList,
    }),
    [assistLevel, difficulty, scenario, simulationId, voiceMetrics.length],
  );

  const skill = getSkill(scenario.skillIds[0] ?? "");
  const hints = HINTS[scenario.skillIds[0] ?? ""] ?? HINTS.default ?? [];
  const visibleHints = assistLevel === "full" ? hints : assistLevel === "partial" ? hints.slice(0, 1) : [];

  const send = useCallback(
    async (text: string, voice?: VoiceTurnMetrics) => {
      if (!text.trim() || busy || !character) return;
      setBusy(true);
      setDraft("");

      const userTurn: SimulationTurn = {
        id: `${simulationId}.${turns.length}`,
        simulationId,
        index: turns.length,
        speaker: "user",
        text: text.trim(),
        createdAt: nowIso(),
        voice,
      };
      const withUser = [...turns, userTurn];
      setTurns(withUser);
      if (voice) setVoiceMetrics((current) => [...current, voice]);

      const lastCharacter = [...turns].reverse().find((turn) => turn.speaker === "character");

      // Everyone's engagement moves, but not equally: a turn aimed at one
      // person is not aimed at the others. With one character this reduces
      // exactly to the previous behaviour.
      const named = namesAddressed(userTurn.text, scenario);
      const groupSize = scenario.characters.length;
      for (const item of scenario.characters) {
        const previous = memories.current.get(item.id) ?? newMemory(item);
        memories.current.set(
          item.id,
          updateEngagement(previous, userTurn.text, lastCharacter?.text ?? null, {
            addressed: named.length > 0 ? named.includes(item.id) : lastCharacter?.characterId === item.id,
            addressedAnyone: named.length > 0,
            groupSize,
            // Goal progress is measured against what the user just said, so it
            // has to be advanced here rather than when the character replies.
            ...(item.goal ? { goal: item.goal } : {}),
          }),
        );
      }

      // The group may take several turns before the floor comes back. This is
      // the loop that makes a group conversation a group conversation: who
      // speaks is decided by the floor engine, not by "the first character".
      let working = withUser;
      const budget = maxConsecutiveCharacterTurns(difficulty);

      for (let taken = 0; taken < budget; taken += 1) {
        const snapshot = floorSnapshot(asSimulation(working));
        const next = nextSpeaker(scenario, memories.current, snapshot, difficulty, rng);
        if (next.speaker === "user") break;
        const speaker = scenario.characters.find((item) => item.id === next.speaker);
        if (!speaker) break;

        const memory = memories.current.get(speaker.id) ?? newMemory(speaker);
        const plan = planTurn(speaker, memory, working.length, difficulty, rng);
        // Counts the push, or marks a concession as delivered so it is said once.
        memories.current.set(speaker.id, applyPlan(memory, plan));

        let reply = "";
        try {
          const response = await fetch("/api/ai", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              request: {
                task: "simulate-turn",
                character: {
                  name: speaker.name,
                  style: speaker.style,
                  role: speaker.role,
                  background: speaker.background,
                  interests: speaker.interests,
                },
                scenarioContext:
                  groupSize > 1
                    ? `${scenario.context} Also present: ${scenario.characters
                        .filter((item) => item.id !== speaker.id)
                        .map((item) => `${item.name} (${item.role})`)
                        .join(", ")}.`
                    : scenario.context,
                plan,
                // Character lines are prefixed with the speaker's name in a
                // group. Without it the model sees an undifferentiated wall of
                // "character" turns and cannot tell who said what, which is
                // exactly what makes a group read as one person with mood
                // swings. Prefixing keeps the request schema unchanged.
                transcript: working.slice(-12).map((turn) => ({
                  speaker: turn.speaker,
                  text:
                    groupSize > 1 && turn.speaker === "character"
                      ? `${scenario.characters.find((item) => item.id === turn.characterId)?.name ?? "Someone"}: ${turn.text}`
                      : turn.text,
                })),
              },
            }),
          });
          const payload = (await response.json()) as {
            data?: { reply?: string; newFact?: string };
            source?: string;
            note?: string;
          };
          reply = payload.data?.reply ?? "";
          if (payload.note) setAiNote(payload.note);
          if (payload.data?.newFact) {
            memories.current.set(speaker.id, {
              ...memory,
              statedFacts: [...memory.statedFacts, payload.data.newFact],
            });
          }
        } catch {
          reply = "";
          setAiNote("Offline — using the built-in character engine.");
        }

        if (!reply) reply = "Mm.";

        const characterTurn: SimulationTurn = {
          id: `${simulationId}.${working.length}`,
          simulationId,
          index: working.length,
          speaker: "character",
          characterId: speaker.id,
          text: reply,
          createdAt: nowIso(),
        };
        working = [...working, characterTurn];
        setTurns(working);
      }

      setBusy(false);
    },
    [asSimulation, busy, character, difficulty, rng, scenario, simulationId, turns],
  );

  const finish = useCallback(async () => {
    if (!character) return;
    setBusy(true);
    const simulation: Simulation = {
      ...asSimulation(turns),
      endedAt: nowIso(),
    };
    const result = await store.saveSimulation(simulation);
    setEvaluation(result);
    setEnded(true);
    setBusy(false);
  }, [asSimulation, character, store, turns]);

  // Voice input. Optional, opt-in, and used only for pace/filler/pause
  // measurement — the audio itself is never stored or transmitted.
  const toggleVoice = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!ctor) {
      setAiNote("Speech recognition is not available in this browser. Typing works exactly the same.");
      return;
    }
    const instance = new ctor();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = "en-GB";
    instance.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setDraft(text);
    };
    instance.onend = () => {
      setListening(false);
      const durationMs = Date.now() - speechStartedAt.current;
      setDraft((current) => {
        if (current.trim()) {
          const metrics = analyseTurn(wordsFromTranscript(current, durationMs), durationMs);
          setVoiceMetrics((existing) => [...existing, metrics]);
        }
        return current;
      });
    };
    recognition.current = instance;
    speechStartedAt.current = Date.now();
    instance.start();
    setListening(true);
  };

  if (!character) {
    return <Card>This scenario has no characters configured.</Card>;
  }

  if (ended && evaluation) {
    const voice = voiceMetrics.length > 0 ? feedbackFor(voiceMetrics) : null;
    return (
      <>
        <FeedbackPanel evaluation={evaluation} skillName={skill?.name ?? "this skill"} />
        {voice ? (
          <Card className="mt-4">
            <h3 className="text-base font-semibold">How you sounded</h3>
            <Evidence items={voice.observations} />
            {voice.suggestion ? <Hedged label="Worth trying">{voice.suggestion}</Hedged> : null}
            <p className="mt-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
              Measured from the transcript and its timings only. No audio was stored, and nothing here infers
              anything about you beyond pace, fillers and pauses.
            </p>
          </Card>
        ) : null}
      </>
    );
  }

  const canEnd = turns.filter((turn) => turn.speaker === "user").length >= 2;

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{scenario.title}</Badge>
          <Badge>Difficulty {Math.round(difficulty)}/5</Badge>
          <Badge>{character.name} · {character.style}</Badge>
        </div>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{scenario.context}</p>
        <p className="mt-2 text-sm font-medium">Your objective: {scenario.objective}</p>
      </Card>

      {visibleHints.length > 0 ? (
        <Card className="mt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Prompts ({assistLevel})
          </span>
          <Evidence items={visibleHints} />
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            These reduce automatically as the evidence for this skill builds.
          </p>
        </Card>
      ) : null}

      <div
        className="mt-4 space-y-3"
        role="log"
        aria-live="polite"
        aria-label="Conversation transcript"
      >
        {turns.length === 0 ? (
          <Card>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              You speak first. {character.name} is {character.role}.
            </p>
          </Card>
        ) : null}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`max-w-[85%] rounded-[var(--radius)] px-4 py-3 text-[15px] leading-relaxed ${turn.speaker === "user" ? "ml-auto" : ""}`}
            style={{
              background: turn.speaker === "user" ? "var(--accent-soft)" : "var(--surface)",
              color: "var(--text)",
              border: `1px solid ${turn.speaker === "user" ? "transparent" : "var(--border)"}`,
            }}
          >
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              {turn.speaker === "user" ? "You" : character.name}
            </span>
            {turn.text}
          </div>
        ))}
        {busy ? (
          <div className="text-sm" style={{ color: "var(--text-faint)" }} aria-live="polite">
            {character.name} is replying…
          </div>
        ) : null}
        <div ref={transcriptEnd} />
      </div>

      <div className="mt-4">
        <label htmlFor="reply" className="sr-only">Your reply</label>
        <TextArea
          id="reply"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type what you would actually say…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send(draft);
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button onClick={() => void send(draft)} disabled={busy || !draft.trim()}>
            <Send size={15} aria-hidden="true" /> Send
          </Button>
          {store.preference.voiceEnabled ? (
            <Button variant="secondary" onClick={toggleVoice} aria-pressed={listening}>
              {listening ? <Square size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
              {listening ? "Stop" : "Speak"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void finish()} disabled={!canEnd || busy}>
            End &amp; get feedback
          </Button>
          {shouldEnd({ turns } as Simulation) ? (
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {character.name} is wrapping up.
            </span>
          ) : null}
        </div>
        {!canEnd ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            A couple of exchanges are needed before feedback means anything.
          </p>
        ) : null}
        {aiNote ? <SourceNote source="fallback" note={aiNote} /> : null}
      </div>
    </>
  );
}
