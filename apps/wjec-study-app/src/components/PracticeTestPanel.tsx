"use client";

import { useState } from "react";
import { SUBJECTS, topicsForSubject } from "@/lib/curriculum";
import type { PracticeFormat, PracticeItem, SubjectId } from "@/lib/types";
import PracticeTestSession from "./PracticeTestSession";

interface Props {
  apiKey: string;
}

const FORMAT_LABELS: { id: PracticeFormat; label: string }[] = [
  { id: "mcq", label: "Multiple choice" },
  { id: "matching", label: "Matching" },
  { id: "fill-blank", label: "Fill in the blank" },
];

export default function PracticeTestPanel({ apiKey }: Props) {
  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS[0].id);
  const topics = topicsForSubject(subjectId);
  const [topicId, setTopicId] = useState(topics[0].id);
  const [formats, setFormats] = useState<PracticeFormat[]>(["mcq", "matching", "fill-blank"]);
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFormat(format: PracticeFormat) {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  }

  async function handleGenerate() {
    if (formats.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-practice-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, formats, count: 9, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate practice test");
      const withIds: PracticeItem[] = data.items.map(
        (item: Omit<PracticeItem, "id">, i: number) => ({ ...item, id: `practice-${Date.now()}-${i}` }),
      );
      setItems(withIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate practice test");
    } finally {
      setLoading(false);
    }
  }

  if (items) {
    return <PracticeTestSession items={items} onFinish={() => setItems(null)} />;
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={subjectId}
          onChange={(e) => {
            const next = e.target.value as SubjectId;
            setSubjectId(next);
            setTopicId(topicsForSubject(next)[0].id);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        >
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {FORMAT_LABELS.map((f) => (
          <label key={f.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
            <input type="checkbox" checked={formats.includes(f.id)} onChange={() => toggleFormat(f.id)} />
            {f.label}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading || formats.length === 0}
        className="self-start rounded-full bg-accent px-4 py-1.5 text-sm text-onaccent disabled:opacity-40"
      >
        {loading ? "Generating…" : "Generate practice test"}
      </button>
    </div>
  );
}
