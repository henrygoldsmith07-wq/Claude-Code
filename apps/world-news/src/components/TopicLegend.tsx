import { TOPIC_COLOR_LIST } from "@/lib/topicColors";

// Small key mapping dot colours to topics, shown over the globe views.
export default function TopicLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden max-w-[42vw] flex-wrap gap-x-3 gap-y-1 rounded-lg border border-rule bg-panel/70 p-2.5 text-[11px] backdrop-blur sm:flex">
      {TOPIC_COLOR_LIST.map(({ topic, color }) => (
        <span key={topic} className="flex items-center gap-1.5 text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          {topic}
        </span>
      ))}
    </div>
  );
}
