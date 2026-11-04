// Tes peringkat Juara Umum (win rate -> % poin -> selisih/laga -> menang). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeStats,
  rankChampions,
  rankMovement,
  sortPlayers,
  minimumGames,
  winRateDivisor,
  winRateBreakdown,
  explainRanking,
  topThree,
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

test("seri penuh berbagi peringkat gaya kompetisi (1,1,3,3), nama tidak memisahkan", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(1, ["C"], ["D"], 11, 9)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches));
  assert.deepEqual(
    ordered.map((p) => [p.name, p.rank]),
    [["A", 1], ["C", 1], ["B", 3], ["D", 3]],
  );
});

test("peringkat kompetisi: seri di tengah melompat, bukan padat (1,2,2,4)", () => {
  // A menang 2x, D kalah 2x. B dan C saling mengalahkan sekali dengan skor identik (rekor kembar).
  const matches = [
    m(1, ["A"], ["D"], 11, 5),
    m(2, ["A"], ["D"], 11, 5),
    m(3, ["B"], ["C"], 11, 9),
    m(4, ["C"], ["B"], 11, 9),
  ];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches));
  assert.deepEqual(
    ordered.map((p) => [p.name, p.rank]),
    [["A", 1], ["B", 2], ["C", 2], ["D", 4]],
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

// --- Teks penjelasan peringkat (apa yang dibaca pemain di bawah tabel) ---

test("winRateDivisor: tidak kurang dari main terbanyak - 1, dan tidak kurang dari laga sendiri", () => {
  assert.equal(winRateDivisor(5, 6), 5); // selisih 1 laga: pakai laga sendiri
  assert.equal(winRateDivisor(6, 6), 6);
  assert.equal(winRateDivisor(5, 10), 9); // selisih 5 laga: pembagi dinaikkan
  assert.equal(winRateDivisor(2, 2), 2);
  assert.equal(winRateDivisor(1, 1), 1);
});

test("VS6TJA: rincian win rate di layar sama dengan angka yang dipakai peringkat", () => {
  const { ordered } = rankChampions(computeStats(vs6tjaPlayers, vs6tja));
  const maxGames = 6;
  const byName = Object.fromEntries(ordered.map((p) => [p.name, p]));
  assert.equal(winRateBreakdown(byName["Afwan"], maxGames), "4 menang ÷ 5 = 80%");
  assert.equal(winRateBreakdown(byName["Tari"], maxGames), "4 menang ÷ 6 = 67%");
  // angka di rincian = nilai winRate yang dipakai untuk mengurutkan
  for (const p of ordered) {
    const shown = Number(winRateBreakdown(p, maxGames).match(/= (\d+)%/)[1]);
    assert.equal(shown, Math.round(p.winRate));
  }
});

test("rincian win rate menyebut pembagi dinaikkan untuk pemain yang telat (Deni 5/5 vs Dona 7/10)", () => {
  const matches = [];
  for (let r = 1; r <= 10; r++) {
    matches.push(m(r, ["Dona", "X"], ["Y", "Z"], r <= 7 ? 11 : 5, r <= 7 ? 5 : 11));
  }
  for (let r = 6; r <= 10; r++) {
    matches.push(m(100 + r, ["Deni", "Q"], ["W", "V"], 11, 5)); // Deni 5 laga, 5 menang
  }
  const stats = computeStats(["Dona", "Deni", "X", "Y", "Z", "Q", "W", "V"], matches);
  const deni = stats.find((p) => p.name === "Deni");
  assert.equal(deni.games, 5);
  assert.equal(
    winRateBreakdown(deni, 10),
    "5 menang ÷ 9 = 56% (main 5 laga, pembagi dinaikkan ke 9)",
  );
  const dona = stats.find((p) => p.name === "Dona");
  assert.equal(winRateBreakdown(dona, 10), "7 menang ÷ 10 = 70%");
  assert.ok(dona.winRate > deni.winRate, "Dona (7/10) tetap di atas Deni (5/5 tapi telat)");
});

test("rincian win rate menyertakan seri sebagai setengah menang", () => {
  const p = { games: 4, wins: 2, draws: 2, winRate: 75 };
  assert.equal(winRateBreakdown(p, 4), "2 menang + ½ × 2 seri ÷ 4 = 75%");
});

test("explainRanking VS6TJA: angka di teks mengikuti aturan (batas 3 laga, pembagi minimal 5, contoh Afwan)", () => {
  const { ordered, minGames } = rankChampions(computeStats(vs6tjaPlayers, vs6tja));
  const ex = explainRanking(ordered, minGames);
  assert.match(ex.summary, /win rate, lalu % poin, selisih poin per laga, lalu jumlah menang/);
  assert.match(ex.summary, /Total poin hanya informasi/);
  assert.match(ex.summary, /\(1, 1, 3\)/);
  assert.equal(ex.steps.length, 5);
  assert.match(ex.steps[0], /0–0/);
  assert.match(ex.steps[1], /tidak kurang dari 5 \(main terbanyak di arena ini 6, dikurangi 1\)/);
  assert.match(ex.steps[4], /minimal 3 laga \(separuh dari main terbanyak, 6\)/);
  assert.equal(ex.example, "Contoh di arena ini: Afwan 4 menang ÷ 5 = 80%.");
});

test("explainRanking: arena kecil tanpa batas pembagi, dan tanpa contoh bila belum ada peringkat", () => {
  const small = rankChampions(computeStats(["A", "B"], [m(1, ["A"], ["B"], 11, 9)]));
  const ex = explainRanking(small.ordered, small.minGames);
  assert.match(ex.steps[1], /Pembagi = jumlah laga pemain itu\.$/);
  assert.equal(ex.example, "Contoh di arena ini: A 1 menang ÷ 1 = 100%.");
  const empty = explainRanking([], 1);
  assert.equal(empty.example, null);
  assert.match(empty.steps[4], /minimal 1 laga/);
});

// --- Podium dipakai bersama Klasemen dan Detail Pemain ---

test("topThree VS6TJA: Afwan, Tama, Tari (bukan Tari, Otto, Afwan seperti aturan total poin lama)", () => {
  const { ordered } = rankChampions(computeStats(vs6tjaPlayers, vs6tja));
  assert.deepEqual(
    topThree(ordered).map((p) => [p.name, p.rank]),
    [
      ["Afwan", 1],
      ["Tama", 2],
      ["Tari", 3],
    ],
  );
  // aturan lama (total poin) memberi urutan berbeda; podium tidak boleh mengikutinya
  const byPoints = [...ordered]
    .sort((a, b) => b.pointsFor - a.pointsFor)
    .slice(0, 3)
    .map((p) => p.name);
  assert.deepEqual(byPoints, ["Tari", "Otto", "Afwan"]);
});

test("topThree: pemain Provisional tidak masuk podium walau win rate tinggi", () => {
  const matches = [];
  for (let r = 1; r <= 6; r++) {
    matches.push(m(r, ["A", "X"], ["B", "Y"], r <= 3 ? 11 : 5, r <= 3 ? 5 : 11));
  }
  matches.push(m(7, ["C", "X"], ["B", "Y"], 11, 0)); // C baru 1 laga, menang 100%
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "X", "Y"], matches));
  const c = ordered.find((p) => p.name === "C");
  assert.equal(c.provisional, true);
  assert.ok(!topThree(ordered).some((p) => p.name === "C"));
});

test("topThree: seri di posisi 1 berbagi peringkat dan hanya tiga yang diambil", () => {
  const matches = [m(1, ["A"], ["B"], 11, 9), m(1, ["C"], ["D"], 11, 9)];
  const { ordered } = rankChampions(computeStats(["A", "B", "C", "D"], matches));
  assert.deepEqual(
    topThree(ordered).map((p) => [p.name, p.rank]),
    [
      ["A", 1],
      ["C", 1],
      ["B", 3],
    ],
  );
  assert.deepEqual(topThree([]), []);
});
