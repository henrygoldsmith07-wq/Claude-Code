export type Item = {
  id: string;
  household_id: string;
  text: string;
  noticed_by: string;
  noticed_by_color: string;
  created_by: string | null;
  created_at: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
};

export type HouseholdRole = "owner" | "member";

export type Membership = {
  household_id: string;
  household_name: string;
  user_id: string;
  role: HouseholdRole;
  display_name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type HouseholdInvitation = {
  invitation_id: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type Profile = {
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
