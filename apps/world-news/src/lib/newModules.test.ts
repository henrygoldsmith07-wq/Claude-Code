import { describe, it, expect } from "vitest";
import { dedupeArticles, originalityForCluster } from "./dedup";
import { linkEvents, nextStatus, mergeEvents, splitEvent } from "./eventStore";
import { provenanceForStory, timelineConfidence, whatChangedSince } from "./provenance";
import { buildCoverageMatrix, detectGaps } from "./coverageMatrix";
import { buildEntityGraph, buildCountryGraph, buildEventGraph } from "./knowledgeGraph";
import { filterByPrefs, diversityGuard, isFilterBubble } from "./personalisation";
import { meaningfulChanges, shouldNotify } from "./notifications";
import { locationConfidence, regionalLabel, mapCluster } from "./geocode";
import { diversityReport } from "./sourcing";
import type { StoryCluster } from "./storyModel";
import type { StoredEvent } from "./eventStore";
import { TOPICS } from "./gemini";

function mkStory(over: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id: "s1", headline: "Test headline", topic: "Politics", summary: "Summary", keyPoints: ["KP1","KP2"],
    sources: [
      { url: "https://bbc.co.uk/a", title: "A", countryCode: "GB", perspective: "center", sourceKind: "newsroom" },
      { url: "https://nytimes.com/b", title: "B", countryCode: "US", perspective: "center-left", sourceKind: "newsroom" },
    ], sourceMix: { total: 2, byCountry: [{code:"GB",label:"United Kingdom",count:1},{code:"US",label:"United States",count:1}], byPerspective: [{perspective:"center",count:1},{perspective:"center-left",count:1}], byKind: [{kind:"newsroom",count:2}], primaryCount: 0, perspectiveEntropy: 1, kindDistinctCount: 1 },
    primarySources: [], timeline: [{date:"2025-01-01",label:"Event"}], conflictingClaims: [], widelyAgreedFacts: ["Fact"], uncertainty: ["Unknown"], corrections: [], coverageGaps: [], ...over
  } as StoryCluster;
}

describe("dedup", () => {
  it("removes exact URL dups", () => {
    const arts = [{ id:"a1", title:"Foo bar baz", url:"https://example.com/x", tags:[], publisher:"a" }, { id:"a2", title:"Other", url:"https://example.com/x", tags:[], publisher:"b" }];
    const r = dedupeArticles(arts as never);
    expect(r.kept.length).toBe(1); expect(r.removed.length).toBe(1);
  });
  it("flags near-duplicate syndicated titles", () => {
    const arts = [{ id:"a1", title:"Central bank raises rates by 50 bps", url:"https://reuters.com/a", tags:[], publisher:"reuters.com" }, { id:"a2", title:"Central bank raises rates by 50 bps — update", url:"https://apnews.com/b", tags:[], publisher:"apnews.com" }];
    const r = dedupeArticles(arts as never, 0.8);
    expect(r.removed.length).toBe(1);
  });
  it("originality labels wire+earliest as original", () => {
    const members = [{ id:"m1", title:"Gov unveils AI institute", publisher:"gov.uk", url:"https://gov.uk/x", tags:[], publishedAt:"2025-01-01T00:00:00Z" }, { id:"m2", title:"UK launches AI safety institute to test models", publisher:"theguardian.com", url:"https://theguardian.com/y", tags:[], publishedAt:"2025-01-01T01:00:00Z" }] as never;
    const m = originalityForCluster(members);
    expect(m.get("m1")).toBe("original");
  });
});

describe("eventStore", () => {
  it("links by headline similarity", () => {
    const prev: StoredEvent[] = [{ id:"e1", headline:"Storm batters French coast", topic:"Science & Health", summary:"", articleIds:["a1"], timeline:[], contradictions:[], widelyAgreedFacts:[], uncertainty:[], provenance:{note:"",groundingRate:1,liveLinkedClaims:0}, significance:50, significanceReasons:[], firstSeen:"2025-01-01", lastUpdated:"2025-01-01", status:"developing", corrections:[] } as unknown as StoredEvent];
    const map = linkEvents(prev, [{ headline:"Storm batters French Atlantic coast", topic:"Science & Health", id:"n1" }]);
    expect(map.get("n1")).toBe("e1");
  });
  it("nextStatus respects contested/correction", () => {
    expect(nextStatus("developing",{hasCorrection:true,daysSinceFirstSeen:1,isContested:false,isResolvedKeyword:false})).toBe("contested");
  });
  it("merge and split", () => {
    const a: StoredEvent = { id:"a", headline:"A", topic:"Politics", summary:"A", articleIds:["1"], timeline:[], contradictions:[], widelyAgreedFacts:[], uncertainty:[], provenance:{note:"",groundingRate:1,liveLinkedClaims:0}, significance:10, significanceReasons:[], firstSeen:"2025-01-01", lastUpdated:"2025-01-01", status:"developing", corrections:[] } as unknown as StoredEvent;
    const b: StoredEvent = { ...a, id:"b", headline:"B", articleIds:["2"] } as unknown as StoredEvent;
    const { merged } = mergeEvents(a,b);
    expect(merged.articleIds.length).toBe(2);
    const { a: aa, b: bb } = splitEvent(merged, "A2","B2");
    expect(aa.id).toBe("a"); expect(bb.id).not.toBe("a");
  });
});

describe("provenance", () => {
  it("maps keyPoints to sources", () => {
    const s = mkStory();
    const claims = provenanceForStory(s);
    expect(claims.length).toBe(2); expect(claims[0].sourceUrls.length).toBeGreaterThan(0);
  });
  it("timeline confidence scales with sources", () => {
    const s = mkStory({ timeline: [{date:"2025-01-01",label:"A"},{date:"2025-01-02",label:"B"},{date:"2025-01-03",label:"C"},{date:"2025-01-04",label:"D"}]});
    const tl = timelineConfidence(s);
    expect(tl.score).toBeGreaterThan(50);
  });
  it("whatChangedSince detects change", () => {
    const a = mkStory({ summary:"Old" }); const b = mkStory({ summary:"New summary improved" });
    const { changed } = whatChangedSince(a,b);
    expect(changed).toBe(true);
  });
});

describe("coverageMatrix", () => {
  it("builds matrix and gaps", () => {
    const news = { country:"X", code:"xx", generatedAt:new Date().toISOString(), topics:[], sources:[], points:[], conflicts:[], stories:[mkStory()], meta:{widelyAgreedFacts:[], uncertainty:[], coverageGaps:[], corrections:[], whatChangedSinceYesterday:null} } as never;
    const m = buildCoverageMatrix([news]);
    expect(m.size).toBeGreaterThan(0);
    const gaps = detectGaps([news], [...TOPICS]);
    expect(Array.isArray(gaps)).toBe(true);
  });
});

describe("knowledgeGraph", () => {
  it("builds entity/country/event graphs", () => {
    const news = { country:"X", code:"xx", generatedAt:new Date().toISOString(), topics:[], sources:[], points:[], conflicts:[], stories:[mkStory({ keyPoints:["ceasefire talks gaza","gaza aid"] })], meta:{widelyAgreedFacts:[], uncertainty:[], coverageGaps:[], corrections:[], whatChangedSinceYesterday:null} } as never;
    expect(buildEntityGraph([news]).nodes.length).toBeGreaterThan(0);
    expect(buildCountryGraph([news]).nodes.length).toBeGreaterThan(0);
    expect(buildEventGraph([news, news]).nodes.length).toBeGreaterThan(0);
  });
});

describe("personalisation & notifications", () => {
  it("filters by prefs and detects bubbles", () => {
    const s = [mkStory({ topic:"Politics" }), mkStory({ id:"s2", topic:"Sport" })];
    const f = filterByPrefs(s, { regions:[], topics:["Politics"], minPerspectives:1, maxSameCountryShare:0.6 });
    expect(f.length).toBe(1);
    const guard = diversityGuard([mkStory(), mkStory(), mkStory()], { regions:[], topics:[], minPerspectives:2, maxSameCountryShare:0.5 });
    expect(guard.passed).toBe(false);
    expect(isFilterBubble([mkStory(),mkStory(),mkStory(),mkStory(),mkStory()]).bubble).toBe(true);
  });
  it("meaningful changes and shouldNotify", () => {
    const base: Record<string, unknown> = { country:"X", code:"xx", generatedAt:new Date().toISOString(), topics:[], sources:[], points:[], conflicts:[], stories:[mkStory()], meta:{widelyAgreedFacts:[], uncertainty:[], coverageGaps:[], corrections:[], whatChangedSinceYesterday:null} };
    const prev = base as never;
    const next = { ...base, stories:[{...mkStory(), corrections:[{date:"2025-01-02",note:"Fixed figure"}]}] } as never;
    const changes = meaningfulChanges(prev, next);
    expect(changes.length).toBeGreaterThan(0);
    expect(shouldNotify(changes)).toBe(true);
  });
});

describe("geocode & sourcing", () => {
  it("location confidence and regional labels", () => {
    expect(locationConfidence({hasCoords:true,sourceCount:3,countryCode:"FR",hasAlternatives:false})).toBeGreaterThan(70);
    expect(regionalLabel(["US","CA","MX"])).toBe("North America");
    expect(mapCluster([{lat:0,lng:0},{lat:0.1,lng:0.1},{lat:40,lng:-74}]).size).toBe(2);
    expect(diversityReport({ total:2, byCountry:[{code:"GB",label:"GB",count:2}], byPerspective:[{perspective:"center",count:2}], byKind:[{kind:"newsroom",count:2}], primaryCount:0, perspectiveEntropy:0, kindDistinctCount:1 }).nonEnglishShare).toBe(0);
  });
});
