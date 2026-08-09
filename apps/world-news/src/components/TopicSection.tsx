import type { TopicSummary } from "@/lib/gemini";

export default function TopicSection({ topic }: { topic: TopicSummary }) {
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <h2 className="text-lg font-semibold tracking-tight">{topic.topic}</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{topic.summary}</p>
      {topic.keyPoints.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {topic.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted">
              <span aria-hidden className="mt-1.5 h-1 w-1 flex-none rounded-full bg-accent" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
