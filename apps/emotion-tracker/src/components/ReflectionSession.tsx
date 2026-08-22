"use client";

import { useEffect, useRef, useState } from "react";
import type { BiasFlag, Entry, LongitudinalReview, Message, ReflectionSummary } from "@/lib/types";
import type { Correction } from "@/lib/corrections";
import { logOutcomeStudyEvent } from "@/lib/outcomeStudy";
import { buildProviderContext } from "@/lib/memory";
import { containsSensitiveData } from "@/lib/adversarial";
import SummaryView from "./SummaryView";

interface Props {
  entry: Entry;
  entries?: Entry[];
  corrections?: Correction[];
  apiKey: string;
  onAppendMessage: (id: string, message: Message) => void;
  onCompleteEntry: (id: string, summary: ReflectionSummary) => void;
  onUpdateFollowUp?: (id: string, at: string | null, note: string | null) => void;
  onSaveReview?: (id: string, patch: Partial<LongitudinalReview>) => void;
  onClearReview?: (id: string) => void;
  onDismissPattern?: (bias: BiasFlag) => void;
  onError: (message: string) => void;
}

// Client-side ceiling for one provider turn — the server already bounds its
// upstream call; this stops the spinner if the network itself stalls.
const REQUEST_TIMEOUT_MS = 60_000;

export default function ReflectionSession({
  entry,
  entries,
  corrections,
  apiKey,
  onAppendMessage,
  onCompleteEntry,
  onUpdateFollowUp,
  onSaveReview,
  onClearReview,
  onDismissPattern,
  onError,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [quietFocus, setQuietFocus] = useState(false);
  // Request lifecycle: a failed step surfaces an inline Try-again button —
  // failures never auto-retry (a transient error must not loop against the
  // paid API), and switching away aborts the in-flight request.
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestedForRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessage = entry.messages[entry.messages.length - 1];
  const awaitingAi =
    entry.status === "in_progress" && lastMessage?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entry.messages.length, loading]);

  function retryRequest() {
    setFailed(false);
    requestedForRef.current = null;
    // Re-run the request effect without duplicating the user's message.
    setRetryNonce((n) => n + 1);
  }

  useEffect(() => {
    if (!awaitingAi) return;
    const requestKey = `${entry.id}:${entry.messages.length}`;
    if (requestedForRef.current === requestKey) return;
    requestedForRef.current = requestKey;

    // Local-only mode: skip the API entirely
    if (typeof window !== "undefined" && window.localStorage.getItem("reflectLocalOnly") === "1") {
      requestedForRef.current = null;
      onError("Local-only mode is on — turn it off in Settings to use guided reflection, or complete the trace manually from the summary.");
      return;
    }
    // This effect owns the request lifecycle; the loading state mirrors the
    // external fetch rather than an input event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const query = entry.messages[entry.messages.length - 1]?.content ?? "";
    const providerContext = buildProviderContext(entries ?? [], corrections ?? [], entry.messages, query);
    fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: entry.messages,
        apiKey: apiKey || undefined,
        mode: entry.mode ?? "full",
        entries: providerContext.entryHints,
        corrections: corrections?.slice(-10) ?? undefined,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        if (data.step === "question") {
          onAppendMessage(entry.id, {
            role: "assistant",
            content: data.question,
          });
        } else {
          onCompleteEntry(entry.id, data.summary);
        }
      })
      .catch((err) => {
        if (cancelled) return; // unmounted — nothing left to update
        setFailed(true);
        if (timedOut) {
          onError("The reflection service took too long to respond — try again.");
          return;
        }
        onError(err instanceof Error ? err.message : "Something went wrong");
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAi, entry.id, entry.messages.length, retryNonce]);

  function submitAnswer() {
    if (!answer.trim()) return;
    // Local-only mode never transmits, so no provider-warning is needed there.
    const localOnly = typeof window !== "undefined" && window.localStorage.getItem("reflectLocalOnly") === "1";
    if (!localOnly && containsSensitiveData(answer)) {
      const proceed = window.confirm(
        "This answer looks like it contains personal data (an email, phone number or credential).\n" +
        "It would be sent to the AI provider with your next reflection step.\n\n" +
        "Send anyway, or edit it out first?",
      );
      if (!proceed) return;
    }
    onAppendMessage(entry.id, { role: "user", content: answer.trim() });
    setAnswer("");
  }

  const mode = entry.mode ?? "full";
  const maxQuestions = mode === "quick" ? 2 : 5;
  const questionsAsked = entry.messages.filter((message) => message.role === "assistant").length;
  const currentStep = Math.min(questionsAsked + 1, maxQuestions);
  const visibleMessages = quietFocus && entry.status === "in_progress" ? entry.messages.slice(-1) : entry.messages;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{mode === "quick" ? "Quick reflection" : "Full reflection"}</p>
              {entry.status === "in_progress" ? <p className="mt-1 text-xs text-muted">One question at a time · step {currentStep} of up to {maxQuestions}</p> : <p className="mt-1 text-xs text-muted">Reflection complete · prediction ready for follow-up</p>}
            </div>
            {entry.status === "in_progress" && <button type="button" aria-pressed={quietFocus} onClick={() => { setQuietFocus((value) => !value); if (!quietFocus) logOutcomeStudyEvent({ type: "focus_mode_used", mode }); }} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${quietFocus ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-muted hover:bg-card-hover"}`}>{quietFocus ? "Exit quiet focus" : "Quiet focus"}</button>}
          </div>
          {quietFocus && entry.status === "in_progress" && <p className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted">Earlier answers are tucked away while you focus on this step.</p>}

          {visibleMessages.map((m, i) => (
            <div
              // Stable per message: appending never changes earlier keys (no
              // full-transcript remount), and turns strictly alternate roles
              // so role+index is unique within the rendered list.
              key={`${m.role}-${i}`}
              className={`${quietFocus && m.role === "assistant" ? "max-w-full px-5 py-5 text-base sm:text-lg" : "max-w-[85%] px-4 py-2.5 text-sm"} rounded-2xl leading-relaxed whitespace-pre-wrap animate-fade-in ${
                m.role === "user"
                  ? "self-end bg-accent text-white shadow-sm"
                  : "self-start border border-border bg-card text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="self-start flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted"
            >
              <span aria-hidden="true" className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
                <span
                  className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
              Thinking…
            </div>
          )}

          {failed && !loading && awaitingAi && (
            <div
              role="alert"
              className="self-start flex items-center gap-3 rounded-2xl border border-danger/30 bg-dangersoft px-4 py-3 text-sm text-danger"
            >
              <span>The last reflection step didn&apos;t complete.</span>
              <button
                type="button"
                onClick={retryRequest}
                className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium hover:bg-danger/10"
              >
                Try again
              </button>
            </div>
          )}

          {entry.status === "complete" && entry.summary && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
              <SummaryView
                summary={entry.summary}
                longitudinalReview={entry.longitudinalReview ?? null}
                corrections={corrections}
                onFollowUp={
                  onUpdateFollowUp
                    ? (at, note) => onUpdateFollowUp(entry.id, at, note)
                    : undefined
                }
                onSaveReview={onSaveReview ? (patch) => onSaveReview(entry.id, patch) : undefined}
                onClearReview={onClearReview ? () => onClearReview(entry.id) : undefined}
                onDismissPattern={onDismissPattern}
              />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {entry.status === "in_progress" && !awaitingAi && (
        <div className="border-t border-border bg-card/50 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl gap-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              rows={2}
              placeholder="Answer one question honestly — this is just for you."
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="self-end rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
