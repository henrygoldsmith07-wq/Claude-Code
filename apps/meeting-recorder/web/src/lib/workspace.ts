/** Team/workspace support (optional, single-workspace default). */
export interface Workspace { id: string; name: string; createdAt: string; retentionDays?: number | null }

export const DEFAULT_WORKSPACE: Workspace = { id: "default", name: "Personal", createdAt: new Date().toISOString(), retentionDays: 90 };

export function workspaceForMeeting(meeting: { workspaceId?: string | null }, workspaces: Workspace[]): Workspace {
  if (meeting.workspaceId) return workspaces.find((w)=>w.id===meeting.workspaceId) ?? DEFAULT_WORKSPACE;
  return DEFAULT_WORKSPACE;
}

export function isWorkspaceMember(workspace: Workspace, userId: string | null): boolean {
  void workspace; void userId;
  return true; // single-workspace: everyone is a member
}
