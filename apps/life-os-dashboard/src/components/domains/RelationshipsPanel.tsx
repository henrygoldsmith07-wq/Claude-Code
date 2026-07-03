"use client";

import { useState } from "react";
import { useRelationships } from "@/lib/domains/relationships";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/shared/formClasses";

export default function RelationshipsPanel() {
  const { contacts, addContact, deleteContact, markContactedToday, daysOverdue, stats } = useRelationships();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [frequencyDays, setFrequencyDays] = useState("14");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addContact({
      name: name.trim(),
      relation: relation.trim(),
      lastContactedDate: null,
      reachOutFrequencyDays: Math.max(1, parseInt(frequencyDays, 10) || 14),
      notes: "",
    });
    setName("");
    setRelation("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Keep track of the people who matter and get nudged before you drift out of touch.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="People tracked" value={String(contacts.length)} />
        <StatCard
          label="Due to reach out"
          value={String(stats.dueToReachOut.length)}
          accent={stats.dueToReachOut.length > 0 ? "warn" : "default"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Add a contact</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="text"
            placeholder="Relation (friend, parent, mentor...)"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            placeholder="Days"
            title="Reach out every N days"
            value={frequencyDays}
            onChange={(e) => setFrequencyDays(e.target.value)}
            className={`${inputClass} w-24`}
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </section>

      {stats.dueToReachOut.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-amber-600">Reach out soon</h2>
          <ul className="flex flex-col gap-1">
            {stats.dueToReachOut.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.name} ({c.relation || "contact"}) — {daysOverdue(c) === Infinity ? "never contacted" : `${daysOverdue(c)}d overdue`}
                </span>
                <button onClick={() => markContactedToday(c.id)} className={ghostButtonClass}>
                  Mark contacted
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">All contacts</h2>
        {contacts.length === 0 ? (
          <EmptyState message="No contacts added yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.name} ({c.relation || "contact"}) — last contacted {c.lastContactedDate ?? "never"}, every{" "}
                  {c.reachOutFrequencyDays}d
                </span>
                <span className="flex gap-2">
                  <button onClick={() => markContactedToday(c.id)} className={ghostButtonClass}>
                    Contacted today
                  </button>
                  <button onClick={() => deleteContact(c.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
