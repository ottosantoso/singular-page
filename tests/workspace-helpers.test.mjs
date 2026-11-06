// Kontrak Batch C: status undangan, hash token, dan validasi waktu event. Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  INVITE_TTL_MS,
  hashInviteToken,
  inviteExpiry,
  inviteStatus,
  validateEventTimes,
} from "../src/lib/workspace-helpers.ts";

const now = new Date("2026-11-06T10:00:00.000Z");

test("hashInviteToken = SHA-256 hex (sama dengan digest di accept_organization_invite)", async () => {
  assert.equal(
    await hashInviteToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("inviteStatus: menunggu, kedaluwarsa, dan sudah diterima", () => {
  assert.equal(inviteStatus({ accepted_at: null, expires_at: "2026-11-07T10:00:00.000Z" }, now), "pending");
  assert.equal(inviteStatus({ accepted_at: null, expires_at: "2026-11-05T10:00:00.000Z" }, now), "expired");
  assert.equal(inviteStatus({ accepted_at: null, expires_at: "2026-11-06T10:00:00.000Z" }, now), "expired");
  assert.equal(
    inviteStatus({ accepted_at: "2026-11-06T09:00:00.000Z", expires_at: "2026-11-05T10:00:00.000Z" }, now),
    "accepted",
  );
});

test("inviteExpiry: 7 hari dari sekarang", () => {
  assert.equal(INVITE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(inviteExpiry(now), "2026-11-13T10:00:00.000Z");
});

test("validateEventTimes: selesai harus >= mulai", () => {
  assert.equal(validateEventTimes("", ""), null);
  assert.equal(validateEventTimes("2026-11-06T10:00", ""), null);
  assert.equal(validateEventTimes("2026-11-06T10:00", "2026-11-06T12:00"), null);
  assert.equal(validateEventTimes("2026-11-06T10:00", "2026-11-06T10:00"), null);
  assert.match(validateEventTimes("2026-11-06T10:00", "2026-11-06T09:59"), /lebih awal/);
  assert.match(validateEventTimes("", "2026-11-06T12:00"), /waktu mulai/);
});
