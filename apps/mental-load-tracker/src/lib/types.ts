export type Item = {
  id: string;
  household_id: string;
  text: string;
  noticed_by: string;
  noticed_by_color: string;
  created_at: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
};

export type Identity = {
  name: string;
  color: string;
};

export const IDENTITY_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#0ea5e9", // sky
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
] as const;
