"use client";

import { useState } from "react";
import { HistoryTable } from "@/components/HistoryTable";
import { ManageList } from "@/components/ManageList";
import { PulseSettings } from "@/components/PulseSettings";
import { SetupNotice } from "@/components/SetupNotice";
import { TodayList } from "@/components/TodayList";
import { isSupabaseConfigured, useHabitData } from "@/lib/supabase";

type Tab = "today" | "history" | "manage";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
  { id: "manage", label: "Manage" },
];

export default function Home() {
  const data = useHabitData();
  const [tab, setTab] = useState<Tab>("today");

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 flex-col items-center bg-bg px-6 py-16">
        <main className="flex w-full max-w-md flex-col items-center gap-8 text-ink">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo.svg" alt="" width={48} height={48} className="rounded-xl" aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Habit</h1>
            <p className="max-w-sm text-ink2">
              A quiet habit tracker — do the thing, keep the streak.
            </p>
          </div>
          <SetupNotice />
        </main>
      </div>
    );
  }

  const active = data.views.filter((view) => !view.archived);
  const archived = data.views.filter((view) => view.archived);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-4">
          <img src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight">Habit</h1>
          <p className="hidden text-sm text-ink3 sm:block">do the thing, keep the streak</p>
          <nav aria-label="Sections" className="ml-auto">
            <ul className="flex gap-1">
              {TABS.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setTab(entry.id)}
                    aria-current={tab === entry.id ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === entry.id ? "bg-surface text-ink" : "text-ink3 hover:text-ink"
                    }`}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {data.loading ? <p className="text-ink3">Loading your habits…</p> : null}
        {data.error ? (
          <p className="rounded-lg border border-line bg-dangersoft p-3 text-sm text-danger">
            {data.error}
          </p>
        ) : null}
        {!data.loading && data.error === null ? (
          <>
            {tab === "today" ? <TodayList views={active} toggle={data.toggle} /> : null}
            {tab === "history" ? <HistoryTable views={data.views} /> : null}
            {tab === "manage" ? (
              <div className="space-y-6">
                <PulseSettings enabled={data.pulseOptIn} onChange={data.setPulseOptIn} />
                <ManageList
                  active={active}
                  archived={archived}
                  addHabit={data.addHabit}
                  updateHabit={data.updateHabit}
                  setArchived={data.setArchived}
                  removeHabit={data.removeHabit}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
