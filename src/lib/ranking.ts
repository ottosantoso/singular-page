// USANG (6 Nov 2026): aturan di berkas ini (poin terbanyak, lalu selisih; peringkat padat 1, 2, 2, 3)
// tidak dipakai lagi. Peringkat resmi ada di src/lib/klasemen-ranking.ts (Juara Umum: win rate, % poin,
// selisih per laga, lalu jumlah menang). Berkas ini dibiarkan dulu karena masih ada tesnya
// (tests/ranking.test.mjs). Hapus setelah tes dipindah ke klasemen-ranking.test.mjs.

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
