"use client";

import { supabase } from "./supabase";
import type { HouseholdInvitation, HouseholdRole } from "./types";

export type HouseholdResult = {
  householdId: string;
  householdName: string;
  role: HouseholdRole;
};

export type InvitationResult = {
  invitationId: string;
  token: string;
  expiresAt: string;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export async function createHousehold(displayName: string, color: string) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("create_household", {
    p_display_name: displayName,
    p_color: color,
  });
  const row = firstRow(data as { household_id: string; household_name: string }[] | null);

  if (error || !row) {
    return {
      data: null,
      error: errorMessage(error, "Could not create the household."),
    };
  }

  return {
    data: {
      householdId: row.household_id,
      householdName: row.household_name,
      role: "owner" as const,
    },
    error: null,
  };
}

export async function acceptHouseholdInvitation(
  token: string,
  displayName: string,
  color: string,
) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("accept_household_invitation", {
    p_token: token,
    p_display_name: displayName,
    p_color: color,
  });
  const row = firstRow(
    data as { household_id: string; household_name: string; role: HouseholdRole }[] | null,
  );

  if (error || !row) {
    return {
      data: null,
      error: errorMessage(error, "That invitation is no longer valid."),
    };
  }

  return {
    data: {
      householdId: row.household_id,
      householdName: row.household_name,
      role: row.role,
    },
    error: null,
  };
}

export async function claimLegacyHousehold(
  legacyCode: string,
  displayName: string,
  color: string,
) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("claim_legacy_household", {
    p_legacy_code: legacyCode,
    p_display_name: displayName,
    p_color: color,
  });
  const row = firstRow(
    data as { household_id: string; household_name: string; role: HouseholdRole }[] | null,
  );

  if (error || !row) {
    return {
      data: null,
      error: errorMessage(error, "That legacy household could not be migrated."),
    };
  }

  return {
    data: {
      householdId: row.household_id,
      householdName: row.household_name,
      role: row.role,
    },
    error: null,
  };
}

export async function createHouseholdInvitation(householdId: string) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("create_household_invitation", {
    p_household_id: householdId,
  });
  const row = firstRow(data as { invitation_id: string; token: string; expires_at: string }[] | null);

  if (error || !row) {
    return {
      data: null,
      error: errorMessage(error, "Only the household owner can create invitations."),
    };
  }

  return {
    data: {
      invitationId: row.invitation_id,
      token: row.token,
      expiresAt: row.expires_at,
    },
    error: null,
  };
}

export async function listHouseholdInvitations(householdId: string) {
  if (!supabase) return { data: [] as HouseholdInvitation[], error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("list_household_invitations", {
    p_household_id: householdId,
  });

  if (error) {
    return { data: [] as HouseholdInvitation[], error: error.message };
  }

  return { data: (data ?? []) as HouseholdInvitation[], error: null };
}

export async function revokeHouseholdInvitation(householdId: string, invitationId: string) {
  if (!supabase) return { data: false, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("revoke_household_invitation", {
    p_household_id: householdId,
    p_invitation_id: invitationId,
  });

  return {
    data: Boolean(data),
    error: error ? error.message : null,
  };
}
