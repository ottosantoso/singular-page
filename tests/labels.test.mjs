// Tes label Indonesia (D4, Rencana v2 bagian 5.5). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  eventStatusLabel,
  invoiceStatusLabel,
  participantStatusLabel,
  planLabel,
  roleLabel,
  subscriptionStatusLabel,
} from "../src/lib/labels.ts";

test("label peran sesuai dokumen v2", () => {
  assert.deepEqual(
    [
      "organization_owner",
      "organization_admin",
      "event_manager",
      "scorer",
      "coach",
      "player",
      "viewer",
    ].map(roleLabel),
    ["Owner", "Admin", "Event Manager", "Scorer", "Coach", "Player", "Viewer"],
  );
});

test("label status event sesuai dokumen v2", () => {
  assert.deepEqual(
    ["draft", "registration", "live", "completed", "cancelled"].map(eventStatusLabel),
    ["Draf", "Pendaftaran dibuka", "Berlangsung", "Selesai", "Dibatalkan"],
  );
});

test("label status peserta sesuai dokumen v2", () => {
  assert.deepEqual(
    ["registered", "waitlisted", "checked_in", "withdrawn"].map(participantStatusLabel),
    ["Terdaftar", "Daftar tunggu", "Sudah hadir", "Mengundurkan diri"],
  );
});

test("label status invoice sesuai dokumen v2", () => {
  assert.deepEqual(
    ["draft", "pending_payment", "proof_submitted", "under_review", "paid", "rejected"].map(
      invoiceStatusLabel,
    ),
    ["Draf", "Menunggu pembayaran", "Bukti dikirim", "Ditinjau", "Lunas", "Ditolak"],
  );
});

test("label paket dan status langganan", () => {
  assert.deepEqual(["free", "club", "pro", "enterprise", "casual", "squad"].map(planLabel), [
    "Free",
    "Club",
    "Pro",
    "Enterprise",
    "Casual",
    "Squad",
  ]);
  assert.equal(subscriptionStatusLabel("past_due"), "Jatuh tempo");
});

test("kode tak dikenal tidak tampil sebagai kode mentah bergaris bawah", () => {
  assert.equal(roleLabel("platform_admin"), "Platform Admin");
  assert.equal(eventStatusLabel("finished"), "Finished");
  assert.ok(!roleLabel("some_new_role").includes("_"));
});

test("nilai kosong menjadi tanda hubung, bukan 'undefined' atau 'null'", () => {
  assert.equal(roleLabel(null), "-");
  assert.equal(planLabel(undefined), "-");
  assert.equal(eventStatusLabel(""), "-");
});

test("kunci prototipe Object tidak dianggap label", () => {
  assert.equal(roleLabel("constructor"), "Constructor");
  assert.equal(roleLabel("toString"), "ToString");
});
