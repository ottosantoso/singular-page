// Fungsi murni untuk halaman /klasemen: form pemain, insight cepat, dan ringkasan laga.
// Tidak menyentuh database; semua dihitung dari data match yang sudah dimuat.

export type InsightMatch = {
  id: string;
  round: number;
  court: number;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  created_at: string;
  status?: string;
};

export type Result = "W" | "L" | "S";

export type PlayerLine = {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  points: number;
  pointDiff: number;
  pointCount: number;
};

export type InsightKind = "consistent" | "scorer" | "streak" | "duo" | "closest" | "blowout";

export type Insight = {
  kind: InsightKind;
  label: string;
  title: string;
  detail: string;
};

export function sortChronological<T extends { round: number; court: number; created_at: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => a.round - b.round || a.court - b.court || a.created_at.localeCompare(b.created_at),
  );
}

// Hasil tiap pemain berurutan dari laga paling awal ke paling akhir.
export function buildForm(matches: readonly InsightMatch[]): Map<string, Result[]> {
  const form = new Map<string, Result[]>();
  const push = (names: string[], own: number, other: number) => {
    const result: Result = own > other ? "W" : own < other ? "L" : "S";
    names.forEach((name) => {
      const list = form.get(name) ?? [];
      list.push(result);
      form.set(name, list);
    });
  };
  for (const match of sortChronological(matches)) {
    push(match.team_a, match.score_a, match.score_b);
    push(match.team_b, match.score_b, match.score_a);
  }
  return form;
}

export function countResults(results: readonly Result[] | undefined) {
  const list = results ?? [];
  return {
    wins: list.filter((r) => r === "W").length,
    losses: list.filter((r) => r === "L").length,
    draws: list.filter((r) => r === "S").length,
  };
}

export function longestWinStreak(
  form: Map<string, Result[]>,
): { name: string; length: number; active: boolean } | null {
  let best: { name: string; length: number; active: boolean } | null = null;
  for (const [name, results] of form) {
    let run = 0;
    let bestRun = 0;
    for (const result of results) {
      if (result === "W") {
        run += 1;
        bestRun = Math.max(bestRun, run);
      } else {
        run = 0;
      }
    }
    if (bestRun > 0 && (!best || bestRun > best.length)) {
      best = { name, length: bestRun, active: run === bestRun };
    }
  }
  return best;
}

type Duo = { names: string[]; games: number; wins: number; pointDiff: number };

export function bestDuo(matches: readonly InsightMatch[]): Duo | null {
  const table = new Map<string, Duo>();
  const add = (team: string[], own: number, other: number) => {
    if (team.length !== 2) return;
    const names = [...team].sort((a, b) => a.localeCompare(b));
    const key = names.join("|");
    const row = table.get(key) ?? { names, games: 0, wins: 0, pointDiff: 0 };
    row.games += 1;
    if (own > other) row.wins += 1;
    row.pointDiff += own - other;
    table.set(key, row);
  };
  matches.forEach((m) => {
    add(m.team_a, m.score_a, m.score_b);
    add(m.team_b, m.score_b, m.score_a);
  });
  const all = [...table.values()];
  const repeated = all.filter((row) => row.games >= 2);
  const pool = (repeated.length > 0 ? repeated : all).filter((row) => row.wins > 0);
  pool.sort(
    (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games || b.pointDiff - a.pointDiff,
  );
  return pool[0] ?? null;
}

export function closestMatch<T extends InsightMatch>(matches: readonly T[]): T | null {
  const played = matches.filter((m) => m.score_a + m.score_b > 0);
  if (played.length === 0) return null;
  return [...played].sort(
    (a, b) =>
      Math.abs(a.score_a - a.score_b) - Math.abs(b.score_a - b.score_b) ||
      b.score_a + b.score_b - (a.score_a + a.score_b),
  )[0];
}

export function biggestWin<T extends InsightMatch>(matches: readonly T[]): T | null {
  const decisive = matches.filter((m) => m.score_a !== m.score_b);
  if (decisive.length === 0) return null;
  return [...decisive].sort(
    (a, b) => Math.abs(b.score_a - b.score_b) - Math.abs(a.score_a - a.score_b),
  )[0];
}

export function teamLabel(team: string[]): string {
  return team.join(" & ");
}

export function buildInsights(players: readonly PlayerLine[], matches: readonly InsightMatch[]): Insight[] {
  const insights: Insight[] = [];
  const played = players.filter((p) => p.games > 0);

  if (played.length > 0) {
    const maxGames = Math.max(...played.map((p) => p.games));
    const minGames = Math.max(1, Math.ceil(maxGames / 2));
    const consistent = [...played]
      .filter((p) => p.games >= minGames)
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.games - a.games)[0];
    if (consistent) {
      insights.push({
        kind: "consistent",
        label: "Paling konsisten",
        title: consistent.name,
        detail: `${consistent.winRate.toFixed(0)}% menang · ${consistent.wins} dari ${consistent.games} laga`,
      });
    }

    // Poin terbanyak dihitung dari skor laga (selalu tersedia), bukan dari mode Detail,
    // supaya tidak tampil 0 ketika poin individu belum dicatat.
    const scorer = [...played].sort(
      (a, b) => b.points - a.points || b.pointDiff - a.pointDiff || a.name.localeCompare(b.name),
    )[0];
    if (scorer && scorer.points > 0) {
      const perGame = scorer.points / scorer.games;
      insights.push({
        kind: "scorer",
        label: "Pengumpul poin terbanyak",
        title: scorer.name,
        detail: `${scorer.points} poin · rata-rata ${perGame.toFixed(1)} per laga${
          scorer.pointCount > 0 ? ` · ${scorer.pointCount} poin individu tercatat` : ""
        }`,
      });
    }
  }

  const streak = longestWinStreak(buildForm(matches));
  if (streak && streak.length >= 2) {
    insights.push({
      kind: "streak",
      label: streak.active ? "Sedang on fire" : "Tren kemenangan terpanjang",
      title: streak.name,
      detail: `${streak.length} kemenangan beruntun${streak.active ? " dan masih berjalan" : ""}`,
    });
  }

  const duo = bestDuo(matches);
  if (duo) {
    insights.push({
      kind: "duo",
      label: "Duo paling klop",
      title: teamLabel(duo.names),
      detail: `${duo.wins} menang dari ${duo.games} laga bareng · selisih ${
        duo.pointDiff > 0 ? "+" : ""
      }${duo.pointDiff}`,
    });
  }

  const closest = closestMatch(matches);
  if (closest) {
    insights.push({
      kind: "closest",
      label: "Laga paling ketat",
      title: `${closest.score_a} – ${closest.score_b}`,
      detail: `${teamLabel(closest.team_a)} vs ${teamLabel(closest.team_b)}`,
    });
  }

  const blowout = biggestWin(matches);
  if (blowout) {
    const diff = Math.abs(blowout.score_a - blowout.score_b);
    const winner = blowout.score_a > blowout.score_b ? blowout.team_a : blowout.team_b;
    insights.push({
      kind: "blowout",
      label: "Kemenangan paling telak",
      title: `${blowout.score_a} – ${blowout.score_b}`,
      detail: `${teamLabel(winner)} unggul ${diff} poin`,
    });
  }

  return insights;
}

// Kalimat penutup singkat soal persaingan di papan atas. `players` harus sudah urut klasemen.
export function leaderNarrative(players: readonly PlayerLine[]): string {
  if (players.length < 2 || players[0].games === 0) return "";
  const [first, second] = players;
  const gap = first.points - second.points;
  if (gap === 0) {
    return `${first.name} dan ${second.name} berbagi poin yang sama — selisih poin yang menentukan peringkat.`;
  }
  return gap <= 5
    ? `${first.name} hanya unggul ${gap} poin dari ${second.name}. Persaingan puncak masih terbuka lebar!`
    : `${first.name} unggul ${gap} poin dari ${second.name}. Siapa yang bisa mengejar?`;
}

export type MatchSummary = {
  count: number;
  rounds: number;
  totalPoints: number;
  avgTotal: number;
  avgTeam: number;
  draws: number;
  highest: InsightMatch | null;
  closest: InsightMatch | null;
  biggest: InsightMatch | null;
  perCourt: Array<{ court: number; count: number }>;
};

export function summarizeMatches(matches: readonly InsightMatch[]): MatchSummary {
  const totalPoints = matches.reduce((sum, m) => sum + m.score_a + m.score_b, 0);
  const courts = new Map<number, number>();
  matches.forEach((m) => courts.set(m.court, (courts.get(m.court) ?? 0) + 1));
  const highest =
    [...matches].sort((a, b) => b.score_a + b.score_b - (a.score_a + a.score_b))[0] ?? null;
  return {
    count: matches.length,
    rounds: new Set(matches.map((m) => m.round)).size,
    totalPoints,
    avgTotal: matches.length > 0 ? totalPoints / matches.length : 0,
    avgTeam: matches.length > 0 ? totalPoints / (matches.length * 2) : 0,
    draws: matches.filter((m) => m.score_a === m.score_b).length,
    highest: highest && highest.score_a + highest.score_b > 0 ? highest : null,
    closest: closestMatch(matches),
    biggest: biggestWin(matches),
    perCourt: [...courts.entries()]
      .map(([court, count]) => ({ court, count }))
      .sort((a, b) => a.court - b.court),
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_TONES = [
  ["#dbeafe", "#1d4ed8"],
  ["#fee2e2", "#b91c1c"],
  ["#dcfce7", "#15803d"],
  ["#fef3c7", "#b45309"],
  ["#ede9fe", "#6d28d9"],
  ["#cffafe", "#0e7490"],
  ["#fce7f3", "#be185d"],
] as const;

export function avatarTone(name: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [background, color] = AVATAR_TONES[hash % AVATAR_TONES.length];
  return { background, color };
}
