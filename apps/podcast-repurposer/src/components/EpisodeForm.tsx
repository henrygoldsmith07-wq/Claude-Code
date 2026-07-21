"use client";

import { useState, useMemo } from "react";
import type { EpisodeOutputs, HistoryEntry } from "@/lib/types";
import { useLocalStorage } from "@/lib/useLocalStorage";

const EXAMPLE_TRANSCRIPT = `Host: Welcome back to the show. Today we're talking about how small teams ship products that feel polished.

Guest: Yeah, the biggest lever is cutting scope ruthlessly. We ship a thin vertical slice every two weeks and only then expand.

Host: How do you decide what stays and what goes?

Guest: We ask "does this help someone complete the core job in under five minutes?" If not, it waits. Also, we instrument everything — if a feature isn't used after two releases, we delete it.

Host: That sounds harsh.

Guest: It's kind. Complexity is a tax on every future change. The users who actually need the edge cases will tell you.`;

export default function EpisodeForm() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [apiKey, setApiKey] = useLocalStorage<string>("podcastRepurposerApiKey", "");
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>("podcastRepurposerHistory", []);
  const [outputs, setOutputs] = useState<EpisodeOutputs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"blog" | "notes" | "social" | "chapters">("blog");
  const [showHistory, setShowHistory] = useState(false);

  const wordCount = useMemo(() => {
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [transcript]);

  const charCount = transcript.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (transcript.trim().length < 50) {
      setError("Transcript is too short — paste a more complete episode.");
      return;
    }
    setLoading(true);
    setError(null);
    setOutputs(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          transcript: transcript.trim(),
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }
      setOutputs(data.outputs);
      setActiveTab("blog");

      // Save to local history (keep last 20)
      const entry: HistoryEntry = {
        id: `hist-${Date.now()}`,
        title: title.trim(),
        createdAt: new Date().toISOString(),
        transcriptPreview: transcript.trim().slice(0, 160),
        outputs: data.outputs,
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function loadHistoryEntry(entry: HistoryEntry) {
    setTitle(entry.title);
    setOutputs(entry.outputs);
    setActiveTab("blog");
    setShowHistory(false);
    setError(null);
  }

  function clearHistory() {
    if (confirm("Clear all local generation history?")) {
      setHistory([]);
    }
  }

  function loadExample() {
    setTitle("Shipping polished products with a tiny team");
    setTranscript(EXAMPLE_TRANSCRIPT);
    setError(null);
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {/* History toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {showHistory ? "← Back to form" : `History (${history.length})`}
        </button>
        {history.length > 0 && !showHistory && (
          <button
            type="button"
            onClick={clearHistory}
            className="text-xs text-zinc-400 hover:text-red-500"
          >
            Clear history
          </button>
        )}
      </div>

      {showHistory ? (
        <HistoryPanel history={history} onSelect={loadHistoryEntry} onClear={clearHistory} />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="title" className="text-sm font-medium">
                Episode title
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Episode 42: Scaling a bootstrapped SaaS"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="transcript" className="text-sm font-medium">
                  Transcript
                </label>
                <button
                  type="button"
                  onClick={loadExample}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Load example
                </button>
              </div>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                required
                rows={12}
                className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Paste the raw episode transcript here..."
              />
              <div className="flex justify-between text-xs text-zinc-400">
                <span>
                  {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
                </span>
                <span className={charCount > 55000 ? "text-amber-500" : ""}>
                  max ~60k chars
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="apiKey" className="text-sm font-medium">
                Anthropic API key <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="sk-ant-... — used only for this request if set"
              />
              <p className="text-xs text-zinc-400">
                Stored only in this browser. Leave blank to use the server key.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !title.trim() || transcript.trim().length < 50}
              className="self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Generating… this can take 20–40s
                </span>
              ) : (
                "Generate content"
              )}
            </button>
          </form>

          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {outputs && (
            <EpisodeResults
              outputs={outputs}
              title={title}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[];
  onSelect: (e: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        No past generations yet. Generate something to see it here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Local history</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-400 hover:text-red-500"
        >
          Clear all
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <div className="font-medium">{entry.title}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {new Date(entry.createdAt).toLocaleString()} ·{" "}
                {entry.transcriptPreview.slice(0, 80)}
                {entry.transcriptPreview.length > 80 ? "…" : ""}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EpisodeResults({
  outputs,
  title,
  activeTab,
  onTabChange,
}: {
  outputs: EpisodeOutputs;
  title: string;
  activeTab: "blog" | "notes" | "social" | "chapters";
  onTabChange: (t: "blog" | "notes" | "social" | "chapters") => void;
}) {
  const tabs = [
    { id: "blog" as const, label: "Blog post" },
    { id: "notes" as const, label: "Show notes" },
    { id: "social" as const, label: "Social" },
    { id: "chapters" as const, label: "Chapters" },
  ];

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadMarkdown() {
    const md = [
      `# ${title}`,
      "",
      "## Blog post",
      "",
      outputs.blogPost,
      "",
      "## Show notes",
      "",
      outputs.showNotes,
      "",
      "## Social snippets",
      "",
      ...outputs.socialSnippets.map((s, i) => `${i + 1}. ${s}`),
      "",
      "## Chapters",
      "",
      ...outputs.chapters.map((c) => `- **${c.timestamp}** ${c.title}`),
    ].join("\n");

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "episode"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={downloadMarkdown}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ↓ Download Markdown
        </button>
      </div>

      {activeTab === "blog" && (
        <Section title="Blog post" onCopy={() => copyText(outputs.blogPost)}>
          <p className="whitespace-pre-wrap text-sm leading-6">{outputs.blogPost}</p>
        </Section>
      )}
      {activeTab === "notes" && (
        <Section title="Show notes" onCopy={() => copyText(outputs.showNotes)}>
          <p className="whitespace-pre-wrap text-sm leading-6">{outputs.showNotes}</p>
        </Section>
      )}
      {activeTab === "social" && (
        <Section
          title="Social snippets"
          onCopy={() => copyText(outputs.socialSnippets.join("\n\n"))}
        >
          <ul className="flex flex-col gap-2">
            {outputs.socialSnippets.map((snippet, i) => (
              <li
                key={i}
                className="group flex items-start justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span>{snippet}</span>
                <button
                  type="button"
                  onClick={() => copyText(snippet)}
                  className="shrink-0 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {activeTab === "chapters" && (
        <Section
          title="Chapters"
          onCopy={() =>
            copyText(
              outputs.chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n"),
            )
          }
        >
          <ul className="flex flex-col gap-1">
            {outputs.chapters.map((chapter, i) => (
              <li key={i} className="text-sm">
                <span className="font-mono text-zinc-500">{chapter.timestamp}</span>{" "}
                {chapter.title}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  onCopy,
}: {
  title: string;
  children: React.ReactNode;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {children}
    </div>
  );
}
