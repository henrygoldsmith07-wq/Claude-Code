import { addDays, dayStamp } from './kitchen.js';

const eventDays = (event) => {
  if (!event.start || !event.end) return [];
  if (event.allDay) {
    const out = [];
    for (let date = event.start.slice(0, 10); date < event.end.slice(0, 10); date = addDays(date, 1)) {
      out.push(date);
    }
    return out;
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out = [];
  for (let date = dayStamp(start); date <= dayStamp(end); date = addDays(date, 1)) {
    const dinnerStart = new Date(`${date}T16:00:00`);
    const dinnerEnd = new Date(`${date}T23:00:00`);
    if (start < dinnerEnd && end > dinnerStart) out.push(date);
  }
  return out;
};

export const busyMealDates = (events = []) =>
  [...new Set(events.flatMap(eventDays))].sort();

export async function readCalendarAvailability(provider, dates) {
  if (!dates.length) return [];
  const from = new Date(`${dates[0]}T00:00:00`).toISOString();
  const to = new Date(`${addDays(dates.at(-1), 1)}T00:00:00`).toISOString();
  const response = await fetch(`/api/integrations/calendar/events?${new URLSearchParams({
    provider, from, to,
  })}`, { credentials: 'same-origin' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Calendar availability could not be read.');
  const source = provider === 'google' ? 'Google Calendar' : 'Outlook Calendar';
  return busyMealDates(body.events).map((date) => ({ date, source, importedAt: Date.now() }));
}

