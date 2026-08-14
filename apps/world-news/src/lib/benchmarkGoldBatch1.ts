// Gold set, labelling batch 1 — first pass, 36 events.
//
// Labelled against LABELLING_GUIDELINES in ./benchmarkGold. Batches are kept as
// separate files because that is how a gold set actually grows: one labelling
// session at a time, each reviewable on its own. See ./benchmarkGoldBatch2.
import type { GoldEventSpec } from "./benchmarkGold";

export const GOLD_BATCH_1: GoldEventSpec[] = [
  // --- Economy -------------------------------------------------------------
  {
    key: "ecb-hold-feb", topic: "Economy & Business", region: "Europe",
    place: ["Frankfurt", 50.11, 8.68, "DE"], at: "2026-02-05T12:45:00Z",
    tags: ["ecb", "interest rates", "eurozone"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "ECB holds rates at 3.25% as inflation cools", "en", 0],
      ["ft.com", "European Central Bank keeps interest rates unchanged at 3.25%", "en", 1],
      ["lemonde.fr", "La BCE maintient ses taux directeurs a 3,25 %", "fr", 2],
      ["faz.net", "EZB belasst Leitzins bei 3,25 Prozent", "de", 2],
      ["elpais.com", "El BCE mantiene los tipos en el 3,25%", "es", 3],
    ],
  },
  {
    key: "fed-cut-25bps", topic: "Economy & Business", region: "North America",
    place: ["Washington", 38.9, -77.04, "US"], at: "2026-01-28T19:00:00Z",
    tags: ["federal reserve", "interest rates"], difficulty: "nearmiss",
    note: "Deliberately adjacent to ecb-hold-feb: same beat, same vocabulary, different central bank and figure.",
    articles: [
      ["apnews.com", "Federal Reserve cuts benchmark rate by 25 basis points", "en", 0],
      ["wsj.com", "Fed lowers rates 25 bps, signals patience on further cuts", "en", 1],
      ["bloomberg.com", "Fed delivers quarter-point cut as labour market softens", "en", 2],
    ],
  },
  {
    key: "boe-hold", topic: "Economy & Business", region: "Europe",
    place: ["London", 51.51, -0.09, "GB"], at: "2026-02-06T12:00:00Z",
    tags: ["bank of england", "interest rates"], difficulty: "nearmiss",
    articles: [
      ["bbc.co.uk", "Bank of England holds interest rates at 4%", "en", 0],
      ["theguardian.com", "Bank of England keeps rates at 4% amid weak growth", "en", 1],
    ],
  },
  {
    key: "chip-fab-arizona", topic: "Economy & Business", region: "North America",
    place: ["Phoenix", 33.45, -112.07, "US"], at: "2026-03-11T14:00:00Z",
    tags: ["semiconductors", "investment"], difficulty: "syndication",
    articles: [
      ["reuters.com", "Chipmaker announces $12bn Arizona fabrication plant", "en", 0],
      ["apnews.com", "Chipmaker to build $12 billion Arizona plant, adding 3,000 jobs", "en", 1],
      ["cnn.com", "$12bn chip plant coming to Arizona", "en", 3],
      ["nikkei.com", "Chipmaker to invest $12bn in Arizona fab", "en", 6],
    ],
  },
  {
    key: "opec-output-cut", topic: "Economy & Business", region: "Middle East",
    place: ["Vienna", 48.21, 16.37, "AT"], at: "2026-02-18T13:30:00Z",
    tags: ["opec", "oil"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "OPEC+ agrees to extend output cuts through June", "en", 0],
      ["aljazeera.com", "OPEC extends production cuts to June, crude rises", "en", 2],
      ["lefigaro.fr", "L OPEP prolonge ses reductions de production jusqu en juin", "fr", 4],
    ],
  },

  // --- Conflict ------------------------------------------------------------
  {
    key: "gaza-ceasefire-extension", topic: "World & Conflict", region: "Middle East",
    place: ["Gaza", 31.5, 34.45, "PS"], at: "2026-01-14T09:00:00Z",
    tags: ["ceasefire", "gaza"], difficulty: "syndication",
    articles: [
      ["reuters.com", "Israel and Hamas agree to extend Gaza ceasefire", "en", 0],
      ["apnews.com", "Israel, Hamas agree to extend Gaza ceasefire by two weeks", "en", 1],
      ["bbc.co.uk", "Gaza ceasefire extended as mediators push for lasting deal", "en", 2],
      ["aljazeera.com", "Gaza truce extended for two weeks, mediators confirm", "en", 2],
      ["haaretz.com", "Cabinet approves two-week extension of Gaza ceasefire", "en", 5],
    ],
  },
  {
    key: "kyiv-drone-strike", topic: "World & Conflict", region: "Europe",
    place: ["Kyiv", 50.45, 30.52, "UA"], at: "2026-02-02T04:30:00Z",
    tags: ["ukraine", "drone strike"], difficulty: "crosslingual",
    note: "Kyiv/Kiew/Kiev transliteration spread is the point of this case.",
    articles: [
      ["reuters.com", "Drone strike hits Kyiv energy infrastructure, power cut to 40,000", "en", 0],
      ["bbc.co.uk", "Kyiv power outages after overnight drone attack", "en", 2],
      ["spiegel.de", "Drohnenangriff auf Kiew trifft Energieinfrastruktur", "de", 3],
      ["lemonde.fr", "Frappe de drones sur Kiev, 40 000 foyers prives d electricite", "fr", 4],
      ["themoscowtimes.com", "Kyiv reports drone strike on power grid", "en", 6],
    ],
  },
  {
    key: "kharkiv-shelling", topic: "World & Conflict", region: "Europe",
    place: ["Kharkiv", 49.99, 36.23, "UA"], at: "2026-02-03T06:00:00Z",
    tags: ["ukraine", "shelling"], difficulty: "nearmiss",
    note: "Same war, next day, different city — must not merge with kyiv-drone-strike.",
    articles: [
      ["reuters.com", "Shelling in Kharkiv damages residential block, three injured", "en", 0],
      ["theguardian.com", "Three injured as shells hit Kharkiv apartment building", "en", 2],
    ],
  },
  {
    key: "sahel-coup", topic: "World & Conflict", region: "Africa",
    place: ["Ouagadougou", 12.37, -1.52, "BF"], at: "2026-03-02T21:00:00Z",
    tags: ["coup", "sahel"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Soldiers announce takeover on state television", "en", 0],
      ["france24.com", "Military officers claim power in televised address", "en", 3],
    ],
  },
  {
    key: "red-sea-shipping", topic: "World & Conflict", region: "Middle East",
    place: ["Bab el-Mandeb", 12.58, 43.33, "YE"], at: "2026-01-22T08:00:00Z",
    tags: ["shipping", "red sea"], difficulty: "multilocation",
    note: "One event, loci in the Red Sea, Rotterdam and Singapore as carriers reroute.",
    articles: [
      ["reuters.com", "Container ship attacked in Bab el-Mandeb strait", "en", 0],
      ["bbc.co.uk", "Attack on container vessel in Red Sea prompts rerouting", "en", 3],
      ["ft.com", "Carriers divert from Red Sea after vessel attack", "en", 6, ["Rotterdam", 51.92, 4.48, "NL"]],
      ["scmp.com", "Asian shippers reroute after Red Sea vessel attack", "en", 9, ["Singapore", 1.35, 103.82, "SG"]],
    ],
  },

  // --- Politics ------------------------------------------------------------
  {
    key: "uk-confidence-vote", topic: "Politics", region: "Europe",
    place: ["London", 51.5, -0.13, "GB"], at: "2026-02-11T19:30:00Z",
    tags: ["parliament", "confidence vote"], difficulty: "easy",
    articles: [
      ["bbc.co.uk", "Prime minister survives confidence vote 302-241", "en", 0],
      ["theguardian.com", "PM wins confidence vote by 302 to 241", "en", 1],
      ["independent.co.uk", "Confidence vote won 302-241 after late rebellion fizzles", "en", 2],
    ],
  },
  {
    key: "uk-housing-bill", topic: "Politics", region: "Europe",
    place: ["London", 51.5, -0.13, "GB"], at: "2026-02-12T11:00:00Z",
    tags: ["housing", "legislation"], difficulty: "nearmiss",
    articles: [
      ["bbc.co.uk", "Opposition unveils housing reform bill", "en", 0],
      ["independent.co.uk", "Housing reform bill introduced by opposition MPs", "en", 2],
    ],
  },
  {
    key: "eu-enlargement-summit", topic: "Politics", region: "Europe",
    place: ["Brussels", 50.85, 4.35, "BE"], at: "2026-03-19T17:00:00Z",
    tags: ["european union", "enlargement"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "EU leaders back opening accession talks with two candidates", "en", 0],
      ["politico.com", "EU summit greenlights accession negotiations", "en", 2],
      ["lemonde.fr", "L UE ouvre les negociations d adhesion avec deux candidats", "fr", 3],
      ["faz.net", "EU-Gipfel gibt Beitrittsgespraeche frei", "de", 4],
    ],
  },
  {
    key: "india-election-result", topic: "Politics", region: "South Asia",
    place: ["New Delhi", 28.61, 77.21, "IN"], at: "2026-05-04T06:00:00Z",
    tags: ["election", "india"], difficulty: "easy",
    articles: [
      ["thehindu.com", "Ruling alliance returns with reduced majority", "en", 0],
      ["hindustantimes.com", "Alliance wins third term with slimmer margin", "en", 1],
      ["reuters.com", "Governing alliance wins Indian election with reduced majority", "en", 2],
      ["bbc.co.uk", "India election: governing alliance holds on with smaller majority", "en", 3],
    ],
  },
  {
    key: "brazil-cabinet-reshuffle", topic: "Politics", region: "Latin America",
    place: ["Brasilia", -15.79, -47.88, "BR"], at: "2026-04-08T15:00:00Z",
    tags: ["brazil", "cabinet"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Brazilian president replaces finance and energy ministers", "en", 0],
      ["elpais.com", "Brasil cambia a los ministros de Hacienda y Energia", "es", 4],
    ],
  },
  {
    key: "japan-pm-resigns", topic: "Politics", region: "East Asia",
    place: ["Tokyo", 35.68, 139.69, "JP"], at: "2026-06-12T02:00:00Z",
    tags: ["japan", "resignation"], difficulty: "crosslingual",
    articles: [
      ["asahi.com", "Prime minister announces resignation amid funding scandal", "en", 0],
      ["nikkei.com", "Japan PM to step down over party funding scandal", "en", 1],
      ["reuters.com", "Japanese prime minister resigns over funding scandal", "en", 2],
      ["japantimes.co.jp", "PM steps down, ruling party to pick successor", "en", 3],
    ],
  },

  // --- Science & Health ----------------------------------------------------
  {
    key: "storm-atlantic-france", topic: "Science & Health", region: "Europe",
    place: ["Bordeaux", 44.84, -0.58, "FR"], at: "2026-11-02T05:00:00Z",
    tags: ["storm", "weather"], difficulty: "multilocation",
    articles: [
      ["lemonde.fr", "Une tempete frappe la cote atlantique francaise", "fr", 0],
      ["france24.com", "Storm batters French Atlantic coast, 200,000 without power", "en", 2],
      ["reuters.com", "Storm hits southwestern France, thousands lose power", "en", 3, ["La Rochelle", 46.16, -1.15, "FR"]],
    ],
  },
  {
    key: "storm-uk-landfall", topic: "Science & Health", region: "Europe",
    place: ["Plymouth", 50.37, -4.14, "GB"], at: "2026-11-03T04:00:00Z",
    tags: ["storm", "weather"], difficulty: "nearmiss",
    note: "Same weather system, separate national landfall event — labelled distinct.",
    articles: [
      ["bbc.co.uk", "UK braces for storm landfall as warnings issued", "en", 0],
      ["theguardian.com", "Amber warnings issued as storm reaches southwest England", "en", 2],
    ],
  },
  {
    key: "malaria-vaccine-rollout", topic: "Science & Health", region: "Africa",
    place: ["Nairobi", -1.29, 36.82, "KE"], at: "2026-04-25T08:00:00Z",
    tags: ["vaccine", "malaria", "who"], difficulty: "easy",
    articles: [
      ["who.int", "WHO announces expanded malaria vaccine rollout across eight countries", "en", 0],
      ["reuters.com", "WHO expands malaria vaccine programme to eight countries", "en", 2],
      ["bbc.co.uk", "Malaria vaccine rollout widened to eight African countries", "en", 4],
      ["aljazeera.com", "Eight more countries to receive malaria vaccine, WHO says", "en", 5],
    ],
  },
  {
    key: "quake-anatolia", topic: "Science & Health", region: "Middle East",
    place: ["Kahramanmaras", 37.58, 36.93, "TR"], at: "2026-07-19T01:17:00Z",
    tags: ["earthquake"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "Magnitude 6.1 earthquake strikes southern Turkey", "en", 0],
      ["bbc.co.uk", "6.1 magnitude quake hits southern Turkey, buildings damaged", "en", 1],
      ["france24.com", "Un seisme de magnitude 6,1 secoue le sud de la Turquie", "fr", 3],
      ["spiegel.de", "Erdbeben der Staerke 6,1 erschuettert Sueden der Tuerkei", "de", 3],
    ],
  },
  {
    key: "antarctic-ice-study", topic: "Science & Health", region: "Global",
    place: ["Antarctica", -75.0, 0.0, ""], at: "2026-05-14T16:00:00Z",
    tags: ["climate", "antarctica", "research"], difficulty: "easy",
    articles: [
      ["nature.com", "Study finds accelerating thinning of West Antarctic ice shelves", "en", 0],
      ["theguardian.com", "West Antarctic ice shelves thinning faster than expected, study finds", "en", 3],
      ["reuters.com", "Antarctic ice shelves thinning faster, researchers report", "en", 5],
    ],
  },

  // --- Technology ----------------------------------------------------------
  {
    key: "eu-ai-act-enforcement", topic: "Technology", region: "Europe",
    place: ["Brussels", 50.85, 4.35, "BE"], at: "2026-02-20T10:00:00Z",
    tags: ["european union", "ai act", "regulation"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "EU unveils AI Act enforcement timeline for general-purpose models", "en", 0],
      ["politico.com", "Commission sets out AI Act enforcement dates", "en", 1],
      ["lemonde.fr", "L UE devoile le calendrier d application du reglement sur l IA", "fr", 3],
      ["zeit.de", "EU legt Zeitplan fuer Durchsetzung des KI-Gesetzes vor", "de", 4],
    ],
  },
  {
    key: "uk-ai-safety-institute", topic: "Technology", region: "Europe",
    place: ["London", 51.5, -0.12, "GB"], at: "2026-03-05T09:30:00Z",
    tags: ["ai", "safety institute"], difficulty: "easy",
    note: "Announcement plus same-day analysis — analysis anchored to this occurrence, so same event.",
    articles: [
      ["gov.uk", "Government launches AI Safety Institute to evaluate frontier models", "en", 0],
      ["theguardian.com", "UK launches AI safety institute to test frontier models", "en", 2],
      ["ft.com", "What the new UK AI safety institute means for startups", "en", 7],
      ["bbc.co.uk", "New institute to test AI models before release", "en", 3],
    ],
  },
  {
    key: "undersea-cable-cut", topic: "Technology", region: "Europe",
    place: ["Gulf of Finland", 59.9, 25.0, "FI"], at: "2026-01-09T23:00:00Z",
    tags: ["undersea cable", "outage"], difficulty: "multilocation",
    articles: [
      ["reuters.com", "Undersea data cable damaged in Gulf of Finland", "en", 0],
      ["bbc.co.uk", "Baltic data cable damaged, investigation opened", "en", 4],
      ["dw.com", "Damaged Baltic cable disrupts traffic between Finland and Estonia", "en", 6, ["Tallinn", 59.44, 24.75, "EE"]],
    ],
  },
  {
    key: "major-cloud-outage", topic: "Technology", region: "Global",
    place: ["Global", 0, 0, ""], at: "2026-06-03T13:20:00Z",
    tags: ["outage", "cloud"], difficulty: "syndication",
    articles: [
      ["reuters.com", "Cloud provider outage disrupts banking and airline systems", "en", 0],
      ["apnews.com", "Cloud outage hits banks, airlines and payment systems worldwide", "en", 1],
      ["bbc.co.uk", "Global cloud outage disrupts banks and airlines", "en", 1],
      ["theguardian.com", "Widespread cloud outage takes down payment and airline systems", "en", 2],
      ["axios.com", "Cloud outage ripples through payments and travel", "en", 3],
    ],
  },

  // --- Society & Sport -----------------------------------------------------
  {
    key: "unesco-heritage-listing", topic: "Society & Culture", region: "Global",
    place: ["Paris", 48.86, 2.35, "FR"], at: "2026-07-28T14:00:00Z",
    tags: ["unesco", "heritage"], difficulty: "longtail",
    articles: [
      ["france24.com", "UNESCO adds twelve sites to World Heritage list", "en", 0],
      ["reuters.com", "Twelve new sites added to UNESCO World Heritage list", "en", 3],
    ],
  },
  {
    key: "champions-final", topic: "Sport", region: "Europe",
    place: ["Munich", 48.14, 11.58, "DE"], at: "2026-05-30T21:00:00Z",
    tags: ["football", "final"], difficulty: "crosslingual",
    articles: [
      ["bbc.co.uk", "Late winner settles Champions League final 2-1", "en", 0],
      ["theguardian.com", "Champions League final won 2-1 with stoppage-time goal", "en", 1],
      ["lequipe.fr", "Finale de la Ligue des champions remportee 2-1", "fr", 1],
      ["corriere.it", "Finale di Champions decisa 2-1 al 93esimo", "it", 2],
    ],
  },
  {
    key: "derby-league-match", topic: "Sport", region: "Europe",
    place: ["Manchester", 53.48, -2.24, "GB"], at: "2026-04-12T16:30:00Z",
    tags: ["football", "league"], difficulty: "nearmiss",
    note: "Also a 2-1 football result — the scoreline must not be enough to merge it with champions-final.",
    articles: [
      ["bbc.co.uk", "Manchester derby ends 2-1 after late winner", "en", 0],
      ["independent.co.uk", "Derby decided 2-1 by injury-time strike", "en", 1],
    ],
  },
  {
    key: "olympic-host-decision", topic: "Sport", region: "Global",
    place: ["Lausanne", 46.52, 6.63, "CH"], at: "2026-09-15T12:00:00Z",
    tags: ["olympics", "host city"], difficulty: "easy",
    articles: [
      ["reuters.com", "IOC awards 2038 Winter Games to joint bid", "en", 0],
      ["apnews.com", "Joint bid wins hosting rights for 2038 Winter Olympics", "en", 1],
      ["bbc.co.uk", "2038 Winter Olympics awarded to joint bid", "en", 2],
    ],
  },

  // --- Additional regional coverage ---------------------------------------
  {
    key: "nigeria-fuel-subsidy", topic: "Economy & Business", region: "Africa",
    place: ["Abuja", 9.06, 7.49, "NG"], at: "2026-03-30T10:00:00Z",
    tags: ["nigeria", "fuel subsidy"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Nigeria scraps remaining fuel subsidy, pump prices jump", "en", 0],
      ["aljazeera.com", "Nigeria ends fuel subsidy as pump prices rise sharply", "en", 5],
    ],
  },
  {
    key: "mexico-water-treaty", topic: "Politics", region: "Latin America",
    place: ["Mexico City", 19.43, -99.13, "MX"], at: "2026-08-07T18:00:00Z",
    tags: ["water", "treaty", "united states"], difficulty: "multilocation",
    articles: [
      ["reuters.com", "Mexico and US agree revised water-sharing schedule", "en", 0],
      ["elpais.com", "Mexico y EE UU acuerdan un nuevo calendario de reparto de agua", "es", 2],
      ["apnews.com", "US, Mexico reach deal on Rio Grande water deliveries", "en", 3, ["El Paso", 31.76, -106.49, "US"]],
    ],
  },
  {
    key: "philippines-typhoon", topic: "Science & Health", region: "Southeast Asia",
    place: ["Manila", 14.6, 120.98, "PH"], at: "2026-10-11T22:00:00Z",
    tags: ["typhoon", "evacuation"], difficulty: "easy",
    articles: [
      ["reuters.com", "Typhoon forces evacuation of 200,000 in northern Philippines", "en", 0],
      ["aljazeera.com", "200,000 evacuated as typhoon nears northern Philippines", "en", 2],
      ["bbc.co.uk", "Philippines evacuates 200,000 ahead of typhoon landfall", "en", 3],
    ],
  },
  {
    key: "australia-emissions-target", topic: "Politics", region: "Oceania",
    place: ["Canberra", -35.28, 149.13, "AU"], at: "2026-09-02T01:00:00Z",
    tags: ["climate", "emissions target"], difficulty: "longtail",
    articles: [
      ["abc.net.au", "Government legislates 2040 emissions reduction target", "en", 0],
      ["smh.com.au", "2040 emissions target passes parliament", "en", 2],
    ],
  },
  {
    key: "korea-chip-export-rules", topic: "Technology", region: "East Asia",
    place: ["Seoul", 37.57, 126.98, "KR"], at: "2026-04-17T07:00:00Z",
    tags: ["semiconductors", "export controls"], difficulty: "easy",
    articles: [
      ["reuters.com", "South Korea tightens chip equipment export rules", "en", 0],
      ["nikkei.com", "Seoul tightens export controls on chipmaking equipment", "en", 2],
      ["scmp.com", "South Korea adds chip tools to export control list", "en", 4],
    ],
  },
  {
    key: "icc-arrest-warrant", topic: "World & Conflict", region: "Global",
    place: ["The Hague", 52.08, 4.31, "NL"], at: "2026-06-25T11:00:00Z",
    tags: ["international criminal court", "arrest warrant"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "ICC issues arrest warrant over alleged war crimes", "en", 0],
      ["bbc.co.uk", "International Criminal Court issues war crimes arrest warrant", "en", 1],
      ["lemonde.fr", "La CPI emet un mandat d arret pour crimes de guerre presumes", "fr", 3],
      ["aljazeera.com", "ICC warrant issued over alleged war crimes", "en", 2],
    ],
  },
];
