// Tes peringkat Juara Umum (win rate -> % poin -> selisih/laga -> menang). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStats,
  rankChampions,
  rankMovement,
  sortPlayers,
  minimumGames,
} from "../src/lib/klasemen-ranking.ts";

const m = (round, a, b, sa, sb) => ({ round, team_a: a, team_b: b, score_a: sa, score_b: sb });

test("win rate mengalahkan total poin: main lebih sedikit tapi efektif tetap di atas", () => {
  // B: 2 laga, 2 menang (22 poin). A: 3 laga, 2 menang (45 poin, lebih banyak).
  const matches = [
    m(1, ["B", "X"], ["Y", "Z"], 11, 9),
    m(1, ["B", "Y"], ["X", "Z"], 11, 10),
    m(2, ["A", "X"], ["Y", "Z"], 21, 5),
    m(2, ["A", "Y"], ["X", "Z"], 21, 5),
    m(2, ["A", "Z"], ["X", "Y"], 3, 21),
  ];
  const { ordered } = rankChampions(computeStats(["A", "B", "X", "Y", "Z"], matches), 2);
  const a = ordered.find((p) => p.name === "A");
  const b = ordered.find((p) => p.name === "B");
  assert.ok(a.pointsFor > b.pointsFor);
  assert.ok(b.rank < a.rank);
});

test("seri penuh berbagi peringkat padat, nama tidak memisahkan", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(1, ["C"], ["D"], 11, 9)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches), 1);
  assert.deepEqual(
    ordered.map((p) => [p.name, p.rank]),
    [["A", 1], ["C", 1], ["B", 2], ["D", 2]],
  );
});

test("tie-break: win rate sama -> persentase poin", () => {
  const matches = [m(1, ["A"], ["X"], 11, 10), m(1, ["B"], ["Y"], 11, 2)];
  const { ordered } = rankChampions(computeStats(["A", "B", "X", "Y"], matches), 1);
  assert.equal(ordered[0].name, "B");
  assert.equal(ordered[1].name, "A");
  assert.equal(ordered[0].rank, 1);
  assert.equal(ordered[1].rank, 2);
});

test("pemain di bawah batas minimum jadi Provisional tanpa peringkat", () => {
  const matches = [];
  for (let r = 1; r <= 4; r++) matches.push(m(r, ["A"], ["B"], 11, 5));
  matches.push(m(5, ["C"], ["B"], 11, 0)); // C hanya main 1x
  assert.equal(minimumGames(5), 3);
  const { ordered, minGames } = rankChampions(computeStats(["A", "B", "C"], matches), 5);
  assert.equal(minGames, 3);
  const c = ordered.find((p) => p.name === "C");
  assert.equal(c.provisional, true);
  assert.equal(c.rank, null);
  assert.equal(ordered[ordered.length - 1].name, "C");
  assert.equal(ordered[0].name, "A");
});

test("mode urutan Total Poin mengikuti aturan lama (poin lalu selisih)", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(2, ["A"], ["C"], 3, 11), m(2, ["B"], ["D"], 11, 0)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches), 2);
  const byPoints = sortPlayers(ordered, "poin").map((p) => p.name);
  assert.equal(byPoints[0], "B");
});

test("pergerakan peringkat dibanding ronde sebelumnya", () => {
  const matches = [
    m(1, ["A"], ["B"], 11, 5),
    m(1, ["C"], ["D"], 11, 9),
    m(2, ["B"], ["A"], 11, 0),
    m(2, ["D"], ["C"], 11, 0),
  ];
  const mv = rankMovement(["A", "B", "C", "D"], matches);
  assert.equal(mv.get("B").round, 2);
  assert.ok(mv.get("B").delta > 0);
  assert.ok(mv.get("A").delta < 0);
  assert.equal(rankMovement(["A"], [m(1, ["A"], ["B"], 1, 0)]).size, 0);
});

// Data nyata arena VS6TJA: 8 pemain, 1 lapangan (4 pemain per ronde), 11 ronde.
// Pemain main 5 atau 6 laga; Bang deni baru masuk setelah ronde 2.
const vs6tja = [
  m(1, ["Ryo", "Donna"], ["Tama", "Afwan"], 9, 12),
  m(2, ["Afwan", "Tari"], ["Riska", "Otto"], 12, 9),
  m(3, ["Bang deni", "Riska"], ["Ryo", "Tama"], 11, 10),
  m(4, ["Tari", "Otto"], ["Donna", "Bang deni"], 14, 7),
  m(5, ["Bang deni", "Tari"], ["Otto", "Afwan"], 8, 13),
  m(6, ["Donna", "Tama"], ["Ryo", "Riska"], 13, 8),
  m(7, ["Tari", "Donna"], ["Tama", "Riska"], 10, 11),
  m(8, ["Bang deni", "Otto"], ["Ryo", "Afwan"], 8, 13),
  m(9, ["Tari", "Ryo"], ["Afwan", "Riska"], 13, 8),
  m(10, ["Donna", "Otto"], ["Tama", "Bang deni"], 10, 11),
  m(11, ["Tari", "Otto"], ["Bang deni", "Donna"], 14, 7),
];
const vs6tjaPlayers = ["Ryo", "Otto", "Afwan", "Tari", "Donna", "Riska", "Tama", "Bang deni"];

test("arena rotasi (VS6TJA): pemain dengan 5 laga tidak jadi Provisional, Afwan juara", () => {
  const { ordered, minGames } = rankChampions(computeStats(vs6tjaPlayers, vs6tja), 11);
  assert.equal(minGames, 3);
  assert.equal(ordered.some((p) => p.provisional), false);
  assert.deepEqual(
    ordered.slice(0, 3).map((p) => [p.name, p.rank]),
    [["Afwan", 1], ["Tama", 2], ["Tari", 3]],
  );
});

test("batas minimum: jatah main = yang terkecil antara jumlah ronde dan main terbanyak", () => {
  assert.equal(minimumGames(11), 6); // semua bisa main di tiap ronde
  assert.equal(minimumGames(11, 6), 3); // arena rotasi, paling banyak main 6x
  assert.equal(minimumGames(11, 20), 6); // tidak pernah lebih ketat dari aturan jumlah ronde
  assert.equal(minimumGames(1, 0), 1);
});

test("pemain yang baru main sedikit tetap Provisional di arena rotasi", () => {
  const matches = [...vs6tja, m(12, ["Baru", "Tari"], ["Otto", "Ryo"], 11, 9)];
  const { ordered } = rankChampions(computeStats([...vs6tjaPlayers, "Baru"], matches), 12);
  const baru = ordered.find((p) => p.name === "Baru");
  assert.equal(baru.provisional, true);
  assert.equal(baru.rank, null);
});
