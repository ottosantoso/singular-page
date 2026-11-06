// Satu sumber izin untuk UI Workspace. Tanpa import supaya bisa dites langsung (npm test).
// Ini hanya mengatur apa yang ditampilkan; yang menolak akses sebenarnya tetap kebijakan dan RPC di database.

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
  | "reports.view"
  | "billing.view"
  | "players.view"
  | "tokens.manage";

export const ALL_PERMISSIONS: readonly Permission[] = [
  "workspace.view",
  "members.view",
  "members.manage",
  "venues.manage",
  "events.view",
  "events.manage",
  "arena.view",
  "arena.score",
  "reports.view",
  "billing.view",
  "players.view",
  "tokens.manage",
];

// Host is the legacy label for event_manager; keep it as an alias while data migrates.
export const ROLE_ALIASES: Record<string, OrganizationRole> = {
  host: "event_manager",
};

// Catatan reports.view: RPC get_organization_report hanya mengizinkan owner dan admin. Izin ini sengaja
// dibatasi ke keduanya supaya tab Reports tidak muncul untuk peran yang pasti ditolak database.
const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  organization_owner: [
    "workspace.view", "members.view", "members.manage", "venues.manage",
    "events.view", "events.manage", "arena.view", "arena.score", "reports.view",
    "billing.view", "players.view", "tokens.manage",
  ],
  organization_admin: [
    "workspace.view", "members.view", "members.manage", "venues.manage",
    "events.view", "events.manage", "arena.view", "arena.score", "reports.view",
    "billing.view", "players.view", "tokens.manage",
  ],
  event_manager: ["workspace.view", "members.view", "events.view", "events.manage", "arena.view", "arena.score", "players.view"],
  scorer: ["workspace.view", "events.view", "arena.view", "arena.score"],
  coach: ["workspace.view", "members.view", "events.view", "arena.view", "players.view"],
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

export type WorkspaceTab = "overview" | "events" | "operations" | "reports" | "billing" | "members" | "settings";

// Tab Workspace dan izin yang membukanya. Urutan array = urutan tombol di layar.
export const WORKSPACE_TABS: ReadonlyArray<{ key: WorkspaceTab; label: string; permission: Permission }> = [
  { key: "overview", label: "Overview", permission: "workspace.view" },
  { key: "events", label: "Events", permission: "events.view" },
  { key: "operations", label: "Operations", permission: "workspace.view" },
  { key: "reports", label: "Reports", permission: "reports.view" },
  { key: "billing", label: "Billing", permission: "billing.view" },
  { key: "members", label: "Members", permission: "members.view" },
  { key: "settings", label: "Settings", permission: "workspace.view" },
];

export function visibleWorkspaceTabs(role: string | null | undefined) {
  return WORKSPACE_TABS.filter((tab) => canOrganizationRole(role, tab.permission));
}
