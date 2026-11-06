// Tes matriks izin Workspace (D-04). Jalankan: npm test
// Tabel EXPECTED sengaja ditulis lengkap. Mengubah matriks di permissions.ts harus disertai mengubah tabel ini,
// supaya perubahan izin selalu disengaja dan kelihatan di review.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  ORGANIZATION_ROLE_ORDER,
  canOrganizationRole,
  normalizeOrganizationRole,
  visibleWorkspaceTabs,
} from "../src/lib/permissions.ts";

const ALL = [
  "organization_owner",
  "organization_admin",
  "event_manager",
  "scorer",
  "coach",
  "player",
  "viewer",
];
const ADMINS = ["organization_owner", "organization_admin"];

const EXPECTED = {
  "workspace.view": ALL,
  "members.view": [...ADMINS, "event_manager", "coach"],
  "members.manage": ADMINS,
  "venues.manage": ADMINS,
  "events.view": ALL,
  "events.manage": [...ADMINS, "event_manager"],
  "arena.view": ALL,
  "arena.score": [...ADMINS, "event_manager", "scorer"],
  "reports.view": ADMINS,
  "billing.view": ADMINS,
  "players.view": [...ADMINS, "event_manager", "coach"],
  "tokens.manage": ADMINS,
};

test("EXPECTED memuat semua izin dan semua peran", () => {
  assert.deepEqual(Object.keys(EXPECTED).sort(), [...ALL_PERMISSIONS].sort());
  assert.deepEqual([...ORGANIZATION_ROLE_ORDER].sort(), [...ALL].sort());
});

for (const permission of ALL_PERMISSIONS) {
  test(`matriks izin ${permission}`, () => {
    const allowed = ALL.filter((role) => canOrganizationRole(role, permission));
    assert.deepEqual(allowed.sort(), [...EXPECTED[permission]].sort());
  });
}

test("D-01: scorer tidak punya members.view dan reports.view, tetap bisa memberi skor", () => {
  assert.equal(canOrganizationRole("scorer", "members.view"), false);
  assert.equal(canOrganizationRole("scorer", "reports.view"), false);
  assert.equal(canOrganizationRole("scorer", "arena.score"), true);
});

test("alias host = event_manager; peran kosong atau tidak dikenal tidak punya izin apa pun", () => {
  assert.equal(normalizeOrganizationRole("host"), "event_manager");
  assert.equal(canOrganizationRole("host", "events.manage"), true);
  for (const role of [null, undefined, "", "hacker", "platform_admin"]) {
    for (const permission of ALL_PERMISSIONS) {
      assert.equal(canOrganizationRole(role, permission), false);
    }
  }
});

test("D-02: tab Workspace yang tampil per peran", () => {
  const tabs = (role) => visibleWorkspaceTabs(role).map((tab) => tab.key);
  const all = ["overview", "events", "operations", "reports", "billing", "members", "settings"];
  assert.deepEqual(tabs("organization_owner"), all);
  assert.deepEqual(tabs("organization_admin"), all);
  assert.deepEqual(tabs("event_manager"), ["overview", "events", "operations", "members", "settings"]);
  assert.deepEqual(tabs("coach"), ["overview", "events", "operations", "members", "settings"]);
  assert.deepEqual(tabs("scorer"), ["overview", "events", "operations", "settings"]);
  assert.deepEqual(tabs("player"), ["overview", "events", "operations", "settings"]);
  assert.deepEqual(tabs("viewer"), ["overview", "events", "operations", "settings"]);
  assert.deepEqual(tabs(undefined), []);
});
