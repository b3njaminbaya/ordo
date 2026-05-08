export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: number;
  username: string;
  email: string;
}

export interface PendingInvite {
  email: string;
  status: "pending" | "accepted" | "rejected";
  invited_by: string;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
  pending_invites: PendingInvite[];
}

export interface InviteRequest {
  email: string;
  workspace_id: string;
}

export interface GenerateLinkRequest {
  workspace_id: string;
}

export interface GenerateLinkResponse {
  link: string;
}
