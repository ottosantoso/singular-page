export type OrganizationRole =
  | "organization_owner"
  | "organization_admin"
  | "event_manager"
  | "scorer"
  | "coach"
  | "player"
  | "viewer";

export type Permission =
  | "workspace.view"
  | "members.view"
  | "members.manage"
  | "venues.manage"
  | "events.view"
  | "events.manage"
  | "arena.view"
  | "arena.score"
  | "reports.view";

// Host is the legacy label for event_manager; keep it as an alias while data migrates.
export const ROLE_ALIASES: Record<string, OrganizationRole> = {
  host: "event_manager",
};

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  organization_owner: [
    "workspace.view", "members.view", "members.manage", "venues.manage",
    "events.view", "events.manage", "arena.view", "arena.score", "reports.view",
  ],
  organization_admin: [
    "workspace.view", "members.view", "members.manage", "venues.manage",
    "events.view", "events.manage", "arena.view", "arena.score", "reports.view",
  ],
  event_manager: ["workspace.view", "members.view", "events.view", "events.manage", "arena.view", "arena.score", "reports.view"],
  scorer: ["workspace.view", "members.view", "events.view", "arena.view", "arena.score", "reports.view"],
  coach: ["workspace.view", "members.view", "events.view", "arena.view", "reports.view"],
  player: ["workspace.view", "events.view", "arena.view"],
  viewer: ["workspace.view", "events.view", "arena.view"],
};

export function normalizeOrganizationRole(role: string | null | undefined): OrganizationRole | null {
  if (!role) return null;
  const normalized = ROLE_ALIASES[role] ?? role;
  return normalized in ROLE_PERMISSIONS ? (normalized as OrganizationRole) : null;
}

export function canOrganizationRole(role: string | null | undefined, permission: Permission) {
  const normalized = normalizeOrganizationRole(role);
  return normalized ? ROLE_PERMISSIONS[normalized].includes(permission) : false;
}

export const ORGANIZATION_ROLE_ORDER: OrganizationRole[] = [
  "player",
  "event_manager",
  "organization_owner",
  "organization_admin",
  "scorer",
  "coach",
  "viewer",
];