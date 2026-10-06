// Simulasi mesin pairing Americano (public/pairing.js).
//
//   node scripts/sim-pairing.mjs            -> 200 sesi per skenario
//   node scripts/sim-pairing.mjs 500        -> jumlah sesi lain
//   node scripts/sim-pairing.mjs 200 pairs  -> hanya skenario Pasangan Tetap
//
// Tiga cara main dibandingkan:
//   lama      : perilaku pickForCourt sebelum perbaikan (pilih 4 orang dulu, baru susun pasangan)
//   mandiri   : pickForCourt baru (lapangan jalan sendiri-sendiri)
//   serentak  : planRound (semua lapangan ganti bersamaan)
//
// Lapangan selesai di waktu acak (8-16 menit). Angka yang dilaporkan:
//   partner ulang : jumlah pengulangan partner (rata-rata per sesi); 0 = tidak ada yang berpasangan 2x
//   sesi bersih   : % sesi tanpa satu pun partner berulang
//   selisih main  : (jumlah main terbanyak - terkecil), rata-rata / terburuk
//   tidak valid   : pertandingan dengan pemain ganda atau pemain yang sedang main di lapangan lain (harus 0)
import { loadPairing, mulberry32 } from '../tests/load-pairing.mjs';

const P = loadPairing();
const SESSIONS = parseInt(process.argv[2], 10) || 200;
const ONLY = process.argv[3] || 'all';

// ---------- perilaku lama (pembanding) ----------
function legacyScore(opt, ctx) {
  const c = (m, k) => (m && m[k]) || 0;
  const partner = c(ctx.partnerCount, P.pairKey(...opt.teamA)) + c(ctx.partnerCount, P.pairKey(...opt.teamB));
  let opp = 0;
  opt.teamA.forEach((x) => opt.teamB.forEach((y) => { opp += c(ctx.opponentCount, P.pairKey(x, y)); }));
  return partner * 10 + opp;
}
function legacyPickForCourt(pool, kind, ctx) {
  const size = kind === P.PAIRS ? 2 : 4;
  if (pool.length < size) return null;
  const rng = ctx.rng;
  const cmp = (a, b) => (ctx.gamesOf(a) - ctx.gamesOf(b)) || ((ctx.sitOutCount[b] || 0) - (ctx.sitOutCount[a] || 0));
  const ranked = P.shuffle(pool, rng).sort(cmp);
  const cutoff = ranked[size - 1];
  const guaranteed = ranked.filter((u) => cmp(u, cutoff) < 0);
  const tied = ranked.filter((u) => cmp(u, cutoff) === 0);
  const slots = size - guaranteed.length;
  let best = null;
  for (let t = 0; t < (tied.length === slots ? 1 : 60); t++) {
    const extra = tied.length === slots ? tied : P.shuffle(tied, rng).slice(0, slots);
    const group = guaranteed.concat(extra);
    let match, cost;
    if (kind === P.PAIRS) {
      match = { pairA: group[0], pairB: group[1] };
      cost = (ctx.opponentCount[P.pairKey(group[0], group[1])] || 0);
    } else {
      const [p0, p1, p2, p3] = group;
      const opts = [{ teamA: [p0, p1], teamB: [p2, p3] }, { teamA: [p0, p2], teamB: [p1, p3] }, { teamA: [p0, p3], teamB: [p1, p2] }];
      let bo = null, bc = Infinity;
      opts.forEach((o) => { const c = legacyScore(o, ctx); if (c < bc) { bc = c; bo = o; } });
      match = bo; cost = bc;
    }
    if (!best || cost < best.cost) best = { match, cost, group };
  }
  return { match: best.match, sitOut: pool.filter((u) => !best.group.includes(u)) };
}

// ---------- satu sesi ----------
function newSession(units, kind, rng) {
  return {
    units, kind, rng,
    partnerCount: {}, opponentCount: {},
    sitOutCount: Object.fromEntries(units.map((u) => [u, 0])),
    games: Object.fromEntries(units.map((u) => [u, 0])),
    base: {}, // titik awal jumlah main untuk pemain yang masuk / kembali dari jeda
    invalid: 0
  };
}
const members = (m) => (m.pairA ? [m.pairA, m.pairB] : [...m.teamA, ...m.teamB]);
const fairGames = (s, u) => s.games[u] + (s.base[u] || 0);
const baseCtx = (s) => ({
  partnerCount: s.partnerCount, opponentCount: s.opponentCount, sitOutCount: s.sitOutCount,
  genderOf: () => 'male', rng: s.rng, gamesOf: (u) => s.games[u]
});
function record(s, m) { P.recordMatch(s, m, 1); }

function runIndependent(s, courts, total, engine, durRng) {
  const dur = () => 8 + durRng() * 8;
  const first = P.planRound(s.units, courts, s.kind, baseCtx(s));
  first.sitOut.forEach((u) => { s.sitOutCount[u]++; });
  let live = first.matches.map((m) => { record(s, m); return { m, end: dur() }; });
  let started = courts;
  s.hooks && s.hooks(s, started, live);
  while (started < total) {
    let idx = 0;
    live.forEach((c, i) => { if (c.end < live[idx].end) idx = i; });
    const t = live[idx].end;
    members(live[idx].m).forEach((u) => { s.games[u]++; });
    const busy = new Set();
    live.forEach((c, i) => { if (i !== idx) members(c.m).forEach((u) => busy.add(u)); });
    const pool = s.units.filter((u) => !busy.has(u));
    const ctx = baseCtx(s);
    ctx.gamesOf = (u) => fairGames(s, u) + (busy.has(u) ? 1 : 0);
    ctx.allUnits = s.units;
    const picked = engine(pool, s.kind, ctx);
    if (!picked) break;
    const mm = members(picked.match);
    if (new Set(mm).size !== mm.length || mm.some((u) => busy.has(u) || !pool.includes(u))) s.invalid++;
    picked.sitOut.forEach((u) => { s.sitOutCount[u]++; });
    record(s, picked.match);
    live[idx] = { m: picked.match, end: t + dur() };
    started++;
    s.hooks && s.hooks(s, started, live);
  }
  live.forEach((c) => members(c.m).forEach((u) => { s.games[u]++; })); // anggap yang berjalan juga dihitung
}

function runSynchronized(s, courts, total) {
  const rounds = Math.ceil(total / courts);
  for (let r = 0; r < rounds; r++) {
    const plan = P.planRound(s.units, courts, s.kind, baseCtx(s));
    plan.sitOut.forEach((u) => { s.sitOutCount[u]++; });
    plan.matches.forEach((m) => { record(s, m); members(m).forEach((u) => { s.games[u]++; }); });
  }
}

function metrics(s) {
  const counts = s.kind === P.PAIRS ? s.opponentCount : s.partnerCount;
  let repeats = 0, worst = 0;
  Object.values(counts).forEach((n) => { if (n > 1) repeats += n - 1; worst = Math.max(worst, n); });
  const g = s.units.map((u) => s.games[u]);
  return { repeats, worst, spread: Math.max(...g) - Math.min(...g), invalid: s.invalid };
}

function summarize(list) {
  const n = list.length;
  const avg = (f) => list.reduce((a, x) => a + f(x), 0) / n;
  return {
    repeats: avg((x) => x.repeats),
    clean: 100 * list.filter((x) => x.repeats === 0).length / n,
    spreadAvg: avg((x) => x.spread),
    spreadMax: Math.max(...list.map((x) => x.spread)),
    invalid: list.reduce((a, x) => a + x.invalid, 0)
  };
}

function scenario(label, nUnits, courts, total, kind) {
  const units = kind === P.PAIRS
    ? Array.from({ length: nUnits }, (_, i) => 'Pr' + (i + 1))
    : Array.from({ length: nUnits }, (_, i) => 'P' + (i + 1));
  const out = {};
  const engines = { lama: legacyPickForCourt, mandiri: P.pickForCourt };
  for (const [name, engine] of Object.entries(engines)) {
    const list = [];
    for (let i = 0; i < SESSIONS; i++) {
      const s = newSession(units, kind, mulberry32(1000 + i));
      runIndependent(s, courts, total, engine, mulberry32(9000 + i));
      list.push(metrics(s));
    }
    out[name] = summarize(list);
  }
  const list = [];
  for (let i = 0; i < SESSIONS; i++) {
    const s = newSession(units, kind, mulberry32(1000 + i));
    runSynchronized(s, courts, total);
    list.push(metrics(s));
  }
  out.serentak = summarize(list);
  const rec = P.recommendRotation(nUnits, courts, kind);
  return { label, out, rec };
}

function printTable(title, rows, unitWord) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
  console.log(['skenario'.padEnd(22), 'cara'.padEnd(9), 'partner ulang'.padStart(14), 'sesi bersih'.padStart(12), 'selisih main'.padStart(14), 'tidak valid'.padStart(12), 'saran'.padStart(12)].join(' '));
  rows.forEach(({ label, out, rec }) => {
    ['lama', 'mandiri', 'serentak'].forEach((k, i) => {
      const r = out[k];
      console.log([
        (i === 0 ? label : '').padEnd(22), k.padEnd(9),
        r.repeats.toFixed(2).padStart(14), (r.clean.toFixed(0) + '%').padStart(12),
        (r.spreadAvg.toFixed(2) + ' / ' + r.spreadMax).padStart(14), String(r.invalid).padStart(12),
        (i === 0 ? rec.mode : '').padStart(12)
      ].join(' '));
    });
  });
  if (unitWord) console.log('(' + unitWord + ')');
}

const T = (n, c, t) => `${n} pmn / ${c} lap / ${t} match`;
if (ONLY === 'all' || ONLY === 'players') {
  const cfg = [[12, 2], [8, 2], [9, 2], [10, 2], [12, 3], [13, 3], [14, 3], [16, 3], [16, 4], [22, 4]];
  [16, 24].forEach((total) => {
    const rows = cfg.map(([n, c]) => scenario(T(n, c, total), n, c, total, P.PLAYERS));
    printTable(`Individu — ${total} pertandingan, ${SESSIONS} sesi per baris`, rows, 'selisih main = rata-rata / terburuk');
  });
}
if (ONLY === 'all' || ONLY === 'pairs') {
  const cfg = [[6, 2], [7, 2], [8, 2], [8, 3], [9, 3], [10, 3], [12, 3]];
  const total = 16;
  const rows = cfg.map(([n, c]) => scenario(`${n} pasangan / ${c} lap / ${total}`, n, c, total, P.PAIRS));
  printTable(`Pasangan Tetap — ${total} pertandingan, ${SESSIONS} sesi per baris (partner ulang = lawan yang sama berulang)`, rows);
}

// ---------- pemain masuk / dijeda di tengah sesi ----------
if (ONLY === 'all' || ONLY === 'players') {
  console.log('\nPemain masuk di tengah sesi (12 pemain -> 13, 2 lapangan, 24 pertandingan, masuk setelah pertandingan ke-6)');
  console.log('-----------------------------------------------------------------------------------------------------------');
  for (const useFloor of [false, true]) {
    const res = [];
    for (let i = 0; i < SESSIONS; i++) {
      const units = Array.from({ length: 12 }, (_, k) => 'P' + (k + 1));
      const s = newSession(units, P.PLAYERS, mulberry32(1000 + i));
      let joined = false;
      s.hooks = (st, started) => {
        if (!joined && started >= 6) {
          joined = true;
          st.units = st.units.concat('NEW');
          st.sitOutCount.NEW = 0; st.games.NEW = 0;
          if (useFloor) st.base.NEW = Math.min(...units.map((u) => fairGames(st, u)));
        }
      };
      runIndependent(s, 2, 24, P.pickForCourt, mulberry32(9000 + i));
      const others = s.units.filter((u) => u !== 'NEW').map((u) => s.games[u]);
      res.push({ newGames: s.games.NEW, avgOthers: others.reduce((a, b) => a + b, 0) / others.length, repeats: metrics(s).repeats, invalid: s.invalid });
    }
    const avg = (f) => (res.reduce((a, x) => a + f(x), 0) / res.length).toFixed(2);
    console.log(`${useFloor ? 'dengan titik awal ' : 'tanpa titik awal  '}: pemain baru main ${avg((x) => x.newGames)}x (rata-rata pemain lain ${avg((x) => x.avgOthers)}x), partner ulang ${avg((x) => x.repeats)}, tidak valid ${res.reduce((a, x) => a + x.invalid, 0)}`);
  }

  console.log('\nPemain dijeda di tengah sesi (12 -> 10 pemain, 2 lapangan, 24 pertandingan, jeda setelah pertandingan ke-8)');
  console.log('---------------------------------------------------------------------------------------------------------');
  for (const [name, engine] of [['lama', legacyPickForCourt], ['mandiri', P.pickForCourt]]) {
    const res = [];
    for (let i = 0; i < SESSIONS; i++) {
      const units = Array.from({ length: 12 }, (_, k) => 'P' + (k + 1));
      const s = newSession(units, P.PLAYERS, mulberry32(1000 + i));
      let paused = false;
      s.hooks = (st, started, live) => {
        if (!paused && started >= 8) {
          const onCourt = new Set(live.flatMap((c) => members(c.m)));
          const free = st.units.filter((u) => !onCourt.has(u)).slice(0, 2);
          if (free.length === 2) { paused = true; st.units = st.units.filter((u) => !free.includes(u)); }
        }
      };
      runIndependent(s, 2, 24, engine, mulberry32(9000 + i));
      res.push({ repeats: metrics(s).repeats, invalid: s.invalid });
    }
    const avg = (f) => (res.reduce((a, x) => a + f(x), 0) / res.length).toFixed(2);
    console.log(`${name.padEnd(8)}: partner ulang ${avg((x) => x.repeats)}, tidak valid ${res.reduce((a, x) => a + x.invalid, 0)}`);
  }
}
