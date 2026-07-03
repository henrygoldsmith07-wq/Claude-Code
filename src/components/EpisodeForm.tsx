"use client";

import { useState } from "react";
import type { EpisodeOutputs } from "@/lib/types";

export default function EpisodeForm() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [outputs, setOutputs] = useState<EpisodeOutputs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutputs(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }
      setOutputs(data.outputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
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
          <label htmlFor="transcript" className="text-sm font-medium">
            Transcript
          </label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            required
            rows={12}
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Paste the raw episode transcript here..."
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {loading ? "Generating..." : "Generate content"}
        </button>
      </form>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {outputs && <EpisodeResults outputs={outputs} />}
    </div>
  );
}

function EpisodeResults({ outputs }: { outputs: EpisodeOutputs }) {
  return (
    <div className="flex flex-col gap-8">
      <Section title="Blog post">
        <p className="whitespace-pre-wrap text-sm leading-6">{outputs.blogPost}</p>
      </Section>
      <Section title="Show notes">
        <p className="whitespace-pre-wrap text-sm leading-6">{outputs.showNotes}</p>
      </Section>
      <Section title="Social snippets">
        <ul className="flex flex-col gap-2">
          {outputs.socialSnippets.map((snippet, i) => (
            <li
              key={i}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              {snippet}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Chapters">
        <ul className="flex flex-col gap-1">
          {outputs.chapters.map((chapter, i) => (
            <li key={i} className="text-sm">
              <span className="font-mono text-zinc-500">{chapter.timestamp}</span>{" "}
              {chapter.title}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
