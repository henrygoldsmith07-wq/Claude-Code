/** Meeting/topic collections + saved searches (client-safe, local model). */
export interface Collection { id: string; name: string; meetingIds: string[]; topic?: string; createdAt: string }
export interface SavedSearch { id: string; query: string; createdAt: string }

export function createCollection(name: string, meetingIds: string[], topic?: string): Collection {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name, meetingIds, topic, createdAt: new Date().toISOString() };
}

export function addToCollection(col: Collection, meetingId: string): Collection {
  if (col.meetingIds.includes(meetingId)) return col;
  return { ...col, meetingIds: [...col.meetingIds, meetingId] };
}

export function removeFromCollection(col: Collection, meetingId: string): Collection {
  return { ...col, meetingIds: col.meetingIds.filter((id)=>id!==meetingId) };
}

export function searchCollections(collections: Collection[], query: string): Collection[] {
  const q = query.trim().toLowerCase(); if (!q) return collections;
  return collections.filter((c)=> c.name.toLowerCase().includes(q) || (c.topic?.toLowerCase().includes(q)));
}

export function savedSearchMatches(meeting: { title: string; transcript?: { text: string } | null; summary?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase(); if (!q) return true;
  return meeting.title.toLowerCase().includes(q) || !!meeting.transcript?.text.toLowerCase().includes(q) || !!meeting.summary?.toLowerCase().includes(q);
}
