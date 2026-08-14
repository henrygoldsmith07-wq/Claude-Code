// Source ownership and transparency registry.
//
// Two counts on a story page are only meaningful if this data exists:
//   - "independent accounts" — needs to know which outlets share an owner
//   - "source diversity"     — needs to know which are state-affiliated, which
//                              are the same wire under different mastheads, and
//                              which are local to the story rather than a
//                              foreign desk rewriting one
//
// What is recorded here is ownership structure and funding model, both matters
// of public record. What is *not* recorded is any judgement of reliability:
// state funding is a fact about an outlet's structure, not a verdict on a
// given article, and the UI is expected to present it that way. Readers who
// want the verdict follow the source link.
//
// The registry is a maintained approximation, not an authority. Unknown
// domains degrade to a conservative record rather than being dropped, so an
// outlet missing from this table is treated as "unknown ownership" and never
// silently counted as independent.

import type { Perspective, SourceKind } from "./storyModel";

export type OwnerType =
  | "listed"          // publicly traded company
  | "private"         // privately held
  | "trust"           // trust or foundation ownership
  | "public-service"  // publicly funded broadcaster with editorial independence in statute
  | "state"           // state owned or state controlled
  | "nonprofit"
  | "cooperative"
  | "unknown";

export type StateAffiliation = "none" | "public-service" | "state-funded" | "state-controlled";

export type Reach = "global" | "national" | "regional" | "local";

export interface SourceRecord {
  domain: string;
  name: string;
  countryCode: string;
  language: string;
  /** Ownership group. Outlets sharing this string are not independent of each other. */
  owner: string;
  ownerType: OwnerType;
  stateAffiliation: StateAffiliation;
  kind: SourceKind;
  reach: Reach;
  perspective: Perspective;
  /** One line on how the outlet is funded. */
  funding: string;
  transparency: {
    /** Ownership is publicly disclosed. */
    ownership: boolean;
    /** Published corrections policy. */
    corrections: boolean;
    /** Articles carry named bylines by default. */
    bylines: boolean;
  };
}

// Column order for the compact table below. Kept as a tuple so ~90 outlets stay
// auditable on one screen each rather than sprawling over 900 lines.
// [domain, name, cc, lang, owner, ownerType, stateAffiliation, kind, reach, perspective, funding, flags]
// flags: "o" ownership disclosed, "c" corrections policy, "b" bylines. "-" for absent.
type Row = [string, string, string, string, string, OwnerType, StateAffiliation, SourceKind, Reach, Perspective, string, string];

const ROWS: Row[] = [
  // --- Wires ---------------------------------------------------------------
  ["reuters.com", "Reuters", "GB", "en", "Thomson Reuters", "listed", "none", "wire", "global", "center", "Subscription and terminal revenue", "ocb"],
  ["apnews.com", "Associated Press", "US", "en", "Associated Press", "cooperative", "none", "wire", "global", "center", "Member cooperative of news organisations", "ocb"],
  ["afp.com", "Agence France-Presse", "FR", "fr", "AFP", "public-service", "state-funded", "wire", "global", "center", "Commercial revenue plus a French state subscription", "ocb"],
  ["dpa.com", "Deutsche Presse-Agentur", "DE", "de", "dpa", "cooperative", "none", "wire", "global", "center", "Cooperative owned by German media companies", "ocb"],
  ["efe.com", "EFE", "ES", "es", "Agencia EFE", "state", "state-funded", "wire", "global", "center", "Spanish state-owned news agency", "ocb"],
  ["ansa.it", "ANSA", "IT", "it", "ANSA", "cooperative", "none", "wire", "national", "center", "Cooperative of Italian publishers", "ocb"],
  ["bloomberg.com", "Bloomberg", "US", "en", "Bloomberg L.P.", "private", "none", "wire", "global", "center", "Financial terminal subscriptions", "ocb"],
  ["xinhuanet.com", "Xinhua", "CN", "zh", "Chinese state", "state", "state-controlled", "wire", "global", "unknown", "Chinese state news agency", "o--"],
  ["tass.com", "TASS", "RU", "ru", "Russian state", "state", "state-controlled", "wire", "global", "unknown", "Russian state news agency", "o--"],
  ["kyodonews.net", "Kyodo News", "JP", "ja", "Kyodo News", "cooperative", "none", "wire", "national", "center", "Cooperative of Japanese media", "ocb"],
  ["pti.in", "Press Trust of India", "IN", "en", "PTI", "cooperative", "none", "wire", "national", "center", "Cooperative of Indian newspapers", "o-b"],

  // --- Public-service broadcasters -----------------------------------------
  ["bbc.co.uk", "BBC News", "GB", "en", "BBC", "public-service", "public-service", "newsroom", "global", "center", "UK licence fee", "ocb"],
  ["bbc.com", "BBC News", "GB", "en", "BBC", "public-service", "public-service", "newsroom", "global", "center", "UK licence fee and commercial arm", "ocb"],
  ["npr.org", "NPR", "US", "en", "NPR", "nonprofit", "public-service", "newsroom", "national", "center-left", "Member stations, sponsorship, grants", "ocb"],
  ["pbs.org", "PBS", "US", "en", "PBS", "nonprofit", "public-service", "newsroom", "national", "center", "Member stations and grants", "ocb"],
  ["dw.com", "Deutsche Welle", "DE", "de", "Deutsche Welle", "public-service", "state-funded", "newsroom", "global", "center", "German federal budget", "ocb"],
  ["france24.com", "France 24", "FR", "fr", "France Médias Monde", "public-service", "state-funded", "newsroom", "global", "center", "French state funding", "ocb"],
  ["rfi.fr", "RFI", "FR", "fr", "France Médias Monde", "public-service", "state-funded", "newsroom", "global", "center", "French state funding", "ocb"],
  ["abc.net.au", "ABC News", "AU", "en", "ABC", "public-service", "public-service", "newsroom", "national", "center", "Australian federal funding", "ocb"],
  ["cbc.ca", "CBC News", "CA", "en", "CBC/Radio-Canada", "public-service", "public-service", "newsroom", "national", "center", "Canadian federal funding and advertising", "ocb"],
  ["rte.ie", "RTÉ", "IE", "en", "RTÉ", "public-service", "public-service", "newsroom", "national", "center", "Irish licence fee and advertising", "ocb"],
  ["nhk.or.jp", "NHK", "JP", "ja", "NHK", "public-service", "public-service", "newsroom", "national", "center", "Japanese receiving fee", "ocb"],
  ["swissinfo.ch", "SWI swissinfo", "CH", "de", "SRG SSR", "public-service", "public-service", "newsroom", "global", "center", "Swiss licence fee", "ocb"],
  ["aljazeera.com", "Al Jazeera English", "QA", "en", "Al Jazeera Media Network", "state", "state-funded", "newsroom", "global", "unknown", "Funded by the government of Qatar", "ocb"],

  // --- UK ------------------------------------------------------------------
  ["theguardian.com", "The Guardian", "GB", "en", "Scott Trust", "trust", "none", "newsroom", "global", "center-left", "Trust-owned, reader contributions and advertising", "ocb"],
  ["ft.com", "Financial Times", "GB", "en", "Nikkei", "listed", "none", "newsroom", "global", "center", "Subscriptions, owned by Nikkei", "ocb"],
  ["economist.com", "The Economist", "GB", "en", "The Economist Group", "private", "none", "newsroom", "global", "center", "Subscriptions", "oc-"],
  ["telegraph.co.uk", "The Telegraph", "GB", "en", "Telegraph Media Group", "private", "none", "newsroom", "national", "center-right", "Subscriptions and advertising", "ocb"],
  ["independent.co.uk", "The Independent", "GB", "en", "Independent Digital News & Media", "private", "none", "newsroom", "national", "center-left", "Advertising and subscriptions", "ocb"],
  ["thetimes.co.uk", "The Times", "GB", "en", "News Corp", "listed", "none", "newsroom", "national", "center-right", "Subscriptions, News Corp owned", "ocb"],
  ["standard.co.uk", "Evening Standard", "GB", "en", "Evening Standard Ltd", "private", "none", "newsroom", "local", "center", "Advertising", "o-b"],
  ["heraldscotland.com", "The Herald", "GB", "en", "Newsquest", "private", "none", "newsroom", "regional", "center", "Subscriptions and advertising", "o-b"],
  ["walesonline.co.uk", "WalesOnline", "GB", "en", "Reach plc", "listed", "none", "newsroom", "regional", "center", "Advertising", "o-b"],
  ["manchestereveningnews.co.uk", "Manchester Evening News", "GB", "en", "Reach plc", "listed", "none", "newsroom", "local", "center", "Advertising", "o-b"],

  // --- US ------------------------------------------------------------------
  ["nytimes.com", "The New York Times", "US", "en", "New York Times Company", "listed", "none", "newsroom", "global", "center-left", "Subscriptions", "ocb"],
  ["washingtonpost.com", "The Washington Post", "US", "en", "Nash Holdings", "private", "none", "newsroom", "national", "center-left", "Subscriptions, privately owned", "ocb"],
  ["wsj.com", "The Wall Street Journal", "US", "en", "News Corp", "listed", "none", "newsroom", "global", "center-right", "Subscriptions, News Corp owned", "ocb"],
  ["nypost.com", "New York Post", "US", "en", "News Corp", "listed", "none", "newsroom", "national", "right", "Advertising, News Corp owned", "o-b"],
  ["cnn.com", "CNN", "US", "en", "Warner Bros. Discovery", "listed", "none", "newsroom", "global", "center-left", "Carriage fees and advertising", "ocb"],
  ["foxnews.com", "Fox News", "US", "en", "Fox Corporation", "listed", "none", "newsroom", "national", "right", "Carriage fees and advertising", "o-b"],
  ["politico.com", "Politico", "US", "en", "Axel Springer", "private", "none", "newsroom", "national", "center", "Subscriptions and advertising", "ocb"],
  ["axios.com", "Axios", "US", "en", "Cox Enterprises", "private", "none", "newsroom", "national", "center", "Advertising and subscriptions", "o-b"],
  ["latimes.com", "Los Angeles Times", "US", "en", "Nant Capital", "private", "none", "newsroom", "regional", "center-left", "Subscriptions, privately owned", "ocb"],
  ["chicagotribune.com", "Chicago Tribune", "US", "en", "Alden Global Capital", "private", "none", "newsroom", "regional", "center", "Subscriptions, hedge-fund owned", "o-b"],
  ["usatoday.com", "USA Today", "US", "en", "Gannett", "listed", "none", "newsroom", "national", "center", "Advertising and subscriptions", "ocb"],
  ["propublica.org", "ProPublica", "US", "en", "ProPublica", "nonprofit", "none", "newsroom", "national", "center-left", "Philanthropic donations", "ocb"],
  ["texastribune.org", "The Texas Tribune", "US", "en", "Texas Tribune", "nonprofit", "none", "newsroom", "regional", "center", "Member donations and grants", "ocb"],

  // --- France --------------------------------------------------------------
  ["lemonde.fr", "Le Monde", "FR", "fr", "Groupe Le Monde", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "ocb"],
  ["lefigaro.fr", "Le Figaro", "FR", "fr", "Groupe Dassault", "private", "none", "newsroom", "national", "center-right", "Subscriptions and advertising", "o-b"],
  ["liberation.fr", "Libération", "FR", "fr", "Fonds de dotation", "trust", "none", "newsroom", "national", "left", "Endowment fund and subscriptions", "o-b"],
  ["lesechos.fr", "Les Échos", "FR", "fr", "LVMH", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["ouest-france.fr", "Ouest-France", "FR", "fr", "Association Ouest-France", "nonprofit", "none", "newsroom", "regional", "center", "Association-owned regional daily", "o-b"],
  ["lequipe.fr", "L'Équipe", "FR", "fr", "Groupe Amaury", "private", "none", "newsroom", "national", "center", "Subscriptions", "--b"],

  // --- Germany, Austria, Switzerland ---------------------------------------
  ["spiegel.de", "Der Spiegel", "DE", "de", "Spiegel-Verlag", "private", "none", "newsroom", "national", "center-left", "Subscriptions, part staff-owned", "ocb"],
  ["zeit.de", "Die Zeit", "DE", "de", "Zeitverlag", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["faz.net", "Frankfurter Allgemeine", "DE", "de", "FAZIT-Stiftung", "trust", "none", "newsroom", "national", "center-right", "Foundation-owned, subscriptions", "o-b"],
  ["sueddeutsche.de", "Süddeutsche Zeitung", "DE", "de", "Südwestdeutsche Medien Holding", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["welt.de", "Die Welt", "DE", "de", "Axel Springer", "private", "none", "newsroom", "national", "center-right", "Subscriptions", "o-b"],
  ["derstandard.at", "Der Standard", "AT", "de", "Bronner Family", "private", "none", "newsroom", "national", "center-left", "Subscriptions and advertising", "o-b"],
  ["nzz.ch", "Neue Zürcher Zeitung", "CH", "de", "NZZ-Mediengruppe", "listed", "none", "newsroom", "national", "center-right", "Subscriptions", "o-b"],

  // --- Southern Europe -----------------------------------------------------
  ["elpais.com", "El País", "ES", "es", "Grupo PRISA", "listed", "none", "newsroom", "global", "center-left", "Subscriptions and advertising", "ocb"],
  ["elmundo.es", "El Mundo", "ES", "es", "Unidad Editorial", "private", "none", "newsroom", "national", "center-right", "Subscriptions", "o-b"],
  ["lavanguardia.com", "La Vanguardia", "ES", "es", "Grupo Godó", "private", "none", "newsroom", "regional", "center", "Subscriptions", "o-b"],
  ["corriere.it", "Corriere della Sera", "IT", "it", "RCS MediaGroup", "listed", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["repubblica.it", "la Repubblica", "IT", "it", "GEDI Gruppo Editoriale", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["publico.pt", "Público", "PT", "pt", "Sonae", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["kathimerini.gr", "Kathimerini", "GR", "el", "Kathimerini S.A.", "private", "none", "newsroom", "national", "center-right", "Subscriptions", "o-b"],

  // --- Nordics, Benelux, Central Europe ------------------------------------
  ["dn.se", "Dagens Nyheter", "SE", "sv", "Bonnier", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["nrc.nl", "NRC", "NL", "nl", "Mediahuis", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["politiken.dk", "Politiken", "DK", "da", "JP/Politikens Hus", "trust", "none", "newsroom", "national", "center-left", "Foundation-owned", "o-b"],
  ["hs.fi", "Helsingin Sanomat", "FI", "fi", "Sanoma", "listed", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["gazeta.pl", "Gazeta Wyborcza", "PL", "pl", "Agora", "listed", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["pravda.com.ua", "Ukrainska Pravda", "UA", "uk", "Ukrainska Pravda", "private", "none", "newsroom", "national", "center", "Advertising and donations", "o-b"],
  ["kyivindependent.com", "The Kyiv Independent", "UA", "en", "Kyiv Independent", "nonprofit", "none", "newsroom", "national", "center", "Reader membership and grants", "ocb"],
  ["themoscowtimes.com", "The Moscow Times", "NL", "en", "Stichting 2 Oktober", "nonprofit", "none", "newsroom", "national", "center", "Donations, based in Amsterdam", "o-b"],
  ["rt.com", "RT", "RU", "en", "Russian state", "state", "state-controlled", "newsroom", "global", "unknown", "Funded by the Russian state", "o--"],

  // --- Middle East ---------------------------------------------------------
  ["haaretz.com", "Haaretz", "IL", "he", "Schocken Family / M. Leumi", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["jpost.com", "The Jerusalem Post", "IL", "en", "Jerusalem Post Group", "private", "none", "newsroom", "national", "center-right", "Subscriptions and advertising", "o-b"],
  ["timesofisrael.com", "The Times of Israel", "IL", "en", "Times of Israel", "private", "none", "newsroom", "national", "center", "Advertising and community funding", "o-b"],
  ["thenationalnews.com", "The National", "AE", "en", "International Media Investments", "private", "state-funded", "newsroom", "national", "unknown", "Abu Dhabi-based, state-linked ownership", "o-b"],
  ["arabnews.com", "Arab News", "SA", "en", "Saudi Research and Media Group", "listed", "state-funded", "newsroom", "national", "unknown", "Saudi media group with state links", "o-b"],
  ["middleeasteye.net", "Middle East Eye", "GB", "en", "M.E.E. Ltd", "private", "none", "newsroom", "regional", "unknown", "Privately funded, ownership partly undisclosed", "--b"],
  ["hurriyetdailynews.com", "Hürriyet Daily News", "TR", "en", "Demirören Holding", "private", "none", "newsroom", "national", "center-right", "Advertising and subscriptions", "o-b"],

  // --- Asia ----------------------------------------------------------------
  ["asahi.com", "The Asahi Shimbun", "JP", "ja", "Asahi Shimbun Company", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["nikkei.com", "Nikkei", "JP", "ja", "Nikkei Inc.", "private", "none", "newsroom", "global", "center", "Subscriptions", "ocb"],
  ["japantimes.co.jp", "The Japan Times", "JP", "en", "News2u Holdings", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["scmp.com", "South China Morning Post", "HK", "en", "Alibaba Group", "listed", "none", "newsroom", "regional", "center", "Subscriptions, Alibaba owned", "ocb"],
  ["chinadaily.com.cn", "China Daily", "CN", "en", "Chinese state", "state", "state-controlled", "newsroom", "global", "unknown", "Published by the Chinese state", "o--"],
  ["koreaherald.com", "The Korea Herald", "KR", "en", "Herald Corporation", "private", "none", "newsroom", "national", "center", "Subscriptions and advertising", "o-b"],
  ["thehindu.com", "The Hindu", "IN", "en", "Kasturi & Sons", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "ocb"],
  ["hindustantimes.com", "Hindustan Times", "IN", "en", "HT Media", "listed", "none", "newsroom", "national", "center", "Advertising and subscriptions", "o-b"],
  ["indianexpress.com", "The Indian Express", "IN", "en", "Indian Express Group", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["dawn.com", "Dawn", "PK", "en", "Dawn Media Group", "private", "none", "newsroom", "national", "center", "Subscriptions and advertising", "o-b"],
  ["thedailystar.net", "The Daily Star", "BD", "en", "Mediaworld", "private", "none", "newsroom", "national", "center", "Advertising", "o-b"],
  ["straitstimes.com", "The Straits Times", "SG", "en", "SPH Media Trust", "trust", "state-funded", "newsroom", "national", "center", "Trust with government funding support", "o-b"],
  ["bangkokpost.com", "Bangkok Post", "TH", "en", "Post Publishing", "listed", "none", "newsroom", "national", "center", "Advertising and subscriptions", "o-b"],
  ["jakartapost.com", "The Jakarta Post", "ID", "en", "PT Bina Media Tenggara", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["rappler.com", "Rappler", "PH", "en", "Rappler Inc.", "private", "none", "newsroom", "national", "center", "Advertising and grants", "ocb"],

  // --- Africa --------------------------------------------------------------
  ["nation.africa", "Nation", "KE", "en", "Nation Media Group", "listed", "none", "newsroom", "regional", "center", "Advertising and subscriptions", "o-b"],
  ["businessday.ng", "BusinessDay", "NG", "en", "BusinessDay Media", "private", "none", "newsroom", "national", "center", "Advertising and subscriptions", "o-b"],
  ["premiumtimesng.com", "Premium Times", "NG", "en", "Premium Times", "nonprofit", "none", "newsroom", "national", "center", "Grants and advertising", "ocb"],
  ["news24.com", "News24", "ZA", "en", "Naspers / Media24", "listed", "none", "newsroom", "national", "center", "Subscriptions and advertising", "o-b"],
  ["mg.co.za", "Mail & Guardian", "ZA", "en", "Mail & Guardian Media", "private", "none", "newsroom", "national", "center-left", "Subscriptions", "o-b"],
  ["theafricareport.com", "The Africa Report", "FR", "en", "Jeune Afrique Media Group", "private", "none", "newsroom", "regional", "center", "Subscriptions", "o-b"],
  ["ahram.org.eg", "Al-Ahram", "EG", "ar", "Egyptian state", "state", "state-controlled", "newsroom", "national", "unknown", "State-owned Egyptian publisher", "o--"],

  // --- Americas ------------------------------------------------------------
  ["globo.com", "O Globo", "BR", "pt", "Grupo Globo", "private", "none", "newsroom", "national", "center-right", "Subscriptions and advertising", "o-b"],
  ["folha.uol.com.br", "Folha de S.Paulo", "BR", "pt", "Grupo Folha", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["clarin.com", "Clarín", "AR", "es", "Grupo Clarín", "listed", "none", "newsroom", "national", "center-right", "Subscriptions and advertising", "o-b"],
  ["eluniversal.com.mx", "El Universal", "MX", "es", "Compañía Periodística Nacional", "private", "none", "newsroom", "national", "center", "Advertising", "o-b"],
  ["eltiempo.com", "El Tiempo", "CO", "es", "Grupo Planeta / Sarmiento", "private", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],
  ["theglobeandmail.com", "The Globe and Mail", "CA", "en", "Woodbridge Company", "private", "none", "newsroom", "national", "center", "Subscriptions", "ocb"],
  ["smh.com.au", "The Sydney Morning Herald", "AU", "en", "Nine Entertainment", "listed", "none", "newsroom", "national", "center", "Subscriptions", "ocb"],
  ["nzherald.co.nz", "The New Zealand Herald", "NZ", "en", "NZME", "listed", "none", "newsroom", "national", "center", "Subscriptions", "o-b"],

  // --- Official / multilateral --------------------------------------------
  ["un.org", "United Nations", "", "en", "United Nations", "state", "none", "official", "global", "unknown", "Member-state funded", "oc-"],
  ["who.int", "World Health Organization", "", "en", "World Health Organization", "state", "none", "official", "global", "unknown", "Member-state and donor funded", "oc-"],
  ["imf.org", "International Monetary Fund", "", "en", "IMF", "state", "none", "official", "global", "unknown", "Member-state funded", "oc-"],
  ["europa.eu", "European Union", "", "en", "European Union", "state", "none", "official", "global", "unknown", "EU budget", "oc-"],
  ["gov.uk", "UK Government", "GB", "en", "UK Government", "state", "none", "official", "national", "unknown", "Public funds", "oc-"],
  ["whitehouse.gov", "The White House", "US", "en", "US Government", "state", "none", "official", "national", "unknown", "Public funds", "oc-"],
];

function expand(r: Row): SourceRecord {
  const [domain, name, cc, lang, owner, ownerType, stateAffiliation, kind, reach, perspective, funding, flags] = r;
  return {
    domain, name, countryCode: cc, language: lang, owner, ownerType, stateAffiliation, kind, reach, perspective, funding,
    transparency: {
      ownership: flags.includes("o"),
      corrections: flags.includes("c"),
      bylines: flags.includes("b"),
    },
  };
}

const REGISTRY: Map<string, SourceRecord> = new Map(ROWS.map((r) => [r[0], expand(r)]));

function normaliseDomain(input: string): string {
  const raw = input.includes("://") ? (() => { try { return new URL(input).hostname; } catch { return input; } })() : input;
  return raw.replace(/^(www|amp|m|mobile)\./, "").toLowerCase();
}

/**
 * Look up an outlet.
 *
 * Unknown domains return a conservative record rather than undefined: unknown
 * ownership means "cannot be shown to be independent", and the caller should
 * not have to remember to handle the gap.
 */
export function lookupSource(domainOrUrl: string): SourceRecord {
  const d = normaliseDomain(domainOrUrl);
  const hit = REGISTRY.get(d);
  if (hit) return hit;
  // Try the registrable suffix: "news.bbc.co.uk" → "bbc.co.uk".
  const parts = d.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const alt = REGISTRY.get(candidate);
    if (alt) return alt;
  }
  return {
    domain: d,
    name: d || "Unknown source",
    countryCode: "",
    language: "",
    owner: `unregistered:${d}`,
    ownerType: "unknown",
    stateAffiliation: "none",
    kind: "unknown",
    reach: "national",
    perspective: "unknown",
    funding: "Ownership and funding not recorded in the registry",
    transparency: { ownership: false, corrections: false, bylines: false },
  };
}

/** Ownership group for a domain — the key `claims.independenceGroups` uses. */
export function ownerOf(domainOrUrl: string): string {
  return lookupSource(domainOrUrl).owner;
}

/** True when two outlets share an owner and so cannot corroborate each other. */
export function shareOwner(a: string, b: string): boolean {
  const oa = ownerOf(a), ob = ownerOf(b);
  return oa === ob && !oa.startsWith("unregistered:");
}

/**
 * 0..100 transparency score.
 *
 * Measures what an outlet discloses about itself, not whether its reporting is
 * good. An outlet can score 100 here and still be wrong about a story; the
 * point is that the reader can find out who is behind it.
 */
export function transparencyScore(rec: SourceRecord): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20;
  if (rec.transparency.ownership) { score += 30; reasons.push("Ownership publicly disclosed"); }
  else reasons.push("Ownership not clearly disclosed");
  if (rec.transparency.corrections) { score += 25; reasons.push("Published corrections policy"); }
  if (rec.transparency.bylines) { score += 15; reasons.push("Named bylines"); }
  if (rec.ownerType === "unknown") { score -= 15; reasons.push("Not in the ownership registry"); }
  if (rec.stateAffiliation === "state-controlled") reasons.push("State-controlled — structure disclosed, editorial independence limited");
  else if (rec.stateAffiliation === "state-funded") reasons.push("State-funded with editorial charter");
  else if (rec.stateAffiliation === "public-service") reasons.push("Public-service broadcaster");
  if (rec.ownerType === "trust" || rec.ownerType === "nonprofit") { score += 10; reasons.push("Trust or nonprofit ownership"); }
  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4) };
}

/** One neutral sentence describing who is behind an outlet. */
export function describeSource(rec: SourceRecord): string {
  const where = rec.countryCode ? ` (${rec.countryCode})` : "";
  const state =
    rec.stateAffiliation === "state-controlled" ? ", state-controlled"
      : rec.stateAffiliation === "state-funded" ? ", state-funded"
        : rec.stateAffiliation === "public-service" ? ", public-service"
          : "";
  return `${rec.name}${where} — owned by ${rec.owner}${state}. ${rec.funding}.`;
}

// ---------------------------------------------------------------------------
// Local and regional discovery
// ---------------------------------------------------------------------------

/**
 * Outlets based in a country, nearest-to-the-story first.
 *
 * Coverage of an event in Lagos written from a London desk is not the same as
 * coverage from Lagos, and the ranking here — local, then regional, then
 * national, then global — is what lets the UI ask for the former.
 */
export function localSourcesFor(countryCode: string, kinds?: Reach[]): SourceRecord[] {
  const cc = countryCode.toUpperCase();
  const order: Record<Reach, number> = { local: 0, regional: 1, national: 2, global: 3 };
  return [...REGISTRY.values()]
    .filter((r) => r.countryCode === cc && (!kinds || kinds.includes(r.reach)))
    .sort((a, b) => order[a.reach] - order[b.reach] || a.name.localeCompare(b.name));
}

/** Registered outlets publishing in a language — for non-English recall. */
export function sourcesInLanguage(language: string): SourceRecord[] {
  return [...REGISTRY.values()].filter((r) => r.language === language.toLowerCase());
}

export function registrySize(): { outlets: number; countries: number; owners: number; languages: number } {
  const recs = [...REGISTRY.values()];
  return {
    outlets: recs.length,
    countries: new Set(recs.map((r) => r.countryCode).filter(Boolean)).size,
    owners: new Set(recs.map((r) => r.owner)).size,
    languages: new Set(recs.map((r) => r.language).filter(Boolean)).size,
  };
}

export const REGISTRY_METHODOLOGY =
  "Ownership and funding are matters of public record and are listed here as structure, not as a " +
  "reliability rating. State funding, trust ownership and listed ownership all carry different " +
  "pressures; none of them determines whether a given article is accurate. Outlets missing from the " +
  "registry are treated as unknown ownership and are never counted as independent corroboration.";
