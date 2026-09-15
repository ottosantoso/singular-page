import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("kode");
    let latest = "";
    if (!fromUrl) {
      let latestAt = -1;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("ottoKlasemenCode_") || key.endsWith("_at")) continue;
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

  return (
    <main className="arena-home court-lines min-h-screen">
      <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-10">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="rounded-full border border-arena-ink/15 bg-white/70 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"
          >
            ← Beranda
          </Link>
          <a
            href="/arena.html"
            className="font-display text-xs font-bold uppercase tracking-wider text-arena-lime"
          >
            Buka Arena
          </a>
        </nav>

        <header className="text-center">
          <span className="text-4xl">🏆</span>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-arena-ink">
            Klasemen Pejuang
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-arena-dim">
            Semua skor pertandingan tersimpan di database, jadi data tetap ada walaupun halaman
            di-refresh. Masukkan kode arena untuk membukanya.
          </p>
        </header>

        <form
          className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const c = input.trim().toUpperCase();
            setCode(c);
            if (c) {
              localStorage.setItem("ottoKlasemenCode_manual", c);
              localStorage.setItem("ottoKlasemenCode_manual_at", String(Date.now()));
            }
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Kode arena, cth. AB12CD"
            className="min-w-0 flex-1 rounded-full border border-arena-ink/15 bg-white/85 px-5 py-3 text-sm text-arena-ink outline-none transition placeholder:text-arena-dim focus:border-arena-lime"
          />
          <button type="submit" className="btn-arena !px-7 !py-3 !text-sm">
            Tampilkan
          </button>
        </form>

        {!code && (
          <p className="mt-10 text-center text-sm text-arena-dim">
            Belum ada kode? Mulai pertandingan di arena dulu, kodenya otomatis dibuat.
          </p>
        )}

        {code && query.isLoading && (
          <p className="mt-10 text-center text-sm text-arena-dim">Memuat klasemen…</p>
        )}

        {code && query.isError && (
          <p className="mt-10 text-center text-sm text-arena-dim">
            Gagal memuat data. Coba lagi sebentar.
          </p>
        )}

        {data && (
          <>
            <section className="arena-card-static mt-10 !p-0 !overflow-hidden">
              <h2 className="text-arena-heading border-b border-arena-ink/10 px-5 py-4">
                Klasemen — {code}
              </h2>
              {data.standings.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-arena-dim">
                  Belum ada data untuk kode ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="arena-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pejuang</th>
                        <th>Main</th>
                        <th>Menang</th>
                        <th>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standings.map((s, i) => (
                        <tr key={s.name}>
                          <td className="font-display font-bold text-arena-lime">{i + 1}</td>
                          <td className="font-medium">{s.name}</td>
                          <td>{s.games}</td>
                          <td>{s.wins}</td>
                          <td className="font-display font-bold">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-arena-heading mb-4">Skor Tiap Pertandingan</h2>
              {data.matches.length === 0 ? (
                <p className="text-sm text-arena-dim">Belum ada pertandingan tercatat.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.matches.map((m) => (
                    <div key={m.id} className="arena-card-static">
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-arena-lime">
                        Ronde {m.round} · Lapangan {m.court}
                      </span>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <span className="flex-1 text-arena-ink">{m.team_a.join(" & ")}</span>
                        <span className="font-display text-lg font-bold text-arena-ink">
                          {m.score_a} – {m.score_b}
                        </span>
                        <span className="flex-1 text-right text-arena-ink">
                          {m.team_b.join(" & ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-arena-heading mb-1">Laporan Pemain</h2>
              <p className="mb-4 text-xs text-arena-dim">
                Kolom Poin Individu/Out/Kesalahan hanya terisi untuk pertandingan yang dicatat pakai mode Detail.
              </p>
              {data.playerReport.length === 0 ? (
                <p className="text-sm text-arena-dim">Belum ada data untuk kode ini.</p>
              ) : (
                <div className="arena-card-static !p-0 !overflow-hidden overflow-x-auto">
                  <table className="arena-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pejuang</th>
                        <th>Main</th>
                        <th>Menang</th>
                        <th>Win Rate %</th>
                        <th>Poin Individu</th>
                        <th>Out</th>
                        <th>Kesalahan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.playerReport.map((p, i) => (
                        <tr key={p.name}>
                          <td className="font-display font-bold text-arena-lime">{i + 1}</td>
                          <td className="font-medium">{p.name}</td>
                          <td>{p.games}</td>
                          <td>{p.wins}</td>
                          <td className="font-display font-bold">{p.winRate.toFixed(0)}%</td>
                          <td>{p.pointCount}</td>
                          <td>{p.outCount}</td>
                          <td>{p.foulCount}</td>
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
