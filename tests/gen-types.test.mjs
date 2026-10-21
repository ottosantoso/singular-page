// Tes normalisasi skrip types:gen (D6). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { DEV_PROJECT_REF, normalizeTypes } from "../scripts/gen-types.mjs";

const valid = "export type Database = {}\nexport const Constants = {} as const\n";

test("proyek sumber adalah development, bukan produksi", () => {
  assert.equal(DEV_PROJECT_REF, "owptsovberbfwvvdxjiu");
  assert.notEqual(DEV_PROJECT_REF, "qibsdczvxqmbjrtmvgtj");
});

test("CRLF dan BOM dibuang, akhir baris LF", () => {
  const out = normalizeTypes(`﻿${valid.replace(/\n/g, "\r\n")}`);
  assert.equal(out, valid);
  assert.ok(!out.includes("\r"));
  assert.ok(!out.startsWith("﻿"));
});

test("newline akhir ditambahkan bila hilang", () => {
  assert.equal(normalizeTypes(valid.trimEnd()), valid);
});

test("keluaran kosong atau bukan tipe database ditolak", () => {
  assert.throws(() => normalizeTypes(""), /Database/);
  assert.throws(() => normalizeTypes("Error: not logged in"), /Database/);
  assert.throws(() => normalizeTypes(undefined), /Database/);
});

test("keluaran terpotong ditolak", () => {
  assert.throws(() => normalizeTypes("export type Database = {"), /terpotong/);
});
