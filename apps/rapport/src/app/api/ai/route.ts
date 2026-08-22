import { NextResponse } from "next/server";
import { run } from "@/ai/tasks";
import { aiRequestSchema } from "@/ai/types";
import type { AiRequest } from "@/ai/types";
import { extractSignals } from "@/domain/reflection";
import { composeReply, newMemory, seededRng, STYLE_PROFILES } from "@/domain/simulator";
import { checkPracticeRequest } from "@/domain/safety";
import type { SimulatedCharacter } from "@/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// The single AI endpoint.
//
// Every request is validated server-side before anything else happens; the
// client is not trusted to have done it. The deterministic fallback is computed
// here too, so a response is guaranteed even when the model is unavailable —
// the route has no failure mode that returns nothing useful.
//
// Privacy: `summarise-reflection` carries the user's private writing, and is
// refused outright unless the request declares the explicit opt-in. The default
// profile never sends reflection text anywhere.
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Rate-limit key. A truncated hash of IP and user agent: enough to separate
 * callers, not enough to identify one. No user id is involved, so the limiter
 * cannot become a record of who used the app when.
 */
function callerKey(request: Request): string {
  // Platform-set headers win because our proxy overwrites them. The *rightmost*
  // x-forwarded-for entry is the one the trusted chain appended; the leftmost
  // is client-supplied, so trusting it lets a caller rotate a fresh bucket per
  // request and bypass the ceiling entirely.
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "";
  const agent = request.headers.get("user-agent") ?? "";
  let value = 2166136261;
  const text = `${ip}|${agent}`;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const envelope = body as { request?: unknown; consent?: { reflections?: boolean } };
  const parsed = aiRequestSchema.safeParse(envelope.request);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.issues.slice(0, 5).map((issue) => issue.path.join(".")) },
      { status: 400 },
    );
  }

  const aiRequest = parsed.data;

  // Explicit permission gate for private writing. Refused, not silently
  // downgraded, so a client bug cannot quietly start sending journal text.
  if (aiRequest.task === "summarise-reflection" && !envelope.consent?.reflections) {
    return NextResponse.json(
      { error: "Reflection text may only be sent to a model with explicit permission enabled in settings." },
      { status: 403 },
    );
  }

  // Free-text inputs pass the safety gate before reaching any model.
  const freeText = userSuppliedText(aiRequest);
  if (freeText) {
    const safety = checkPracticeRequest(freeText);
    if (safety.verdict !== "ok") {
      return NextResponse.json({ refused: true, message: safety.message, reasons: safety.reasons }, { status: 200 });
    }
  }

  const result = await run({
    request: aiRequest,
    fallback: fallbackFor(aiRequest),
    rateLimitKey: callerKey(request),
  });

  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

function userSuppliedText(request: AiRequest): string | null {
  switch (request.task) {
    case "coach-explain":
      return request.question;
    case "enrich-scenario":
      return request.description;
    case "simulate-turn":
      return request.transcript.filter((turn) => turn.speaker === "user").map((turn) => turn.text).join("\n");
    default:
      return null;
  }
}

/** The deterministic answer for each task. Computed before the model is called. */
function fallbackFor(request: AiRequest): unknown {
  switch (request.task) {
    case "simulate-turn": {
      const profile = STYLE_PROFILES[request.character.style];
      const character: SimulatedCharacter = {
        id: "fallback",
        name: request.character.name,
        style: request.character.style,
        role: request.character.role,
        background: request.character.background,
        interests: request.character.interests,
        openness: profile.volunteering,
        reciprocity: profile.asksBack,
      };
      const lastUser = [...request.transcript].reverse().find((turn) => turn.speaker === "user");
      const rng = seededRng(`${request.character.name}:${request.transcript.length}`);
      return {
        reply: composeReply(character, newMemory(character), request.plan, lastUser?.text ?? null, rng),
        newFact: request.plan.factToIntroduce,
      };
    }
    case "phrase-feedback":
      return {
        whatWorked: request.whatWorked.length > 0 ? request.whatWorked.slice(0, 2) : ["You stayed in the conversation."],
        observation: request.improvement.observation,
        principle: request.improvement.principle,
        exampleAlternative: request.improvement.exampleAlternative,
      };
    case "summarise-reflection": {
      const signal = extractSignals({
        id: "temp",
        userId: "temp",
        subject: { kind: "freeform" },
        attempted: request.attempted,
        difficulty: request.difficulty,
        wentWell: request.wentWell,
        wouldChange: request.wouldChange,
        skillIds: [],
        createdAt: new Date().toISOString(),
      });
      const attemptWord = request.attempted === "yes" ? "attempted" : request.attempted === "partly" ? "partly attempted" : "did not attempt";
      return {
        summary: `You ${attemptWord} this and rated it ${request.difficulty}/5 for difficulty.`,
        obstacles: signal.obstacles,
        behaviours: signal.behavioursMentioned,
      };
    }
    case "explain-insight":
      return {
        possibleExplanation:
          request.confidence < 0.45
            ? "This may well be noise — there is not much data behind it yet."
            : "One explanation is ordinary variation in the situations you have been in; another is that the practice is showing up. More attempts would separate the two.",
        recommendedAction: `One real-world attempt at ${request.skillNames[0] ?? "this skill"} this week would tell you more than any further analysis.`,
      };
    case "coach-explain":
      return {
        explanation: `${request.diagnosis} ${request.technique} ${request.context}`.trim(),
        example: "",
      };
    case "enrich-scenario":
      return {
        title: request.description.slice(0, 60),
        context: request.description,
        characters: request.styles.map((style, index) => ({
          name: ["Sam", "Alex", "Jo"][index] ?? "Sam",
          role: "someone in the situation you described",
          background: ["I've been in this situation before."],
          interests: ["walking"],
        })),
      };
    default:
      return null;
  }
}

export async function GET() {
  // Status only — never the key, never the model's identity beyond its name.
  const { providerStatus } = await import("@/ai/provider");
  const { stats } = await import("@/ai/telemetry");
  return NextResponse.json({ provider: providerStatus(), stats: stats() }, { headers: { "cache-control": "no-store" } });
}
