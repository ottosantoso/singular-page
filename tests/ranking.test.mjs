// Tes peringkat klasemen: poin, lalu selisih poin, peringkat padat. Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { rankStandings, sortStandings } from "../src/lib/ranking.ts";

// Data nyata arena 374FNL (9 pemain). Kak Tari main 8x, yang lain 9x.
const arena374FNL = [
  { name: "Bang Deni", points: 102, pointDiff: 15, games: 9, wins: 6 },
  { name: "Mz Akbar", points: 99, pointDiff: 9, games: 9, wins: 5 },
  { name: "Kak Tari", points: 98, pointDiff: 29, games: 8, wins: 5 },
  { name: "Ryo", points: 98, pointDiff: 8, games: 9, wins: 5 },
  { name: "Yamin", points: 94, pointDiff: 0, games: 9, wins: 4 },
  { name: "Kak Donna", points: 93, pointDiff: -3, games: 9, wins: 6 },
  { name: "Bang Otto", points: 89, pointDiff: -11, games: 9, wins: 4 },
  { name: "Kak Pina", points: 84, pointDiff: -21, games: 9, wins: 3 },
  { name: "Diaz", points: 81, pointDiff: -26, games: 9, wins: 2 },
];

test("juara arena 374FNL adalah Bang Deni (poin terbanyak), bukan rata-rata poin", () => {
  const ranked = rankStandings([...arena374FNL].reverse());
  assert.equal(ranked[0].name, "Bang Deni");
  assert.deepEqual(
    ranked.map((r) => r.name),
    arena374FNL.map((r) => r.name),
  );
});

test("poin sama diurutkan dari selisih poin", () => {
  const ranked = rankStandings(arena374FNL);
  assert.equal(ranked[2].name, "Kak Tari");
  assert.equal(ranked[3].name, "Ryo");
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("kemenangan tidak dipakai sebagai pemisah: poin dan selisih sama tetap seri", () => {
  const ranked = rankStandings([
    { name: "A", points: 50, pointDiff: 5, wins: 1 },
    { name: "B", points: 50, pointDiff: 5, wins: 4 },
    { name: "C", points: 40, pointDiff: 0, wins: 9 },
  ]);
  assert.deepEqual(
    ranked.map((r) => [r.name, r.rank]),
    [
      ["A", 1],
      ["B", 1],
      ["C", 2],
    ],
  );
});

test("peringkat padat: setelah seri peringkat berikutnya naik satu", () => {
  const ranked = rankStandings([
    { name: "A", points: 10, pointDiff: 1 },
    { name: "B", points: 10, pointDiff: 1 },
    { name: "C", points: 9, pointDiff: 1 },
    { name: "D", points: 9, pointDiff: 1 },
    { name: "E", points: 8, pointDiff: 0 },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 1, 2, 2, 3],
  );
});

test("daftar kosong dan input tidak diubah", () => {
  assert.deepEqual(rankStandings([]), []);
  const input = [
    { name: "B", points: 1, pointDiff: 0 },
    { name: "A", points: 2, pointDiff: 0 },
  ];
  sortStandings(input);
  assert.equal(input[0].name, "B");
});
