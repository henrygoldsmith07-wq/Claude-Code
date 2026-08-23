import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callOpenRouterStep,
  parseAssistantStep,
  resolveModelChain,
  type OpenRouterToolSpec,
} from "./openrouter";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_MODEL;
});

const TOOLS: OpenRouterToolSpec[] = [
  { name: "ask_followup", description: "ask", parameters: { type: "object", properties: {} } },
  { name: "conclude_reflection", description: "conclude", parameters: { type: "object", properties: {} } },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("parseAssistantStep", () => {
  it("maps ask_followup tool calls to a question", () => {
    const step = parseAssistantStep({
      role: "assistant",
      content: null,
      tool_calls: [{ function: { name: "ask_followup", arguments: '{"question":"What did they actually say?"}' } }],
    });
    expect(step?.question).toBe("What did they actually say?");
  });

  it("maps conclude_reflection arguments to the summary payload", () => {
    const summary = { trace: { event: "x" }, coreEmotion: "hurt" };
    const step = parseAssistantStep({
      role: "assistant",
      content: null,
      tool_calls: [{ function: { name: "conclude_reflection", arguments: JSON.stringify(summary) } }],
    });
    expect(step?.summary).toEqual(summary);
  });

  it("falls back to strict JSON embedded in prose (fenced or raw)", () => {
    expect(parseAssistantStep({ role: "assistant", content: '```json\n{"question":"Hmm?"}\n```' })?.question).toBe("Hmm?");
    expect(parseAssistantStep({ role: "assistant", content: 'Sure — {"trace":{"event":"e"},"coreEmotion":"calm"}' })?.summary).toBeDefined();
  });

  it("returns null for prose without structure", () => {
    expect(parseAssistantStep({ role: "assistant", content: "Just chatting, no JSON here." })).toBeNull();
  });
});

describe("resolveModelChain", () => {
  it("prefers an explicit pin, then env, then the fallback chain", () => {
    expect(resolveModelChain("test/model:free")).toEqual(["test/model:free"]);
    delete process.env.OPENROUTER_MODEL;
    const chain = resolveModelChain();
    expect(chain.length).toBeGreaterThan(10); // full approved free pool
    expect(new Set(chain).size).toBe(chain.length);
  });

  it("rotates the starting model so per-model free caps spread out", () => {
    delete process.env.OPENROUTER_MODEL;
    const a = resolveModelChain();
    const b = resolveModelChain();
    expect(b[0]).toBe(a[1 % a.length]);
    expect([...b].sort()).toEqual([...a].sort());
    // a pinned model never rotates
    expect(resolveModelChain("pin/model")).toEqual(["pin/model"]);
  });
});

describe("callOpenRouterStep", () => {
  it("walks the chain past failing models and reports which model answered", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        calls.push(body.model);
        if (body.model === "capped/model:free") return jsonResponse(404, { error: "no such model" });
        return jsonResponse(200, {
          choices: [{ message: { role: "assistant", content: null, tool_calls: [{ function: { name: "ask_followup", arguments: '{"question":"Q"}' } }] } }],
        });
      }),
    );
    const result = await callOpenRouterStep({
      apiKey: "sk-or-test",
      systemPrompt: "s",
      messages: [{ role: "user", content: "hi" }],
      tools: TOOLS,
      modelChain: ["capped/model:free", "working/model:free"],
    });
    expect(calls).toEqual(["capped/model:free", "working/model:free"]);
    expect(result.model).toBe("working/model:free");
    expect(result.question).toBe("Q");
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer sk-or-test");
  });

  it("uses strict-JSON prose when a model ignores tools entirely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, { choices: [{ message: { role: "assistant", content: 'Here you go: {"question":"Why did that sting?"}' } }] }),
      ),
    );
    const result = await callOpenRouterStep({ apiKey: "k", systemPrompt: "s", messages: [], tools: TOOLS, modelChain: ["only/model"] });
    expect(result.question).toBe("Why did that sting?");
  });

  it("throws a model-exhausted error listing every attempt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(500, { error: "boom" })));
    await expect(
      callOpenRouterStep({ apiKey: "k", systemPrompt: "s", messages: [], tools: TOOLS, modelChain: ["a/x", "b/y"] }),
    ).rejects.toThrow(/OpenRouter models exhausted[\s\S]*a\/x[\s\S]*b\/y/);
  });
});
