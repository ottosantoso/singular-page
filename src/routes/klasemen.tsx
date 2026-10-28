import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas-pro";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Crown,
  Download,
  ExternalLink,
  Flame,
  Home,
  Image as ImageIcon,
  MoreHorizontal,
  Percent,
  Radio,
  Search,
  Settings,
  Sparkles,
  Swords,
  Target,
  Ticket,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sortStandings } from "@/lib/ranking";
import {
  buildForm,
  buildInsights,
  leaderNarrative as _unusedLeaderNarrative,
  teamLabel,
  type Insight,
  type InsightKind,
  type PlayerLine,
} from "@/lib/klasemen-insights";
import { championNarrative, computeStats, rankChampions, rankMovement } from "@/lib/klasemen-ranking";
import { buildAwards } from "@/lib/klasemen-awards";
import { Avatar } from "@/components/klasemen/avatar";
import { AwardsBoard } from "@/components/klasemen/awards-board";
import { StandingsCard } from "@/components/klasemen/standings-card";
import { MatchBadges, ScheduleDialog } from "@/components/klasemen/schedule-dialog";
import "@/klasemen.css";
import "@/klasemen-awards.css";

void _unusedLeaderNarrative;

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
  status?: string;
};

type Standing = {
  name: string;
  points: number;
  games: number;
  wins: number;
  pointDiff: number;
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
    if (!table.has(name)) table.set(name, { name, points: 0, games: 0, wins: 0, pointDiff: 0 });
    return table.get(name)!;
  };
  players.forEach(ensure);
  matches.forEach((m) => {
    const aWins = m.score_a > m.score_b;
    const bWins = m.score_b > m.score_a;
    m.team_a.forEach((p) => {
      const row = ensure(p);
      row.points += m.score_a;
      row.pointDiff += m.score_a - m.score_b;
      row.games += 1;
      if (aWins) row.wins += 1;
    });
    m.team_b.forEach((p) => {
      const row = ensure(p);
      row.points += m.score_b;
      row.pointDiff += m.score_b - m.score_a;
      row.games += 1;
      if (bWins) row.wins += 1;
    });
  });
  return sortStandings([...table.values()]);
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

type NavKey = "beranda" | "klasemen" | "pertandingan" | "pemain" | "event" | "galeri" | "notifikasi" | "pengaturan";

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: LucideIcon; badge?: string }> = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "klasemen", label: "Klasemen", icon: Trophy },
  { key: "pertandingan", label: "Pertandingan", icon: CalendarDays },
  { key: "pemain", label: "Pemain", icon: User },
  { key: "event", label: "Event & Promo", icon: Ticket, badge: "NEW" },
  { key: "galeri", label: "Galeri", icon: ImageIcon },
  { key: "notifikasi", label: "Notifikasi", icon: Bell },
  { key: "pengaturan", label: "Pengaturan", icon: Settings },
];

const MOBILE_NAV: NavKey[] = ["beranda", "klasemen", "pertandingan", "pemain"];
const MORE_NAV: NavKey[] = ["event", "galeri", "notifikasi", "pengaturan"];

const INSIGHT_STYLE: Record<InsightKind, { icon: LucideIcon; tone: string }> = {
  consistent: { icon: TrendingUp, tone: "kl-tone-green" },
  scorer: { icon: Target, tone: "kl-tone-gold" },
  streak: { icon: Flame, tone: "kl-tone-red" },
  duo: { icon: Users, tone: "kl-tone-blue" },
  closest: { icon: Zap, tone: "kl-tone-gold" },
  blowout: { icon: Swords, tone: "kl-tone-blue" },
};

function signedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function MatchCard({ match }: { match: MatchRow }) {
  return (
    <article className="kl-match">
      <div className="kl-match-top">
        <span className="r" style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}>
          Ronde {match.round}
          <MatchBadges match={match} />
        </span>
        <span className="c">Lapangan {match.court}</span>
      </div>
      <div className="kl-match-body">
        <p className={`kl-match-team ${match.score_a > match.score_b ? "is-win" : ""}`} style={{ margin: 0 }}>
          {teamLabel(match.team_a)}
        </p>
        <div className="kl-score">
          {match.score_a} – {match.score_b}
        </div>
        <p className={`kl-match-team right ${match.score_b > match.score_a ? "is-win" : ""}`} style={{ margin: 0 }}>
          {teamLabel(match.team_b)}
        </p>
      </div>
    </article>
  );
}

function Klasemen() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<"live" | "hasil" | "ronde">("hasil");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRound, setDialogRound] = useState<number | null>(null);
  const [focusName, setFocusName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const notify = (message: string) => setToast(message);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleDownloadImage = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#f4f7fc",
        useCORS: true,
      });
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `Report-Ottoplay-${code || "Arena"}.png`;
      link.click();
    } catch (err) {
      console.error("Gagal membuat gambar laporan:", err);
      window.alert("Gagal membuat gambar, coba lagi.");
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
          .select("id, round, court, team_a, team_b, score_a, score_b, created_at, status")
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
      const allRows = (matchesRes.data ?? []) as MatchRow[];
      // Skor yang masih berjalan (status 'live') ditampilkan, tapi belum dihitung ke klasemen
      // sampai ronde ditutup, supaya skor setengah jalan tidak mengubah peringkat.
      const matches = allRows.filter((m) => m.status !== "live");
      const liveMatches = allRows.filter((m) => m.status === "live");
      const statRows = (statsRes.data ?? []) as PlayerStatRow[];
      const standings = buildStandings(players, matches);
      return { players, matches, liveMatches, standings, playerReport: buildPlayerReport(standings, statRows) };
    },
  });

  const data = query.data;

  const view = useMemo(() => {
    if (!data) return null;
    const allMatches = [...data.liveMatches, ...data.matches];
    const rounds = new Set(allMatches.map((m) => m.round)).size;
    const stats = computeStats(data.players, data.matches);
    const { ordered, minGames } = rankChampions(stats, rounds);
    const reportByName = new Map(data.playerReport.map((r) => [r.name, r] as [string, PlayerReport]));
    const lines: PlayerLine[] = ordered.map((p) => ({
      name: p.name,
      games: p.games,
      wins: p.wins,
      winRate: p.winRate,
      points: p.pointsFor,
      pointDiff: p.pointDiff,
      pointCount: reportByName.get(p.name)?.pointCount ?? 0,
    }));
    const movement = rankMovement(
      stats.map((s) => s.name),
      data.matches,
    );
    const totalScore = data.matches.reduce((sum, m) => sum + m.score_a + m.score_b, 0);
    return {
      ordered,
      minGames,
      reportByName,
      form: buildForm(data.matches),
      movement,
      awards: buildAwards(ordered, data.matches, movement),
      totalScore,
      averageTeamScore: data.matches.length > 0 ? totalScore / (data.matches.length * 2) : 0,
      averageMatchTotal: data.matches.length > 0 ? totalScore / data.matches.length : 0,
      rounds,
      activePlayers: ordered.filter((p) => p.games > 0).length,
      maxPoints: Math.max(...ordered.map((p) => p.pointsFor), 1),
      maxGames: Math.max(...ordered.map((p) => p.games), 1),
      // Streak & duo sudah punya gelar sendiri di Papan Gelar.
      insights: buildInsights(lines, data.matches).filter((i) => i.kind !== "streak" && i.kind !== "duo"),
      narrative: championNarrative(ordered),
      allMatches,
    };
  }, [data]);

  const openSchedule = (round: number | null) => {
    if (!view || view.allMatches.length === 0) {
      notify(view ? "Belum ada pertandingan tercatat." : "Masukkan kode arena dulu untuk melihat pertandingan.");
      return;
    }
    setDialogRound(round);
    setDialogOpen(true);
  };

  const scrollToReport = () => {
    const el = document.getElementById("laporan-pemain");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else notify("Masukkan kode arena dulu untuk melihat laporan pemain.");
  };

  const handleNav = (key: NavKey) => {
    setMoreOpen(false);
    switch (key) {
      case "klasemen":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "pertandingan":
        openSchedule(null);
        break;
      case "pemain":
        scrollToReport();
        break;
      case "event":
        notify("Event & Promo segera hadir 🚀");
        break;
      case "galeri":
        notify("Galeri segera hadir 🚀");
        break;
      case "notifikasi":
        notify("Notifikasi segera hadir 🚀");
        break;
      case "pengaturan":
        notify("Pengaturan segera hadir 🚀");
        break;
      default:
        break;
    }
  };

  const renderNav = (key: NavKey, base: string) => {
    const item = NAV_ITEMS.find((n) => n.key === key)!;
    const Icon = item.icon;
    const content = (
      <>
        <Icon aria-hidden="true" />
        {item.label}
        {item.badge && <span className="kl-new">{item.badge}</span>}
      </>
    );
    if (key === "beranda") {
      return (
        <Link key={key} to="/" className={base}>
          {content}
        </Link>
      );
    }
    return (
      <button
        key={key}
        type="button"
        className={`${base} ${key === "klasemen" ? "is-active" : ""}`}
        aria-current={key === "klasemen" ? "page" : undefined}
        onClick={() => handleNav(key)}
      >
        {content}
      </button>
    );
  };

  const focus = view ? (view.ordered.find((p) => p.name === focusName) ?? view.ordered[0]) : undefined;
  const focusTotal = focus ? focus.wins + focus.losses + focus.draws : 0;
  const winPct = focus && focusTotal > 0 ? (focus.wins / focusTotal) * 100 : 0;
  const drawPct = focus && focusTotal > 0 ? (focus.draws / focusTotal) * 100 : 0;
  const donutBackground =
    focusTotal > 0
      ? `conic-gradient(#1d4ed8 0 ${winPct}%, #94a3b8 ${winPct}% ${winPct + drawPct}%, #e11d2e ${winPct + drawPct}% 100%)`
      : "conic-gradient(#e5eaf3 0 100%)";

  const rankedPlayers = view ? view.ordered.filter((p) => p.rank !== null) : [];
  const podium = rankedPlayers.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  const latestRounds = view
    ? [...new Set(view.allMatches.map((m) => m.round))].sort((a, b) => b - a).slice(0, 4)
    : [];

  return (
    <main className="kl-root">
      <header className="kl-topbar">
        <Link to="/" className="kl-brand" aria-label="OTTOPLAY ARENA — Beranda">
          <img src="/brand/logo-light-128.webp" alt="OTTOPLAY ARENA" />
        </Link>
        <nav className="kl-topnav" aria-label="Menu utama">
          {NAV_ITEMS.slice(0, 5).map((item) => renderNav(item.key, "kl-navlink"))}
        </nav>
        <div className="kl-actions">
          <button
            type="button"
            className="kl-iconbtn"
            aria-label="Cari kode arena"
            onClick={() => document.getElementById("kl-code")?.focus()}
          >
            <Search aria-hidden="true" />
          </button>
          <button type="button" className="kl-iconbtn" aria-label="Notifikasi" onClick={() => handleNav("notifikasi")}>
            <Bell aria-hidden="true" />
            <span className="kl-dot" />
          </button>
          <Link to="/login" className="kl-iconbtn" aria-label="Masuk / akun">
            <User aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="kl-shell">
        <aside className="kl-sidebar" aria-label="Navigasi samping">
          <nav className="kl-side-nav">{NAV_ITEMS.map((item) => renderNav(item.key, "kl-navlink"))}</nav>
          <div className="kl-side-card">
            <p>
              Better Players,
              <br />
              Bigger Community
            </p>
            <span>Rotasi adil, skor tercatat, klasemen real-time.</span>
          </div>
        </aside>

        <div ref={reportRef} className="kl-main">
          <section className="kl-hero">
            <div className="kl-crumb">
              <Link to="/">Beranda</Link>
              <ChevronRight size={12} aria-hidden="true" />
              <span>Klasemen</span>
            </div>
            <div className="kl-chip">
              <Activity aria-hidden="true" /> Analisis &amp; statistik
            </div>
            <h1 className="kl-title">
              Klasemen<span>Pertandingan</span>
            </h1>
            <p className="kl-sub">
              Pantau peringkat, konsistensi, kontribusi poin, dan riwayat pertandingan dalam satu laporan. Lihat siapa
              yang sedang on fire.
            </p>
            <div className="kl-hero-meta">
              {code && (
                <div className="kl-codebadge">
                  <small>Kode arena</small>
                  <b>{code}</b>
                  <i>Diperbarui otomatis setiap 15 detik</i>
                </div>
              )}
              <a href="/arena.html" className="kl-btn">
                Buka Arena <ExternalLink aria-hidden="true" />
              </a>
              <button type="button" onClick={handleDownloadImage} disabled={isDownloading} className="kl-btn kl-btn--primary">
                <Download aria-hidden="true" />
                {isDownloading ? "Memproses..." : "Download Laporan"}
              </button>
            </div>
          </section>

          <form
            className="kl-filter"
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
            <label className="kl-codeinput">
              <Search aria-hidden="true" />
              <input
                id="kl-code"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="Kode arena, cth. AB12CD"
                aria-label="Kode arena"
              />
            </label>
            <div className="kl-pills">
              <button type="button" className="kl-pill" onClick={() => notify("Filter Season segera hadir 🚀")}>
                <CalendarDays aria-hidden="true" /> Semua Season <ChevronDown aria-hidden="true" />
              </button>
              <button type="button" className="kl-pill" onClick={() => notify("Filter Mode segera hadir 🚀")}>
                <Swords aria-hidden="true" /> Semua Mode <ChevronDown aria-hidden="true" />
              </button>
              <button type="button" className="kl-pill" onClick={() => notify("Filter Cabang Olahraga segera hadir 🚀")}>
                <Trophy aria-hidden="true" /> Semua Cabang Olahraga <ChevronDown aria-hidden="true" />
              </button>
            </div>
            <button type="submit" className="kl-btn kl-btn--primary">
              Tampilkan
            </button>
          </form>

          {!code && <p className="kl-note">Belum ada kode? Mulai pertandingan di arena dulu, kodenya otomatis dibuat.</p>}
          {code && query.isLoading && <p className="kl-note">Memuat dashboard analisis…</p>}
          {code && query.isError && <p className="kl-note">Gagal memuat data. Coba lagi sebentar.</p>}

          {data && view && (
            <>
              <section className="kl-stats" aria-label="Ringkasan turnamen">
                {[
                  { label: "Pemain aktif", value: data.players.length, icon: Users, tone: "blue", note: `${view.activePlayers} sudah bermain` },
                  {
                    label: "Pertandingan",
                    value: data.matches.length,
                    icon: Swords,
                    tone: "red",
                    note: data.liveMatches.length > 0 ? `${data.liveMatches.length} sedang live` : `${view.rounds} ronde`,
                  },
                  { label: "Total poin", value: view.totalScore, icon: Target, tone: "gold", note: `${view.averageMatchTotal.toFixed(1)} poin per laga` },
                  { label: "Rata-rata skor", value: view.averageTeamScore.toFixed(1), icon: BarChart3, tone: "green", note: "per tim per laga" },
                ].map((metric) => (
                  <article key={metric.label} className="kl-stat">
                    <span className={`kl-stat-icon kl-stat-icon--${metric.tone}`}>
                      <metric.icon aria-hidden="true" />
                    </span>
                    <div>
                      <small>{metric.label}</small>
                      <b>{metric.value}</b>
                      <em>{metric.note}</em>
                    </div>
                  </article>
                ))}
              </section>

              <section className="kl-showcase">
                <div className="kl-podium">
                  <h2>
                    <Trophy aria-hidden="true" /> Top 3 Klasemen
                  </h2>
                  <p className="kl-pdesc">Juara Umum berdasarkan win rate, bukan sekadar total poin</p>
                  {podium.length === 0 ? (
                    <p className="kl-pdesc" style={{ marginTop: "1.5rem" }}>
                      Belum ada performa pemain untuk dianalisis.
                    </p>
                  ) : (
                    <div className="kl-podium-stage">
                      {podiumOrder.map((idx) => {
                        const p = podium[idx];
                        const place = idx + 1;
                        if (!p) return <div key={idx} className={`kl-step kl-step--${place} kl-step--empty`} />;
                        return (
                          <div key={p.name} className={`kl-step kl-step--${place}`}>
                            {place === 1 && <Crown className="kl-crown" aria-hidden="true" />}
                            <Avatar name={p.name} size={place === 1 ? "xl" : "lg"} />
                            <span className="kl-step-name">{p.name}</span>
                            <span className="kl-step-pts">
                              {p.winRate.toFixed(0)}% · {p.pointsFor} poin
                            </span>
                            <div className="kl-block">{p.rank}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="kl-card kl-top5">
                  <div className="kl-card-title">
                    <Users aria-hidden="true" /> Top 5 Pemain
                  </div>
                  <ol className="kl-top5-list">
                    {view.ordered.slice(0, 5).map((p) => (
                      <li key={p.name}>
                        <span className={`kl-rankbadge ${p.rank !== null && p.rank <= 3 ? `kl-rankbadge--${p.rank}` : ""}`}>
                          {p.rank ?? "–"}
                        </span>
                        <Avatar name={p.name} />
                        <b>{p.name}</b>
                        <span className="kl-pts">
                          {p.winRate.toFixed(0)}%<small className="kl-sub-pts">{p.pointsFor} poin</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="kl-card kl-insight">
                  <div className="kl-card-title">
                    <Sparkles aria-hidden="true" /> Insight Cepat
                  </div>
                  {view.insights.length === 0 ? (
                    <p className="kl-card-sub" style={{ marginTop: "1rem" }}>
                      Belum cukup data. Insight muncul setelah ada pertandingan selesai.
                    </p>
                  ) : (
                    <div className="kl-insight-list">
                      {view.insights.slice(0, 4).map((item: Insight) => {
                        const style = INSIGHT_STYLE[item.kind];
                        const Icon = style.icon;
                        return (
                          <div key={item.kind} className="kl-insight-item">
                            <span className={`kl-insight-icon ${style.tone}`}>
                              <Icon aria-hidden="true" />
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <small>{item.label}</small>
                              <strong>{item.title}</strong>
                              <span>{item.detail}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {view.narrative && <p className="kl-insight-quote">{view.narrative}</p>}
                </div>
              </section>

              <StandingsCard
                ordered={view.ordered}
                form={view.form}
                movement={view.movement}
                maxPoints={view.maxPoints}
                minGames={view.minGames}
              />

              <AwardsBoard awards={view.awards} />

              <section className="kl-bottom">
                <div className="kl-card kl-sched">
                  <div className="kl-card-head">
                    <div>
                      <h2 className="kl-card-title">
                        <CalendarDays aria-hidden="true" /> Jadwal Pertandingan
                      </h2>
                      <p className="kl-card-sub">Laga yang sedang berjalan dan hasil terbaru di arena ini.</p>
                    </div>
                    <button type="button" className="kl-link" onClick={() => openSchedule(null)}>
                      Lihat Semua <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                  <div className="kl-sched-tabs" role="tablist" aria-label="Jenis jadwal">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={scheduleTab === "live"}
                      className={`kl-stab ${scheduleTab === "live" ? "is-active" : ""}`}
                      onClick={() => setScheduleTab("live")}
                    >
                      <Radio size={12} aria-hidden="true" style={{ display: "inline", marginRight: 4 }} />
                      Live{data.liveMatches.length > 0 ? ` (${data.liveMatches.length})` : ""}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={scheduleTab === "hasil"}
                      className={`kl-stab ${scheduleTab === "hasil" ? "is-active" : ""}`}
                      onClick={() => setScheduleTab("hasil")}
                    >
                      Hasil Terbaru
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={scheduleTab === "ronde"}
                      className={`kl-stab ${scheduleTab === "ronde" ? "is-active" : ""}`}
                      onClick={() => setScheduleTab("ronde")}
                    >
                      Ronde
                    </button>
                  </div>
                  <div className="kl-sched-list">
                    {scheduleTab === "live" &&
                      (data.liveMatches.length === 0 ? (
                        <p className="kl-empty">Tidak ada laga yang sedang berjalan.</p>
                      ) : (
                        data.liveMatches.slice(0, 3).map((m) => <MatchCard key={m.id} match={m} />)
                      ))}
                    {scheduleTab === "hasil" &&
                      (data.matches.length === 0 ? (
                        <p className="kl-empty">Belum ada pertandingan tercatat.</p>
                      ) : (
                        [...data.matches]
                          .sort((a, b) => b.round - a.round || b.court - a.court)
                          .slice(0, 3)
                          .map((m) => <MatchCard key={m.id} match={m} />)
                      ))}
                    {scheduleTab === "ronde" &&
                      (latestRounds.length === 0 ? (
                        <p className="kl-empty">Belum ada ronde tercatat.</p>
                      ) : (
                        latestRounds.map((r) => {
                          const inRound = view.allMatches.filter((m) => m.round === r);
                          const pts = inRound.reduce((s, m) => s + m.score_a + m.score_b, 0);
                          return (
                            <button key={r} type="button" className="kl-round-row" onClick={() => openSchedule(r)}>
                              <div>
                                <b>Ronde {r}</b>
                                <small>
                                  {inRound.length} laga · {pts} poin
                                </small>
                              </div>
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                          );
                        })
                      ))}
                  </div>
                </div>

                <div className="kl-card">
                  <div className="kl-card-head">
                    <h2 className="kl-card-title">
                      <Percent aria-hidden="true" /> Distribusi Hasil
                    </h2>
                  </div>
                  {focus && (
                    <>
                      <div className="kl-focus">
                        <span className="kl-card-sub" style={{ margin: 0 }}>
                          Pilih pemain
                        </span>
                        <select
                          className="kl-select"
                          value={focus.name}
                          onChange={(e) => setFocusName(e.target.value)}
                          aria-label="Pilih pemain untuk distribusi hasil"
                        >
                          {view.ordered.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="kl-donut-wrap">
                        <div className="kl-donut" style={{ background: donutBackground }}>
                          <b>{focusTotal > 0 ? `${winPct.toFixed(0)}%` : "—"}</b>
                        </div>
                        <div className="kl-donut-legend">
                          <div>
                            <i style={{ background: "#1d4ed8" }} />
                            <span>Menang</span>
                            <b>{focus.wins}</b>
                          </div>
                          <div>
                            <i style={{ background: "#e11d2e" }} />
                            <span>Kalah</span>
                            <b>{focus.losses}</b>
                          </div>
                          {focus.draws > 0 && (
                            <div>
                              <i style={{ background: "#94a3b8" }} />
                              <span>Seri</span>
                              <b>{focus.draws}</b>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="kl-card">
                  <div className="kl-card-head">
                    <h2 className="kl-card-title">
                      <BarChart3 aria-hidden="true" /> Statistik Performa
                    </h2>
                    {focus && <span className="kl-card-sub" style={{ margin: 0 }}>{focus.name}</span>}
                  </div>
                  {focus && (
                    <div className="kl-perf">
                      {[
                        { label: "Win rate", value: `${focus.winRate.toFixed(0)}%`, pct: focus.winRate, icon: Percent, tone: "kl-tone-blue" },
                        { label: "Total poin terkumpul", value: String(focus.pointsFor), pct: (focus.pointsFor / view.maxPoints) * 100, icon: Target, tone: "kl-tone-red" },
                        { label: "Total pertandingan", value: String(focus.games), pct: (focus.games / view.maxGames) * 100, icon: Swords, tone: "kl-tone-gold" },
                        {
                          label: "Selisih poin",
                          value: signedValue(focus.pointDiff),
                          pct: Math.min(100, (Math.abs(focus.pointDiff) / view.maxPoints) * 100 * 3),
                          icon: TrendingUp,
                          tone: "kl-tone-green",
                        },
                      ].map((row) => (
                        <div key={row.label} className="kl-perf-row">
                          <span className={`kl-perf-icon ${row.tone}`}>
                            <row.icon aria-hidden="true" />
                          </span>
                          <div>
                            <div className="kl-perf-top">
                              <span>{row.label}</span>
                              <b>{row.value}</b>
                            </div>
                            <div className="kl-bar-track">
                              <div className="kl-bar-fill" style={{ width: `${row.pct}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="kl-banner mt-4" aria-label="Semangat bertanding">
                <div>
                  <p>Semangat Bertanding!</p>
                  <span>Sportivitas hari ini, persahabatan selamanya.</span>
                </div>
              </section>

              <section id="laporan-pemain" className="kl-card kl-report">
                <div className="kl-card-head">
                  <div>
                    <h2 className="kl-card-title">
                      <User aria-hidden="true" /> Laporan Pemain
                    </h2>
                    <p className="kl-card-sub">
                      Poin individu, out, dan kesalahan tersedia untuk pertandingan dengan mode Detail.
                    </p>
                  </div>
                </div>
                {view.ordered.length === 0 ? (
                  <p className="kl-empty">Belum ada data untuk kode ini.</p>
                ) : (
                  <div className="kl-scroll">
                    <table className="kl-table" style={{ minWidth: 640 }}>
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
                        {view.ordered.map((player) => {
                          const report = view.reportByName.get(player.name);
                          return (
                            <tr key={player.name}>
                              <td className="kl-num" style={{ color: "#e11d2e" }}>
                                {player.rank !== null ? String(player.rank).padStart(2, "0") : "–"}
                              </td>
                              <td>
                                <div className="kl-player">
                                  <Avatar name={player.name} />
                                  {player.name}
                                </div>
                              </td>
                              <td>{player.games}</td>
                              <td>{player.wins}</td>
                              <td>
                                <div className="kl-bar">
                                  <div className="kl-bar-track">
                                    <div className="kl-bar-fill" style={{ width: `${player.winRate}%` }} />
                                  </div>
                                  <span className="kl-bar-val">{player.winRate.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="kl-num">{report?.pointCount ?? 0}</td>
                              <td>{report?.outCount ?? 0}</td>
                              <td>{report?.foulCount ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {moreOpen && (
        <div className="kl-more" role="menu" aria-label="Menu lainnya">
          {MORE_NAV.map((key) => renderNav(key, "kl-navlink"))}
        </div>
      )}
      <nav className="kl-bottomnav" aria-label="Navigasi bawah">
        {MOBILE_NAV.map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key)!;
          const Icon = item.icon;
          const inner = (
            <>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </>
          );
          return key === "beranda" ? (
            <Link key={key} to="/" className="kl-bn">
              {inner}
            </Link>
          ) : (
            <button
              key={key}
              type="button"
              className={`kl-bn ${key === "klasemen" ? "is-active" : ""}`}
              onClick={() => handleNav(key)}
            >
              {inner}
            </button>
          );
        })}
        <button type="button" className={`kl-bn ${moreOpen ? "is-active" : ""}`} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <MoreHorizontal aria-hidden="true" />
          <span>Lainnya</span>
        </button>
      </nav>

      {toast && (
        <div className="kl-toast" role="status">
          <Sparkles aria-hidden="true" />
          {toast}
        </div>
      )}

      {view && (
        <ScheduleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          matches={view.allMatches}
          initialRound={dialogRound}
        />
      )}
    </main>
  );
}
