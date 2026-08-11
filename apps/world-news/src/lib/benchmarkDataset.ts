// Real event clustering evaluation dataset — diverse, multi-country, syndicated.
// Each case is a ground-truth event with near-duplicate wires + distractors.
// Used by src/lib/benchmark.ts evaluateBenchmark for P/R/F1.

import type { BenchmarkCase } from "./benchmark";

export const EXTENDED_CASES: BenchmarkCase[] = [
  {
    name: "syndicated-wire-wire",
    articles: [
      { id: "w1", title: "Israel and Hamas agree to extended ceasefire", url: "https://reuters.com/w1", publisher: "reuters.com", tags: ["ceasefire","gaza"], topic: "World & Conflict", location: { label: "Gaza", lat: 31.5, lng: 34.4, countryCode: "PS" } },
      { id: "w2", title: "Israel, Hamas agree to extend Gaza ceasefire", url: "https://apnews.com/w2", publisher: "apnews.com", tags: ["ceasefire","gaza"], topic: "World & Conflict", location: { label: "Gaza", lat: 31.5, lng: 34.45, countryCode: "PS" } },
      { id: "w3", title: "Gaza ceasefire extended as mediators push for deal", url: "https://bbc.co.uk/w3", publisher: "bbc.co.uk", tags: ["ceasefire","gaza"], topic: "World & Conflict", location: { label: "Gaza City", lat: 31.5, lng: 34.46, countryCode: "PS" } },
      { id: "d1", title: "Tokyo stocks close higher on tech gains", url: "https://example.com/d1", publisher: "example.com", tags: ["stocks"], topic: "Economy & Business", location: { label: "Tokyo", lat: 35.6, lng: 139.6, countryCode: "JP" } },
    ],
    expectedGroups: [["w1","w2","w3"]],
  },
  {
    name: "near-duplicate-title-spread",
    articles: [
      { id: "n1", title: "ECB holds rates steady at 4 percent", url: "https://reuters.com/n1", publisher: "reuters.com", tags: ["ecb","rates"], topic: "Economy & Business", location: { label: "Frankfurt", lat: 50.1, lng: 8.6, countryCode: "DE" } },
      { id: "n2", title: "ECB keeps interest rates unchanged at 4%", url: "https://ft.com/n2", publisher: "ft.com", tags: ["ecb","rates"], topic: "Economy & Business", location: { label: "Frankfurt", lat: 50.11, lng: 8.68, countryCode: "DE" } },
      { id: "n3", title: "Fed raises rates by 25 bps", url: "https://reuters.com/n3", publisher: "reuters.com", tags: ["fed","rates"], topic: "Economy & Business", location: { label: "Washington", lat: 38.9, lng: -77.0, countryCode: "US" } },
    ],
    expectedGroups: [["n1","n2"]],
  },
  {
    name: "multi-location-regional-event",
    articles: [
      { id: "r1", title: "Storm batters French Atlantic coast", url: "https://lemonde.fr/r1", publisher: "lemonde.fr", tags: ["storm","weather"], topic: "Science & Health", location: { label: "Bordeaux", lat: 44.8, lng: -0.5, countryCode: "FR" } },
      { id: "r2", title: "Storm hits southwestern France — thousands without power", url: "https://bbc.co.uk/r2", publisher: "bbc.co.uk", tags: ["storm","weather"], topic: "Science & Health", location: { label: "La Rochelle", lat: 46.1, lng: -1.1, countryCode: "FR" } },
      { id: "r3", title: "UK braces for Storm Ciaran landfall", url: "https://theguardian.com/r3", publisher: "theguardian.com", tags: ["storm","uk"], topic: "Science & Health", location: { label: "Plymouth", lat: 50.3, lng: -4.1, countryCode: "GB" } },
    ],
    // r1+r2 same French storm; r3 is UK — different coverage area → separate
    expectedGroups: [["r1","r2"]],
  },
  {
    name: "original-vs-rewrite-same-event",
    articles: [
      { id: "o1", title: "Government unveils AI safety institute", url: "https://gov.uk/o1", publisher: "gov.uk", tags: ["ai","institute"], topic: "Technology", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "o2", title: "UK launches new AI safety institute to test models", url: "https://theguardian.com/o2", publisher: "theguardian.com", tags: ["ai","institute"], topic: "Technology", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "o3", title: "What the new UK AI safety institute means for startups", url: "https://ft.com/o3", publisher: "ft.com", tags: ["ai","startups"], topic: "Technology", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
    ],
    // All three cover the same announcement; o1 is primary, o2 syndication/rewrite, o3 analysis — but same event cluster
    expectedGroups: [["o1","o2","o3"]],
  },
  {
    name: "two-events-one-topic",
    articles: [
      { id: "t1", title: "Prime minister survives confidence vote 302-241", url: "https://bbc.co.uk/t1", publisher: "bbc.co.uk", tags: ["vote","parliament"], topic: "Politics", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "t2", title: "PM wins confidence vote with 302 to 241", url: "https://theguardian.com/t2", publisher: "theguardian.com", tags: ["vote","parliament"], topic: "Politics", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "t3", title: "Opposition unveils housing reform bill", url: "https://bbc.co.uk/t3", publisher: "bbc.co.uk", tags: ["housing","bill"], topic: "Politics", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
      { id: "t4", title: "Housing reform bill introduced by opposition MPs", url: "https://independent.co.uk/t4", publisher: "independent.co.uk", tags: ["housing","bill"], topic: "Politics", location: { label: "London", lat: 51.5, lng: -0.1, countryCode: "GB" } },
    ],
    expectedGroups: [["t1","t2"], ["t3","t4"]],
  },
];
