import type { Flashcard } from "./types";
import { isDue } from "./sm2";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Lower easiness factor means the topic is being forgotten faster, i.e. it's
// the weaker one; a group of never-reviewed cards (EF still at the 2.5
// default) is treated as average difficulty rather than automatically weak.
function weaknessScore(cards: Flashcard[]): number {
  const total = cards.reduce((sum, c) => sum + c.easinessFactor, 0);
  return -(total / cards.length);
}

// Builds a review queue that interleaves topics instead of blocking through
// one topic at a time. Interleaved practice forces retrieval cues to be
// reconstructed each time rather than carried over from the previous card,
// which produces better long-term retention than blocked practice even
// though it feels harder in the moment. Topics with a lower average
// easiness factor (i.e. weaker recall) are placed earlier in the rotation,
// so a session capped by `limit` still reaches the weakest material first.
export function buildInterleavedQueue(cards: Flashcard[], limit?: number, now = new Date()): Flashcard[] {
  const due = shuffle(cards.filter((c) => isDue(c, now)));

  const byTopic = new Map<string, Flashcard[]>();
  for (const card of due) {
    const bucket = byTopic.get(card.topicId);
    if (bucket) bucket.push(card);
    else byTopic.set(card.topicId, [card]);
  }

  const topicIds = [...byTopic.keys()].sort(
    (a, b) => weaknessScore(byTopic.get(b)!) - weaknessScore(byTopic.get(a)!),
  );

  const queue: Flashcard[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const topicId of topicIds) {
      const bucket = byTopic.get(topicId)!;
      const next = bucket.shift();
      if (next) {
        queue.push(next);
        added = true;
        if (limit !== undefined && queue.length >= limit) return queue;
      }
    }
  }
  return queue;
}
