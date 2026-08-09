// Topic → dot colour, shared by the globe (news dots) and the colour legend.
// Kept free of any server-only imports so client components can use it.
export const TOPIC_DOT_COLORS: Record<string, string> = {
  Politics: "#f59e0b",
  "Economy & Business": "#34d399",
  "World & Conflict": "#f87171",
  "Science & Health": "#22d3ee",
  Technology: "#a78bfa",
  "Society & Culture": "#f472b6",
  Sport: "#facc15",
};

export const DEFAULT_DOT_COLOR = "#93c5fd";

// Ordered list for rendering the legend.
export const TOPIC_COLOR_LIST = Object.entries(TOPIC_DOT_COLORS).map(
  ([topic, color]) => ({ topic, color }),
);

export function dotColor(topic: string): string {
  return TOPIC_DOT_COLORS[topic] ?? DEFAULT_DOT_COLOR;
}
