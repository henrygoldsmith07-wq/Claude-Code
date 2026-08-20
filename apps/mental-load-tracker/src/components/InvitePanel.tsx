"use client";

import { useEffect, useState } from "react";
import {
  createHouseholdInvitation,
  listHouseholdInvitations,
  revokeHouseholdInvitation,
} from "@/lib/household";
import type { HouseholdInvitation } from "@/lib/types";

type Props = {
  householdId: string;
};

function invitationStatus(invitation: HouseholdInvitation) {
  if (invitation.revoked_at) return "Revoked";
  if (invitation.accepted_at) return "Accepted";
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return "Expired";
  return "Active";
}

export default function InvitePanel({ householdId }: Props) {
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInvitations() {
    const result = await listHouseholdInvitations(householdId);
    if (result.error) setError(result.error);
    else setInvitations(result.data);
  }

  useEffect(() => {
    // Opening the panel intentionally triggers an external data refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function createInvite() {
    setLoading(true);
    setError(null);
    const result = await createHouseholdInvitation(householdId);
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not create an invitation.");
      return;
    }

    // Keep the bearer token in the URL fragment so it is not sent in HTTP
    // request logs or Referer headers. The home page consumes the fragment
    // after hydration.
    const url = `${window.location.origin}/#invite=${encodeURIComponent(result.data.token)}`;
    setInviteUrl(url);
    await loadInvitations();
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function revoke(invitationId: string) {
    setError(null);
    const result = await revokeHouseholdInvitation(householdId, invitationId);
    if (result.error) {
      setError(result.error);
      return;
    }
    await loadInvitations();
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left text-sm font-medium"
        data-testid="invite-toggle"
      >
        <span>Invite someone to this household</span>
        <span className="text-zinc-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4 text-sm">
          <p className="text-zinc-500 dark:text-zinc-400">
            The link grants one authenticated account access as a member. It
            expires after 7 days and can be revoked here.
          </p>
          <button
            type="button"
            onClick={createInvite}
            disabled={loading}
            className="self-start rounded-md bg-zinc-900 px-3 py-2 font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            data-testid="create-invite"
          >
            {loading ? "Creating…" : "Create invitation link"}
          </button>

          {inviteUrl && (
            <div className="flex flex-col gap-2">
              <label htmlFor="invite-link" className="font-medium">
                Copy this link now
              </label>
              <div className="flex gap-2">
                <input
                  id="invite-link"
                  value={inviteUrl}
                  readOnly
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-700"
                  data-testid="invite-link"
                />
                <button
                  type="button"
                  onClick={copyInvite}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {invitations.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="font-medium">Invitation history</p>
              {invitations.map((invitation) => {
                const status = invitationStatus(invitation);
                return (
                  <div key={invitation.invitation_id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {status} · expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </span>
                    {status === "Active" && (
                      <button
                        type="button"
                        onClick={() => revoke(invitation.invitation_id)}
                        className="text-red-600 underline-offset-2 hover:underline dark:text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </section>
  );
}
