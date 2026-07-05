import { GoogleCalendarEvent, CalendarConflict } from '@/types';

export const mergeCalendars = (
  googleEvents: GoogleCalendarEvent[],
) => {
  const merged = [
    ...googleEvents.map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start.dateTime || e.start.date!,
      end: e.end.dateTime || e.end.date!,
      source: 'Google',
      original: e
    })),
  ];

  return merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
};

export const detectConflicts = (events: any[]): CalendarConflict[] => {
  const conflicts: CalendarConflict[] = [];
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const e1 = sorted[i];
      const e2 = sorted[j];

      const e1End = new Date(e1.end).getTime();
      const e2Start = new Date(e2.start).getTime();

      if (e2Start < e1End) {
        conflicts.push({
          title: `${e1.title} vs ${e2.title}`,
          startTime: new Date(Math.max(new Date(e1.start).getTime(), e2Start)).toISOString(),
          endTime: new Date(Math.min(e1End, new Date(e2.end).getTime())).toISOString(),
          sources: [e1.source, e2.source]
        });
      } else {
        break;
      }
    }
  }

  return conflicts;
};

export const suggestFocusBlocks = (events: any[], workDayStart = 9, workDayEnd = 17) => {
  const focusBlocks: { start: string; end: string }[] = [];
  const now = new Date();
  const todayStart = new Date(now.setHours(workDayStart, 0, 0, 0));
  const todayEnd = new Date(now.setHours(workDayEnd, 0, 0, 0));

  let lastEnd = todayStart.getTime();

  const sortedEvents = events
    .filter(e => new Date(e.start) >= todayStart && new Date(e.end) <= todayEnd)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const event of sortedEvents) {
    const eventStart = new Date(event.start).getTime();
    const gap = eventStart - lastEnd;

    // If gap is at least 90 minutes, suggest a focus block
    if (gap >= 90 * 60 * 1000) {
      focusBlocks.push({
        start: new Date(lastEnd).toISOString(),
        end: new Date(eventStart).toISOString()
      });
    }
    lastEnd = Math.max(lastEnd, new Date(event.end).getTime());
  }

  // Check gap at the end of the day
  if (todayEnd.getTime() - lastEnd >= 90 * 60 * 1000) {
    focusBlocks.push({
      start: new Date(lastEnd).toISOString(),
      end: todayEnd.toISOString()
    });
  }

  return focusBlocks;
};
