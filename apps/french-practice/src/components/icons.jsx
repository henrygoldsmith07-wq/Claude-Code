// Minimal inline SVG icon set (Lucide-style strokes, currentColor).
// No dependency — keeps the bundle small and the look consistent.

function Icon({ size = 16, children, className = '', filled = false, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Flame = (p) => (
  <Icon {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.072-2.143 1.5-3.5 1-5 2.324 1.5 4.5 3.5 4.5 7a4.5 4.5 0 1 1-9 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 1 6.5z" /></Icon>
);
export const Bolt = (p) => (
  <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>
);
export const Camera = (p) => (
  <Icon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></Icon>
);
export const Sun = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>
);
export const Moon = (p) => (
  <Icon {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Icon>
);
export const Gear = (p) => (
  <Icon {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></Icon>
);
export const Key = (p) => (
  <Icon {...p}><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></Icon>
);
export const Copy = (p) => (
  <Icon {...p}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>
);
export const Mic = (p) => (
  <Icon {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></Icon>
);
export const Square = (p) => (
  <Icon filled {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Icon>
);
export const Play = (p) => (
  <Icon filled {...p}><polygon points="6 3 20 12 6 21 6 3" /></Icon>
);
export const MessageCircle = (p) => (
  <Icon {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></Icon>
);
export const Clock = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>
);
export const Layers = (p) => (
  <Icon {...p}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></Icon>
);
export const TrendingUp = (p) => (
  <Icon {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></Icon>
);
export const Search = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
);
export const Grid = (p) => (
  <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>
);
export const Terminal = (p) => (
  <Icon {...p}><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></Icon>
);
export const Lightbulb = (p) => (
  <Icon {...p}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6M10 22h4" /></Icon>
);
export const X = (p) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);
export const ChevronLeft = (p) => (
  <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>
);
export const ChevronRight = (p) => (
  <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>
);
export const Check = (p) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);
export const RefreshCw = (p) => (
  <Icon {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></Icon>
);
export const Shuffle = (p) => (
  <Icon {...p}><path d="M18 4l3 3-3 3" /><path d="M18 20l3-3-3-3" /><path d="M3 7h3.5a5 5 0 0 1 4 2l5 6a5 5 0 0 0 4 2H21" /><path d="M3 17h3.5a5 5 0 0 0 4-2" /><path d="M15.5 9a5 5 0 0 1 4-2H21" /></Icon>
);
export const Share = (p) => (
  <Icon {...p}><path d="M12 2v13" /><path d="m16 6-4-4-4 4" /><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /></Icon>
);
export const Download = (p) => (
  <Icon {...p}><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></Icon>
);
export const Upload = (p) => (
  <Icon {...p}><path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></Icon>
);
export const ArrowRight = (p) => (
  <Icon {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Icon>
);
export const Utensils = (p) => (
  <Icon {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></Icon>
);
export const Package = (p) => (
  <Icon {...p}><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73Z" /><path d="M12 22V12" /><path d="m3.3 7 7.7 4.4a2 2 0 0 0 2 0L20.7 7" /></Icon>
);
export const Plane = (p) => (
  <Icon {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></Icon>
);
export const Basket = (p) => (
  <Icon {...p}><path d="m5 11 4-7" /><path d="m19 11-4-7" /><path d="M2 11h20" /><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.6-7.4" /><path d="m9 15 .5 2" /><path d="M14.5 15l-.5 2" /></Icon>
);
export const Home = (p) => (
  <Icon {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>
);
export const Volume = (p) => (
  <Icon {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></Icon>
);
export const Target = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Icon>
);
export const Pencil = (p) => (
  <Icon {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /></Icon>
);

export const Briefcase = (p) => (
  <Icon {...p}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></Icon>
);
export const GraduationCap = (p) => (
  <Icon {...p}><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></Icon>
);
export const Lock = (p) => (
  <Icon {...p}><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>
);
export const CheckCircle = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Icon>
);
export const Map = (p) => (
  <Icon {...p}><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /><path d="M15 5.764v15" /><path d="M9 3.236v15" /></Icon>
);

export const Bookmark = (p) => (
  <Icon {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></Icon>
);
export const BookmarkFilled = (p) => (
  <Icon filled {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></Icon>
);
export const Book = (p) => (
  <Icon {...p}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></Icon>
);
export const Plus = (p) => (
  <Icon {...p}><path d="M5 12h14M12 5v14" /></Icon>
);
export const Trash = (p) => (
  <Icon {...p}><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></Icon>
);
export const BookOpen = (p) => (
  <Icon {...p}><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></Icon>
);
export const Sparkles = (p) => (
  <Icon {...p}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /></Icon>
);
export const Globe = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></Icon>
);
export const Landmark = (p) => (
  <Icon {...p}><line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /></Icon>
);
export const Coins = (p) => (
  <Icon {...p}><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></Icon>
);
export const Trophy = (p) => (
  <Icon {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></Icon>
);
export const BarChart = (p) => (
  <Icon {...p}><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></Icon>
);
export const Cross = (p) => (
  <Icon {...p}><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2z" /></Icon>
);
export const Compass = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></Icon>
);
export const Sliders = (p) => (
  <Icon {...p}><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" /></Icon>
);
export const FileText = (p) => (
  <Icon {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></Icon>
);

// Le Studio mark: a conversation window with the three colours of the
// French flag. It stays legible at header size and gives the speaking flow a
// recognisable visual anchor without adding another image dependency.
export function StudioMark({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--ink)" />
      <path d="M7 6v9.5a1.5 1.5 0 0 0 1.5 1.5H17" stroke="var(--speak)" strokeWidth="3" strokeLinecap="round" />
      <path d="M10.5 6v9.5a1.5 1.5 0 0 0 1.5 1.5h1" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 6v9.5a1.5 1.5 0 0 0 1.5 1.5H17" stroke="var(--review)" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 19h7" stroke="var(--on-accent)" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export const Scissors = (p) => (
  <Icon {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" x2="8.12" y1="4" y2="15.88" /><line x1="14.47" x2="20" y1="14.48" y2="20" /><line x1="8.12" x2="12" y1="8.12" y2="12" /></Icon>
);

// Per-scenario icon lookup for the arena card rail.
export const SCENARIO_ICONS = {
  bistro: Utensils,
  poste: Package,
  vol: Plane,
  marche: Basket,
  colloc: Home,
  entretien: Briefcase,
  reunion: MessageCircle,
  cours: GraduationCap,
  libre: MessageCircle,
  pharmacie: Cross,
  banque: Coins,
  medecin: Cross,
  coiffeur: Scissors,
  logement: Key,
  hotel: Key,
  taxi: Map,
  musee: Landmark,
  cinema: Play,
  supermarche: Basket,
  boulangerie2: Utensils,
  dentiste: Cross,
  veterinaire: Cross,
  garagiste: Gear,
  plombier: Gear,
  commissariat: Lock,
  mairie: Landmark,
  bibliotheque: Book,
  librairie: BookOpen,
  pressing: Package,
  opticien: Target,
  camping: Compass,
  ski: Bolt,
  plage: Sun,
  diner: Utensils,
  voisin: Home,
  covoiturage: Map,
  sav: MessageCircle,
  gym: Flame,
  fleuriste: Sparkles,
  noel: Sparkles,
  // German and Spanish scenarios share id suffixes behind a `de-`/`es-`
  // prefix (de-cafe, es-cafe, …); scenarioIcon() strips the prefix so both
  // languages resolve against these.
  cafe: Utensils,
  directions: Map,
  shopping: Basket,
  smalltalk: MessageCircle,
  doctor: Cross,
  doctor2: Cross,
  restaurant: Utensils,
  clothes: Package,
  phone: MessageCircle,
  bank: Coins,
  apartment: Home,
  interview: Briefcase,
  lost: Compass,
  party: Sparkles,
  complaint: MessageCircle,
  weekend: Sun,
  delivery: Package,
};

// Safe lookup for any scenario id in any target language. Never returns
// undefined — rendering `undefined` as a component crashes the whole screen.
export const scenarioIcon = (id) =>
  SCENARIO_ICONS[id] || SCENARIO_ICONS[String(id).replace(/^[a-z]{2}-/, '')] || MessageCircle;

// Per-topic icon lookup for the favourite-topic chips (Onboarding,
// Personalise). Stroke icons inherit currentColor, so they invert cleanly
// when a selected chip flips to accent-on-ink — colour emojis don't.
export const TOPIC_ICONS = {
  travel: Plane,
  food: Utensils,
  work: Briefcase,
  culture: Landmark,
  daily: Home,
  shopping: Basket,
  health: Cross,
  study: GraduationCap,
};
