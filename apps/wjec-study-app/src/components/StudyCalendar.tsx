"use client";

import { useMemo, useState } from "react";
import type { CalendarBlock, Topic } from "@/lib/types";

interface Props {
  unscheduledTopics: Topic[];
  blocks: CalendarBlock[];
  onScheduleTopic: (topic: Topic, day: string, startHour: number) => void;
  onMoveBlock: (id: string, day: string, startHour: number) => void;
  onDeleteBlock: (id: string) => void;
  onSelectTopic: (topicId: string) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 - 22:00

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHour(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
}

// A month grid to pick a day, then an hourly grid for that day where topic
// chips can be dragged in to time-block them — the "physical planner" style
// scheduling view, as an alternative to the plain day-by-day list.
export default function StudyCalendar({
  unscheduledTopics,
  blocks,
  onScheduleTopic,
  onMoveBlock,
  onDeleteBlock,
  onSelectTopic,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => toDateOnly(today));

  const blocksByDay = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const b of blocks) {
      const list = map.get(b.day) ?? [];
      list.push(b);
      map.set(b.day, list);
    }
    return map;
  }, [blocks]);

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toDateOnly(new Date(year, month, d)));
    }
    return cells;
  }, [monthCursor]);

  const dayBlocks = blocksByDay.get(selectedDay) ?? [];
  const blocksByHour = new Map(dayBlocks.map((b) => [b.startHour, b]));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#dad5cb] bg-[#fbfaf7] p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="rounded-full border border-[#dad5cb] px-2 py-1 text-xs hover:bg-[#f1eee7]"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="font-display text-sm font-bold text-[#201e1a]">
          {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="rounded-full border border-[#dad5cb] px-2 py-1 text-xs hover:bg-[#f1eee7]"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#5a544b]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day, i) => {
          if (!day) return <span key={i} />;
          const count = blocksByDay.get(day)?.length ?? 0;
          const isToday = day === toDateOnly(today);
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setSelectedDay(day);
              }}
              className={
                "flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-xs " +
                (isSelected
                  ? "border-2 border-[#3b4a6b] bg-[#e7eaf1]"
                  : "border-[#dad5cb] hover:bg-[#f1eee7]")
              }
            >
              <span className={isToday ? "font-bold text-[#3b4a6b]" : "text-[#201e1a]"}>
                {Number(day.slice(-2))}
              </span>
              {count > 0 && <span className="h-1 w-1 rounded-full bg-[#3b4a6b]" />}
            </button>
          );
        })}
      </div>

      {unscheduledTopics.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-dashed border-[#dad5cb] pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a544b]">
            Drag a topic onto an hour to time-block it
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduledTopics.map((topic) => (
              <div
                key={topic.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/x-topic-id", topic.id)}
                onClick={() => onSelectTopic(topic.id)}
                className="cursor-grab rounded-full border border-[#dad5cb] bg-white px-3 py-1 text-xs text-[#201e1a] active:cursor-grabbing"
                title="Drag onto the calendar, or click to study now"
              >
                {topic.title}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-[#e9e6df] overflow-hidden rounded-lg border border-[#dad5cb]">
        {HOURS.map((hour) => {
          const block = blocksByHour.get(hour);
          return (
            <div
              key={hour}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const topicId = e.dataTransfer.getData("application/x-topic-id");
                const blockId = e.dataTransfer.getData("application/x-block-id");
                if (blockId) {
                  onMoveBlock(blockId, selectedDay, hour);
                } else if (topicId) {
                  const topic = unscheduledTopics.find((t) => t.id === topicId);
                  if (topic) onScheduleTopic(topic, selectedDay, hour);
                }
              }}
              className="flex min-h-9 items-center gap-2 px-2 py-1 text-xs hover:bg-[#f1eee7]"
            >
              <span className="w-10 shrink-0 text-[#8b8378]">{formatHour(hour)}</span>
              {block ? (
                <div
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("application/x-block-id", block.id)}
                  className="flex flex-1 items-center justify-between gap-2 rounded-md bg-[#e7eaf1] px-2 py-1 text-[#3b4a6b]"
                >
                  <span className="cursor-grab active:cursor-grabbing">{block.title}</span>
                  <button
                    onClick={() => onDeleteBlock(block.id)}
                    aria-label={`Remove ${block.title} from schedule`}
                    className="text-[#8b8378] hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="flex-1 border-b border-dotted border-[#dad5cb]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
