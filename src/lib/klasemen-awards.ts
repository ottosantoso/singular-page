import { bestDuo, buildForm, type InsightMatch } from "@/lib/klasemen-insights";
import type { Movement, RankedPlayer } from "@/lib/klasemen-ranking";

// Papan gelar: 9 penghargaan dari data yang sudah ada. Gelar per-laga hanya dihitung dari
// pemain yang masuk peringkat (bukan Provisional) supaya sampel kecil tidak menang gelar.

export type Award = {
  key: string;
  emoji: string;
  title: string;
  rule: string;
  holders: string[];
  value: string;
  unit: string;
  detail: string;
};

function top<T>(items: readonly T[], cmp: (a: T, b: T) => number): { best: T | null; ties: number } {
  if (items.length === 0) return { best: null, ties: 0 };
  // sort stabil: urutan masuk (urutan peringkat) memenangkan seri
  const sorted = [...items].sort(cmp);
  const ties = sorted.filter((item) => cmp(sorted[0], item) === 0).length - 1;
  return { best: sorted[0], ties };
}

const tieNote = (ties: number) => (ties > 0 ? ` · imbang dengan ${ties} pemain lain` : "");
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function buildAwards(
  ordered: readonly RankedPlayer[],
  matches: readonly InsightMatch[],
  movement: Map<string, Movement>,
): Award[] {
  const played = ordered.filter((p) => p.games > 0);
  const ranked = played.filter((p) => !p.provisional);
  const pool = ranked.length > 0 ? ranked : played;

  const empty = (key: string, emoji: string, title: string, rule: string): Award => ({
    key,
    emoji,
    title,
    rule,
    holders: [],
    value: "—",
    unit: "",
    detail: "Belum ada pemenang",
  });

  const awards: Award[] = [];

  // 👑 Juara Umum
  {
    const champs = ordered.filter((p) => p.rank === 1);
    const c = champs[0];
    awards.push(
      c
        ? {
            key: "juara",
            emoji: "👑",
            title: "Juara Umum",
            rule: "Win rate, lalu % poin, selisih/laga, jumlah menang",
            holders: [c.name],
            value: `${c.winRate.toFixed(0)}%`,
            unit: "win rate",
            detail: `${c.wins} menang dari ${c.games} laga · ${c.pointPct.toFixed(0)}% poin${tieNote(champs.length - 1)}`,
          }
        : empty("juara", "👑", "Juara Umum", "Win rate, lalu % poin, selisih/laga, jumlah menang"),
    );
  }

  // 🎯 Mesin Poin
  {
    const { best, ties } = top(pool, (a, b) => b.avgFor - a.avgFor);
    awards.push(
      best && best.avgFor > 0
        ? {
            key: "mesin",
            emoji: "🎯",
            title: "Mesin Poin",
            rule: "Rata-rata poin per laga tertinggi",
            holders: [best.name],
            value: best.avgFor.toFixed(1),
            unit: "poin/laga",
            detail: `${best.pointsFor} poin dari ${best.games} laga${tieNote(ties)}`,
          }
        : empty("mesin", "🎯", "Mesin Poin", "Rata-rata poin per laga tertinggi"),
    );
  }

  // 🧱 Si Tembok
  {
    const { best, ties } = top(pool, (a, b) => a.avgAgainst - b.avgAgainst);
    awards.push(
      best
        ? {
            key: "tembok",
            emoji: "🧱",
            title: "Si Tembok",
            rule: "Poin kebobolan per laga paling sedikit",
            holders: [best.name],
            value: best.avgAgainst.toFixed(1),
            unit: "kebobolan/laga",
            detail: `${best.pointsAgainst} poin kebobolan dari ${best.games} laga${tieNote(ties)}`,
          }
        : empty("tembok", "🧱", "Si Tembok", "Poin kebobolan per laga paling sedikit"),
    );
  }

  // 🔥 Raja Streak
  {
    const form = buildForm(matches);
    const runs = played.map((p) => {
      let run = 0;
      let bestRun = 0;
      for (const r of form.get(p.name) ?? []) {
        if (r === "W") {
          run += 1;
          bestRun = Math.max(bestRun, run);
        } else {
          run = 0;
        }
      }
      return { p, bestRun, active: run > 0 && run === bestRun };
    });
    const { best, ties } = top(
      runs.filter((r) => r.bestRun >= 2),
      (a, b) => b.bestRun - a.bestRun,
    );
    awards.push(
      best
        ? {
            key: "streak",
            emoji: "🔥",
            title: "Raja Streak",
            rule: "Menang beruntun terpanjang",
            holders: [best.p.name],
            value: `${best.bestRun}x`,
            unit: "beruntun",
            detail: `${best.active ? "Masih berjalan" : "Rekor tertinggi"}${tieNote(ties)}`,
          }
        : empty("streak", "🔥", "Raja Streak", "Menang beruntun terpanjang"),
    );
  }

  // 🧊 Mental Baja
  {
    const closeWins = new Map<string, number>();
    const closeGames = new Map<string, number>();
    for (const m of matches) {
      const diff = m.score_a - m.score_b;
      if (Math.abs(diff) > 2) continue;
      const bump = (map: Map<string, number>, names: string[]) =>
        names.forEach((n) => map.set(n, (map.get(n) ?? 0) + 1));
      bump(closeGames, m.team_a);
      bump(closeGames, m.team_b);
      if (diff > 0) bump(closeWins, m.team_a);
      if (diff < 0) bump(closeWins, m.team_b);
    }
    const rows = played
      .filter((p) => (closeWins.get(p.name) ?? 0) > 0)
      .map((p) => ({ p, wins: closeWins.get(p.name) ?? 0, games: closeGames.get(p.name) ?? 0 }));
    const { best, ties } = top(rows, (a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games);
    awards.push(
      best
        ? {
            key: "mental",
            emoji: "🧊",
            title: "Mental Baja",
            rule: "Paling sering menang di laga ketat (selisih ≤2)",
            holders: [best.p.name],
            value: String(best.wins),
            unit: "menang tipis",
            detail: `${best.wins} menang dari ${best.games} laga ketat${tieNote(ties)}`,
          }
        : empty("mental", "🧊", "Mental Baja", "Paling sering menang di laga ketat (selisih ≤2)"),
    );
  }

  // 🤝 Duo Terbaik
  {
    const duo = bestDuo(matches);
    awards.push(
      duo
        ? {
            key: "duo",
            emoji: "🤝",
            title: "Duo Terbaik",
            rule: "Pasangan dengan hasil terbaik",
            holders: duo.names,
            value: `${duo.wins}/${duo.games}`,
            unit: "menang",
            detail: `Selisih poin ${signed(duo.pointDiff)} saat berpasangan`,
          }
        : empty("duo", "🤝", "Duo Terbaik", "Pasangan dengan hasil terbaik"),
    );
  }

  // ⚔️ Giant Killer
  {
    const strength = new Map<string, number>(ordered.map((p, i) => [p.name, i] as [string, number]));
    const kills = new Map<string, number>();
    for (const m of matches) {
      if (m.score_a === m.score_b) continue;
      const aWon = m.score_a > m.score_b;
      const winners = aWon ? m.team_a : m.team_b;
      const losers = aWon ? m.team_b : m.team_a;
      for (const w of winners) {
        const wi = strength.get(w) ?? Number.MAX_SAFE_INTEGER;
        const count = losers.filter((l) => (strength.get(l) ?? Number.MAX_SAFE_INTEGER) < wi).length;
        if (count > 0) kills.set(w, (kills.get(w) ?? 0) + count);
      }
    }
    const rows = played.filter((p) => (kills.get(p.name) ?? 0) > 0).map((p) => ({ p, kills: kills.get(p.name) ?? 0 }));
    const { best, ties } = top(rows, (a, b) => b.kills - a.kills);
    awards.push(
      best
        ? {
            key: "giant",
            emoji: "⚔️",
            title: "Giant Killer",
            rule: "Menang atas pemain yang peringkatnya lebih tinggi",
            holders: [best.p.name],
            value: String(best.kills),
            unit: "kali",
            detail: `Menumbangkan pemain berperingkat di atasnya${tieNote(ties)}`,
          }
        : empty("giant", "⚔️", "Giant Killer", "Menang atas pemain yang peringkatnya lebih tinggi"),
    );
  }

  // 🚀 Pendaki Terbaik
  {
    const rows = played
      .map((p) => ({ p, mv: movement.get(p.name) }))
      .filter((r): r is { p: RankedPlayer; mv: Movement } => !!r.mv && r.mv.delta > 0);
    const { best, ties } = top(rows, (a, b) => b.mv.delta - a.mv.delta);
    awards.push(
      best
        ? {
            key: "pendaki",
            emoji: "🚀",
            title: "Pendaki Terbaik",
            rule: "Naik peringkat terbanyak dibanding ronde sebelumnya",
            holders: [best.p.name],
            value: `▲${best.mv.delta}`,
            unit: "peringkat",
            detail: `Dari #${best.mv.from} ke #${best.mv.to} di Ronde ${best.mv.round}${tieNote(ties)}`,
          }
        : empty("pendaki", "🚀", "Pendaki Terbaik", "Naik peringkat terbanyak dibanding ronde sebelumnya"),
    );
  }

  // 💪 Raja Rotasi
  {
    const partners = new Map<string, Set<string>>();
    const addPartners = (team: string[]) => {
      for (const name of team) {
        const set = partners.get(name) ?? new Set<string>();
        for (const teammate of team) {
          if (teammate !== name) set.add(teammate);
        }
        partners.set(name, set);
      }
    };
    for (const match of matches) {
      addPartners(match.team_a);
      addPartners(match.team_b);
    }

    const rows = pool
      .filter((p) => p.games >= 3)
      .map((p) => ({ p, partnerCount: partners.get(p.name)?.size ?? 0 }))
      .filter((row) => row.partnerCount > 0);
    const { best, ties } = top(
      rows,
      (a, b) => b.partnerCount - a.partnerCount || b.p.games - a.p.games || b.p.wins - a.p.wins,
    );
    awards.push(
      best
        ? {
            key: "rotasi",
            emoji: "💪",
            title: "Raja Rotasi",
            rule: "Rekan satu tim unik terbanyak",
            holders: [best.p.name],
            value: String(best.partnerCount),
            unit: "rekan unik",
            detail: `${best.p.games} laga · ${best.p.wins} menang${tieNote(ties)}`,
          }
        : empty("rotasi", "💪", "Raja Rotasi", "Rekan satu tim unik terbanyak"),
    );
  }
  return awards;
}
