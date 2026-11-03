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
  const { ordered } = rankChampions(computeStats(["A", "B", "X", "Y", "Z"], matches));
  const a = ordered.find((p) => p.name === "A");
  const b = ordered.find((p) => p.name === "B");
  assert.ok(a.pointsFor > b.pointsFor);
  assert.ok(b.rank < a.rank);
});

test("seri penuh berbagi peringkat padat, nama tidak memisahkan", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(1, ["C"], ["D"], 11, 9)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches));
  assert.deepEqual(
    ordered.map((p) => [p.name, p.rank]),
    [["A", 1], ["C", 1], ["B", 2], ["D", 2]],
  );
});

test("tie-break: win rate sama -> persentase poin", () => {
  const matches = [m(1, ["A"], ["X"], 11, 10), m(1, ["B"], ["Y"], 11, 2)];
  const { ordered } = rankChampions(computeStats(["A", "B", "X", "Y"], matches));
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
  const { ordered, minGames } = rankChampions(computeStats(["A", "B", "C"], matches));
  assert.equal(minGames, 3);
  const c = ordered.find((p) => p.name === "C");
  assert.equal(c.provisional, true);
  assert.equal(c.rank, null);
  assert.equal(ordered[ordered.length - 1].name, "C");
  assert.equal(ordered[0].name, "A");
});

test("mode urutan Total Poin mengikuti aturan lama (poin lalu selisih)", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(2, ["A"], ["C"], 3, 11), m(2, ["B"], ["D"], 11, 0)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches));
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

// Data asli arena VS6TJA: 8 pemain, 1 lapangan (4 pemain per ronde), 11 ronde.
// Bang deni baru masuk setelah ronde 2. Ronde 11 memberi laga ke-6 untuk 4 pemain saja.
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

test("VS6TJA: pemain yang istirahat lebih sering tidak dicoret dari peringkat (batas dari jumlah main, bukan ronde)", () => {
  const { ordered, minGames } = rankChampions(computeStats(vs6tjaPlayers, vs6tja));
  assert.equal(minGames, 3); // separuh dari main terbanyak (6), bukan separuh dari 11 ronde
  assert.ok(ordered.every((p) => !p.provisional), "semua pemain sudah layak diranking");
  assert.deepEqual(
    ordered.map((p) => [p.name, p.rank]),
    [
      ["Afwan", 1], // 4/5 menang, 55% poin
      ["Tama", 2], // 4/5 menang, 54% poin
      ["Tari", 3], // 4/6
      ["Otto", 4], // 3/6
      ["Ryo", 5], // 2/5, 50% poin
      ["Riska", 6], // 2/5, 45% poin
      ["Bang deni", 7], // 2/6
      ["Donna", 8], // 1/6
    ],
  );
});

test("VS6TJA: tanpa ronde 11 semua main 5x dan Afwan tetap juara", () => {
  const { ordered } = rankChampions(computeStats(vs6tjaPlayers, vs6tja.filter((x) => x.round <= 10)));
  assert.ok(computeStats(vs6tjaPlayers, vs6tja.filter((x) => x.round <= 10)).every((s) => s.games === 5));
  assert.equal(ordered[0].name, "Afwan");
  assert.equal(ordered[1].name, "Tama");
});

test("batas minimum = separuh dari jumlah main terbanyak (minimal 1)", () => {
  assert.equal(minimumGames(0), 1);
  assert.equal(minimumGames(1), 1);
  assert.equal(minimumGames(5), 3);
  assert.equal(minimumGames(6), 3);
  assert.equal(minimumGames(10), 5);
});
