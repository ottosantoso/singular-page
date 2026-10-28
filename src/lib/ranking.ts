// Satu-satunya sumber aturan peringkat klasemen (Rencana v2, aturan kerja 12).
// Aturan: poin terbanyak, lalu selisih poin; yang seri berbagi peringkat padat
// (1, 2, 2, 3). Nama hanya dipakai untuk urutan tampil, bukan untuk peringkat.

export type RankableStanding = {
  name: string;
  points: number;
  pointDiff: number;
};

export function sortStandings<T extends RankableStanding>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || b.pointDiff - a.pointDiff || a.name.localeCompare(b.name),
  );
}

export function isTied(a: RankableStanding, b: RankableStanding): boolean {
  return a.points === b.points && a.pointDiff === b.pointDiff;
}

// Mengurutkan lalu memberi peringkat padat. Peringkat 1 = juara.
export function rankStandings<T extends RankableStanding>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  const sorted = sortStandings(rows);
  let rank = 0;
  let previous: T | undefined;
  return sorted.map((row) => {
    if (!previous || !isTied(row, previous)) rank += 1;
    previous = row;
    return { ...row, rank };
  });
}
