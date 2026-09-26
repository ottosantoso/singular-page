import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Medal,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/klasemen")({
  head: () => ({
    meta: [
      { title: "Klasemen Pejuang — OTTOPLAY ARENA" },
      {
        name: "description",
        content:
          "Lihat klasemen pejuang dan skor tiap pertandingan yang tersimpan permanen. Masukkan kode arena untuk membuka hasil pertandinganmu.",
      },
      { property: "og:title", content: "Klasemen Pejuang — OTTOPLAY ARENA" },
      {
        property: "og:description",
        content: "Daftar pejuang, poin, menang, dan skor tiap match tersimpan aman di database.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Klasemen,
});

type MatchRow = {
  id: string;
  round: number;
  court: number;
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  created_at: string;
};

type Standing = {
  name: string;
  points: number;
  games: number;
  wins: number;
};

type PlayerStatRow = {
  player_name: string;
  point_count: number;
  out_count: number;
  foul_count: number;
};

type PlayerReport = {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  pointCount: number;
  outCount: number;
  foulCount: number;
};

function buildStandings(players: string[], matches: MatchRow[]): Standing[] {
  const table = new Map<string, Standing>();
  const ensure = (name: string) => {
    if (!table.has(name)) table.set(name, { name, points: 0, games: 0, wins: 0 });
    return table.get(name)!;
  };
  players.forEach(ensure);
  matches.forEach((m) => {
    const aWins = m.score_a > m.score_b;
    const bWins = m.score_b > m.score_a;
    m.team_a.forEach((p) => {
      const row = ensure(p);
      row.points += m.score_a;
      row.games += 1;
      if (aWins) row.wins += 1;
    });
    m.team_b.forEach((p) => {
      const row = ensure(p);
      row.points += m.score_b;
      row.games += 1;
      if (bWins) row.wins += 1;
    });
  });
  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name),
  );
}

function buildPlayerReport(standings: Standing[], statRows: PlayerStatRow[]): PlayerReport[] {
  const statTable = new Map<string, { point_count: number; out_count: number; foul_count: number }>();
  statRows.forEach((row) => {
    const cur = statTable.get(row.player_name) ?? { point_count: 0, out_count: 0, foul_count: 0 };
    cur.point_count += row.point_count ?? 0;
    cur.out_count += row.out_count ?? 0;
    cur.foul_count += row.foul_count ?? 0;
    statTable.set(row.player_name, cur);
  });

  return standings.map((s) => {
    const stat = statTable.get(s.name) ?? { point_count: 0, out_count: 0, foul_count: 0 };
    return {
      name: s.name,
      games: s.games,
      wins: s.wins,
      winRate: s.games > 0 ? (s.wins / s.games) * 100 : 0,
      pointCount: stat.point_count,
      outCount: stat.out_count,
      foulCount: stat.foul_count,
    };
  });
}

function Klasemen() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#f8fafc",
        useCORS: true,
      });
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `Report-Ottoplay-${code || "Arena"}.png`;
      link.click();
    } catch (err) {
      console.error("Gagal membuat gambar laporan:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("kode");
    let latest = "";
    if (!fromUrl) {
      let latestAt = -1;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.endsWith("_at")) continue;
        // Kode arena & kode klasemen sekarang disatukan (prefix kocokArenaCode_).
        // Tetap cek prefix lama (ottoKlasemenCode_) juga buat kode-kode lama yang
        // sempat kesimpen sebelum unifikasi ini, biar tidak mendadak hilang.
        if (!key.startsWith("kocokArenaCode_") && !key.startsWith("ottoKlasemenCode_")) continue;
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
    if (saved) {
      setInput(saved);
      setCode(saved);
    }
  }, []);


  const query = useQuery({
    queryKey: ["klasemen", code],
    enabled: !!code,
    refetchInterval: 15000,
    queryFn: async () => {
      const [playersRes, matchesRes, statsRes] = await Promise.all([
        supabase.from("arena_players").select("name").eq("arena_code", code),
        supabase
          .from("arena_matches")
          .select("id, round, court, team_a, team_b, score_a, score_b, created_at")
          .eq("arena_code", code)
          .order("round", { ascending: true })
          .order("court", { ascending: true }),
        supabase
          .from("arena_player_stats")
          .select("player_name, point_count, out_count, foul_count")
          .eq("arena_code", code),
      ]);
      if (playersRes.error) throw playersRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (statsRes.error) throw statsRes.error;
      const players = (playersRes.data ?? []).map((p) => p.name);
      const matches = (matchesRes.data ?? []) as MatchRow[];
      const statRows = (statsRes.data ?? []) as PlayerStatRow[];
      const standings = buildStandings(players, matches);
      return { players, matches, standings, playerReport: buildPlayerReport(standings, statRows) };
    },
  });

  const data = query.data;
  const dashboard = data
    ? (() => {
        const totalScore = data.matches.reduce((sum, match) => sum + match.score_a + match.score_b, 0);
        const leader = data.playerReport[0];
        const topScorer = [...data.playerReport].sort(
          (a, b) => b.pointCount - a.pointCount || b.winRate - a.winRate,
        )[0];
        const mostConsistent = [...data.playerReport]
          .filter((player) => player.games > 0)
          .sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0];
        const closestMatch = [...data.matches].sort(
          (a, b) => Math.abs(a.score_a - a.score_b) - Math.abs(b.score_a - b.score_b),
        )[0];
        const maxPoints = Math.max(...data.standings.map((player) => player.points), 1);

        return {
          totalScore,
          averageTeamScore: data.matches.length > 0 ? totalScore / (data.matches.length * 2) : 0,
          leader,
          topScorer,
          mostConsistent,
          closestMatch,
          maxPoints,
        };
      })()
    : null;

  return (
    <main className="arena-home court-lines min-h-screen">
      <div ref={reportRef} className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 bg-card/80 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Beranda
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="/arena.html"
              className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-arena-lime"
            >
              Buka Arena <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <button
              onClick={handleDownloadImage}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 rounded-full bg-arena-lime px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden="true" />
              {isDownloading ? "Memproses..." : "Download Laporan"}
            </button>
          </div>
        </nav>

        <header className="grid items-end gap-6 border-b border-arena-ink/10 pb-7 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-arena-lime/30 bg-arena-lime/10 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-arena-ink">
              <Activity className="size-3.5 text-arena-lime" aria-hidden="true" /> Analisis pertandingan
            </div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-arena-ink sm:text-4xl">
              Dashboard Klasemen
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-arena-dim">
              Pantau peringkat, konsistensi, kontribusi poin, dan riwayat pertandingan dalam satu laporan.
            </p>
          </div>
          {code && (
            <div className="border-l-2 border-arena-lime pl-4 text-left md:text-right">
              <p className="font-display text-[10px] font-bold uppercase tracking-wider text-arena-dim">Kode arena</p>
              <p className="font-display text-xl font-bold text-arena-ink">{code}</p>
              <p className="mt-1 text-xs text-arena-dim">Diperbarui otomatis setiap 15 detik</p>
            </div>
          )}
        </header>

        <form
          className="mt-6 flex max-w-xl flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = input.trim().toUpperCase();
            setCode(c);
            if (c) {
              localStorage.setItem("kocokArenaCode_manual", c);
              localStorage.setItem("kocokArenaCode_manual_at", String(Date.now()));
            }
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Kode arena, cth. AB12CD"
            className="min-w-0 flex-1 rounded-full border border-arena-ink/15 bg-card/85 px-5 py-3 text-sm text-arena-ink outline-none transition placeholder:text-arena-dim focus:border-arena-lime"
          />
          <button type="submit" className="btn-arena !px-7 !py-3 !text-sm">
            Tampilkan
          </button>
        </form>

        {!code && (
          <p className="mt-10 text-sm text-arena-dim">
            Belum ada kode? Mulai pertandingan di arena dulu, kodenya otomatis dibuat.
          </p>
        )}

        {code && query.isLoading && (
          <p className="mt-10 text-sm text-arena-dim">Memuat dashboard analisis…</p>
        )}

        {code && query.isError && (
          <p className="mt-10 text-sm text-arena-dim">
            Gagal memuat data. Coba lagi sebentar.
          </p>
        )}

        {data && dashboard && (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan turnamen">
              {[
                { label: "Pemain aktif", value: data.players.length, icon: Users },
                { label: "Pertandingan", value: data.matches.length, icon: Swords },
                { label: "Total poin", value: dashboard.totalScore, icon: Target },
                { label: "Rata-rata skor", value: dashboard.averageTeamScore.toFixed(1), icon: BarChart3 },
              ].map((metric) => (
                <article key={metric.label} className="rounded-lg border border-arena-ink/10 bg-card/85 p-4 shadow-sm backdrop-blur-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-arena-dim">{metric.label}</p>
                    <metric.icon className="size-4 text-arena-lime" aria-hidden="true" />
                  </div>
                  <p className="mt-3 font-display text-3xl font-bold text-arena-ink">{metric.value}</p>
                </article>
              ))}
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="overflow-hidden rounded-lg bg-arena-ink p-6 shadow-xl sm:p-7">
                {dashboard.leader ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-md bg-background/10 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-background">
                        <Trophy className="size-3.5 text-arena-lime" aria-hidden="true" /> Pemimpin klasemen
                      </span>
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-background/60">
                        {dashboard.leader.games} pertandingan
                      </span>
                    </div>
                    <div className="mt-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-background/55">Performa terbaik saat ini</p>
                        <h2 className="mt-1 font-display text-3xl font-bold text-background">{dashboard.leader.name}</h2>
                        <div className="mt-4 flex items-center gap-5">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-background/50">Win rate</p>
                            <p className="font-display text-xl font-bold text-arena-lime">{dashboard.leader.winRate.toFixed(0)}%</p>
                          </div>
                          <div className="h-9 w-px bg-background/15" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-background/50">Total poin</p>
                            <p className="font-display text-xl font-bold text-background">{data.standings[0]?.points ?? 0}</p>
                          </div>
                          <div className="h-9 w-px bg-background/15" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-background/50">Menang</p>
                            <p className="font-display text-xl font-bold text-background">{dashboard.leader.wins}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex size-20 items-center justify-center rounded-full border border-arena-lime/30 bg-arena-lime/10">
                        <Medal className="size-9 text-arena-lime" aria-hidden="true" />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-background/70">Belum ada performa pemain untuk dianalisis.</p>
                )}
              </div>

              <div className="rounded-lg border border-arena-ink/10 bg-card/85 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-arena-lime" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-arena-ink">Insight cepat</h2>
                </div>
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-arena-dim">Paling konsisten</p>
                    <p className="mt-1 font-display text-lg font-bold text-arena-ink">{dashboard.mostConsistent?.name ?? "—"}</p>
                    <p className="text-xs text-arena-dim">{dashboard.mostConsistent ? `${dashboard.mostConsistent.winRate.toFixed(0)}% kemenangan` : "Belum ada pertandingan"}</p>
                  </div>
                  <div className="border-t border-arena-ink/10 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-arena-dim">Poin individu terbanyak</p>
                    <p className="mt-1 font-display text-lg font-bold text-arena-ink">{dashboard.topScorer?.name ?? "—"}</p>
                    <p className="text-xs text-arena-dim">{dashboard.topScorer?.pointCount ?? 0} poin tercatat</p>
                  </div>
                  <div className="border-t border-arena-ink/10 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-arena-dim">Laga paling ketat</p>
                    <p className="mt-1 font-display text-lg font-bold text-arena-ink">
                      {dashboard.closestMatch ? `${dashboard.closestMatch.score_a} – ${dashboard.closestMatch.score_b}` : "—"}
                    </p>
                    <p className="truncate text-xs text-arena-dim">
                      {dashboard.closestMatch ? `${dashboard.closestMatch.team_a.join(" & ")} vs ${dashboard.closestMatch.team_b.join(" & ")}` : "Belum ada pertandingan"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-lg border border-arena-ink/10 bg-card/90 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-arena-ink/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-arena-lime">Peringkat keseluruhan</p>
                  <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-arena-ink">Klasemen Pejuang</h2>
                </div>
                <p className="text-xs text-arena-dim">Diurutkan berdasarkan poin, kemenangan, lalu nama</p>
              </div>
              {data.standings.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-arena-dim">Belum ada data untuk kode ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="arena-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pejuang</th>
                        <th>Main</th>
                        <th>Menang</th>
                        <th>Win Rate</th>
                        <th>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standings.map((standing, index) => {
                        const report = data.playerReport.find((player) => player.name === standing.name);
                        const winRate = report?.winRate ?? 0;
                        return (
                        <tr key={standing.name} className={index === 0 ? "bg-arena-lime/5" : undefined}>
                          <td>
                            <span className={`inline-flex size-7 items-center justify-center rounded-md font-display text-xs font-bold ${index === 0 ? "bg-arena-lime text-primary-foreground" : "bg-muted text-arena-dim"}`}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </td>
                          <td className="font-semibold text-arena-ink">{standing.name}</td>
                          <td>{standing.games}</td>
                          <td>{standing.wins}</td>
                          <td>
                            <div className="flex min-w-32 items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-arena-lime" style={{ width: `${winRate}%` }} />
                              </div>
                              <span className="w-9 text-right font-display text-xs font-bold text-arena-ink">{winRate.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="font-display text-base font-bold text-arena-ink">{standing.points}</span>
                              <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block">
                                <div className="h-full rounded-full bg-arena-lime" style={{ width: `${(standing.points / dashboard.maxPoints) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-arena-lime">Riwayat arena</p>
                  <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-arena-ink">Skor Pertandingan</h2>
                </div>
                <span className="rounded-full border border-arena-ink/10 bg-card/70 px-3 py-1.5 text-xs font-semibold text-arena-dim">{data.matches.length} laga</span>
              </div>
              {data.matches.length === 0 ? (
                <p className="text-sm text-arena-dim">Belum ada pertandingan tercatat.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.matches.map((match) => (
                    <article key={match.id} className="rounded-lg border border-arena-ink/10 bg-card/85 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-arena-ink/10 pb-3">
                        <span className="font-display text-[10px] font-bold uppercase tracking-wider text-arena-lime">Ronde {match.round}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-arena-dim">Lapangan {match.court}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <p className={`text-sm leading-snug ${match.score_a > match.score_b ? "font-bold text-arena-ink" : "text-arena-dim"}`}>{match.team_a.join(" & ")}</p>
                        <div className="rounded-md bg-arena-ink px-3 py-2 font-display text-lg font-bold text-background">{match.score_a} – {match.score_b}</div>
                        <p className={`text-right text-sm leading-snug ${match.score_b > match.score_a ? "font-bold text-arena-ink" : "text-arena-dim"}`}>{match.team_b.join(" & ")}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-arena-lime">Analisis individual</p>
                <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-arena-ink">Laporan Pemain</h2>
                <p className="mt-1 text-xs text-arena-dim">Poin individu, out, dan kesalahan tersedia untuk pertandingan dengan mode Detail.</p>
              </div>
              {data.playerReport.length === 0 ? (
                <p className="text-sm text-arena-dim">Belum ada data untuk kode ini.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-arena-ink/10 bg-card/90 shadow-sm">
                  <table className="arena-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pejuang</th>
                        <th>Main</th>
                        <th>Menang</th>
                        <th>Win Rate</th>
                        <th>Poin Individu</th>
                        <th>Out</th>
                        <th>Kesalahan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.playerReport.map((player, index) => (
                        <tr key={player.name}>
                          <td className="font-display font-bold text-arena-lime">{String(index + 1).padStart(2, "0")}</td>
                          <td className="font-semibold text-arena-ink">{player.name}</td>
                          <td>{player.games}</td>
                          <td>{player.wins}</td>
                          <td>
                            <div className="flex min-w-32 items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-arena-lime" style={{ width: `${player.winRate}%` }} />
                              </div>
                              <span className="w-9 text-right font-display text-xs font-bold">{player.winRate.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="font-display font-bold">{player.pointCount}</td>
                          <td>{player.outCount}</td>
                          <td>{player.foulCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
