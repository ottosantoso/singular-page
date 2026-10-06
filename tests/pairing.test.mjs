// Tes modul pairing (public/pairing.js). Jalankan: npm test   (atau: node --test tests/pairing.test.mjs)
// Tanpa dependensi tambahan — memakai test runner bawaan Node.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPairing, mulberry32 } from "./load-pairing.mjs";

const P = loadPairing();
const players = (n) => Array.from({ length: n }, (_, i) => "P" + (i + 1));
const members = (m) => (m.pairA ? [m.pairA, m.pairB] : [...m.teamA, ...m.teamB]);

function newCounts(units) {
  return {
    partnerCount: {},
    opponentCount: {},
    sitOutCount: Object.fromEntries(units.map((u) => [u, 0])),
  };
}

// Sesi Mandiri: lapangan selesai di waktu acak, pertandingan berikutnya dipilih pickForCourt.
function runIndependent({ units, courts, total, seed, kind = P.PLAYERS }) {
  const rng = mulberry32(seed);
  const dur = mulberry32(seed + 7777);
  const s = { ...newCounts(units), games: Object.fromEntries(units.map((u) => [u, 0])) };
  const ctxOf = () => ({ ...s, genderOf: () => "male", rng, gamesOf: (u) => s.games[u] });
  const first = P.planRound(units, courts, kind, ctxOf());
  first.sitOut.forEach((u) => s.sitOutCount[u]++);
  const live = first.matches.map((m) => {
    P.recordMatch(s, m, 1);
    return { m, end: 8 + dur() * 8 };
  });
  const all = live.map((c) => c.m);
  let invalid = 0;
  while (all.length < total) {
    let idx = 0;
    live.forEach((c, i) => {
      if (c.end < live[idx].end) idx = i;
    });
    const t = live[idx].end;
    members(live[idx].m).forEach((u) => s.games[u]++);
    const busy = new Set(live.flatMap((c, i) => (i === idx ? [] : members(c.m))));
    const pool = units.filter((u) => !busy.has(u));
    const ctx = ctxOf();
    ctx.gamesOf = (u) => s.games[u] + (busy.has(u) ? 1 : 0);
    ctx.allUnits = units;
    const picked = P.pickForCourt(pool, kind, ctx);
    const mm = members(picked.match);
    if (new Set(mm).size !== mm.length || mm.some((u) => busy.has(u))) invalid++;
    picked.sitOut.forEach((u) => s.sitOutCount[u]++);
    P.recordMatch(s, picked.match, 1);
    live[idx] = { m: picked.match, end: t + 8 + dur() * 8 };
    all.push(picked.match);
  }
  live.forEach((c) => members(c.m).forEach((u) => s.games[u]++));
  const g = Object.values(s.games);
  const repeats = Object.values(kind === P.PAIRS ? s.opponentCount : s.partnerCount).reduce(
    (a, n) => a + Math.max(0, n - 1),
    0,
  );
  return { repeats, invalid, spread: Math.max(...g) - Math.min(...g), s };
}

// ---------- pickForCourt: bentuk hasil ----------

test("pickForCourt: 4 pemain berbeda dari pool, sisanya jadi sitOut", () => {
  const pool = players(9);
  const ctx = { ...newCounts(pool), gamesOf: () => 0, rng: mulberry32(1) };
  const r = P.pickForCourt(pool, P.PLAYERS, ctx);
  const four = members(r.match);
  assert.equal(four.length, 4);
  assert.equal(new Set(four).size, 4);
  four.forEach((u) => assert.ok(pool.includes(u)));
  assert.equal(r.sitOut.length, 5);
  assert.deepEqual([...four, ...r.sitOut].sort(), [...pool].sort());
});

test("pickForCourt: null kalau pool kurang dari satu lapangan", () => {
  const pool = players(3);
  const ctx = { ...newCounts(pool), gamesOf: () => 0 };
  assert.equal(P.pickForCourt(pool, P.PLAYERS, ctx), null);
  const pairs = ["A", "B"].slice(0, 1);
  assert.equal(P.pickForCourt(pairs, P.PAIRS, { ...newCounts(pairs), gamesOf: () => 0 }), null);
});

test("pickForCourt: hasil sama persis untuk rng yang sama", () => {
  const pool = players(10);
  const run = () =>
    P.pickForCourt(pool, P.PLAYERS, {
      ...newCounts(pool),
      gamesOf: () => 0,
      rng: mulberry32(42),
    });
  assert.deepEqual(run(), run());
});

// ---------- pickForCourt: aturan prioritas ----------

test("pemerataan: pemain yang main > terkecil + 1 tidak dipilih selama masih ada yang lebih sedikit", () => {
  const pool = players(8);
  const games = { P1: 5, P2: 5, P3: 5, P4: 5, P5: 2, P6: 2, P7: 2, P8: 3 };
  for (let seed = 1; seed <= 30; seed++) {
    const ctx = { ...newCounts(pool), gamesOf: (u) => games[u], rng: mulberry32(seed) };
    const four = members(P.pickForCourt(pool, P.PLAYERS, ctx).match);
    assert.deepEqual(four.sort(), ["P5", "P6", "P7", "P8"]);
  }
});

test("partner berulang dihindari walau 4 orang yang sama paling lama menunggu", () => {
  // P1-P4 paling lama menunggu dan sudah sering berpasangan; P5-P8 baru. Mesin lama tetap memilih P1-P4.
  const pool = players(8);
  const counts = newCounts(pool);
  ["P1", "P2", "P3", "P4"].forEach((u) => (counts.sitOutCount[u] = 3));
  P.recordMatch(counts, { teamA: ["P1", "P2"], teamB: ["P3", "P4"] }, 1);
  P.recordMatch(counts, { teamA: ["P1", "P3"], teamB: ["P2", "P4"] }, 1);
  P.recordMatch(counts, { teamA: ["P1", "P4"], teamB: ["P2", "P3"] }, 1);
  for (let seed = 1; seed <= 20; seed++) {
    const ctx = { ...counts, gamesOf: () => 3, rng: mulberry32(seed) };
    const m = P.pickForCourt(pool, P.PLAYERS, ctx).match;
    const key = (a, b) => P.pairKey(a, b);
    [m.teamA, m.teamB].forEach((t) =>
      assert.equal(counts.partnerCount[key(t[0], t[1])] || 0, 0, "partner baru tersedia, jangan ulang"),
    );
  }
});

test("biaya partner dihitung kuadrat: ulang ke-2 lebih mahal dari dua ulang ke-1", () => {
  const ctx = (pc) => ({ partnerCount: pc, opponentCount: {} });
  const opt = { teamA: ["A", "B"], teamB: ["C", "D"] };
  const twiceOneTeam = P.scorePairing(opt, ctx({ [P.pairKey("A", "B")]: 2 }));
  const onceEachTeam = P.scorePairing(
    opt,
    ctx({ [P.pairKey("A", "B")]: 1, [P.pairKey("C", "D")]: 1 }),
  );
  assert.ok(twiceOneTeam > onceEachTeam, `${twiceOneTeam} > ${onceEachTeam}`);
});

test("tim campur gender dipilih kalau tidak ada yang berulang", () => {
  const pool = players(4);
  const female = new Set(["P1", "P2"]);
  const ctx = {
    ...newCounts(pool),
    gamesOf: () => 0,
    genderOf: (n) => (female.has(n) ? "female" : "male"),
    rng: mulberry32(3),
  };
  const m = P.pickForCourt(pool, P.PLAYERS, ctx).match;
  [m.teamA, m.teamB].forEach((t) =>
    assert.notEqual(female.has(t[0]), female.has(t[1]), "tiap tim harus campur"),
  );
});

test("jumlah main terkecil dihitung dari SEMUA pemain (termasuk yang sedang main di lapangan lain)", () => {
  // 4 pemain bebas sama-sama 3x main; yang sedang main di lapangan lain baru 1x. Tetap harus bisa memilih 4.
  const pool = players(4);
  const all = pool.concat(["Q1", "Q2", "Q3", "Q4"]);
  const games = Object.fromEntries(all.map((u) => [u, u.startsWith("Q") ? 1 : 3]));
  const ctx = { ...newCounts(all), gamesOf: (u) => games[u], allUnits: all, rng: mulberry32(1) };
  const r = P.pickForCourt(pool, P.PLAYERS, ctx);
  assert.deepEqual(members(r.match).sort(), pool);
});

test("kandidat dibatasi 14: yang terpilih selalu dari 14 pemain dengan jumlah main terendah", () => {
  const pool = players(40);
  const games = Object.fromEntries(pool.map((u, i) => [u, i < 14 ? 0 : 1]));
  for (let seed = 1; seed <= 10; seed++) {
    const ctx = { ...newCounts(pool), gamesOf: (u) => games[u], rng: mulberry32(seed) };
    members(P.pickForCourt(pool, P.PLAYERS, ctx).match).forEach((u) => assert.equal(games[u], 0));
  }
});

test("Pasangan Tetap: dua pasangan berbeda, menghindari lawan yang sama", () => {
  const pairs = ["A", "B", "C", "D", "E"];
  const counts = newCounts(pairs);
  P.recordMatch(counts, { pairA: "A", pairB: "B" }, 1);
  for (let seed = 1; seed <= 20; seed++) {
    const ctx = { ...counts, gamesOf: () => 1, rng: mulberry32(seed) };
    const m = P.pickForCourt(pairs, P.PAIRS, ctx).match;
    assert.notEqual(m.pairA, m.pairB);
    assert.notEqual(P.pairKey(m.pairA, m.pairB), P.pairKey("A", "B"));
  }
});

// ---------- sesi penuh (simulasi) ----------

test("12 pemain / 2 lapangan / 16 pertandingan: >= 95% sesi tanpa partner berulang, selisih main <= 2", () => {
  let clean = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const r = runIndependent({ units: players(12), courts: 2, total: 16, seed });
    assert.equal(r.invalid, 0);
    assert.ok(r.spread <= 2, `selisih main ${r.spread}`);
    if (r.repeats === 0) clean++;
  }
  assert.ok(clean / N >= 0.95, `hanya ${clean}/${N} sesi bersih`);
});

test("12 pemain / 2 lapangan / 24 pertandingan: tidak ada partner berulang", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = runIndependent({ units: players(12), courts: 2, total: 24, seed });
    assert.equal(r.invalid, 0);
    assert.equal(r.repeats, 0, `seed ${seed}`);
    assert.ok(r.spread <= 2);
  }
});

test("16 pemain / 3 lapangan dan 14 / 3: Mandiri bersih dan valid", () => {
  for (const n of [14, 16]) {
    for (let seed = 1; seed <= 15; seed++) {
      const r = runIndependent({ units: players(n), courts: 3, total: 16, seed });
      assert.equal(r.invalid, 0);
      assert.equal(r.repeats, 0, `${n} pemain, seed ${seed}`);
    }
  }
});

test("8 pasangan / 2 lapangan: lawan yang sama tidak berulang dalam 14 pertandingan", () => {
  const pairs = Array.from({ length: 8 }, (_, i) => "Pr" + (i + 1));
  for (let seed = 1; seed <= 15; seed++) {
    const r = runIndependent({ units: pairs, courts: 2, total: 14, seed, kind: P.PAIRS });
    assert.equal(r.invalid, 0);
    assert.equal(r.repeats, 0, `seed ${seed}`);
  }
});

// ---------- saran rotasi ----------

test("recommendRotation: Individu — Mandiri hanya kalau cadangan >= 4 dan lapangan >= 2", () => {
  const rec = (n, c) => P.recommendRotation(n, c, P.PLAYERS).mode;
  assert.equal(rec(12, 2), "independent");
  assert.equal(rec(16, 3), "independent");
  assert.equal(rec(22, 4), "independent");
  assert.equal(rec(8, 2), "synchronized"); // pas 4 x lapangan: grup pasti terkunci
  assert.equal(rec(12, 3), "synchronized");
  assert.equal(rec(16, 4), "synchronized");
  assert.equal(rec(10, 2), "synchronized"); // cadangan 2
  assert.equal(rec(13, 3), "synchronized"); // cadangan 1
  assert.equal(rec(40, 1), "synchronized"); // 1 lapangan: tidak ada yang mandiri
  assert.deepEqual(P.recommendRotation(12, 2, P.PLAYERS), {
    mode: "independent",
    spare: 4,
    needed: 4,
  });
});

test("recommendRotation: Pasangan Tetap — Mandiri kalau cadangan >= 3 pasangan", () => {
  const rec = (n, c) => P.recommendRotation(n, c, P.PAIRS).mode;
  assert.equal(rec(8, 2), "independent");
  assert.equal(rec(7, 2), "independent");
  assert.equal(rec(9, 3), "independent");
  assert.equal(rec(6, 2), "synchronized");
  assert.equal(rec(8, 3), "synchronized");
});

// ---------- jalur serentak & Mexicano tidak rusak ----------

test("planRound: tiap lapangan 4 pemain berbeda, sitOut sesuai", () => {
  const units = players(11);
  const r = P.planRound(units, 2, P.PLAYERS, { ...newCounts(units), rng: mulberry32(5) });
  assert.equal(r.matches.length, 2);
  const all = r.matches.flatMap(members);
  assert.equal(new Set(all).size, 8);
  assert.equal(r.sitOut.length, 3);
});

test("planRound serentak 12 pemain / 3 lapangan: 0 partner berulang & jumlah main persis sama", () => {
  const units = players(12);
  const s = { ...newCounts(units), games: Object.fromEntries(units.map((u) => [u, 0])) };
  const rng = mulberry32(9);
  for (let r = 0; r < 6; r++) {
    const plan = P.planRound(units, 3, P.PLAYERS, { ...s, rng });
    plan.sitOut.forEach((u) => s.sitOutCount[u]++);
    plan.matches.forEach((m) => {
      P.recordMatch(s, m, 1);
      members(m).forEach((u) => s.games[u]++);
    });
  }
  const g = Object.values(s.games);
  assert.equal(Math.max(...g), Math.min(...g));
  const repeats = Object.values(s.partnerCount).reduce((a, n) => a + Math.max(0, n - 1), 0);
  assert.equal(repeats, 0);
});

test("Mexicano tidak berubah: #1 & #4 lawan #2 & #3", () => {
  const units = players(8);
  const pts = Object.fromEntries(units.map((u, i) => [u, 100 - i]));
  const r = P.planMexicanoRound(units, 2, {
    ...newCounts(units),
    pointsOf: (u) => pts[u],
    rng: mulberry32(2),
  });
  assert.deepEqual(r.matches[0], { teamA: ["P1", "P4"], teamB: ["P2", "P3"] });
  assert.deepEqual(r.matches[1], { teamA: ["P5", "P8"], teamB: ["P6", "P7"] });
});

test("recordMatch: catat (+1) dan batalkan (-1), tidak pernah di bawah 0", () => {
  const c = { partnerCount: {}, opponentCount: {} };
  const m = { teamA: ["A", "B"], teamB: ["C", "D"] };
  P.recordMatch(c, m, 1);
  assert.equal(c.partnerCount[P.pairKey("A", "B")], 1);
  assert.equal(c.opponentCount[P.pairKey("A", "C")], 1);
  P.recordMatch(c, m, -1);
  P.recordMatch(c, m, -1);
  assert.equal(c.partnerCount[P.pairKey("A", "B")], 0);
});
