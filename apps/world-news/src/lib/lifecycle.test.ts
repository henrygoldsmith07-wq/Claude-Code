import { describe, it, expect } from "vitest";
import { lifecycleFor, linkEvents, mergeEvents, resolveEventId, splitEvent, correctionLog, type StoredEvent } from "./eventStore";
import { relate, relationsFor, whatChanged, whatRemainsUnknown, changeSummary } from "./storyRelations";
import { eventGeography, locationConfidence, regionalLabel, binPoints, renderBudget, type Locus } from "./eventGeography";
import { candidatesFor, decideNotifications, notificationsFor, type NotificationCandidate } from "./notifications";
import { analyseStudy, assignArm, compareProportions, eligibleForGlobe, requiredSampleSize, INSTRUMENT, type Response } from "./comprehension";
import { composeFeed, isFilterBubble, normalisePrefs, MIN_DISCOVERY_SHARE } from "./personalisation";
import type { StoryCluster } from "./storyModel";

const event = (over: Partial<StoredEvent> = {}): StoredEvent => ({
  id: "e1", headline: "Storm batters French coast", topic: "Science & Health", summary: "A storm hit.",
  status: "developing", significance: 50, significanceReasons: [],
  firstSeen: "2026-01-01T00:00:00Z", lastUpdated: "2026-01-01T00:00:00Z",
  articleIds: ["a1"], timeline: [], contradictions: [], widelyAgreedFacts: [], uncertainty: [],
  provenance: { note: "", groundingRate: 1, liveLinkedClaims: 0 },
  corrections: [], ...over,
} as StoredEvent);

const story = (over: Partial<StoryCluster> = {}): StoryCluster => ({
  id: "s1", headline: "Storm batters French coast", topic: "Science & Health",
  summary: "A storm hit the Atlantic coast of France.", keyPoints: [],
  location: { label: "Bordeaux", lat: 44.84, lng: -0.58, countryCode: "FR" },
  sources: [], sourceMix: { total: 0, byCountry: [], byPerspective: [], byKind: [], primaryCount: 0, perspectiveEntropy: 0, kindDistinctCount: 0 },
  primarySources: [], timeline: [], conflictingClaims: [], widelyAgreedFacts: [],
  uncertainty: [], corrections: [], coverageGaps: [], ...over,
});

describe("event linking", () => {
  it("links a rewritten headline through shared actors", () => {
    const prev = [event({ headline: "Kyiv power grid hit by drone strike", summary: "Kyiv lost power.", topic: "World & Conflict" })];
    const { map, candidates } = linkEvents(prev, [
      { id: "n1", headline: "Outages continue across Kyiv after strike on the grid", topic: "World & Conflict", at: "2026-01-02T00:00:00Z" },
    ]);
    expect(map.get("n1")).toBe("e1");
    expect(candidates[0].reasons.join(" ")).toMatch(/Shared actors|Headline overlap/);
  });

  it("refuses to link on topic alone", () => {
    const prev = [event({ headline: "Central bank holds rates", topic: "Economy & Business", summary: "Rates held." })];
    const { map } = linkEvents(prev, [
      { id: "n1", headline: "Copper hits nine-month high", topic: "Economy & Business", at: "2026-01-02T00:00:00Z" },
    ]);
    expect(map.has("n1")).toBe(false);
  });

  it("does not link across a long gap", () => {
    const prev = [event({ lastUpdated: "2026-01-01T00:00:00Z" })];
    const { map } = linkEvents(prev, [
      { id: "n1", headline: "Storm batters French coast", topic: "Science & Health", at: "2026-04-01T00:00:00Z" },
    ]);
    expect(map.has("n1")).toBe(false);
  });

  it("ignores events that were merged away", () => {
    const prev = [event({ supersededBy: "e2" })];
    const { map } = linkEvents(prev, [
      { id: "n1", headline: "Storm batters French coast again", topic: "Science & Health", at: "2026-01-02T00:00:00Z" },
    ]);
    expect(map.has("n1")).toBe(false);
  });
});

describe("merge and split", () => {
  it("keeps the earlier event as the survivor and leaves a forwarding pointer", () => {
    const a = event({ id: "a", firstSeen: "2026-01-01T00:00:00Z", articleIds: ["1"] });
    const b = event({ id: "b", firstSeen: "2026-01-03T00:00:00Z", articleIds: ["2"] });
    const { merged, superseded } = mergeEvents(b, a); // deliberately reversed
    expect(merged.id).toBe("a");
    expect(merged.articleIds).toEqual(["1", "2"]);
    expect(superseded.supersededBy).toBe("a");
    expect(resolveEventId([merged, superseded], "b")).toBe("a");
  });

  it("records why every correction happened", () => {
    const { merged, superseded } = mergeEvents(event({ id: "a" }), event({ id: "b" }));
    const log = correctionLog([merged, superseded]);
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log.every((c) => c.note.length > 0)).toBe(true);
  });

  it("moves only the named articles on a split", () => {
    const ev = event({ articleIds: ["1", "2", "3"] });
    const { kept, created } = splitEvent(ev, "Second event", ["3"]);
    expect(kept.articleIds).toEqual(["1", "2"]);
    expect(created.articleIds).toEqual(["3"]);
    expect(created.status).toBe("developing");
  });
});

describe("lifecycle", () => {
  it("marks a quiet event resolved rather than leaving it live", () => {
    const v = lifecycleFor({ hasCorrection: false, daysSinceFirstSeen: 9, daysSinceLastChange: 7, isContested: false, isResolvedKeyword: false, newSourcesToday: 0 });
    expect(v.status).toBe("resolved");
    expect(v.dormant).toBe(true);
  });

  it("keeps a contested event contested even when quiet", () => {
    const v = lifecycleFor({ hasCorrection: false, daysSinceFirstSeen: 20, daysSinceLastChange: 9, isContested: true, isResolvedKeyword: false, newSourcesToday: 0 });
    expect(v.status).toBe("contested");
  });

  it("calls a week-old story with fresh coverage ongoing", () => {
    const v = lifecycleFor({ hasCorrection: false, daysSinceFirstSeen: 8, daysSinceLastChange: 0, isContested: false, isResolvedKeyword: false, newSourcesToday: 3 });
    expect(v.status).toBe("ongoing");
  });
});

describe("story relations", () => {
  it("types a later development as a follow-up", () => {
    const earlier = story({ id: "a", headline: "NATO begins Baltic exercise", summary: "NATO drill in the Baltic.", timeline: [{ date: "2026-05-11", label: "start" }] });
    const later = story({ id: "b", headline: "NATO Baltic exercise enters second phase", summary: "The NATO drill continues.", timeline: [{ date: "2026-05-14", label: "phase 2" }] });
    const r = relate(later, earlier);
    expect(r?.kind).toBe("follow-up");
  });

  it("recognises a disputing story", () => {
    const a = story({ id: "a", headline: "Ministry denies NATO account of the incident", summary: "The ministry disputes the NATO version." });
    const b = story({ id: "b", headline: "NATO says incident occurred in its airspace", summary: "NATO reported the incident." });
    expect(relate(a, b)?.kind).toBe("counter-narrative");
  });

  it("returns nothing for unrelated stories", () => {
    expect(relate(story({ id: "a", headline: "Copper prices climb", summary: "Metals rose.", topic: "Economy & Business", location: undefined }),
                  story({ id: "b", headline: "Film festival lineup announced", summary: "Cannes announced.", topic: "Society & Culture", location: undefined }))).toBeNull();
  });

  it("ranks relations by strength", () => {
    const s = story({ id: "x", headline: "NATO exercise expands", summary: "NATO drill grows." });
    const rels = relationsFor(s, [
      story({ id: "y", headline: "NATO launches Baltic drill", summary: "NATO started the exercise." }),
      story({ id: "z", headline: "Bakery opens in Vilnius", summary: "A shop opened.", topic: "Society & Culture", location: undefined }),
    ]);
    expect(rels[0].toId).toBe("y");
  });
});

describe("what changed", () => {
  it("surfaces a revised figure above a reworded sentence", () => {
    const prev = story({ keyPoints: ["Fourteen people were detained", "Roads remain closed"] });
    const next = story({ keyPoints: ["Nineteen people were detained, officials say", "Roads remain closed"] });
    const changes = whatChanged(prev, next);
    expect(changes[0].kind).toBe("figure-revised");
    expect(changes[0].from).toBeDefined();
  });

  it("puts a correction at the top", () => {
    const prev = story({ keyPoints: ["A"] });
    const next = story({ keyPoints: ["A"], corrections: [{ date: "2026-01-02", note: "Earlier figure was wrong" }] });
    expect(whatChanged(prev, next)[0].kind).toBe("correction");
  });

  it("reports nothing for an unchanged story", () => {
    const s = story({ keyPoints: ["A", "B"] });
    expect(whatChanged(s, { ...s })).toHaveLength(0);
    expect(changeSummary([])).toBeNull();
  });

  it("notices a new dispute", () => {
    const prev = story();
    const next = story({ conflictingClaims: [{ claim: "A", attributedTo: ["x"], counterClaim: "B", counterAttributedTo: ["y"], disagreementDimension: "casualty count" }] });
    expect(whatChanged(prev, next).some((c) => c.kind === "dispute-added")).toBe(true);
  });
});

describe("what remains unknown", () => {
  it("asks who was responsible when an attack has no claim of responsibility", () => {
    const q = whatRemainsUnknown(story({ headline: "Explosion damages substation", summary: "A blast hit a substation overnight." }));
    expect(q.some((x) => x.category === "attribution")).toBe(true);
  });

  it("does not ask a question the story already answers", () => {
    const q = whatRemainsUnknown(story({ headline: "Group claimed responsibility for the attack", summary: "A group claimed responsibility for the attack." }));
    expect(q.some((x) => x.category === "attribution")).toBe(false);
  });

  it("carries through uncertainty the story stated itself", () => {
    const q = whatRemainsUnknown(story({ uncertainty: ["The death toll is not confirmed"] }));
    expect(q[0].category).toBe("stated");
  });
});

describe("event geography", () => {
  const locus = (over: Partial<Locus>): Locus => ({ label: "X", lat: 0, lng: 0, role: "primary", confidence: 80, reasons: [], ...over });

  it("draws one point when everything is in one place", () => {
    const g = eventGeography([locus({ label: "Bordeaux", lat: 44.84, lng: -0.58, countryCode: "FR" })]);
    expect(g.render).toBe("point");
    expect(g.multiLocation).toBe(false);
  });

  it("does not average two distant places into a point in between", () => {
    const g = eventGeography([
      locus({ label: "Rotterdam", lat: 51.92, lng: 4.48, countryCode: "NL" }),
      locus({ label: "Singapore", lat: 1.35, lng: 103.82, countryCode: "SG", role: "reaction" }),
    ]);
    expect(g.multiLocation).toBe(true);
    expect(g.focus?.label).toBe("Rotterdam");
  });

  it("treats a spread across several countries as a region", () => {
    const g = eventGeography([
      locus({ label: "Tallinn", lat: 59.44, lng: 24.75, countryCode: "EE", role: "secondary" }),
      locus({ label: "Riga", lat: 56.95, lng: 24.11, countryCode: "LV", role: "secondary" }),
      locus({ label: "Vilnius", lat: 54.69, lng: 25.28, countryCode: "LT", role: "secondary" }),
    ]);
    expect(g.render).toBe("region");
    expect(g.regionLabel).toBe("the Baltic states");
  });

  it("says so when nothing can be placed", () => {
    const g = eventGeography([]);
    expect(g.render).toBe("unplaced");
    expect(g.note).toMatch(/not mapped/);
  });

  it("names groups the way a reader would", () => {
    expect(regionalLabel(["SA", "AE", "QA"])).toBe("the Gulf states");
    expect(regionalLabel(["FR"])).toBeNull();
    expect(regionalLabel(["FR", "JP", "BR"])).toMatch(/^across /);
  });

  it("penalises an ambiguous place name", () => {
    const sure = locationConfidence({ hasCoords: true, sourceCount: 4, countryCode: "US", ambiguousMatches: 1, insideClaimedCountry: true });
    const vague = locationConfidence({ hasCoords: false, sourceCount: 1, ambiguousMatches: 5 });
    expect(sure.score).toBeGreaterThan(vague.score + 30);
    expect(vague.reasons.join(" ")).toMatch(/share this name/);
  });

  it("flags coordinates outside their claimed country", () => {
    const r = locationConfidence({ hasCoords: true, sourceCount: 3, countryCode: "FR", ambiguousMatches: 1, insideClaimedCountry: false });
    expect(r.reasons.join(" ")).toMatch(/outside the named country/);
  });

  it("bins points rather than dropping them on low-power devices", () => {
    const pts = Array.from({ length: 200 }, (_, i) => ({ lat: (i % 20) * 2, lng: (i % 17) * 3 }));
    const budget = renderBudget("low");
    const bins = binPoints(pts, budget.cellDeg);
    expect(bins.length).toBeLessThan(pts.length);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(pts.length);
    expect(budget.animate).toBe(false);
  });
});

describe("notification quality", () => {
  const cand = (over: Partial<NotificationCandidate>): NotificationCandidate => ({
    kind: "major-development", storyId: "s1", headline: "H", body: "B", score: 70, reasons: [], ...over,
  });

  it("does not interrupt for a timeline gaining an entry", () => {
    const c = candidatesFor(story(), [{ kind: "timeline-extended", text: "2 new dated events", weight: 45 }]);
    expect(c).toHaveLength(0);
  });

  it("holds low-scoring candidates below the threshold", () => {
    const d = decideNotifications([cand({ score: 40 })]);
    expect(d.send).toHaveLength(0);
    expect(d.hold[0].reason).toMatch(/threshold/);
  });

  it("respects quiet hours but lets a correction through", () => {
    const ctx = { localHour: 3, quietHours: { from: 22, to: 7 } };
    expect(decideNotifications([cand({ score: 75 })], ctx).send).toHaveLength(0);
    expect(decideNotifications([cand({ kind: "correction", score: 95 })], ctx).send).toHaveLength(1);
  });

  it("enforces a daily cap and rolls the rest into a digest", () => {
    const many = Array.from({ length: 6 }, (_, i) => cand({ storyId: `s${i}`, score: 80 }));
    const d = decideNotifications(many, { dailyCap: 2 });
    expect(d.send).toHaveLength(2);
    expect(d.digest).toMatch(/other update/);
  });

  it("does not repeat a notification already sent", () => {
    const d = decideNotifications([cand({ kind: "correction", score: 95 })], {
      recentlySent: [{ storyId: "s1", kind: "correction", at: "2026-01-01T00:00:00Z" }],
    });
    expect(d.send).toHaveLength(0);
  });

  it("sends at most one notification per story per round", () => {
    const d = decideNotifications([cand({ kind: "correction", score: 95 }), cand({ kind: "dispute", score: 80 })]);
    expect(d.send).toHaveLength(1);
  });

  it("only interrupts for a new story when it is significant", () => {
    const next = { stories: [story({ significance: 20 })] } as never;
    expect(notificationsFor(null, next).send).toHaveLength(0);
    const big = { stories: [story({ significance: 85 })] } as never;
    expect(notificationsFor(null, big).send).toHaveLength(1);
  });
});

describe("personalisation without narrowing", () => {
  const many = (n: number, topic: string, cc: string) =>
    Array.from({ length: n }, (_, i) => story({ id: `${topic}${cc}${i}`, topic, location: { label: cc, lat: 0, lng: 0, countryCode: cc } }));

  it("cannot have discovery switched off", () => {
    expect(normalisePrefs({ discoveryShare: 0 }).discoveryShare).toBe(MIN_DISCOVERY_SHARE);
  });

  it("reserves labelled slots for stories outside the reader's preferences", () => {
    const all = [...many(10, "Politics", "GB"), ...many(5, "Science & Health", "NG")];
    const feed = composeFeed(all, { topics: ["Politics"] }, 10);
    expect(feed.discoveryIds.length).toBeGreaterThan(0);
    expect(feed.composition.topics).toBeGreaterThan(1);
    expect(feed.discoveryReasons[feed.discoveryIds[0]]).toMatch(/Outside your topics/);
  });

  it("caps a single topic even when every preferred story shares it", () => {
    const all = [...many(20, "Politics", "GB"), ...many(4, "Sport", "JP")];
    const feed = composeFeed(all, { topics: ["Politics"], maxSameTopicShare: 0.5 }, 10);
    const politics = feed.stories.filter((s) => s.topic === "Politics").length;
    expect(politics).toBeLessThanOrEqual(6);
  });

  it("still detects a bubble when one is present", () => {
    expect(isFilterBubble(many(6, "Politics", "GB")).bubble).toBe(true);
  });
});

describe("globe comprehension study", () => {
  it("assigns an arm stably and splits roughly evenly", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `p${i}`);
    const globe = ids.filter((id) => assignArm(id) === "globe").length;
    expect(globe).toBeGreaterThan(150);
    expect(globe).toBeLessThan(250);
    expect(assignArm("p1")).toBe(assignArm("p1"));
  });

  it("excludes devices that cannot run the globe", () => {
    expect(eligibleForGlobe({ webgl: false })).toBe(false);
    expect(eligibleForGlobe({ webgl: true, reducedMotion: true })).toBe(false);
    expect(eligibleForGlobe({ webgl: true, deviceMemoryGb: 4 })).toBe(true);
  });

  it("reports an underpowered null as inconclusive, not as no effect", () => {
    const t = compareProportions(12, 20, 10, 20);
    expect(t.significant).toBe(false);
    expect(t.interpretation).toMatch(/inconclusive/i);
  });

  it("detects a real difference at adequate sample size", () => {
    const t = compareProportions(700, 1000, 550, 1000);
    expect(t.significant).toBe(true);
    expect(t.interpretation).toMatch(/Globe readers scored/);
  });

  it("sizes the sample it needs", () => {
    expect(requiredSampleSize(0.1)).toBeGreaterThan(300);
    expect(requiredSampleSize(0.2)).toBeLessThan(requiredSampleSize(0.1));
  });

  it("balances the instrument across question kinds", () => {
    const kinds = new Set(INSTRUMENT.map((q) => q.kind));
    expect(kinds.has("spatial")).toBe(true);
    expect(kinds.has("factual")).toBe(true);
    expect(kinds.has("calibration")).toBe(true);
  });

  it("calls out confidence without accuracy as a harm", () => {
    const responses: Response[] = [];
    // Globe arm: better spatial accuracy, but wildly overconfident.
    for (let i = 0; i < 400; i++) {
      responses.push({ participantId: `g${i}`, arm: "globe", questionId: "s1", correct: i % 10 < 8 });
      responses.push({ participantId: `g${i}`, arm: "globe", questionId: "f1", correct: i % 10 < 5 });
      responses.push({ participantId: `g${i}`, arm: "globe", questionId: "k1", correct: false, confidence: 95 });
      responses.push({ participantId: `l${i}`, arm: "list", questionId: "s1", correct: i % 10 < 5 });
      responses.push({ participantId: `l${i}`, arm: "list", questionId: "f1", correct: i % 10 < 5 });
      responses.push({ participantId: `l${i}`, arm: "list", questionId: "k1", correct: false, confidence: 55 });
    }
    const result = analyseStudy(responses);
    expect(result.primary.significant).toBe(true);
    expect(result.verdict).toMatch(/overrate their own understanding/);
  });
});
