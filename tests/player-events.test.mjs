// Tes filter event aktif Player hub (D3). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { filterActiveEvents, isActiveEvent } from "../src/lib/player-events.ts";

const entry = (id, status) => ({ event_id: id, event: status === null ? null : { status } });

test("event draft, registration, dan live dihitung aktif", () => {
  for (const status of ["draft", "registration", "live"]) {
    assert.equal(isActiveEvent({ status }), true, status);
  }
});

test("event completed dan cancelled tidak dihitung aktif", () => {
  assert.equal(isActiveEvent({ status: "completed" }), false);
  assert.equal(isActiveEvent({ status: "cancelled" }), false);
});

test("status 'finished' bukan status valid dan tidak lagi dipakai sebagai penanda selesai", () => {
  // Regresi D3: dulu filter memakai 'finished', sehingga event 'completed' ikut terhitung aktif.
  assert.equal(isActiveEvent({ status: "finished" }), true);
  assert.equal(isActiveEvent({ status: "completed" }), false);
});

test("event kosong (null/undefined) tidak aktif", () => {
  assert.equal(isActiveEvent(null), false);
  assert.equal(isActiveEvent(undefined), false);
});

test("filterActiveEvents hanya mempertahankan event aktif dan urutan asli", () => {
  const items = [
    entry("a", "registration"),
    entry("b", "completed"),
    entry("c", "live"),
    entry("d", "cancelled"),
    entry("e", null),
    entry("f", "draft"),
  ];
  assert.deepEqual(
    filterActiveEvents(items).map((item) => item.event_id),
    ["a", "c", "f"],
  );
});

test("filterActiveEvents tidak mengubah array masukan", () => {
  const items = [entry("a", "completed"), entry("b", "live")];
  const copy = structuredClone(items);
  filterActiveEvents(items);
  assert.deepEqual(items, copy);
});
