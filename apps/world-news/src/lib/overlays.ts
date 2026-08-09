// Lightweight, optional map overlays (Mappit-inspired).
// Kept static so they never require extra API keys or network calls.

export interface OverlayMarker {
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  color: string;
}

/** A handful of notable “on this day” style events (approximate locations). */
export const TODAY_IN_HISTORY: OverlayMarker[] = [
  {
    lat: 48.8566,
    lng: 2.3522,
    label: "Bastille Day (1789)",
    detail: "Storming of the Bastille, Paris",
    color: "#fbbf24",
  },
  {
    lat: 38.9072,
    lng: -77.0369,
    label: "Apollo 11 splashdown era",
    detail: "Moon-landing programme milestones",
    color: "#fbbf24",
  },
  {
    lat: 35.6762,
    lng: 139.6503,
    label: "Meiji Restoration period",
    detail: "Opening of modern Japan",
    color: "#fbbf24",
  },
  {
    lat: -33.8688,
    lng: 151.2093,
    label: "Federation of Australia",
    detail: "1901 – Commonwealth formed",
    color: "#fbbf24",
  },
  {
    lat: 55.7558,
    lng: 37.6173,
    label: "October Revolution",
    detail: "1917 – Petrograd / Moscow",
    color: "#fbbf24",
  },
];

/** Major financial centres as optional coloured markers. */
export const MARKET_MARKERS: OverlayMarker[] = [
  { lat: 40.7128, lng: -74.006, label: "NYSE / S&P 500", detail: "New York", color: "#34d399" },
  { lat: 51.5074, lng: -0.1278, label: "London / FTSE", detail: "City of London", color: "#34d399" },
  { lat: 35.6762, lng: 139.6503, label: "Tokyo / Nikkei", detail: "Japan", color: "#34d399" },
  { lat: 22.3193, lng: 114.1694, label: "Hong Kong / HSI", detail: "Hong Kong", color: "#34d399" },
  { lat: 1.3521, lng: 103.8198, label: "Singapore", detail: "SGX", color: "#34d399" },
  { lat: 19.076, lng: 72.8777, label: "Mumbai / Sensex", detail: "India", color: "#34d399" },
  { lat: 50.1109, lng: 8.6821, label: "Frankfurt / DAX", detail: "Germany", color: "#34d399" },
];
