// Tes peringkat klasemen per cabang olahraga. Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStandings,
  gamesSpread,
  getRankingProfile,
  headlineMetric,
  normalizeSport,
  profileSummary,
  rankStandings,
  sortStandings,
  sportFromMatches,
} from "../src/lib/ranking.ts";

const row = (name, games, wins, points, pointsAgainst) => ({
  name,
  games,
  wins,
  draws: 0,
  losses: games - wins,
  points,
  pointsAgainst,
  pointDiff: points - pointsAgainst,
});

// Data nyata arena padel 374FNL. Kak Tari main 8x, yang lain 9x.
const arena374FNL = [
  row("Bang Deni", 9, 6, 102, 87),
  row("Mz Akbar", 9, 5, 99, 90),
  row("Kak Tari", 8, 5, 98, 69),
  row("Ryo", 9, 5, 98, 90),
  row("Yamin", 9, 4, 94, 94),
  row("Kak Donna", 9, 6, 93, 96),
  row("Bang Otto", 9, 4, 89, 100),
  row("Kak Pina", 9, 3, 84, 105),
  row("Diaz", 9, 2, 81, 107),
];

test("padel: juara arena 374FNL adalah Bang Deni (poin terbanyak), bukan rata-rata poin", () => {
  const ranked = rankStandings([...arena374FNL].reverse(), "padel");
  assert.equal(ranked[0].name, "Bang Deni");
  assert.deepEqual(
    ranked.map((r) => r.name),
    arena374FNL.map((r) => r.name),
  );
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("padel: poin sama dipisah selisih poin, bukan jumlah menang", () => {
  const ranked = rankStandings(
    [row("A", 4, 1, 50, 45), row("B", 4, 4, 50, 49), row("C", 4, 2, 50, 40)],
    "padel",
  );
  assert.deepEqual(
    ranked.map((r) => r.name),
    ["C", "A", "B"],
  );
});

test("badminton: jumlah menang lebih penting dari total poin (urutan BWF)", () => {
  const rows = [row("Banyak poin", 6, 2, 120, 100), row("Banyak menang", 6, 4, 100, 100)];
  assert.equal(rankStandings(rows, "badminton")[0].name, "Banyak menang");
  assert.equal(rankStandings(rows, "padel")[0].name, "Banyak poin");
});

test("badminton: menang sama dipisah selisih poin lalu total poin", () => {
  const ranked = rankStandings(
    [row("A", 4, 3, 80, 70), row("B", 4, 3, 84, 70), row("C", 4, 3, 84, 70)],
    "badminton",
  );
  assert.deepEqual(
    ranked.map((r) => [r.name, r.rank]),
    [
      ["B", 1],
      ["C", 1],
      ["A", 2],
    ],
  );
});

test("tenis dan tenis meja: menang sama dipisah persentase poin dimenangkan", () => {
  const rows = [row("A", 3, 2, 18, 12), row("B", 3, 2, 20, 10), row("C", 3, 2, 15, 15)];
  for (const sport of ["tennis", "tenismeja"]) {
    assert.deepEqual(
      rankStandings(rows, sport).map((r) => r.name),
      ["B", "A", "C"],
    );
  }
});

test("peringkat padat: setelah seri, peringkat berikutnya naik satu", () => {
  const ranked = rankStandings(
    [
      row("A", 2, 1, 10, 9),
      row("B", 2, 1, 10, 9),
      row("C", 2, 1, 9, 9),
      row("D", 2, 1, 9, 9),
      row("E", 2, 0, 8, 9),
    ],
    "padel",
  );
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 1, 2, 2, 3],
  );
});

test("pemain tanpa pertandingan selalu di bawah yang sudah main", () => {
  const ranked = rankStandings([row("Belum", 0, 0, 0, 0), row("Sudah", 1, 0, 3, 9)], "padel");
  assert.deepEqual(
    ranked.map((r) => r.name),
    ["Sudah", "Belum"],
  );
});

test("buildStandings: skor 0-0 dan live tidak dihitung; seri bukan menang", () => {
  const standings = buildStandings(
    ["A", "B", "C", "D", "E"],
    [
      { team_a: ["A", "B"], team_b: ["C", "D"], score_a: 11, score_b: 7, status: "done" },
      { team_a: ["A", "C"], team_b: ["B", "D"], score_a: 0, score_b: 0, status: "done" },
      { team_a: ["A", "D"], team_b: ["B", "C"], score_a: 5, score_b: 3, status: "live" },
      { team_a: ["A", "C"], team_b: ["B", "D"], score_a: 6, score_b: 6, status: "done" },
    ],
  );
  const byName = Object.fromEntries(standings.map((s) => [s.name, s]));
  assert.equal(byName.A.games, 2);
  assert.equal(byName.A.wins, 1);
  assert.equal(byName.A.draws, 1);
  assert.equal(byName.A.points, 17);
  assert.equal(byName.A.pointDiff, 4);
  assert.equal(byName.E.games, 0);
});

test("profil per cabang dan fallback sport tidak dikenal ke padel", () => {
  assert.equal(normalizeSport("tenismeja"), "tenismeja");
  assert.equal(normalizeSport("golf"), "padel");
  assert.equal(normalizeSport(undefined), "padel");
  assert.equal(
    profileSummary(getRankingProfile("padel")),
    "Total poin → Selisih poin → Jumlah menang",
  );
  assert.equal(
    profileSummary(getRankingProfile("tennis")),
    "Jumlah menang → Persentase game dimenangkan → Selisih game",
  );
  assert.deepEqual(headlineMetric(row("A", 3, 2, 30, 20), getRankingProfile("badminton")), {
    value: 2,
    label: "menang",
  });
  assert.deepEqual(headlineMetric(row("A", 3, 2, 30, 20), getRankingProfile("padel")), {
    value: 30,
    label: "poin",
  });
});

test("sportFromMatches memilih sport terbanyak; gamesSpread; input tidak diubah", () => {
  assert.equal(
    sportFromMatches([{ sport: "badminton" }, { sport: "badminton" }, { sport: "padel" }]),
    "badminton",
  );
  assert.equal(sportFromMatches([]), "padel");
  assert.deepEqual(gamesSpread(arena374FNL), { min: 8, max: 9 });
  assert.equal(gamesSpread([row("A", 0, 0, 0, 0)]), null);
  const input = [row("B", 1, 0, 1, 2), row("A", 1, 1, 2, 1)];
  sortStandings(input, "padel");
  assert.equal(input[0].name, "B");
  assert.deepEqual(rankStandings([], "padel"), []);
});
