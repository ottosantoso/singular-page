// Kontrak B-01/B-04: halaman event publik dan /klasemen memakai modul yang sama, jadi urutannya harus sama.
// Contoh dari roadmap-final-v3 bagian 5. Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { computeStats, rankChampions } from "../src/lib/klasemen-ranking.ts";

const m = (round, a, b, sa, sb) => ({ round, team_a: a, team_b: b, score_a: sa, score_b: sb });

const contoh = [
  m(1, ["A", "B"], ["C", "D"], 21, 17),
  m(2, ["A", "C"], ["B", "D"], 15, 21),
  m(3, ["A", "D"], ["B", "C"], 21, 19),
  m(4, ["A", "D"], ["B", "C"], 21, 18),
];

test("contoh 4 pemain: peringkat resmi D, A, B, C (total poin B lebih besar dari A, tapi tidak menentukan)", () => {
  const { ordered, minGames } = rankChampions(computeStats(["A", "B", "C", "D"], contoh));
  assert.deepEqual(ordered.map((p) => p.name), ["D", "A", "B", "C"]);
  assert.deepEqual(ordered.map((p) => p.rank), [1, 2, 3, 4]);
  assert.equal(minGames, 2);
});

test("contoh 4 pemain: angka tiap pemain sesuai tabel dokumen", () => {
  const byName = Object.fromEntries(
    rankChampions(computeStats(["A", "B", "C", "D"], contoh)).ordered.map((p) => [p.name, p]),
  );
  assert.equal(byName.A.pointsFor, 78);
  assert.equal(byName.A.pointsAgainst, 75);
  assert.equal(byName.B.pointsFor, 79);
  assert.equal(byName.C.pointsFor, 69);
  assert.equal(byName.D.pointsFor, 80);
  assert.equal(byName.A.wins, 3);
  assert.equal(byName.B.wins, 2);
  assert.equal(byName.C.wins, 0);
  assert.equal(byName.D.wins, 3);
  assert.equal(Math.round(byName.A.winRate), 75);
  assert.equal(Math.round(byName.B.winRate), 50);
  assert.equal(Math.round(byName.C.winRate), 0);
});

test("skor 0-0 tidak dihitung sebagai laga (tidak mengubah peringkat)", () => {
  const dengan0 = [...contoh, m(5, ["A", "B"], ["C", "D"], 0, 0)];
  const tanpa = rankChampions(computeStats(["A", "B", "C", "D"], contoh)).ordered.map((p) => p.name);
  const dengan = rankChampions(computeStats(["A", "B", "C", "D"], dengan0)).ordered.map((p) => p.name);
  assert.deepEqual(dengan, tanpa);
});
