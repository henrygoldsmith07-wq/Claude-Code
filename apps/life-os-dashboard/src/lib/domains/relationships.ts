"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { daysBetween, todayIso } from "@/lib/date";
import type { Contact } from "@/lib/types";

export function useRelationships() {
  const [contacts, setContacts] = useLocalStorage<Contact[]>("relationships.contacts", []);

  function addContact(contact: Omit<Contact, "id">) {
    setContacts([...contacts, { ...contact, id: crypto.randomUUID() }]);
  }
  function deleteContact(id: string) {
    setContacts(contacts.filter((c) => c.id !== id));
  }
  function markContactedToday(id: string) {
    setContacts(contacts.map((c) => (c.id === id ? { ...c, lastContactedDate: todayIso() } : c)));
  }

  const today = todayIso();
  function daysOverdue(contact: Contact): number {
    if (!contact.lastContactedDate) return Infinity;
    const daysSince = daysBetween(contact.lastContactedDate, today);
    return daysSince - contact.reachOutFrequencyDays;
  }

  const dueToReachOut = [...contacts]
    .filter((c) => daysOverdue(c) >= 0)
    .sort((a, b) => daysOverdue(b) - daysOverdue(a));

  return {
    contacts,
    addContact,
    deleteContact,
    markContactedToday,
    daysOverdue,
    stats: { dueToReachOut },
  };
}
