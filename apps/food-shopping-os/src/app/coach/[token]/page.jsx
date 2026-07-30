import { notFound } from 'next/navigation';
import { readCoachShare } from '../../../server/coach-shares.js';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Shared coaching dashboard · Forq',
  robots: { index: false, follow: false },
};

const countEntries = (log = {}) => Object.values(log).reduce((sum, entries) => sum + entries.length, 0);
const countPlanned = (plan = {}) =>
  Object.values(plan).reduce((sum, day) => sum + Object.values(day || {}).filter(Boolean).length, 0);

const Stat = ({ label, value }) => (
  <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
    <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{label}</p>
    <p className="mt-1 text-[1.5rem] font-extrabold">{value}</p>
  </div>
);

export default async function CoachDashboard({ params }) {
  let share;
  try {
    share = await readCoachShare((await params).token);
  } catch {
    notFound();
  }
  const diary = share.data.diary || {};
  const nutrition = share.data.nutrition || {};
  const plan = share.data.plan || {};
  const health = share.data.health || {};
  const updated = share.updatedAt
    ? new Date(share.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not yet synced';

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <header className="mb-6 border-b pb-5" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Forq · read-only coach view</p>
        <h1 className="mt-1 text-[1.75rem] font-extrabold">{share.household.name}</h1>
        <p className="mt-2 text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
          Shared as “{share.label}”. Updated {updated}. This link cannot edit, message or export household data.
        </p>
      </header>

      <div className="space-y-6">
        {share.scopes.includes('diary') && (
          <section aria-labelledby="coach-diary">
            <h2 id="coach-diary" className="mb-3 text-[1.125rem] font-extrabold">Food diary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Logged days" value={Object.keys(diary.log || {}).length} />
              <Stat label="Food entries" value={countEntries(diary.log)} />
              <Stat label="Meals cooked" value={(diary.cooked || []).length} />
            </div>
          </section>
        )}

        {share.scopes.includes('nutrition') && (
          <section aria-labelledby="coach-nutrition">
            <h2 id="coach-nutrition" className="mb-3 text-[1.125rem] font-extrabold">Nutrition settings</h2>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <p className="font-bold capitalize">Goal: {nutrition.goal || 'Not set'}</p>
              <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                Dietary patterns: {(nutrition.diets || []).join(', ') || 'none recorded'}
              </p>
              <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
                Allergies: {(nutrition.allergies || []).join(', ') || 'none recorded'}
              </p>
            </div>
          </section>
        )}

        {share.scopes.includes('plan') && (
          <section aria-labelledby="coach-plan">
            <h2 id="coach-plan" className="mb-3 text-[1.125rem] font-extrabold">Meal plan</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Planned days" value={Object.keys(plan.plan || {}).length} />
              <Stat label="Planned meals" value={countPlanned(plan.plan)} />
            </div>
          </section>
        )}

        {share.scopes.includes('health') && (
          <section aria-labelledby="coach-health">
            <h2 id="coach-health" className="mb-3 text-[1.125rem] font-extrabold">Health records</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Measurements" value={(health.measurements || []).length} />
              <Stat label="Vitals" value={(health.vitals || []).length} />
              <Stat label="Sleep records" value={(health.sleep || []).length} />
              <Stat label="Blood results" value={(health.bloods || []).length} />
            </div>
          </section>
        )}
      </div>

      <footer className="mt-8 border-t pt-4 text-[0.75rem] font-semibold" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
        Access expires {new Date(share.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}.
        The household owner can revoke it immediately.
      </footer>
    </main>
  );
}

