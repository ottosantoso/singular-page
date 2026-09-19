import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/detail-pemain")({
  head: () => ({
    meta: [
      { title: "Report Detail Pemain — OTTOPLAY ARENA" },
      {
        name: "description",
        content:
          "Breakdown detail performa tiap pejuang: total poin, win rate, tren per ronde, kompatibilitas partner, dan head-to-head.",
      },
    ],
  }),
  component: DetailPemain,
});

type MatchRow = {
  id: string;
  round: number;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  created_at: string;
};

type PlayerStatRow = {
  player_name: string;
  point_count: number;
  out_count: number;
  foul_count: number;
};

type Standing = { name: string; points: number; games: number; wins: number };

type ActionSummary = {
  name: string;
  pointCount: number;
  outCount: number;
  foulCount: number;
  total: number;
  efficiency: number;
};

type PartnerRow = {
  key: string;
  members: [string, string];
  games: number;
  wins: number;
  winRate: number;
};

type RivalryRow = {
  key: string;
  members: [string, string];
  meetings: number;
  winsA: number;
  winsB: number;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join("␟");
}

function buildStandings(players: string[], matches: MatchRow[]): Standing[] {
  const table = new Map<string, Standing>();
  players.forEach((name) => table.set(name, { name, points: 0, games: 0, wins: 0 }));

  matches.forEach((m) => {
    const teamA = m.team_a ?? [];
    const teamB = m.team_b ?? [];
    const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
    const bWon = (m.score_b ?? 0) > (m.score_a ?? 0);

    teamA.forEach((name) => {
      const row = table.get(name) ?? { name, points: 0, games: 0, wins: 0 };
      row.games += 1;
      row.points += m.score_a ?? 0;
      if (aWon) row.wins += 1;
      table.set(name, row);
    });
    teamB.forEach((name) => {
      const row = table.get(name) ?? { name, points: 0, games: 0, wins: 0 };
      row.games += 1;
      row.points += m.score_b ?? 0;
      if (bWon) row.wins += 1;
      table.set(name, row);
    });
  });

  return [...table.values()];
}

function buildActionSummary(statRows: PlayerStatRow[]): ActionSummary[] {
  const table = new Map<string, { pointCount: number; outCount: number; foulCount: number }>();
  statRows.forEach((row) => {
    const cur = table.get(row.player_name) ?? { pointCount: 0, outCount: 0, foulCount: 0 };
    cur.pointCount += row.point_count ?? 0;
    cur.outCount += row.out_count ?? 0;
    cur.foulCount += row.foul_count ?? 0;
    table.set(row.player_name, cur);
  });

  return [...table.entries()].map(([name, v]) => {
    const total = v.pointCount + v.outCount + v.foulCount;
    return {
      name,
      pointCount: v.pointCount,
      outCount: v.outCount,
      foulCount: v.foulCount,
      total,
      efficiency: total > 0 ? (v.pointCount / total) * 100 : 0,
    };
  });
}

/** Partner = anggota tim yang sama (team_a bareng, atau team_b bareng) di satu match. */
function buildPartnerStats(matches: MatchRow[]): PartnerRow[] {
  const table = new Map<string, { members: [string, string]; games: number; wins: number }>();
  const record = (members: string[], won: boolean) => {
    if (members.length !== 2) return;
    const [a, b] = members;
    if (a === undefined || b === undefined) return;
    const key = pairKey(a, b);
    const cur = table.get(key) ?? { members: [a, b] as [string, string], games: 0, wins: 0 };
    cur.games += 1;
    if (won) cur.wins += 1;
    table.set(key, cur);
  };
  matches.forEach((m) => {
    const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
    const bWon = (m.score_b ?? 0) > (m.score_a ?? 0);
    record(m.team_a ?? [], aWon);
    record(m.team_b ?? [], bWon);
  });
  return [...table.entries()].map(([key, v]) => ({
    key,
    members: v.members,
    games: v.games,
    wins: v.wins,
    winRate: v.games > 0 ? (v.wins / v.games) * 100 : 0,
  }));
}

/** Pasangan favorit = paling sering main bareng (berdasarkan frekuensi, bukan win rate). */
function buildFavoritePartnerships(partnerships: PartnerRow[]): PartnerRow[] {
  return [...partnerships].sort((a, b) => b.games - a.games || b.winRate - a.winRate).slice(0, 5);
}

function buildNeverPartnered(players: string[], partnerships: PartnerRow[]): [string, string][] {
  const played = new Set(partnerships.map((p) => p.key));
  const result: [string, string][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const pa = players[i];
      const pb = players[j];
      if (pa === undefined || pb === undefined) continue;
      const key = pairKey(pa, pb);
      if (!played.has(key)) result.push([pa, pb]);
    }
  }
  return result;
}

/** Head-to-head antar individu (lintas tim, sebagai lawan), bukan antar tim/pasangan. */
function buildHeadToHead(matches: MatchRow[]): RivalryRow[] {
  const table = new Map<string, RivalryRow>();
  matches.forEach((m) => {
    const teamA = m.team_a ?? [];
    const teamB = m.team_b ?? [];
    const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
    const bWon = (m.score_b ?? 0) > (m.score_a ?? 0);
    teamA.forEach((x) => {
      teamB.forEach((y) => {
        const [first, second] = [x, y].sort();
        const key = pairKey(x, y);
        const cur = table.get(key) ?? { key, members: [first, second] as [string, string], meetings: 0, winsA: 0, winsB: 0 };
        cur.meetings += 1;
        if (aWon) {
          if (first === x) cur.winsA += 1;
          else cur.winsB += 1;
        } else if (bWon) {
          if (first === y) cur.winsA += 1;
          else cur.winsB += 1;
        }
        table.set(key, cur);
      });
    });
  });
  return [...table.values()];
}

/** Akumulasi poin per ronde, khusus buat nama-nama yang diminta (biar chart nggak penuh sesak). */
function buildRoundTrend(matches: MatchRow[], trackedNames: string[]): Record<string, number | string>[] {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const cumulative = new Map<string, number>();
  trackedNames.forEach((n) => cumulative.set(n, 0));
  return rounds.map((r) => {
    matches
      .filter((m) => m.round === r)
      .forEach((m) => {
        (m.team_a ?? []).forEach((p) => {
          if (cumulative.has(p)) cumulative.set(p, (cumulative.get(p) ?? 0) + (m.score_a ?? 0));
        });
        (m.team_b ?? []).forEach((p) => {
          if (cumulative.has(p)) cumulative.set(p, (cumulative.get(p) ?? 0) + (m.score_b ?? 0));
        });
      });
    const point: Record<string, number | string> = { round: `R${r}` };
    trackedNames.forEach((n) => (point[n] = cumulative.get(n) ?? 0));
    return point;
  });
}

function buildRoundMvp(matches: MatchRow[]): { round: number; name: string; points: number } | null {
  if (!matches.length) return null;
  const maxRound = Math.max(...matches.map((m) => m.round));
  const points = new Map<string, number>();
  matches
    .filter((m) => m.round === maxRound)
    .forEach((m) => {
      (m.team_a ?? []).forEach((p) => points.set(p, (points.get(p) ?? 0) + (m.score_a ?? 0)));
      (m.team_b ?? []).forEach((p) => points.set(p, (points.get(p) ?? 0) + (m.score_b ?? 0)));
    });
  let best: { name: string; points: number } | null = null;
  for (const [name, pts] of points) {
    if (!best || pts > best.points) best = { name, points: pts };
  }
  return best ? { round: maxRound, name: best.name, points: best.points } : null;
}

function buildWinStreaks(players: string[], matches: MatchRow[]): { name: string; streak: number }[] {
  const sorted = [...matches].sort(
    (a, b) => a.round - b.round || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );
  const results = new Map<string, boolean[]>();
  players.forEach((p) => results.set(p, []));
  sorted.forEach((m) => {
    const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
    const bWon = (m.score_b ?? 0) > (m.score_a ?? 0);
    (m.team_a ?? []).forEach((p) => results.get(p)?.push(aWon));
    (m.team_b ?? []).forEach((p) => results.get(p)?.push(bWon));
  });
  return players
    .map((p) => {
      const seq = results.get(p) ?? [];
      let best = 0;
      let cur = 0;
      seq.forEach((won) => {
        if (won) {
          cur += 1;
          best = Math.max(best, cur);
        } else {
          cur = 0;
        }
      });
      return { name: p, streak: best };
    })
    .filter((r) => r.streak > 0)
    .sort((a, b) => b.streak - a.streak);
}

const SPORT_GREEN = "#85bd13";
const SPORT_BLUE = "#28a9e0";
const SPORT_PINK = "#ff5b6e";
const SPORT_AMBER = "#f0b429";
const SPORT_PURPLE = "#8b5cf6";
const TREND_COLORS = [SPORT_GREEN, SPORT_BLUE, SPORT_PINK, SPORT_AMBER, SPORT_PURPLE];

function MiniBarChart({
  data,
  dataKey,
  color,
  suffix = "",
}: {
  data: { name: string; value: number }[];
  dataKey: string;
  color: string;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.26 0.05 250 / 0.08)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--arena-dim)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--arena-dim)" }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v: number) => [`${v}${suffix}`, ""]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid oklch(0.26 0.05 250 / 0.1)",
            fontSize: 12,
          }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} maxBarSize={40} name={dataKey} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RoundTrendChart({
  data,
  names,
}: {
  data: Record<string, number | string>[];
  names: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.26 0.05 250 / 0.08)" />
        <XAxis dataKey="round" tick={{ fontSize: 11, fill: "var(--arena-dim)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--arena-dim)" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid oklch(0.26 0.05 250 / 0.1)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {names.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={TREND_COLORS[i % TREND_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function DetailPemain() {
  const [code, setCode] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("kode");
    let latest = "";
    if (!fromUrl) {
      let latestAt = -1;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Kode arena & kode klasemen sekarang disatukan (prefix kocokArenaCode_).
        // Tetap cek prefix lama (ottoKlasemenCode_) juga buat kode-kode lama yang
        // sudah kesimpen sebelum penyatuan ini — persis pola yang sama di klasemen.tsx.
        if (!key || (!key.startsWith("kocokArenaCode_") && !key.startsWith("ottoKlasemenCode_")) || key.endsWith("_at")) continue;
        const value = localStorage.getItem(key);
        if (!value) continue;
        const at = Number(localStorage.getItem(key + "_at") ?? 0);
        if (at >= latestAt) {
          latestAt = at;
          latest = value;
        }
      }
    }
    const saved = (fromUrl || latest || "").toUpperCase();
    if (saved) setCode(saved);
  }, []);

  const query = useQuery({
    queryKey: ["detail-pemain", code],
    enabled: !!code,
    refetchInterval: (q) => {
      const lastMatchAt = q.state.data?.lastMatchAt;
      if (lastMatchAt) {
        const elapsed = Date.now() - new Date(lastMatchAt).getTime();
        if (elapsed > 2 * 60 * 60 * 1000) return false; // >2 jam sejak match terakhir, turnamen kemungkinan sudah kelar
      }
      return 15000;
    },
    queryFn: async () => {
      const [playersRes, matchesRes, statsRes] = await Promise.all([
        supabase.from("arena_players").select("name").eq("arena_code", code),
        supabase
          .from("arena_matches")
          .select("id, round, team_a, team_b, score_a, score_b, created_at")
          .eq("arena_code", code)
          .order("round", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("arena_player_stats")
          .select("player_name, point_count, out_count, foul_count")
          .eq("arena_code", code),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (matchesRes.error) throw matchesRes.error;
      const players = (playersRes.data ?? []).map((p) => p.name);
      const allMatches = (matchesRes.data ?? []) as MatchRow[];
      // Ronde yang masih 0-0 di kedua tim itu belum beneran dimainkan (baru dibuat
      // pas ronde mulai, skornya belum diisi) — jangan ikut dihitung di statistik
      // apapun (podium, MVP, jumlah game, tren, dst), biar nggak nampilin ronde
      // yang masih kosong seolah-olah sudah selesai.
      const matches = allMatches.filter((m) => (m.score_a ?? 0) !== 0 || (m.score_b ?? 0) !== 0);
      const statRows = statsRes.error ? [] : ((statsRes.data ?? []) as PlayerStatRow[]);

      const standings = buildStandings(players, matches);
      const trendNames = [...standings]
        .sort((a, b) => b.points - a.points || b.wins - a.wins)
        .slice(0, 5)
        .map((s) => s.name);
      const partnerships = buildPartnerStats(matches);

      const lastMatchAt = allMatches.length
        ? allMatches.reduce((latest, m) => (m.created_at > latest ? m.created_at : latest), "")
        : null;

      return {
        standings,
        actions: buildActionSummary(statRows),
        hasActionData: !statsRes.error && statRows.length > 0,
        roundTrend: buildRoundTrend(matches, trendNames),
        trendNames,
        partnerships,
        favoritePartnerships: buildFavoritePartnerships(partnerships),
        neverPartnered: buildNeverPartnered(players, partnerships),
        rivalries: buildHeadToHead(matches),
        roundMvp: buildRoundMvp(matches),
        winStreaks: buildWinStreaks(players, matches),
        lastMatchAt,
      };
    },
  });

  const data = query.data;

  const rankedStandingsRaw = data
    ? [...data.standings].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
    : [];
  // Rank secara adil walau jumlah main tiap orang beda: pakai rata-rata poin per
  // game, bukan total poin mentah. Supaya nggak ada yang nangkring di atas cuma
  // modal 1-2 game menang, kasih syarat minimal main dulu (setengah dari jumlah
  // main terbanyak, minimal 3x) sebelum ikut di-ranking berdasarkan rata-rata.
  const maxGamesPlayed = data ? Math.max(0, ...data.standings.map((s) => s.games)) : 0;
  const minGamesToRank = Math.max(3, Math.ceil(maxGamesPlayed / 2));
  const eligibleForRank = rankedStandingsRaw.filter((s) => s.games >= minGamesToRank);
  const belumCukupMain = rankedStandingsRaw.filter((s) => s.games > 0 && s.games < minGamesToRank);
  const rankedStandings = [...eligibleForRank].sort((a, b) => {
    const avgA = a.games > 0 ? a.points / a.games : 0;
    const avgB = b.games > 0 ? b.points / b.games : 0;
    return avgB - avgA || b.wins - a.wins || a.name.localeCompare(b.name);
  });
  const podium = rankedStandings.slice(0, 3);
  const maxPodiumAvg = podium.length
    ? Math.max(...podium.map((p) => (p.games > 0 ? p.points / p.games : 0)), 1)
    : 1;

  const topPoin = data
    ? [...data.standings].sort((a, b) => b.points - a.points).slice(0, 5).map((s) => ({ name: s.name, value: s.points }))
    : [];
  const topWinRate = data
    ? [...data.standings]
        .filter((s) => s.games >= minGamesToRank)
        .map((s) => ({ name: s.name, value: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    : [];
  const topLowestErrors = data
    ? [...data.actions]
        .map((a) => ({ name: a.name, value: a.outCount + a.foulCount }))
        .sort((a, b) => a.value - b.value)
        .slice(0, 5)
    : [];
  const topAvgPointsPerGame = data
    ? [...data.standings]
        .filter((s) => s.games > 0)
        .map((s) => ({ name: s.name, value: Math.round((s.points / s.games) * 10) / 10 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    : [];
  const rankedActions = data
    ? [...data.actions].sort((a, b) => b.efficiency - a.efficiency || b.total - a.total)
    : [];

  const bestPartnerships = data
    ? [...data.partnerships]
        .filter((p) => p.games >= 2)
        .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
        .slice(0, 5)
    : [];
  const topRivalries = data
    ? [...data.rivalries].sort((a, b) => b.meetings - a.meetings).slice(0, 5)
    : [];
  const topWinStreak = data?.winStreaks[0] ?? null;

  return (
    <main className="arena-home court-lines min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-10">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="rounded-full border border-arena-ink/15 bg-white/70 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"
          >
            ← Beranda
          </Link>
          <a
            href={`/klasemen?kode=${encodeURIComponent(code)}`}
            className="font-display text-xs font-bold uppercase tracking-wider text-arena-lime"
          >
            Lihat Klasemen
          </a>
        </nav>

        <header className="text-center">
          <span className="text-4xl">📊</span>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-arena-ink">
            Report Detail Pemain
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-arena-dim">
            Breakdown performa tiap pejuang: tren poin per ronde, kompatibilitas partner, head-to-head,
            dan rincian aksi (poin/out/kesalahan) dari mode pencatatan Detail.
          </p>
        </header>

        {!code && (
          <p className="mt-10 text-center text-sm text-arena-dim">
            Kode arena tidak ditemukan di link ini. Buka halaman ini dari tombol "Report Detail Pemain"
            di layar Turnamen Kelar, atau{" "}
            <Link to="/klasemen" className="font-bold text-arena-lime underline">
              cari lewat halaman Klasemen
            </Link>
            .
          </p>
        )}

        {code && query.isLoading && (
          <p className="mt-10 text-center text-sm text-arena-dim">Memuat data…</p>
        )}

        {code && query.isError && (
          <p className="mt-10 text-center text-sm text-arena-dim">
            Gagal memuat data. Coba lagi sebentar.
          </p>
        )}

        {code && data && (
          <>
            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Podium</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Top 3 pejuang lapangan berdasarkan rata-rata poin per game (biar adil walau jumlah
                main beda-beda) & win rate. Minimal main {minGamesToRank}x dulu baru masuk
                perangkingan.
              </p>
              {podium.length === 0 ? (
                <p className="text-sm text-arena-dim">
                  {rankedStandingsRaw.length === 0
                    ? "Belum ada data."
                    : `Belum ada yang main minimal ${minGamesToRank}x — main dulu beberapa ronde lagi buat lihat podium.`}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {podium.map((p, i) => {
                    const rank = i + 1;
                    const meta =
                      rank === 1
                        ? { badge: "🥇", label: "GOLD BADGE", color: SPORT_AMBER }
                        : rank === 2
                          ? { badge: "🥈", label: "SILVER BADGE", color: SPORT_BLUE }
                          : { badge: "🥉", label: "BRONZE BADGE", color: SPORT_PINK };
                    const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0;
                    const losses = p.games - p.wins;
                    const avgPoints = p.games > 0 ? Math.round((p.points / p.games) * 10) / 10 : 0;
                    const avgPct = Math.min(100, Math.round((avgPoints / maxPodiumAvg) * 100));

                    return (
                      <div
                        key={p.name}
                        className="arena-card-static"
                        style={{ boxShadow: `0 0 0 1px ${meta.color}33, 0 14px 30px -24px ${meta.color}88` }}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-2xl">{meta.badge}</span>
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-bold text-white"
                            style={{ background: meta.color }}
                          >
                            {rank}
                          </span>
                        </div>
                        <p className="mt-2 font-display text-lg font-bold uppercase tracking-wide text-arena-ink">
                          {p.name}
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                          {meta.label}
                        </p>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-arena-dim">
                            <span>Rata-rata Poin/Game</span>
                            <span className="font-display font-bold text-arena-ink">{avgPoints} pts</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-arena-ink/10">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${avgPct}%`, background: meta.color }}
                            />
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-arena-dim">
                            <span>Win Rate</span>
                            <span className="font-display font-bold text-arena-ink">{winRate}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-arena-ink/10">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${winRate}%`, background: meta.color }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                          <span className="rounded-full bg-arena-ink/5 px-2 py-1 text-arena-dim">
                            {p.games} Game
                          </span>
                          <span className="rounded-full bg-arena-lime/15 px-2 py-1 text-arena-ink">
                            {p.wins} Menang
                          </span>
                          <span className="rounded-full px-2 py-1" style={{ background: `${SPORT_PINK}22`, color: SPORT_PINK }}>
                            {losses} Kalah
                          </span>
                          <span className="rounded-full bg-arena-ink/5 px-2 py-1 text-arena-dim">
                            {p.points} total pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {belumCukupMain.length > 0 && (
                <p className="mt-3 text-xs text-arena-dim">
                  Belum ikut di-ranking (kurang dari {minGamesToRank}x main):{" "}
                  {belumCukupMain.map((s) => s.name).join(", ")}
                </p>
              )}
            </section>

            {(data.roundMvp || topWinStreak) && (
              <section className="mt-10 grid gap-4 sm:grid-cols-2">
                {data.roundMvp && (
                  <div className="arena-card-static">
                    <p className="text-xs font-bold uppercase tracking-wide text-arena-dim">
                      🔥 MVP Ronde {data.roundMvp.round}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-arena-ink">
                      {data.roundMvp.name}
                    </p>
                    <p className="mt-1 text-sm text-arena-dim">{data.roundMvp.points} poin di ronde ini</p>
                  </div>
                )}
                {topWinStreak && (
                  <div className="arena-card-static">
                    <p className="text-xs font-bold uppercase tracking-wide text-arena-dim">
                      🏅 Win Streak Terpanjang
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-arena-ink">
                      {topWinStreak.name}
                    </p>
                    <p className="mt-1 text-sm text-arena-dim">{topWinStreak.streak} kemenangan beruntun</p>
                  </div>
                )}
              </section>
            )}

            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Tren Poin per Ronde</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Progres akumulasi poin top 5 pejuang dari ronde ke ronde — biar kelihatan siapa yang
                lagi naik daun dan siapa yang mulai melambat.
              </p>
              <div className="arena-card-static">
                {data.roundTrend.length > 1 ? (
                  <RoundTrendChart data={data.roundTrend} names={data.trendNames} />
                ) : (
                  <p className="py-10 text-center text-xs text-arena-dim">
                    Butuh minimal 2 ronde buat lihat tren.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Kompatibilitas Partner</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Pasangan dengan win rate terbaik, minimal sudah 2 kali main bareng.
              </p>
              <div className="arena-card-static">
                {bestPartnerships.length === 0 ? (
                  <p className="py-6 text-center text-xs text-arena-dim">
                    Belum ada pasangan yang main bareng ≥2 kali.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {bestPartnerships.map((p, i) => (
                      <li key={p.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-arena-ink/5 text-[11px] font-bold text-arena-ink">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-arena-ink">
                            {p.members[0]} & {p.members[1]}
                          </span>
                        </div>
                        <div className="text-right text-xs text-arena-dim">
                          <span className="font-display font-bold text-arena-ink">
                            {Math.round(p.winRate)}%
                          </span>{" "}
                          ({p.wins}/{p.games})
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Rival Terpanas</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Individu yang paling sering berhadapan sebagai lawan, lengkap rekor menang-kalahnya.
              </p>
              {topRivalries.length === 0 ? (
                <p className="text-sm text-arena-dim">Belum ada data pertandingan.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {topRivalries.map((r) => (
                    <div key={r.key} className="arena-card-static flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-bold text-arena-ink">{r.members[0]}</span>
                        <span className="mx-2 text-arena-dim">vs</span>
                        <span className="font-bold text-arena-ink">{r.members[1]}</span>
                      </div>
                      <div className="text-right text-xs text-arena-dim">
                        <span className="font-display font-bold text-arena-ink">
                          {r.winsA}–{r.winsB}
                        </span>{" "}
                        ({r.meetings}x)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-arena-heading mb-4">Top 5 Statistics</h2>
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="arena-card-static">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-arena-dim">
                    Top 5 Total Poin
                  </p>
                  {topPoin.length ? (
                    <MiniBarChart data={topPoin} dataKey="value" color={SPORT_GREEN} />
                  ) : (
                    <p className="py-10 text-center text-xs text-arena-dim">Belum ada data.</p>
                  )}
                </div>
                <div className="arena-card-static">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-arena-dim">
                    Top 5 Win Rate %
                  </p>
                  {topWinRate.length ? (
                    <MiniBarChart data={topWinRate} dataKey="value" color={SPORT_BLUE} suffix="%" />
                  ) : (
                    <p className="py-10 text-center text-xs text-arena-dim">Belum ada data.</p>
                  )}
                </div>
                <div className="arena-card-static">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-arena-dim">
                    {data.hasActionData ? "Top 5 Paling Sedikit Kesalahan" : "Top 5 Rata-rata Poin/Game"}
                  </p>
                  {data.hasActionData ? (
                    topLowestErrors.length ? (
                      <MiniBarChart data={topLowestErrors} dataKey="value" color={SPORT_PINK} />
                    ) : (
                      <p className="py-10 text-center text-xs text-arena-dim">Belum ada data.</p>
                    )
                  ) : topAvgPointsPerGame.length ? (
                    <MiniBarChart data={topAvgPointsPerGame} dataKey="value" color={SPORT_PINK} />
                  ) : (
                    <p className="py-10 text-center text-xs text-arena-dim">Belum ada data.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Per-Player Event Log Breakdown</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Efisiensi = poin yang dicetak sendiri ÷ total aksi (poin + out + kesalahan). Cuma
                terisi untuk pertandingan yang dicatat pakai mode Detail.
              </p>

              {!data.hasActionData ? (
                <div className="arena-card-static text-center">
                  <p className="text-sm text-arena-ink">
                    Belum ada breakdown poin/out/kesalahan untuk sesi ini.
                  </p>
                  <p className="mt-1 text-xs text-arena-dim">
                    Ini cuma tercatat kalau skor dimasukkan pakai mode Detail. Ranking, tren ronde,
                    partner, dan MVP di atas tetap valid kok — itu semua dihitung dari skor akhir
                    pertandingan, bukan dari mode Detail.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {rankedActions.map((a, i) => (
                    <div key={a.name} className="arena-card-static">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-arena-ink/5 font-display text-sm font-bold text-arena-ink">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-display text-sm font-bold uppercase tracking-wide text-arena-ink">
                              {a.name}
                            </p>
                            <p className="text-xs text-arena-dim">{a.total} aksi</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-arena-ink/10">
                        {a.total > 0 && (
                          <div className="flex h-full w-full">
                            <div
                              className="h-full"
                              style={{ width: `${(a.pointCount / a.total) * 100}%`, background: SPORT_GREEN }}
                            />
                            <div
                              className="h-full"
                              style={{ width: `${(a.outCount / a.total) * 100}%`, background: SPORT_AMBER }}
                            />
                            <div
                              className="h-full"
                              style={{ width: `${(a.foulCount / a.total) * 100}%`, background: SPORT_PINK }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-arena-dim">
                        <span>
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: SPORT_GREEN }}
                          />
                          {a.pointCount} poin
                        </span>
                        <span>
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: SPORT_AMBER }}
                          />
                          {a.outCount} out
                        </span>
                        <span>
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: SPORT_PINK }}
                          />
                          {a.foulCount} kesalahan
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-arena-dim">
                          Efisiensi
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-arena-ink/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, a.efficiency))}%`,
                                background: a.efficiency >= 60 ? SPORT_GREEN : a.efficiency >= 35 ? SPORT_AMBER : SPORT_PINK,
                              }}
                            />
                          </div>
                          <span className="font-display text-xs font-bold text-arena-ink">
                            {a.efficiency.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-arena-heading mb-1">Rekap Pasangan</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Siapa yang paling langganan main bareng, dan siapa yang belum pernah sekalipun jadi satu
                tim.
              </p>
              <div className="arena-card-static">
                {data.favoritePartnerships.length === 0 ? (
                  <p className="py-6 text-center text-xs text-arena-dim">
                    Belum ada pasangan yang tercatat main bareng.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-arena-dim">
                      💞 Pasangan Favorit
                    </p>
                    <ul className="space-y-3">
                      {data.favoritePartnerships.map((p, i) => (
                        <li key={p.key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-arena-ink/5 text-[11px] font-bold text-arena-ink">
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-arena-ink">
                              {p.members[0]} & {p.members[1]}
                            </span>
                          </div>
                          <div className="text-right text-xs text-arena-dim">
                            <span className="font-display font-bold text-arena-ink">{p.games}x</span>{" "}
                            main bareng · {Math.round(p.winRate)}% menang
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <p className="mb-3 mt-6 border-t border-arena-ink/10 pt-5 text-xs font-bold uppercase tracking-wide text-arena-dim">
                  👀 Belum Pernah Berpasangan
                </p>
                {data.neverPartnered.length === 0 ? (
                  <p className="py-6 text-center text-xs text-arena-dim">
                    Semua pemain sudah pernah berpasangan satu sama lain.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.neverPartnered.map(([a, b]) => (
                      <span
                        key={pairKey(a, b)}
                        className="rounded-full bg-arena-ink/5 px-3 py-1.5 text-xs font-medium text-arena-dim"
                      >
                        {a} × {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
