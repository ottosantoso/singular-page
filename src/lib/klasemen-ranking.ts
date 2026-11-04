// Peringkat "Juara Umum" untuk halaman /klasemen. Tanpa import supaya bisa dites langsung (npm test).
// Urutan: win rate -> persentase poin -> selisih poin per laga -> jumlah menang.
// Kalau semuanya sama, peringkat dibagi gaya kompetisi (1, 1, 3), sama dengan Excel simulasi.
// Nama hanya dipakai untuk urutan tampil.
// Pemain dengan laga kurang dari batas minimum berstatus Provisional (tidak mengambil peringkat).
//
// Aturan final (simulasi_juara_umum.xlsx, 3 Nov 2026):
//  0. Laga valid hanya jika skor A + skor B > 0. Laga 0-0 berstatus final adalah laga yang belum
//     dimainkan, bukan seri, jadi dikeluarkan dari semua statistik.
//  1. Pembagi win rate = MAX(laga sendiri, main terbanyak - ROTATION_TOLERANCE).
//  2. Win rate = (menang + 0,5 x seri) / pembagi.
//  3. Layak peringkat jika laga sendiri >= MAX(1, ceil(50% x main terbanyak)); sisanya Provisional.
//  4. Total poin tidak ikut menentukan peringkat (hanya informasi).

export type MatchLike = {
  round: number;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
};

export type PlayerStats = {
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number; // 0-100, seri dihitung setengah menang; pembagi = MAX(games, main terbanyak - toleransi)
  pointPct: number; // 0-100, poin untuk / (poin untuk + poin kebobolan)
  avgFor: number;
  avgAgainst: number;
  diffPerGame: number;
};

export type RankedPlayer = PlayerStats & { rank: number | null; provisional: boolean };

export type SortMode = "juara" | "poin" | "rata" | "selisih";

// Jadwal rotasi yang adil menghasilkan selisih main paling banyak 1 laga (istirahat bergilir,
// ronde terakhir tidak penuh). Selisih sebesar ini bukan salah pemain, jadi tidak menurunkan win rate.
// Selisih yang lebih besar (telat datang, pulang awal) dihitung sebagai laga yang tidak dimenangkan.
export const ROTATION_TOLERANCE = 1;

// Pembagi win rate satu pemain: jumlah laga sendiri, tapi tidak kurang dari (main terbanyak - toleransi).
export function winRateDivisor(games: number, maxGames: number): number {
  return Math.max(games, maxGames - ROTATION_TOLERANCE);
}

// Laga 0-0 = belum dimainkan (bukan seri). Dipakai juga oleh insight, form, dan papan gelar.
export function isPlayedMatch(m: { score_a: number; score_b: number }): boolean {
  return m.score_a + m.score_b > 0;
}

type Raw = { games: number; wins: number; losses: number; draws: number; pf: number; pa: number };

function finalize(name: string, r: Raw, divisor: number): PlayerStats {
  const g = r.games;
  const total = r.pf + r.pa;
  return {
    name,
    games: g,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    pointsFor: r.pf,
    pointsAgainst: r.pa,
    pointDiff: r.pf - r.pa,
    winRate: divisor > 0 ? ((r.wins + 0.5 * r.draws) / divisor) * 100 : 0,
    pointPct: total > 0 ? (r.pf / total) * 100 : 0,
    avgFor: g > 0 ? r.pf / g : 0,
    avgAgainst: g > 0 ? r.pa / g : 0,
    diffPerGame: g > 0 ? (r.pf - r.pa) / g : 0,
  };
}

export function computeStats(players: readonly string[], matches: readonly MatchLike[]): PlayerStats[] {
  const table = new Map<string, Raw>();
  const ensure = (name: string) => {
    let row = table.get(name);
    if (!row) {
      row = { games: 0, wins: 0, losses: 0, draws: 0, pf: 0, pa: 0 };
      table.set(name, row);
    }
    return row;
  };
  players.forEach(ensure);
  for (const m of matches) {
    if (!isPlayedMatch(m)) continue; // laga 0-0 belum dimainkan
    const apply = (team: string[], own: number, other: number) => {
      for (const name of team) {
        const row = ensure(name);
        row.games += 1;
        row.pf += own;
        row.pa += other;
        if (own > other) row.wins += 1;
        else if (own < other) row.losses += 1;
        else row.draws += 1;
      }
    };
    apply(m.team_a, m.score_a, m.score_b);
    apply(m.team_b, m.score_b, m.score_a);
  }
  const maxGames = [...table.values()].reduce((max, r) => Math.max(max, r.games), 0);
  return [...table.entries()].map(([name, row]) =>
    finalize(name, row, winRateDivisor(row.games, maxGames)),
  );
}

// 0 = seri penuh pada semua kriteria peringkat (nama tidak ikut dihitung).
export function compareChampion(a: PlayerStats, b: PlayerStats): number {
  return (
    b.winRate - a.winRate ||
    b.pointPct - a.pointPct ||
    b.diffPerGame - a.diffPerGame ||
    b.wins - a.wins
  );
}

function byChampion(a: PlayerStats, b: PlayerStats): number {
  return compareChampion(a, b) || a.name.localeCompare(b.name);
}

// Batas minimum = separuh dari jumlah main terbanyak di arena (minimal 1 laga).
// Dasarnya jumlah main, bukan jumlah ronde: di arena 8 pemain dengan 1 lapangan tiap pemain
// memang hanya main sekitar separuh ronde, jadi batas "50% ronde" mencoret pemain yang
// kebetulan istirahat lebih sering (atau baru masuk di tengah sesi).
export function minimumGames(maxGames: number): number {
  return Math.max(1, Math.ceil(maxGames * 0.5));
}

export function rankChampions(stats: readonly PlayerStats[]): { ordered: RankedPlayer[]; minGames: number } {
  const maxGames = stats.reduce((max, s) => Math.max(max, s.games), 0);
  const minGames = minimumGames(maxGames);
  let eligible = stats.filter((s) => s.games >= minGames);
  // Jaga-jaga: kalau tak seorang pun memenuhi batas, semua yang sudah main tetap diranking.
  if (eligible.length === 0) eligible = stats.filter((s) => s.games > 0);
  const eligibleNames = new Set(eligible.map((s) => s.name));

  let rank = 0;
  let position = 0;
  let previous: PlayerStats | undefined;
  const ranked: RankedPlayer[] = [...eligible].sort(byChampion).map((s) => {
    position += 1;
    // Peringkat kompetisi: yang seri berbagi peringkat, peringkat berikutnya melompat (1, 1, 3).
    if (!previous || compareChampion(previous, s) !== 0) rank = position;
    previous = s;
    return { ...s, rank, provisional: false };
  });

  const provisional: RankedPlayer[] = stats
    .filter((s) => !eligibleNames.has(s.name))
    .sort((a, b) => Number(b.games > 0) - Number(a.games > 0) || byChampion(a, b))
    .map((s) => ({ ...s, rank: null, provisional: true }));

  return { ordered: [...ranked, ...provisional], minGames };
}

// Mode urutan tabel. "juara" = urutan resmi; "poin" = aturan lama (poin, lalu selisih poin).
export function sortPlayers(ordered: readonly RankedPlayer[], mode: SortMode): RankedPlayer[] {
  if (mode === "juara") return [...ordered];
  const key = (p: RankedPlayer) =>
    mode === "poin" ? p.pointsFor : mode === "rata" ? p.avgFor : p.pointDiff;
  return [...ordered].sort(
    (a, b) => key(b) - key(a) || b.pointDiff - a.pointDiff || a.name.localeCompare(b.name),
  );
}

export type Movement = { delta: number; from: number; to: number; round: number };

function competitionRanks(stats: readonly PlayerStats[]): Map<string, number> {
  const sorted = [...stats].sort(
    (a, b) => Number(b.games > 0) - Number(a.games > 0) || byChampion(a, b),
  );
  const ranks = new Map<string, number>();
  let rank = 0;
  let position = 0;
  let previous: PlayerStats | undefined;
  for (const s of sorted) {
    position += 1;
    const tied = previous && previous.games > 0 === s.games > 0 && compareChampion(previous, s) === 0;
    if (!tied) rank = position;
    previous = s;
    ranks.set(s.name, rank);
  }
  return ranks;
}

// Perubahan peringkat antara ronde sebelumnya dan ronde terakhir (delta > 0 = naik).
export function rankMovement(
  players: readonly string[],
  matches: readonly MatchLike[],
): Map<string, Movement> {
  const result = new Map<string, Movement>();
  const played = matches.filter(isPlayedMatch);
  const rounds = [...new Set(played.map((m) => m.round))].sort((a, b) => a - b);
  const last = rounds[rounds.length - 1];
  const previous = rounds[rounds.length - 2];
  if (last === undefined || previous === undefined) return result;
  const before = competitionRanks(computeStats(players, played.filter((m) => m.round <= previous)));
  const after = competitionRanks(computeStats(players, played.filter((m) => m.round <= last)));
  for (const [name, to] of after) {
    const from = before.get(name);
    if (from !== undefined) result.set(name, { delta: from - to, from, to, round: last });
  }
  return result;
}

export function championNarrative(ordered: readonly RankedPlayer[]): string {
  const ranked = ordered.filter((p) => p.rank !== null);
  const a = ranked[0];
  const b = ranked[1];
  if (!a || !b) return "";
  if (a.winRate === b.winRate) {
    return `${a.name} dan ${b.name} sama-sama ${a.winRate.toFixed(0)}% menang — persentase poin yang menentukan peringkat.`;
  }
  const gap = a.winRate - b.winRate;
  return `${a.name} memimpin dengan win rate ${a.winRate.toFixed(0)}%, unggul ${gap.toFixed(0)} poin persen dari ${b.name}.${
    gap <= 10 ? " Persaingan puncak masih terbuka!" : ""
  }`;
}

// ---------------------------------------------------------------------------
// Teks penjelasan peringkat untuk pemain. Dibangun dari konstanta aturan di atas supaya angka
// di layar (batas minimum, pembagi) selalu sama dengan yang dipakai perhitungan.
// ---------------------------------------------------------------------------

// Rincian win rate satu pemain, mis. "4 menang ÷ 5 = 80%".
export function winRateBreakdown(
  p: Pick<PlayerStats, "games" | "wins" | "draws" | "winRate">,
  maxGames: number,
): string {
  const divisor = winRateDivisor(p.games, maxGames);
  const numerator = p.draws > 0 ? `${p.wins} menang + ½ × ${p.draws} seri` : `${p.wins} menang`;
  const base = `${numerator} ÷ ${divisor} = ${p.winRate.toFixed(0)}%`;
  return divisor > p.games
    ? `${base} (main ${p.games} laga, pembagi dinaikkan ke ${divisor})`
    : base;
}

export type RankingExplanation = {
  summary: string;
  steps: string[];
  example: string | null;
};

export function explainRanking(
  ordered: readonly RankedPlayer[],
  minGames: number,
): RankingExplanation {
  const maxGames = ordered.reduce((max, p) => Math.max(max, p.games), 0);
  const floor = maxGames - ROTATION_TOLERANCE;
  const divisorRule =
    floor >= 2
      ? `Pembagi = jumlah laga pemain itu, tetapi tidak kurang dari ${floor} (main terbanyak di arena ini ${maxGames}, dikurangi ${ROTATION_TOLERANCE}).`
      : "Pembagi = jumlah laga pemain itu.";
  const leader = ordered.find((p) => p.rank === 1);

  return {
    summary:
      "Peringkat resmi: win rate, lalu % poin, selisih poin per laga, lalu jumlah menang. " +
      "Total poin hanya informasi dan tidak menentukan peringkat. Seri penuh berbagi peringkat (1, 1, 3).",
    steps: [
      "Laga yang dihitung: hanya laga yang sudah dimainkan. Skor 0–0 dan laga yang masih berjalan tidak ikut dihitung.",
      `Win rate = (menang + ½ × seri) ÷ pembagi. ${divisorRule}`,
      `Kenapa pembagi begitu: selisih ${ROTATION_TOLERANCE} laga dianggap wajar (rotasi, istirahat bergilir) dan tidak menurunkan win rate. ` +
        `Selisih lebih dari ${ROTATION_TOLERANCE} laga (datang telat, pulang lebih awal) dihitung sebagai laga yang tidak dimenangkan. ` +
        "Contoh: bila main terbanyak 10 laga, menang 5 dari 5 laga (5 ÷ 9 = 56%) tidak mengalahkan menang 7 dari 10 laga (70%).",
      "Win rate sama? Dipisah berurutan oleh % poin (poin pemain ÷ poin pemain + poin lawan), lalu selisih poin per laga, lalu jumlah menang.",
      `Syarat masuk peringkat: minimal ${minGames} laga (separuh dari main terbanyak, ${maxGames}). ` +
        "Yang belum mencapainya berlabel Provisional dan tampil di bawah tanpa nomor peringkat.",
    ],
    example: leader
      ? `Contoh di arena ini: ${leader.name} ${winRateBreakdown(leader, maxGames)}.`
      : null,
  };
}
