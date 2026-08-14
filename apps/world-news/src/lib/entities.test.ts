import { describe, it, expect } from "vitest";
import {
  canonicalEntity,
  entitySimilarity,
  extractEntities,
  extractNumerics,
  foldDiacritics,
  numericAgreement,
  personMatch,
  scriptOf,
  transliterate,
} from "./entities";
import { clusterScore } from "./clustering";

describe("script folding", () => {
  it("folds diacritics and atomic letters", () => {
    expect(foldDiacritics("Zełenski")).toBe("Zelenski");
    expect(foldDiacritics("Køln straße")).toBe("Koln strasse");
    expect(foldDiacritics("García")).toBe("Garcia");
  });

  it("romanises Cyrillic and Greek", () => {
    expect(transliterate("Киев")).toBe("kyev");
    expect(transliterate("Москва")).toBe("moskva");
    expect(transliterate("Αθήνα")).toContain("thin");
  });

  it("identifies the dominant script", () => {
    expect(scriptOf("Киев")).toBe("cyrillic");
    expect(scriptOf("東京")).toBe("han");
    expect(scriptOf("القاهرة")).toBe("arabic");
    expect(scriptOf("Berlin")).toBe("latin");
  });
});

describe("canonical entities", () => {
  it("collapses place aliases across languages", () => {
    for (const surface of ["Kyiv", "Kiev", "Kiew", "Kijów", "Киев"]) {
      expect(canonicalEntity(surface).id, surface).toBe("kyiv");
    }
    expect(canonicalEntity("Peking").id).toBe("beijing");
    expect(canonicalEntity("Moskau").id).toBe("moscow");
  });

  it("expands organisation acronyms across languages", () => {
    expect(canonicalEntity("ECB").id).toBe("european central bank");
    expect(canonicalEntity("BCE").id).toBe("european central bank");
    expect(canonicalEntity("EZB").id).toBe("european central bank");
    expect(canonicalEntity("OTAN").id).toBe("nato");
  });

  it("leaves unknown surfaces as normalised terms", () => {
    const r = canonicalEntity("Somewheresville");
    expect(r.matched).toBe(false);
    expect(r.id).toBe("somewheresville");
  });
});

describe("entity extraction", () => {
  it("finds registry entities in an English headline", () => {
    const e = extractEntities("ECB holds rates as Frankfurt meeting ends");
    expect(e.known).toContain("european central bank");
  });

  it("finds the same entity through a German surface form", () => {
    const e = extractEntities("EZB belasst Leitzins bei 3,25 Prozent");
    expect(e.known).toContain("european central bank");
  });

  it("does not read short common words as acronyms", () => {
    // "us" lowercase in prose must not become the United States.
    const e = extractEntities("Officials told us the review continues");
    expect(e.known).not.toContain("united states");
  });

  it("matches cross-script headlines through canonical ids", () => {
    const a = extractEntities("Drone strike hits Kyiv energy infrastructure");
    const b = extractEntities("Drohnenangriff auf Kiew trifft Energieinfrastruktur");
    const sim = entitySimilarity(a, b);
    expect(sim.shared).toContain("kyiv");
    expect(sim.crossLingual).toBe(true);
  });
});

describe("numerics", () => {
  it("extracts the figures a headline asserts", () => {
    expect(extractNumerics("Rates cut by 50 bps")).toContain("bps50");
    expect(extractNumerics("ECB holds at 3.25%")).toContain("pct3.25");
    expect(extractNumerics("PM survives vote 302-241")).toContain("302:241");
  });

  it("treats same-kind different-value figures as conflicting", () => {
    const a = extractNumerics("Central bank raises rates by 50 basis points");
    const b = extractNumerics("Central bank raises rates by 25 basis points");
    expect(numericAgreement(a, b).conflicting).toBe(true);
  });

  it("treats shared figures as agreement", () => {
    const a = extractNumerics("Vote carried 302-241");
    const b = extractNumerics("Motion passes by 302 to 241");
    expect(numericAgreement(a, b).shared.length).toBeGreaterThan(0);
  });
});

describe("person matching", () => {
  it("matches across transliteration and ordering", () => {
    expect(personMatch("Volodymyr Zelenskyy", "Selenskyj, Wolodymyr")).toBe(true);
    expect(personMatch("V. Zelensky", "Volodymyr Zelenskiy")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(personMatch("Christine Lagarde", "Narendra Modi")).toBe(false);
  });
});

describe("clusterScore uses entity evidence", () => {
  it("scores a cross-lingual pair above an unrelated same-topic pair", () => {
    const en = {
      id: "en", title: "ECB holds rates at 3.25% as inflation cools",
      url: "https://reuters.com/en", publisher: "reuters.com", tags: ["ecb", "rates"],
      topic: "Economy & Business", location: { label: "Frankfurt", lat: 50.11, lng: 8.68, countryCode: "DE" },
    };
    const de = {
      id: "de", title: "EZB belasst Leitzins bei 3,25 Prozent",
      url: "https://faz.net/de", publisher: "faz.net", tags: ["ecb", "rates"],
      topic: "Economy & Business", location: { label: "Frankfurt", lat: 50.11, lng: 8.68, countryCode: "DE" },
    };
    const other = {
      id: "other", title: "Copper hits nine-month high on supply concerns",
      url: "https://bloomberg.com/x", publisher: "bloomberg.com", tags: ["commodities"],
      topic: "Economy & Business", location: { label: "Santiago", lat: -33.45, lng: -70.67, countryCode: "CL" },
    };
    expect(clusterScore(en, de).score).toBeGreaterThan(clusterScore(en, other).score);
  });

  it("penalises conflicting figures between look-alike headlines", () => {
    const base = { url: "https://x.test/a", tags: ["rates"], topic: "Economy & Business" };
    const a = { ...base, id: "a", title: "Central bank raises rates by 50 basis points" };
    const b = { ...base, id: "b", title: "Central bank raises rates by 25 basis points" };
    const c = { ...base, id: "c", title: "Central bank raises rates by 50 bps" };
    expect(clusterScore(a, c).score).toBeGreaterThan(clusterScore(a, b).score);
  });
});
