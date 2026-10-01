/*
 * OttoPairing — modul pairing murni untuk arena.html.
 *
 * Aturan modul ini:
 *  - TIDAK menyentuh DOM, localStorage, cloud, ataupun variabel global `state`.
 *  - Semua data masuk lewat argumen (`ctx`), hasil keluar lewat return value.
 *  - Satu-satunya fungsi yang mengubah data adalah recordMatch(), dan itu hanya
 *    mengubah objek counts yang diberikan caller.
 *
 * Istilah:
 *  - unit  : 1 pemain (kind = 'players') atau 1 pasangan tetap (kind = 'pairs').
 *  - ctx   : {
 *      partnerCount, opponentCount : { [pairKey]: number }
 *      sitOutCount                 : { [unit]: number }
 *      gamesOf(unit)               : jumlah main (untuk pair: rata-rata anggota)
 *      genderOf(name)              : 'male' | 'female'  (opsional, default 'male')
 *      pointsOf(unit), winsOf(unit): hanya untuk Mexicano (peringkat)
 *      rng()                       : opsional, default Math.random (berguna buat test)
 *    }
 *
 * Dipakai oleh 3 jalur yang dulu menduplikasi logika yang sama:
 *  1. planRound()    -> kocok SEMUA lapangan sekaligus (Americano: acak + minim pengulangan)
 *  1b. planMexicanoRound() -> semua lapangan sekaligus berdasarkan peringkat (Mexicano / Super Mexicano)
 *  2. pickForCourt() -> isi 1 lapangan saja (lapangan independen / tombol Next Player)
 *  3. recordMatch()  -> catat (+1) atau batalkan (-1) efek sebuah match ke counts
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OttoPairing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLAYERS = 'players';
  var PAIRS = 'pairs';

  var ROUND_TRIES = 400; // percobaan kocok untuk satu ronde penuh
  var COURT_TRIES = 60;  // percobaan memilih dari kandidat yang seri untuk satu lapangan

  function perCourt(kind) { return kind === PAIRS ? 2 : 4; }

  // ---------- util ----------

  // Fisher–Yates. (sort(() => Math.random() - 0.5) itu bias, jangan dipakai.)
  function shuffle(arr, rng) {
    var r = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pairKey(a, b) { return [a, b].sort().join('\u241F'); }

  function count(map, key) { return (map && map[key]) || 0; }

  // ---------- pencatatan counts (satu-satunya tempat yang mengubah data) ----------

  // match = { teamA:[a1,a2], teamB:[b1,b2], pairA?, pairB? }
  // delta = +1 (catat) atau -1 (batalkan). Nilai tidak pernah turun di bawah 0.
  function recordMatch(counts, match, delta) {
    var d = delta === undefined ? 1 : delta;
    function bump(map, key) { map[key] = Math.max(0, (map[key] || 0) + d); }

    if (match.pairA && match.pairB) {
      bump(counts.opponentCount, pairKey(match.pairA, match.pairB));
      return;
    }
    bump(counts.partnerCount, pairKey(match.teamA[0], match.teamA[1]));
    bump(counts.partnerCount, pairKey(match.teamB[0], match.teamB[1]));
    match.teamA.forEach(function (x) {
      match.teamB.forEach(function (y) { bump(counts.opponentCount, pairKey(x, y)); });
    });
  }

  // ---------- skor ----------

  // Skor satu susunan 2v2 (makin kecil makin bagus):
  // partner berulang dihukum 10x lebih berat dari lawan berulang; tim campur gender diberi bonus.
  function scorePairing(opt, ctx) {
    var gender = ctx.genderOf || function () { return 'male'; };
    var partner = count(ctx.partnerCount, pairKey(opt.teamA[0], opt.teamA[1])) +
                  count(ctx.partnerCount, pairKey(opt.teamB[0], opt.teamB[1]));
    var opp = 0;
    opt.teamA.forEach(function (x) {
      opt.teamB.forEach(function (y) { opp += count(ctx.opponentCount, pairKey(x, y)); });
    });
    var mix = 0;
    if (gender(opt.teamA[0]) !== gender(opt.teamA[1])) mix += 0.5;
    if (gender(opt.teamB[0]) !== gender(opt.teamB[1])) mix += 0.5;
    return partner * 10 + opp - mix;
  }

  // Dari 4 pemain, ada 3 cara membagi 2v2. Ambil yang skornya terendah.
  function bestPairingForChunk(chunk, ctx) {
    var p0 = chunk[0], p1 = chunk[1], p2 = chunk[2], p3 = chunk[3];
    var options = [
      { teamA: [p0, p1], teamB: [p2, p3] },
      { teamA: [p0, p2], teamB: [p1, p3] },
      { teamA: [p0, p3], teamB: [p1, p2] }
    ];
    var best = null, bestCost = Infinity;
    options.forEach(function (opt) {
      var c = scorePairing(opt, ctx);
      if (c < bestCost) { bestCost = c; best = opt; }
    });
    return { pairing: best, cost: bestCost };
  }

  // Skor satu lapangan untuk grup unit tertentu.
  function evaluateGroup(group, kind, ctx) {
    if (kind === PAIRS) {
      return {
        match: { pairA: group[0], pairB: group[1] },
        cost: count(ctx.opponentCount, pairKey(group[0], group[1]))
      };
    }
    var r = bestPairingForChunk(group, ctx);
    return { match: { teamA: r.pairing.teamA, teamB: r.pairing.teamB }, cost: r.cost };
  }

  // ---------- istirahat ----------

  // Yang paling sedikit pernah istirahat dapat giliran istirahat dulu. Seri diacak.
  function chooseSitOuts(units, need, sitOutCount, rng) {
    var excess = units.length - need;
    if (excess <= 0) return { playing: units.slice(), sitOut: [] };
    var ranked = shuffle(units, rng).sort(function (a, b) {
      return count(sitOutCount, a) - count(sitOutCount, b);
    }); // Array.prototype.sort stabil -> urutan acak dipertahankan di antara yang seri
    var sitOut = ranked.slice(0, excess);
    var playing = units.filter(function (u) { return sitOut.indexOf(u) === -1; });
    return { playing: playing, sitOut: sitOut };
  }

  // ---------- jalur 1: kocok semua lapangan ----------

  // Mengembalikan { matches:[{teamA,teamB}|{pairA,pairB}], sitOut:[unit] }.
  // Tidak mengubah ctx — caller yang memanggil recordMatch() dan menambah sitOutCount.
  function planRound(units, numCourts, kind, ctx) {
    var rng = ctx.rng || Math.random;
    var size = perCourt(kind);
    var need = numCourts * size;
    var split = chooseSitOuts(units, need, ctx.sitOutCount, rng);

    var best = null, bestTotal = Infinity;
    for (var t = 0; t < ROUND_TRIES; t++) {
      var order = shuffle(split.playing, rng);
      var total = 0, matches = [];
      for (var c = 0; c < numCourts; c++) {
        var r = evaluateGroup(order.slice(c * size, c * size + size), kind, ctx);
        total += r.cost;
        matches.push(r.match);
      }
      if (total < bestTotal) { bestTotal = total; best = matches; }
      if (bestTotal <= -numCourts) break; // tidak ada yang berulang & semua tim campur: tidak mungkin lebih baik
      if (kind === PAIRS && bestTotal === 0) break;
    }
    return { matches: best || [], sitOut: split.sitOut };
  }

  // ---------- jalur 2: isi satu lapangan ----------

  // pool = unit yang sedang bebas. Return null kalau kurang dari 1 lapangan.
  // Return { match, sitOut } — sitOut = sisa pool yang tidak kebagian.
  //
  // Urutan prioritas:
  //   1. yang paling sedikit main (wajib, pemerataan)
  //   2. yang paling lama menunggu
  //   3. di antara kandidat yang SERI di 2 kriteria itu, pilih kombinasi dengan
  //      partner/lawan berulang paling sedikit  <- bagian ini dulu tidak ada
  function pickForCourt(pool, kind, ctx) {
    var size = perCourt(kind);
    if (pool.length < size) return null;
    var rng = ctx.rng || Math.random;

    function cmp(a, b) {
      var g = ctx.gamesOf(a) - ctx.gamesOf(b);
      if (g !== 0) return g;
      return count(ctx.sitOutCount, b) - count(ctx.sitOutCount, a);
    }

    var ranked = shuffle(pool, rng).sort(cmp);
    var cutoff = ranked[size - 1];
    var guaranteed = ranked.filter(function (u) { return cmp(u, cutoff) < 0; });
    var tied = ranked.filter(function (u) { return cmp(u, cutoff) === 0; });
    var slots = size - guaranteed.length;

    var best = null;
    var tries = tied.length === slots ? 1 : COURT_TRIES;
    for (var t = 0; t < tries; t++) {
      var extra = tied.length === slots ? tied : shuffle(tied, rng).slice(0, slots);
      var group = guaranteed.concat(extra);
      var r = evaluateGroup(group, kind, ctx);
      if (!best || r.cost < best.cost) best = { match: r.match, cost: r.cost, group: group };
      if (best.cost <= 0 && kind === PAIRS) break;
    }

    return {
      match: best.match,
      sitOut: pool.filter(function (u) { return best.group.indexOf(u) === -1; })
    };
  }

  // ---------- jalur 3: Mexicano (berbasis peringkat) ----------

  // Urutkan unit dari peringkat terbaik ke terburuk: poin desc, lalu menang desc.
  // Yang masih seri diacak (bukan urutan input), supaya tidak ada yang selalu diuntungkan.
  // ctx.pointsOf(unit), ctx.winsOf(unit) (opsional, default 0).
  function rankUnits(units, ctx) {
    var pts = ctx.pointsOf || function () { return 0; };
    var wins = ctx.winsOf || function () { return 0; };
    return shuffle(units, ctx.rng).sort(function (a, b) {
      return (pts(b) - pts(a)) || (wins(b) - wins(a));
    });
  }

  // Satu lapangan Mexicano dari 4 pemain yang SUDAH urut peringkat [r1,r2,r3,r4]:
  // #1 & #4 lawan #2 & #3 (dua tim seimbang).
  function mexicanoMatch(group) {
    return { teamA: [group[0], group[3]], teamB: [group[1], group[2]] };
  }

  // Ronde Mexicano untuk numCourts lapangan (berapa pun: 1, 2, 3, ...).
  //   1. Siapa yang main ditentukan pemerataan dulu (sama persis dengan Americano):
  //      yang paling sedikit istirahat, istirahat dulu.
  //   2. Yang main diurutkan berdasar peringkat, lalu dipotong per 4:
  //      Lapangan 1 = 4 teratas, Lapangan 2 = 4 berikutnya, dst.
  //   3. Di tiap lapangan: #1 & #4 vs #2 & #3.
  // Return { matches:[{teamA,teamB}], sitOut:[unit] }. Tidak mengubah ctx.
  function planMexicanoRound(units, numCourts, ctx) {
    var rng = ctx.rng || Math.random;
    var size = perCourt(PLAYERS);
    var split = chooseSitOuts(units, numCourts * size, ctx.sitOutCount, rng);
    var ranked = rankUnits(split.playing, ctx);
    var matches = [];
    for (var c = 0; c < numCourts; c++) {
      matches.push(mexicanoMatch(ranked.slice(c * size, c * size + size)));
    }
    return { matches: matches, sitOut: split.sitOut };
  }

  return {
    PLAYERS: PLAYERS,
    PAIRS: PAIRS,
    shuffle: shuffle,
    pairKey: pairKey,
    recordMatch: recordMatch,
    scorePairing: scorePairing,
    bestPairingForChunk: bestPairingForChunk,
    chooseSitOuts: chooseSitOuts,
    planRound: planRound,
    planMexicanoRound: planMexicanoRound,
    rankUnits: rankUnits,
    pickForCourt: pickForCourt
  };
});
