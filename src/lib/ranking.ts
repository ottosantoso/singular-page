// Satu-satunya sumber aturan peringkat klasemen (Rencana v2, aturan kerja 12).
// Halaman tidak boleh menulis ulang logika ini. Aturan dibedakan per cabang olahraga
// lewat RANKING_PROFILES; urutan kriteria dan sumber acuannya ikut tampil di UI.

export type SportKey = "padel" | "badminton" | "tennis" | "tenismeja";

export const SPORT_KEYS: readonly SportKey[] = ["padel", "badminton", "tennis", "tenismeja"];

export function normalizeSport(value: unknown): SportKey {
  return SPORT_KEYS.includes(value as SportKey) ? (value as SportKey) : "padel";
}

// Sport arena diambil dari pertandingannya; yang paling sering muncul menang.
export function sportFromMatches(matches: ReadonlyArray<{ sport?: string | null }>): SportKey {
  const counts = new Map<SportKey, number>();
  for (const m of matches) {
    if (!m.sport) continue;
    const key = normalizeSport(m.sport);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: SportKey = "padel";
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export type Standing = {
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  pointsAgainst: number;
  pointDiff: number;
};

export type RankedStanding = Standing & { rank: number };

export type MatchForRanking = {
  team_a?: string[] | null;
  team_b?: string[] | null;
  score_a?: number | null;
  score_b?: number | null;
  status?: string | null;
};

// Pertandingan yang ikut dihitung: bukan skor live, dan bukan 0-0 (ronde yang baru
// dibuat tetapi belum diisi, jadi belum benar-benar dimainkan).
export function isCountedMatch(m: MatchForRanking): boolean {
  if (m.status === "live") return false;
  return (m.score_a ?? 0) !== 0 || (m.score_b ?? 0) !== 0;
}

export function buildStandings(
  players: readonly string[],
  matches: readonly MatchForRanking[],
): Standing[] {
  const table = new Map<string, Standing>();
  const ensure = (name: string) => {
    let row = table.get(name);
    if (!row) {
      row = {
        name,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      };
      table.set(name, row);
    }
    return row;
  };
  players.forEach(ensure);
  for (const m of matches) {
    if (!isCountedMatch(m)) continue;
    const a = m.score_a ?? 0;
    const b = m.score_b ?? 0;
    const apply = (names: readonly string[] | null | undefined, own: number, other: number) => {
      for (const name of names ?? []) {
        const row = ensure(name);
        row.games += 1;
        row.points += own;
        row.pointsAgainst += other;
        row.pointDiff += own - other;
        if (own > other) row.wins += 1;
        else if (own < other) row.losses += 1;
        else row.draws += 1;
      }
    };
    apply(m.team_a, a, b);
    apply(m.team_b, b, a);
  }
  return [...table.values()];
}

// ---------------------------------------------------------------------------
// Profil aturan per cabang olahraga
// ---------------------------------------------------------------------------

export type Criterion = "points" | "wins" | "pointDiff" | "pointShare";

export type RankingProfile = {
  sport: SportKey;
  label: string;
  accent: string;
  unit: string; // satuan skor: "poin" atau "game"
  criteria: readonly Criterion[];
  reference: string;
  adaptation: string;
};

export const RANKING_PROFILES: Record<SportKey, RankingProfile> = {
  padel: {
    sport: "padel",
    label: "Padel",
    accent: "#85bd13",
    unit: "poin",
    criteria: ["points", "pointDiff", "wins"],
    reference:
      "Praktik umum format Americano dan Mexicano: peringkat individu dari total poin, lalu selisih poin.",
    adaptation:
      "Federasi (FIP) tidak punya aturan resmi untuk peringkat individu dengan partner yang berganti tiap ronde, jadi ini konvensi turnamen, bukan aturan federasi.",
  },
  badminton: {
    sport: "badminton",
    label: "Badminton",
    accent: "#28a9e0",
    unit: "poin",
    criteria: ["wins", "pointDiff", "points"],
    reference:
      "Mengikuti urutan BWF untuk round robin (General Competition Regulations 16.2): pertandingan dimenangkan, lalu selisih game, lalu selisih poin.",
    adaptation:
      "Satu pertandingan di arena sama dengan satu game, jadi selisih game dilewati dan langsung memakai selisih poin. Pertemuan langsung tidak dipakai karena partner berganti tiap ronde.",
  },
  tennis: {
    sport: "tennis",
    label: "Tenis",
    accent: "#f0b429",
    unit: "game",
    criteria: ["wins", "pointShare", "pointDiff"],
    reference:
      "Mengikuti prinsip round robin tenis (contoh aturan Tennis Canada): pertandingan dimenangkan, lalu persentase set, lalu persentase game.",
    adaptation:
      "Arena hanya mencatat satu skor (game) per pertandingan, jadi persentase set dilewati dan dipakai persentase game. Pertemuan langsung tidak dipakai karena partner berganti.",
  },
  tenismeja: {
    sport: "tenismeja",
    label: "Tenis Meja",
    accent: "#ff5b6e",
    unit: "poin",
    criteria: ["wins", "pointShare", "pointDiff"],
    reference:
      "Mengikuti prinsip ITTF untuk grup round robin: poin pertandingan (menang 2, kalah 1 bila selesai), lalu rasio game, lalu rasio poin.",
    adaptation:
      "Arena hanya mencatat satu skor per pertandingan, jadi dipakai jumlah menang lalu rasio poin. Pertemuan langsung tidak dipakai karena partner berganti tiap ronde.",
  },
};

export function getRankingProfile(sport: unknown): RankingProfile {
  return RANKING_PROFILES[normalizeSport(sport)];
}

export function criterionLabel(criterion: Criterion, profile: RankingProfile): string {
  switch (criterion) {
    case "points":
      return `Total ${profile.unit}`;
    case "wins":
      return "Jumlah menang";
    case "pointDiff":
      return `Selisih ${profile.unit}`;
    case "pointShare":
      return `Persentase ${profile.unit} dimenangkan`;
  }
}

export function criterionHint(criterion: Criterion, profile: RankingProfile): string {
  switch (criterion) {
    case "points":
      return `Semua ${profile.unit} yang dicetak tim pemain, dijumlahkan dari tiap pertandingan.`;
    case "wins":
      return "Banyaknya pertandingan yang dimenangkan. Skor sama (seri) tidak dihitung menang.";
    case "pointDiff":
      return `${profile.unit === "game" ? "Game" : "Poin"} dicetak dikurangi ${profile.unit} kemasukan, dijumlahkan dari semua pertandingan.`;
    case "pointShare":
      return `${profile.unit === "game" ? "Game" : "Poin"} dicetak dibagi total ${profile.unit} yang dimainkan pemain itu.`;
  }
}

export function profileSummary(profile: RankingProfile): string {
  return profile.criteria.map((c) => criterionLabel(c, profile)).join(" → ");
}

// Angka utama yang ditonjolkan di podium dan tabel, mengikuti kriteria pertama profil.
export function headlineMetric(
  row: Standing,
  profile: RankingProfile,
): { value: number; label: string } {
  const first = profile.criteria[0];
  if (first === "wins") return { value: row.wins, label: "menang" };
  return { value: row.points, label: profile.unit };
}

export function pointShare(row: Standing): number {
  const total = row.points + row.pointsAgainst;
  return total > 0 ? row.points / total : 0;
}

// Negatif berarti a berperingkat lebih tinggi dari b pada kriteria ini.
function compareCriterion(criterion: Criterion, a: Standing, b: Standing): number {
  switch (criterion) {
    case "points":
      return b.points - a.points;
    case "wins":
      return b.wins - a.wins;
    case "pointDiff":
      return b.pointDiff - a.pointDiff;
    case "pointShare":
      return pointShare(b) - pointShare(a);
  }
}

function compareByProfile(a: Standing, b: Standing, profile: RankingProfile): number {
  // Pemain yang belum punya pertandingan selalu di bawah yang sudah main.
  const played = Number(b.games > 0) - Number(a.games > 0);
  if (played !== 0) return played;
  for (const criterion of profile.criteria) {
    const diff = compareCriterion(criterion, a, b);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isTied(a: Standing, b: Standing, profile: RankingProfile): boolean {
  return compareByProfile(a, b, profile) === 0;
}

function sortByProfile<T extends Standing>(rows: readonly T[], profile: RankingProfile): T[] {
  return [...rows].sort((a, b) => compareByProfile(a, b, profile) || a.name.localeCompare(b.name));
}

// Hanya urutan (tanpa nomor peringkat), misalnya untuk memilih 5 pemain teratas.
export function sortStandings<T extends Standing>(
  rows: readonly T[],
  sport: unknown = "padel",
): T[] {
  return sortByProfile(rows, getRankingProfile(sport));
}

// Mengurutkan lalu memberi peringkat padat (1, 2, 2, 3). Nama hanya mengatur urutan
// tampil bagi yang seri, tidak memengaruhi peringkat.
export function rankStandings<T extends Standing>(
  rows: readonly T[],
  sport: unknown = "padel",
): Array<T & { rank: number }> {
  const profile = getRankingProfile(sport);
  let rank = 0;
  let previous: T | undefined;
  return sortByProfile(rows, profile).map((row) => {
    if (!previous || !isTied(row, previous, profile)) rank += 1;
    previous = row;
    return { ...row, rank };
  });
}

// Selisih jumlah main antar pemain; dipakai untuk memberi catatan transparansi di UI.
export function gamesSpread(rows: readonly Standing[]): { min: number; max: number } | null {
  const played = rows.filter((r) => r.games > 0).map((r) => r.games);
  if (played.length === 0) return null;
  return { min: Math.min(...played), max: Math.max(...played) };
}
