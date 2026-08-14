// Gold set, labelling batch 2 — 24 events.
//
// Batch 1 was Europe- and wire-heavy, which is exactly the bias the coverage
// work elsewhere in this app exists to expose; a benchmark carrying the same
// bias would hide it. This batch deliberately weights Africa, Latin America,
// South and Southeast Asia and Oceania, and adds harder cases: same-actor
// events days apart, corrections, contested casualty figures, and events whose
// only shared vocabulary is an entity name.
import type { GoldEventSpec } from "./benchmarkGold";

export const GOLD_BATCH_2: GoldEventSpec[] = [
  // --- Africa --------------------------------------------------------------
  {
    key: "drc-mineral-deal", topic: "Economy & Business", region: "Africa",
    place: ["Kinshasa", -4.44, 15.27, "CD"], at: "2026-05-06T10:00:00Z",
    tags: ["mining", "cobalt", "trade deal"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Congo signs cobalt processing deal worth $2.1bn", "en", 0],
      ["france24.com", "Kinshasa signe un accord de traitement du cobalt de 2,1 milliards", "fr", 5],
      ["aljazeera.com", "DR Congo signs $2.1bn cobalt processing agreement", "en", 8],
    ],
  },
  {
    key: "horn-drought-appeal", topic: "Science & Health", region: "Africa",
    place: ["Mogadishu", 2.05, 45.32, "SO"], at: "2026-06-18T09:00:00Z",
    tags: ["drought", "united nations", "aid appeal"], difficulty: "multilocation",
    note: "One appeal, reported from Mogadishu, Addis Ababa and Geneva.",
    articles: [
      ["un.org", "UN launches $1.4bn appeal for Horn of Africa drought", "en", 0],
      ["reuters.com", "UN seeks $1.4bn as Horn of Africa drought deepens", "en", 2, ["Geneva", 46.2, 6.14, "CH"]],
      ["bbc.co.uk", "Aid agencies warn of worsening Horn of Africa drought", "en", 5, ["Addis Ababa", 9.03, 38.74, "ET"]],
      ["aljazeera.com", "$1.4bn sought for drought response in Horn of Africa", "en", 6],
    ],
  },
  {
    key: "sahel-coup-reversal", topic: "World & Conflict", region: "Africa",
    place: ["Ouagadougou", 12.37, -1.52, "BF"], at: "2026-03-09T14:00:00Z",
    tags: ["coup", "sahel", "counter-coup"], difficulty: "nearmiss",
    note: "One week after the batch-1 sahel-coup event, same city and vocabulary. Distinct occurrence.",
    articles: [
      ["reuters.com", "Rival officers announce they have reversed last week's takeover", "en", 0],
      ["france24.com", "Counter-coup announced by rival officers a week after takeover", "en", 4],
    ],
  },
  {
    key: "nile-dam-talks", topic: "Politics", region: "Africa",
    place: ["Cairo", 30.04, 31.24, "EG"], at: "2026-07-14T12:00:00Z",
    tags: ["nile", "dam", "water rights"], difficulty: "multilocation",
    articles: [
      ["reuters.com", "Egypt and Ethiopia resume talks over Nile dam operation", "en", 0],
      ["aljazeera.com", "Nile dam talks restart between Cairo and Addis Ababa", "en", 3],
      ["bbc.co.uk", "Nile dam negotiations resume after two-year stall", "en", 6, ["Addis Ababa", 9.03, 38.74, "ET"]],
    ],
  },
  {
    key: "lagos-flood", topic: "Science & Health", region: "Africa",
    place: ["Lagos", 6.52, 3.38, "NG"], at: "2026-09-21T05:00:00Z",
    tags: ["flooding", "lagos"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Flooding displaces 15,000 in Lagos after record rainfall", "en", 0],
      ["aljazeera.com", "15,000 displaced by Lagos floods following record rain", "en", 4],
    ],
  },

  // --- Latin America -------------------------------------------------------
  {
    key: "amazon-deforestation-data", topic: "Science & Health", region: "Latin America",
    place: ["Brasilia", -15.79, -47.88, "BR"], at: "2026-08-19T13:00:00Z",
    tags: ["amazon", "deforestation", "satellite data"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "Amazon deforestation falls 22% year on year, agency data shows", "en", 0],
      ["elpais.com", "La deforestacion en la Amazonia cae un 22% interanual", "es", 2],
      ["theguardian.com", "Amazon deforestation down 22% on last year, monitoring agency says", "en", 4],
      ["lemonde.fr", "La deforestation en Amazonie recule de 22 % sur un an", "fr", 6],
    ],
  },
  {
    key: "argentina-imf-deal", topic: "Economy & Business", region: "Latin America",
    place: ["Buenos Aires", -34.6, -58.38, "AR"], at: "2026-04-02T20:00:00Z",
    tags: ["international monetary fund", "argentina", "loan"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "Argentina reaches staff-level agreement with IMF on $8bn programme", "en", 0],
      ["ft.com", "IMF and Argentina agree $8bn programme at staff level", "en", 2],
      ["elpais.com", "Argentina alcanza un acuerdo tecnico con el FMI por 8.000 millones", "es", 3],
    ],
  },
  {
    key: "chile-lithium-nationalisation", topic: "Economy & Business", region: "Latin America",
    place: ["Santiago", -33.45, -70.67, "CL"], at: "2026-06-08T16:00:00Z",
    tags: ["lithium", "chile", "state control"], difficulty: "easy",
    articles: [
      ["reuters.com", "Chile moves lithium concessions under state-controlled venture", "en", 0],
      ["bloomberg.com", "Chile brings lithium concessions into state-led venture", "en", 2],
      ["elmundo.es", "Chile pone las concesiones de litio bajo control estatal", "es", 5],
    ],
  },
  {
    key: "mexico-cartel-operation", topic: "World & Conflict", region: "Latin America",
    place: ["Culiacan", 24.81, -107.39, "MX"], at: "2026-10-05T03:00:00Z",
    tags: ["security operation", "mexico"], difficulty: "nearmiss",
    note: "Outlets disagree on the number detained (14 vs 19). Contested figures, one event.",
    articles: [
      ["reuters.com", "Security operation in Culiacan detains 14, officials say", "en", 0],
      ["apnews.com", "Mexican forces say 19 detained in Culiacan operation", "en", 3],
      ["elpais.com", "Operativo en Culiacan deja varios detenidos", "es", 5],
    ],
  },

  // --- South & Southeast Asia ---------------------------------------------
  {
    key: "bangladesh-garment-wage", topic: "Society & Culture", region: "South Asia",
    place: ["Dhaka", 23.81, 90.41, "BD"], at: "2026-02-23T08:00:00Z",
    tags: ["garment industry", "minimum wage", "protest"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Bangladesh raises garment minimum wage by 18% after protests", "en", 0],
      ["aljazeera.com", "Garment minimum wage lifted 18% in Bangladesh", "en", 4],
      ["bbc.co.uk", "Bangladesh garment workers win 18% wage rise", "en", 7],
    ],
  },
  {
    key: "sri-lanka-debt-restructure", topic: "Economy & Business", region: "South Asia",
    place: ["Colombo", 6.93, 79.86, "LK"], at: "2026-03-17T09:00:00Z",
    tags: ["debt restructuring", "bondholders"], difficulty: "easy",
    articles: [
      ["reuters.com", "Sri Lanka reaches deal with bondholders on debt restructuring", "en", 0],
      ["ft.com", "Sri Lanka strikes bondholder deal to restructure debt", "en", 2],
      ["thehindu.com", "Colombo agrees debt restructuring terms with bondholders", "en", 5],
    ],
  },
  {
    key: "pakistan-heatwave", topic: "Science & Health", region: "South Asia",
    place: ["Jacobabad", 28.28, 68.44, "PK"], at: "2026-05-27T11:00:00Z",
    tags: ["heatwave", "public health"], difficulty: "longtail",
    articles: [
      ["reuters.com", "Temperatures pass 50C as heatwave grips southern Pakistan", "en", 0],
      ["bbc.co.uk", "Southern Pakistan tops 50C in prolonged heatwave", "en", 4],
    ],
  },
  {
    key: "mekong-dam-agreement", topic: "Politics", region: "Southeast Asia",
    place: ["Vientiane", 17.97, 102.6, "LA"], at: "2026-07-03T07:00:00Z",
    tags: ["mekong", "dam", "asean"], difficulty: "multilocation",
    articles: [
      ["reuters.com", "Mekong states agree joint data-sharing on dam releases", "en", 0],
      ["scmp.com", "Mekong countries agree to share dam release data", "en", 3],
      ["bangkokpost.com", "Regional agreement reached on Mekong dam data", "en", 5, ["Bangkok", 13.76, 100.5, "TH"]],
    ],
  },
  {
    key: "indonesia-capital-move", topic: "Politics", region: "Southeast Asia",
    place: ["Nusantara", -0.94, 116.7, "ID"], at: "2026-08-17T02:00:00Z",
    tags: ["capital relocation", "indonesia"], difficulty: "easy",
    articles: [
      ["reuters.com", "Indonesia formally transfers first ministries to new capital", "en", 0],
      ["scmp.com", "First ministries move to Indonesia's new capital", "en", 3],
      ["aljazeera.com", "Indonesia begins ministry transfer to Nusantara", "en", 5],
    ],
  },
  {
    key: "vietnam-chip-plant", topic: "Technology", region: "Southeast Asia",
    place: ["Hanoi", 21.03, 105.85, "VN"], at: "2026-11-05T04:00:00Z",
    tags: ["semiconductors", "investment", "vietnam"], difficulty: "nearmiss",
    note: "Another multi-billion chip plant announcement — must stay distinct from batch 1's Arizona fab.",
    articles: [
      ["reuters.com", "Chipmaker commits $4bn to packaging plant in northern Vietnam", "en", 0],
      ["nikkei.com", "$4bn chip packaging plant planned for northern Vietnam", "en", 2],
    ],
  },

  // --- Oceania -------------------------------------------------------------
  {
    key: "pacific-forum-security", topic: "Politics", region: "Oceania",
    place: ["Suva", -18.14, 178.44, "FJ"], at: "2026-09-24T00:00:00Z",
    tags: ["pacific islands forum", "security pact"], difficulty: "longtail",
    articles: [
      ["abc.net.au", "Pacific leaders endorse regional security framework", "en", 0],
      ["reuters.com", "Pacific Islands Forum backs regional security framework", "en", 3],
      ["smh.com.au", "Regional security framework endorsed at Pacific forum", "en", 6],
    ],
  },
  {
    key: "nz-quake", topic: "Science & Health", region: "Oceania",
    place: ["Wellington", -41.29, 174.78, "NZ"], at: "2026-12-02T18:40:00Z",
    tags: ["earthquake", "new zealand"], difficulty: "easy",
    articles: [
      ["reuters.com", "Magnitude 5.8 earthquake shakes New Zealand capital", "en", 0],
      ["abc.net.au", "5.8 quake felt across Wellington, no major damage reported", "en", 2],
    ],
  },

  // --- Europe / global, harder identity cases ------------------------------
  {
    key: "ecb-hold-march", topic: "Economy & Business", region: "Europe",
    place: ["Frankfurt", 50.11, 8.68, "DE"], at: "2026-03-19T12:45:00Z",
    tags: ["ecb", "interest rates", "eurozone"], difficulty: "nearmiss",
    note: "Same institution, same decision type, six weeks after batch 1's ecb-hold-feb. Two events.",
    articles: [
      ["reuters.com", "ECB leaves rates at 3.25% for a second meeting", "en", 0],
      ["ft.com", "ECB holds at 3.25% again as growth stalls", "en", 2],
      ["faz.net", "EZB haelt Leitzins erneut bei 3,25 Prozent", "de", 3],
    ],
  },
  {
    key: "north-sea-wind-auction", topic: "Economy & Business", region: "Europe",
    place: ["Copenhagen", 55.68, 12.57, "DK"], at: "2026-04-29T09:00:00Z",
    tags: ["offshore wind", "auction"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "North Sea offshore wind auction clears at record low subsidy", "en", 0],
      ["ft.com", "Offshore wind auction clears at record low subsidy level", "en", 2],
      ["spiegel.de", "Offshore-Windauktion in der Nordsee erzielt Rekordtiefstwert", "de", 4],
    ],
  },
  {
    key: "cable-repair-correction", topic: "Technology", region: "Europe",
    place: ["Gulf of Finland", 59.9, 25.0, "FI"], at: "2026-01-13T10:00:00Z",
    tags: ["undersea cable", "correction"], difficulty: "nearmiss",
    note: "Follow-up correcting the batch-1 cable story's attribution. Distinct event: the correction is its own occurrence.",
    articles: [
      ["reuters.com", "Investigators say cable damage was caused by dragging anchor", "en", 0],
      ["bbc.co.uk", "Dragging anchor blamed for Baltic cable damage, investigators say", "en", 4],
    ],
  },
  {
    key: "nato-exercise", topic: "World & Conflict", region: "Europe",
    place: ["Vilnius", 54.69, 25.28, "LT"], at: "2026-05-11T06:00:00Z",
    tags: ["nato", "exercise", "baltic"], difficulty: "crosslingual",
    articles: [
      ["reuters.com", "NATO begins largest Baltic exercise in a decade", "en", 0],
      ["dw.com", "NATO launches biggest Baltic drill in ten years", "en", 2],
      ["lemonde.fr", "L OTAN lance son plus grand exercice balte depuis dix ans", "fr", 4],
      ["faz.net", "Nato startet groesste Baltikum-Uebung seit zehn Jahren", "de", 5],
    ],
  },
  {
    key: "who-outbreak-declaration", topic: "Science & Health", region: "Global",
    place: ["Geneva", 46.2, 6.14, "CH"], at: "2026-10-22T14:00:00Z",
    tags: ["world health organization", "outbreak", "emergency"], difficulty: "syndication",
    articles: [
      ["who.int", "WHO declares regional outbreak a public health emergency", "en", 0],
      ["reuters.com", "WHO declares public health emergency over regional outbreak", "en", 1],
      ["apnews.com", "World Health Organization declares emergency over outbreak", "en", 1],
      ["bbc.co.uk", "WHO declares outbreak a public health emergency", "en", 2],
      ["aljazeera.com", "Outbreak declared a public health emergency by WHO", "en", 3],
    ],
  },
  {
    key: "space-launch-failure", topic: "Technology", region: "Global",
    place: ["Kourou", 5.16, -52.65, "GF"], at: "2026-12-14T21:15:00Z",
    tags: ["rocket launch", "failure"], difficulty: "easy",
    articles: [
      ["reuters.com", "Rocket fails minutes after launch, payload lost", "en", 0],
      ["france24.com", "Lanceur perdu quelques minutes apres le decollage", "fr", 2],
      ["bbc.co.uk", "Launch failure destroys satellite payload", "en", 3],
    ],
  },
  {
    key: "un-plastics-treaty", topic: "Politics", region: "Global",
    place: ["Nairobi", -1.29, 36.82, "KE"], at: "2026-11-28T17:00:00Z",
    tags: ["united nations", "plastics treaty", "negotiations"], difficulty: "crosslingual",
    articles: [
      ["un.org", "Delegates agree final text of global plastics treaty", "en", 0],
      ["reuters.com", "Negotiators agree final text of global plastics treaty", "en", 1],
      ["theguardian.com", "Global plastics treaty text agreed after marathon talks", "en", 3],
      ["lemonde.fr", "Le texte final du traite mondial sur les plastiques est adopte", "fr", 5],
      ["elpais.com", "Acordado el texto final del tratado mundial sobre plasticos", "es", 6],
    ],
  },
];
