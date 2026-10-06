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
 *  2. pickForCourt() -> isi 1 lapangan saja (lapangan mandiri / tombol Next Player)
 *  3. recordMatch()  -> catat (+1) atau batalkan (-1) efek sebuah match ke counts
 *  4. recommendRotation() -> saran mode rotasi lapangan (mandiri / serentak) dari jumlah pemain
 *
 * Satu fungsi biaya untuk jalur 1 dan 2 (makin kecil makin bagus), urutan prioritasnya:
 *   jumlah main merata  >  partner tidak berulang  >  lawan bervariasi  >  tim campur gender  >  yang lama menunggu
 * Partner dihitung KUADRAT: ulang yang ke-2 jauh lebih mahal daripada ulang yang ke-1.
 *
 * ctx tambahan khusus pickForCourt (semuanya opsional):
 *      allUnits      : semua unit aktif (termasuk yang sedang main di lapangan lain),
 *                      dipakai untuk menghitung jumlah main TERKECIL se-sesi
 *      band          : selisih jumlah main yang masih boleh ikut dipilih (default 1)
 *      maxCandidates : batas kandidat per keputusan (default 14)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OttoPairing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLAYERS = 'players';
  var PAIRS = 'pairs';

  var ROUND_TRIES = 400; // percobaan kocok untuk satu ronde penuh

  // Bobot biaya. Angka ini hasil percobaan simulasi (lihat scripts/sim-pairing.mjs); ubah dengan hati-hati.
  var WEIGHTS = {
    partner: 100,  // x (jumlah partner sebelumnya)^2, per tim
    opponent: 1,   // x jumlah pertemuan lawan sebelumnya
    wait: 3,       // dikurangi per giliran menunggu (yang lama menunggu didahulukan)
    fair: 15,      // x (total kelebihan jumlah main dari yang terkecil)^2
    mix: 0.5       // bonus per tim campur gender
  };
  var FAIR_BAND = 1;        // pemain dengan jumlah main <= terkecil + band yang boleh dipilih
  var MAX_CANDIDATES = 14;  // batas kandidat per keputusan supaya perhitungan tetap ringan
  var WAIT_CAP = 6;         // batas pengaruh "lama menunggu" per pemain

  // Mode Mandiri baru masuk akal kalau ada cadangan (unit yang istirahat) sebanyak ini atau lebih.
  // Individu: 4 (= pemain >= 4 x lapangan + 4). Pasangan tetap: 3 (hasil simulasi: dengan cadangan 2,
  // mandiri masih kalah bersih dari serentak; mulai 3 sudah setara atau lebih baik).
  var MIN_SPARE = { players: 4, pairs: 3 };

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
  // partner berulang dihukum kuadrat dan jauh lebih berat dari lawan berulang; tim campur gender diberi bonus.
  function scorePairing(opt, ctx) {
    var gender = ctx.genderOf || function () { return 'male'; };
    var pA = count(ctx.partnerCount, pairKey(opt.teamA[0], opt.teamA[1]));
    var pB = count(ctx.partnerCount, pairKey(opt.teamB[0], opt.teamB[1]));
    var opp = 0;
    opt.teamA.forEach(function (x) {
      opt.teamB.forEach(function (y) { opp += count(ctx.opponentCount, pairKey(x, y)); });
    });
    var mix = 0;
    if (gender(opt.teamA[0]) !== gender(opt.teamA[1])) mix += WEIGHTS.mix;
    if (gender(opt.teamB[0]) !== gender(opt.teamB[1])) mix += WEIGHTS.mix;
    return WEIGHTS.partner * (pA * pA + pB * pB) + WEIGHTS.opponent * opp - mix;
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
      if (bestTotal <= -numCourts * 2 * WEIGHTS.mix) break; // tidak ada yang berulang & semua tim campur: tidak mungkin lebih baik
      if (kind === PAIRS && bestTotal === 0) break;
    }
    return { matches: best || [], sitOut: split.sitOut };
  }

  // ---------- jalur 2: isi satu lapangan ----------

  // pool = unit yang sedang bebas. Return null kalau kurang dari 1 lapangan.
  // Return { match, sitOut } — sitOut = sisa pool yang tidak kebagian.
  //
  // Dulu: pilih 4 orang dulu (yang paling lama menunggu), BARU susun pasangan dari 4 orang itu.
  // Akibatnya, kalau 4 orang yang sama terus terpilih, partner pasti berulang (dari 4 orang cuma
  // ada 3 susunan 2v2). Sekarang grup dan susunan dinilai SEKALIGUS lewat satu fungsi biaya:
  //   1. kandidat = pemain bebas yang jumlah mainnya <= terkecil + band (pemerataan, keras)
  //   2. dari kandidat (maks. MAX_CANDIDATES) coba semua grup 4 orang x 3 susunan 2v2
  //   3. biaya terendah menang; seri diacak
  function pickForCourt(pool, kind, ctx) {
    var size = perCourt(kind);
    if (pool.length < size) return null;
    var rng = ctx.rng || Math.random;
    var gamesOf = ctx.gamesOf || function () { return 0; };
    var gender = ctx.genderOf || function () { return 'male'; };
    var band = ctx.band === undefined || ctx.band === null ? FAIR_BAND : ctx.band;
    var maxCand = Math.max(size, ctx.maxCandidates || MAX_CANDIDATES);

    // Jumlah main terkecil se-sesi (termasuk yang sedang main di lapangan lain), bukan cuma di pool.
    var universe = ctx.allUnits && ctx.allUnits.length ? ctx.allUnits : pool;
    var minGames = Infinity;
    universe.forEach(function (u) { var g = gamesOf(u); if (g < minGames) minGames = g; });

    // Urut: paling sedikit main dulu, lalu paling lama menunggu; seri diacak (sort stabil).
    var ranked = shuffle(pool, rng).sort(function (a, b) {
      var g = gamesOf(a) - gamesOf(b);
      if (g !== 0) return g;
      return count(ctx.sitOutCount, b) - count(ctx.sitOutCount, a);
    });

    // Pita keadilan. Kalau yang jumlah mainnya terkecil sedang main di lapangan lain, pita dihitung dari
    // yang terkecil DI POOL supaya tetap ada pilihan.
    var limit = Math.max(minGames, gamesOf(ranked[0])) + band + 1e-9;
    var n = 0;
    while (n < ranked.length && gamesOf(ranked[n]) <= limit) n++;
    n = Math.min(Math.max(n, size), maxCand);
    var cand = ranked.slice(0, n);

    // Data per kandidat + matriks partner/lawan dihitung SEKALI (pairKey itu mahal kalau di dalam loop).
    var m = cand.length;
    var ex = [], wt = [], gd = [];
    var minSit = Infinity;
    cand.forEach(function (u) { var s = count(ctx.sitOutCount, u); if (s < minSit) minSit = s; });
    cand.forEach(function (u) {
      ex.push(Math.max(0, gamesOf(u) - minGames));
      wt.push(Math.min(count(ctx.sitOutCount, u) - minSit, WAIT_CAP));
      gd.push(kind === PAIRS ? '' : gender(u));
    });
    var pc = [], oc = [];
    for (var i = 0; i < m; i++) {
      pc.push([]); oc.push([]);
      for (var j = 0; j < m; j++) {
        var k = i === j ? null : pairKey(cand[i], cand[j]);
        pc[i].push(k ? count(ctx.partnerCount, k) : 0);
        oc[i].push(k ? count(ctx.opponentCount, k) : 0);
      }
    }

    var EPS = 1e-9;
    var bestCost = Infinity, ties = [];
    function offer(cost, entry) {
      if (cost < bestCost - EPS) { bestCost = cost; ties = [entry]; }
      else if (cost <= bestCost + EPS) ties.push(entry);
    }
    function groupBase(sumEx, sumWait) {
      return WEIGHTS.fair * sumEx * sumEx - WEIGHTS.wait * sumWait;
    }

    var a, b, c, d;
    if (kind === PAIRS) {
      // Pasangan tetap: hanya lawan yang bisa divariasikan.
      for (a = 0; a < m; a++) {
        for (b = a + 1; b < m; b++) {
          offer(WEIGHTS.partner * oc[a][b] * oc[a][b] + groupBase(ex[a] + ex[b], wt[a] + wt[b]), [a, b]);
        }
      }
    } else {
      var mixOf = function (x, y) { return gd[x] !== gd[y] ? WEIGHTS.mix : 0; };
      for (a = 0; a < m; a++) {
        for (b = a + 1; b < m; b++) {
          for (c = b + 1; c < m; c++) {
            for (d = c + 1; d < m; d++) {
              var base = groupBase(ex[a] + ex[b] + ex[c] + ex[d], wt[a] + wt[b] + wt[c] + wt[d]);
              // 3 susunan 2v2: (ab|cd), (ac|bd), (ad|bc)
              offer(base + WEIGHTS.partner * (pc[a][b] * pc[a][b] + pc[c][d] * pc[c][d]) +
                    WEIGHTS.opponent * (oc[a][c] + oc[a][d] + oc[b][c] + oc[b][d]) - mixOf(a, b) - mixOf(c, d),
                    [a, b, c, d, 0]);
              offer(base + WEIGHTS.partner * (pc[a][c] * pc[a][c] + pc[b][d] * pc[b][d]) +
                    WEIGHTS.opponent * (oc[a][b] + oc[a][d] + oc[c][b] + oc[c][d]) - mixOf(a, c) - mixOf(b, d),
                    [a, b, c, d, 1]);
              offer(base + WEIGHTS.partner * (pc[a][d] * pc[a][d] + pc[b][c] * pc[b][c]) +
                    WEIGHTS.opponent * (oc[a][b] + oc[a][c] + oc[d][b] + oc[d][c]) - mixOf(a, d) - mixOf(b, c),
                    [a, b, c, d, 2]);
            }
          }
        }
      }
    }

    var pick = ties[Math.floor(rng() * ties.length)];
    var match, group;
    if (kind === PAIRS) {
      group = [cand[pick[0]], cand[pick[1]]];
      match = { pairA: group[0], pairB: group[1] };
    } else {
      var q = [cand[pick[0]], cand[pick[1]], cand[pick[2]], cand[pick[3]]];
      group = q;
      match = pick[4] === 0 ? { teamA: [q[0], q[1]], teamB: [q[2], q[3]] }
            : pick[4] === 1 ? { teamA: [q[0], q[2]], teamB: [q[1], q[3]] }
            : { teamA: [q[0], q[3]], teamB: [q[1], q[2]] };
    }
    return {
      match: match,
      sitOut: pool.filter(function (u) { return group.indexOf(u) === -1; })
    };
  }

  // ---------- saran mode rotasi lapangan ----------

  // Mandiri: tiap lapangan jalan sendiri begitu selesai. Pilihan siapa main baru punya ruang kalau ada
  // cadangan. Kalau jumlah pemain pas 4 x lapangan, saat satu lapangan selesai cuma 4 orang itu yang bebas,
  // jadi grupnya terkunci dan partner pasti berulang -> Serentak (semua lapangan ganti bersamaan) lebih tepat.
  // Return { mode: 'independent'|'synchronized', spare, needed }.
  function recommendRotation(numUnits, numCourts, kind) {
    var size = perCourt(kind);
    var spare = numUnits - numCourts * size;
    var needed = kind === PAIRS ? MIN_SPARE.pairs : MIN_SPARE.players;
    if (numCourts < 2) return { mode: 'synchronized', spare: spare, needed: needed };
    return { mode: spare >= needed ? 'independent' : 'synchronized', spare: spare, needed: needed };
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
    pickForCourt: pickForCourt,
    recommendRotation: recommendRotation,
    WEIGHTS: WEIGHTS,
    FAIR_BAND: FAIR_BAND,
    MAX_CANDIDATES: MAX_CANDIDATES
  };
});
