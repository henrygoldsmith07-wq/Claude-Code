import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { readCalendarAvailability } from '../lib/calendar.js';
import { useApp } from '../lib/store.jsx';

export default function CalendarAvailability({ dates }) {
  const app = useApp();
  const [provider, setProvider] = useState('google');
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState('');

  const importAvailability = async () => {
    setReading(true);
    setStatus('');
    try {
      const busy = await readCalendarAvailability(provider, dates);
      const outsideRange = (app.calendarBusy || []).filter((item) => !dates.includes(item.date));
      app.set({ calendarBusy: [...outsideRange, ...busy] });
      setStatus(
        busy.length
          ? `${busy.length} busy evening${busy.length === 1 ? '' : 's'} imported. The generator will leave them empty.`
          : 'No events overlap dinner time in this range.',
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Calendar availability</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          aria-label="Calendar provider"
          className="rounded-2xl border px-3 py-2.5 text-[0.8125rem] font-bold"
          style={{ borderColor: 'var(--line)', background: 'var(--card)', color: 'var(--ink)' }}
        >
          <option value="google">Google Calendar</option>
          <option value="azure-ad">Outlook Calendar</option>
        </select>
        <button
          type="button"
          onClick={importAvailability}
          disabled={reading}
          className="press rounded-2xl border px-3 py-2.5 text-[0.8125rem] font-extrabold disabled:opacity-50"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={15} /> {reading ? 'Reading…' : 'Find busy evenings'}
          </span>
        </button>
      </div>
      {status && <p className="text-center text-[0.75rem] font-semibold" style={{ color: 'var(--muted)' }}>{status}</p>}
    </div>
  );
}

