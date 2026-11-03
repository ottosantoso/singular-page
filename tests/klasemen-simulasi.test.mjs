// Tes aturan final Juara Umum dengan data asli 4 arena (simulasi_juara_umum.xlsx, 3 Nov 2026).
// Aturan: laga 0-0 diabaikan, win rate dengan pembagi MAX(laga sendiri, main terbanyak - 1),
// tie-break % poin -> selisih/laga -> menang. Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  ROTATION_TOLERANCE,
  computeStats,
  isPlayedMatch,
  rankChampions,
} from "../src/lib/klasemen-ranking.ts";
import {
  bestDuo,
  buildForm,
  buildInsights,
  summarizeMatches,
} from "../src/lib/klasemen-insights.ts";

const m = (round, a, b, sa, sb) => ({ round, team_a: a, team_b: b, score_a: sa, score_b: sb });

const vs6tjaPlayers = ["Afwan", "Bang deni", "Donna", "Otto", "Riska", "Ryo", "Tama", "Tari"];
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

const fnl374Players = ["Bang Deni", "Bang Otto", "Diaz", "Kak Donna", "Kak Pina", "Kak Tari", "Mz Akbar", "Ryo", "Yamin"];
const fnl374 = [
  m(1, ["Kak Pina", "Bang Otto"], ["Kak Tari", "Diaz"], 5, 16),
  m(1, ["Mz Akbar", "Kak Donna"], ["Ryo", "Bang Deni"], 8, 13),
  m(2, ["Kak Tari", "Bang Otto"], ["Mz Akbar", "Bang Deni"], 8, 13),
  m(2, ["Kak Pina", "Diaz"], ["Yamin", "Ryo"], 7, 14),
  m(3, ["Kak Donna", "Bang Deni"], ["Yamin", "Kak Pina"], 11, 10),
  m(3, ["Diaz", "Ryo"], ["Mz Akbar", "Kak Tari"], 6, 15),
  m(4, ["Kak Pina", "Kak Donna"], ["Bang Otto", "Mz Akbar"], 11, 10),
  m(4, ["Yamin", "Diaz"], ["Ryo", "Kak Tari"], 5, 15),
  m(5, ["Yamin", "Kak Donna"], ["Bang Otto", "Diaz"], 11, 10),
  m(5, ["Kak Pina", "Ryo"], ["Kak Tari", "Bang Deni"], 8, 13),
  m(6, ["Kak Pina", "Bang Deni"], ["Diaz", "Kak Donna"], 13, 8),
  m(6, ["Bang Otto", "Yamin"], ["Mz Akbar", "Ryo"], 10, 11),
  m(7, ["Kak Tari", "Yamin"], ["Bang Otto", "Kak Donna"], 10, 11),
  m(7, ["Bang Deni", "Diaz"], ["Kak Pina", "Mz Akbar"], 9, 12),
  m(8, ["Kak Pina", "Kak Tari"], ["Mz Akbar", "Yamin"], 8, 13),
  m(8, ["Bang Deni", "Bang Otto"], ["Kak Donna", "Ryo"], 12, 9),
  m(9, ["Kak Tari", "Kak Donna"], ["Diaz", "Mz Akbar"], 13, 8),
  m(9, ["Bang Otto", "Ryo"], ["Yamin", "Bang Deni"], 12, 9),
  m(10, ["Ryo", "Kak Pina"], ["Kak Donna", "Bang Otto"], 10, 11),
  m(10, ["Bang Deni", "Mz Akbar"], ["Yamin", "Diaz"], 9, 12),
];

const jtsz5Players = ["Dona", "Otto", "Tari", "akbar", "alifah", "alvina", "diaz", "faiz", "hafiz", "queen", "ryo"];
const jtsz5 = [
  m(1, ["diaz", "alifah"], ["ryo", "Tari"], 4, 14),
  m(1, ["Dona", "hafiz"], ["Otto", "faiz"], 7, 14),
  m(2, ["Tari", "diaz"], ["Otto", "akbar"], 10, 11),
  m(2, ["queen", "alifah"], ["faiz", "alvina"], 5, 16),
  m(3, ["Dona", "queen"], ["akbar", "alifah"], 10, 11),
  m(3, ["hafiz", "faiz"], ["ryo", "alvina"], 12, 9),
  m(4, ["Tari", "akbar"], ["hafiz", "ryo"], 12, 9),
  m(4, ["diaz", "Otto"], ["queen", "alvina"], 11, 10),
  m(5, ["diaz", "queen"], ["alifah", "Dona"], 10, 11),
  m(5, ["alvina", "Otto"], ["akbar", "faiz"], 8, 13),
  m(6, ["queen", "Tari"], ["ryo", "Dona"], 6, 15),
  m(6, ["faiz", "alifah"], ["hafiz", "akbar"], 7, 14),
  m(7, ["diaz", "alvina"], ["hafiz", "Tari"], 6, 15),
  m(7, ["ryo", "alifah"], ["Otto", "Dona"], 9, 12),
  m(8, ["Otto", "hafiz"], ["queen", "akbar"], 10, 11),
  m(8, ["faiz", "Dona"], ["diaz", "ryo"], 17, 14),
  m(9, ["Otto", "Tari"], ["queen", "faiz"], 13, 8),
  m(9, ["akbar", "Dona"], ["hafiz", "alvina"], 13, 8),
  m(10, ["Otto", "ryo"], ["Tari", "alifah"], 0, 0),
  m(10, ["diaz", "Dona"], ["alvina", "akbar"], 0, 0),
];

const tvj8ppPlayers = ["Akbar", "Diaz", "Donna", "Faiz", "Hafiz", "Otto", "Pina", "Ryo", "Tari", "Yamin"];
const tvj8pp = [
  m(1, ["Faiz", "Hafiz"], ["Akbar", "Pina"], 14, 7),
  m(1, ["Diaz", "Tari"], ["Donna", "Yamin"], 10, 11),
  m(2, ["Diaz", "Donna"], ["Pina", "Ryo"], 9, 12),
  m(2, ["Faiz", "Otto"], ["Tari", "Yamin"], 11, 10),
  m(3, ["Hafiz", "Pina"], ["Tari", "Otto"], 15, 6),
  m(3, ["Donna", "Ryo"], ["Yamin", "Akbar"], 12, 9),
  m(4, ["Hafiz", "Otto"], ["Ryo", "Faiz"], 6, 15),
  m(4, ["Diaz", "Pina"], ["Akbar", "Tari"], 10, 11),
  m(5, ["Faiz", "Diaz"], ["Hafiz", "Ryo"], 6, 15),
  m(5, ["Donna", "Akbar"], ["Otto", "Yamin"], 6, 15),
  m(6, ["Pina", "Otto"], ["Hafiz", "Yamin"], 10, 11),
  m(6, ["Faiz", "Tari"], ["Akbar", "Diaz"], 18, 3),
  m(7, ["Otto", "Diaz"], ["Faiz", "Donna"], 9, 12),
  m(7, ["Tari", "Pina"], ["Ryo", "Yamin"], 6, 15),
  m(8, ["Tari", "Ryo"], ["Otto", "Akbar"], 13, 8),
  m(8, ["Faiz", "Yamin"], ["Hafiz", "Donna"], 10, 11),
  m(9, ["Otto", "Donna"], ["Akbar", "Pina"], 14, 7),
  m(9, ["Tari", "Hafiz"], ["Diaz", "Ryo"], 15, 6),
  m(10, ["Hafiz", "Diaz"], ["Yamin", "Donna"], 10, 11),
  m(10, ["Pina", "Faiz"], ["Akbar", "Ryo"], 8, 13),
  m(11, ["Pina", "Donna"], ["Faiz", "Akbar"], 10, 11),
  m(11, ["Yamin", "Diaz"], ["Otto", "Ryo"], 11, 10),
  m(12, ["Pina", "Yamin"], ["Diaz", "Faiz"], 10, 11),
  m(12, ["Ryo", "Tari"], ["Akbar", "Hafiz"], 13, 8),
];

const ARENAS = {
  VS6TJA: { players: vs6tjaPlayers, matches: vs6tja, top3: ["Afwan", "Tama", "Tari"] },
  "374FNL": { players: fnl374Players, matches: fnl374, top3: ["Bang Deni", "Kak Donna", "Kak Tari"] },
  "5JTSZ4": { players: jtsz5Players, matches: jtsz5, top3: ["akbar", "faiz", "Dona"] },
  TVJ8PP: { players: tvj8ppPlayers, matches: tvj8pp, top3: ["Ryo", "Faiz", "Hafiz"] },
};

const rankArena = (key) => rankChampions(computeStats(ARENAS[key].players, ARENAS[key].matches));
const insightMatches = (matches) =>
  matches.map((x, i) => ({ ...x, id: `m${i}`, court: 1, created_at: `2026-11-03T00:00:${String(i % 60).padStart(2, "0")}Z` }));
const rankOf = (ordered, name) => ordered.find((p) => p.name === name).rank;

test("toleransi rotasi = 1 laga", () => {
  assert.equal(ROTATION_TOLERANCE, 1);
});

test("laga 0-0 dianggap belum dimainkan", () => {
  assert.equal(isPlayedMatch({ score_a: 0, score_b: 0 }), false);
  assert.equal(isPlayedMatch({ score_a: 11, score_b: 0 }), true);
  assert.equal(isPlayedMatch({ score_a: 11, score_b: 11 }), true); // seri sungguhan tetap dihitung
});

for (const [key, arena] of Object.entries(ARENAS)) {
  test(`${key}: Top 3 aturan final`, () => {
    const { ordered } = rankArena(key);
    assert.deepEqual(
      ordered.slice(0, 3).map((p) => p.name),
      arena.top3,
    );
  });
}

test("5JTSZ4: laga 0-0 di ronde 10 tidak dihitung (akbar 7/7 = 100%, tanpa seri fiktif)", () => {
  const stats = computeStats(jtsz5Players, jtsz5);
  assert.equal(jtsz5.filter((x) => x.score_a + x.score_b === 0).length, 2);
  const akbar = stats.find((s) => s.name === "akbar");
  assert.equal(akbar.games, 7);
  assert.equal(akbar.wins, 7);
  assert.equal(akbar.winRate, 100);
  assert.ok(stats.every((s) => s.draws === 0), "tidak ada seri fiktif");
});

test("5JTSZ4: form tidak memuat S dari laga 0-0", () => {
  const form = buildForm(insightMatches(jtsz5));
  const stats = computeStats(jtsz5Players, jtsz5);
  for (const s of stats) {
    const list = form.get(s.name) ?? [];
    assert.ok(!list.includes("S"), `${s.name} tidak boleh punya S`);
    assert.equal(list.length, s.games);
  }
});

test("5JTSZ4: menang laga dulu — alifah (2 menang, selisih negatif) di atas alvina dan diaz (1 menang)", () => {
  const { ordered } = rankArena("5JTSZ4");
  assert.ok(rankOf(ordered, "alifah") < rankOf(ordered, "alvina"));
  assert.ok(rankOf(ordered, "alifah") < rankOf(ordered, "diaz"));
});

test("TVJ8PP: Yamin 6/10 di peringkat 5, Tari 5/9 di peringkat 6", () => {
  const { ordered } = rankArena("TVJ8PP");
  assert.equal(rankOf(ordered, "Yamin"), 5);
  assert.equal(rankOf(ordered, "Tari"), 6);
});

test("TVJ8PP: Akbar (3 menang) di atas Pina (2 menang) walau % poin Pina lebih tinggi", () => {
  const { ordered } = rankArena("TVJ8PP");
  assert.ok(rankOf(ordered, "Akbar") < rankOf(ordered, "Pina"));
});

test("VS6TJA: Afwan tetap juara dan tidak ada Provisional", () => {
  const { ordered } = rankArena("VS6TJA");
  assert.equal(ordered[0].name, "Afwan");
  assert.ok(ordered.every((p) => !p.provisional));
});

test("telat datang: Deni 5/5 tidak mengalahkan Dona 7/10", () => {
  const matches = [];
  for (let i = 1; i <= 5; i++) matches.push(m(i, ["Deni"], ["X"], 11, 5));
  for (let i = 1; i <= 10; i++) matches.push(m(i, ["Dona"], ["Y"], i <= 7 ? 11 : 4, i <= 7 ? 6 : 11));
  const stats = computeStats(["Deni", "Dona", "X", "Y"], matches);
  const deni = stats.find((s) => s.name === "Deni");
  const dona = stats.find((s) => s.name === "Dona");
  assert.equal(Math.round(deni.winRate * 10) / 10, 55.6); // 5 / MAX(5, 10 - 1)
  assert.equal(dona.winRate, 70);
  const { ordered } = rankChampions(stats);
  assert.ok(rankOf(ordered, "Dona") < rankOf(ordered, "Deni"));
});

test("selisih main 1 laga (rotasi) tidak menghukum: 4/4 tetap 100% saat main terbanyak 5", () => {
  const matches = [];
  for (let i = 1; i <= 4; i++) matches.push(m(i, ["A"], ["B"], 11, 3));
  matches.push(m(5, ["C"], ["B"], 11, 3));
  const stats = computeStats(["A", "B", "C"], matches);
  assert.equal(stats.find((s) => s.name === "B").games, 5);
  assert.equal(stats.find((s) => s.name === "A").winRate, 100);
});

test("seri sungguhan masih setengah menang", () => {
  const stats = computeStats(["A", "B"], [m(1, ["A"], ["B"], 10, 10)]);
  assert.equal(stats.find((s) => s.name === "A").draws, 1);
  assert.equal(stats.find((s) => s.name === "A").winRate, 50);
});

for (const key of Object.keys(ARENAS)) {
  test(`${key}: "Paling konsisten" memakai peringkat yang sama dengan Top 3`, () => {
    const { ordered } = rankArena(key);
    const lines = ordered.map((p) => ({
      name: p.name,
      games: p.games,
      wins: p.wins,
      winRate: p.winRate,
      points: p.pointsFor,
      pointDiff: p.pointDiff,
      pointCount: 0,
      rank: p.rank,
    }));
    const consistent = buildInsights(lines, insightMatches(ARENAS[key].matches)).find((i) => i.kind === "consistent");
    assert.equal(consistent.title, ARENAS[key].top3[0]);
  });
}

test("Paling konsisten melewati pemain Provisional", () => {
  const lines = [
    { name: "P", games: 1, wins: 1, winRate: 100, points: 11, pointDiff: 5, pointCount: 0, rank: null },
    { name: "Q", games: 4, wins: 3, winRate: 75, points: 40, pointDiff: 9, pointCount: 0, rank: 1 },
  ];
  const consistent = buildInsights(lines, []).find((i) => i.kind === "consistent");
  assert.equal(consistent.title, "Q");
});

test("5JTSZ4: ringkasan dan duo mengabaikan laga 0-0", () => {
  const rows = insightMatches(jtsz5);
  assert.equal(summarizeMatches(rows).draws, 0);
  const duo = bestDuo(rows);
  assert.ok(duo === null || duo.games >= 1);
  const zero = rows.filter((x) => x.score_a + x.score_b === 0);
  const withoutZero = rows.filter((x) => x.score_a + x.score_b > 0);
  assert.deepEqual(bestDuo(rows), bestDuo(withoutZero));
  assert.equal(zero.length, 2);
});
