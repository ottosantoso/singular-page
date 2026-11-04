// Peringkat "Juara Umum" untuk halaman /klasemen. Tanpa import supaya bisa dites langsung (npm test).
// Urutan: win rate -> persentase poin -> selisih poin per laga -> jumlah menang.
// Kalau semuanya sama, peringkat dibagi (padat). Nama hanya dipakai untuk urutan tampil.
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
    finalize(name, row, Math.max(row.games, maxGames - ROTATION_TOLERANCE)),
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
  let previous: PlayerStats | undefined;
  const ranked: RankedPlayer[] = [...eligible].sort(byChampion).map((s) => {
    if (!previous || compareChampion(previous, s) !== 0) rank += 1;
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

function denseRanks(stats: readonly PlayerStats[]): Map<string, number> {
  const sorted = [...stats].sort(
    (a, b) => Number(b.games > 0) - Number(a.games > 0) || byChampion(a, b),
  );
  const ranks = new Map<string, number>();
  let rank = 0;
  let previous: PlayerStats | undefined;
  for (const s of sorted) {
    const tied = previous && previous.games > 0 === s.games > 0 && compareChampion(previous, s) === 0;
    if (!tied) rank += 1;
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
  if (rounds.length < 2) return result;
  const last = rounds[rounds.length - 1];
  const previousRound = rounds[rounds.length - 2];
  if (last === undefined || previousRound === undefined) return result;
  const before = denseRanks(computeStats(players, played.filter((m) => m.round <= previousRound)));
  const after = denseRanks(computeStats(players, played.filter((m) => m.round <= last)));
  for (const [name, to] of after) {
    const from = before.get(name);
    if (from !== undefined) result.set(name, { delta: from - to, from, to, round: last });
  }
  return result;
}

export function championNarrative(ordered: readonly RankedPlayer[]): string {
  const ranked = ordered.filter((p) => p.rank !== null);
  if (ranked.length < 2) return "";
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
