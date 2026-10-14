import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDateTime,
  formatLabel,
  parseCurrent,
  parseHistory,
  parseLeaderboard,
  parsePlayers,
  parseSitOut,
  relativeTime,
  sportLabel,
  type CourtMatch,
  type GameDetail,
} from "@/lib/admin-games";
import { StatusBadge } from "./status-badge";

const HISTORY_LIMIT = 30;

function MatchRow({ m }: { m: CourtMatch }) {
  const aWins = m.scoreA > m.scoreB;
  const bWins = m.scoreB > m.scoreA;
  return (
    <div className="rounded-2xl border border-arena-ink/10 bg-white/70 p-3">
      <div className="font-display text-[11px] font-bold uppercase tracking-wider text-arena-dim">
        Lapangan {m.court}
        {m.round ? ` · Ronde ${m.round}` : ""}
        {m.finished ? " · selesai" : ""}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={`text-sm ${aWins ? "font-bold text-arena-ink" : "text-arena-dim"}`}>
          {m.teamA.join(" & ")}
        </div>
        <div className="font-display text-xl font-bold tabular-nums text-arena-ink">
          {m.scoreA} <span className="text-arena-dim">–</span> {m.scoreB}
        </div>
        <div className={`text-right text-sm ${bWins ? "font-bold text-arena-ink" : "text-arena-dim"}`}>
          {m.teamB.join(" & ")}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.18em] text-arena-dim">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Preview({ game }: { game: GameDetail }) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const state = game.state ?? {};
  const players = parsePlayers(state);
  const sitOut = parseSitOut(state);
  const current = game.status === "finished" ? [] : parseCurrent(state);
  const leaderboard = parseLeaderboard(state);
  const history = parseHistory(state);
  const shownHistory = showAllHistory ? history : history.slice(0, HISTORY_LIMIT);
  const courts = typeof state.courtsRequested === "number" ? state.courtsRequested : null;
  const round = typeof state.round === "number" ? state.round : null;

  return (
    <>
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-arena-lime/30 bg-arena-lime/10 p-3 text-xs text-arena-ink">
        <Eye className="mt-0.5 size-4 shrink-0 text-arena-lime" aria-hidden="true" />
        <span>Hanya pratinjau. Skor tidak bisa diubah dari halaman admin.</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-arena-dim">Host</dt>
          <dd className="font-semibold">{game.owner ?? "Tidak tercatat"}</dd>
        </div>
        <div>
          <dt className="text-xs text-arena-dim">
            {game.status === "finished" ? (game.auto_closed ? "Ditutup otomatis" : "Selesai") : "Aktivitas terakhir"}
          </dt>
          <dd className="font-semibold">
            {game.status === "finished"
              ? formatDateTime(game.finished_at ?? game.last_activity_at)
              : relativeTime(game.last_activity_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-arena-dim">Pemain</dt>
          <dd className="font-semibold">{players.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-arena-dim">Lapangan · Ronde</dt>
          <dd className="font-semibold">
            {courts ?? "-"} · {round ?? "-"}
          </dd>
        </div>
      </dl>

      {current.length > 0 && (
        <Section title="Lapangan sekarang">
          <div className="grid gap-2">
            {current.map((m) => (
              <MatchRow key={`${m.court}-${m.round}`} m={m} />
            ))}
          </div>
          {sitOut.length > 0 && (
            <p className="mt-2 text-xs text-arena-dim">Istirahat: {sitOut.join(", ")}</p>
          )}
        </Section>
      )}

      {leaderboard.length > 0 && (
        <Section title="Klasemen">
          <div className="overflow-x-auto rounded-2xl border border-arena-ink/10 bg-white/70">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pemain</th>
                  <th>Main</th>
                  <th>Menang</th>
                  <th>Poin</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.name}>
                    <td className="font-display font-bold text-arena-lime">{i + 1}</td>
                    <td className="font-semibold">{r.name}</td>
                    <td>{r.games}</td>
                    <td>{r.wins}</td>
                    <td className="font-bold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {leaderboard.length === 0 && players.length > 0 && (
        <Section title="Pemain">
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <span
                key={p}
                className="rounded-full border border-arena-ink/10 bg-white/70 px-3 py-1 text-xs font-semibold"
              >
                {p}
              </span>
            ))}
          </div>
        </Section>
      )}

      {history.length > 0 && (
        <Section title={`Riwayat pertandingan (${history.length})`}>
          <div className="grid gap-2">
            {shownHistory.map((m, i) => (
              <MatchRow key={`${m.round}-${m.court}-${i}`} m={m} />
            ))}
          </div>
          {history.length > HISTORY_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="mt-3 font-display text-xs font-bold uppercase tracking-wider text-arena-lime hover:underline"
            >
              {showAllHistory ? "Ringkas" : `Tampilkan semua (${history.length})`}
            </button>
          )}
        </Section>
      )}

      {current.length === 0 && history.length === 0 && leaderboard.length === 0 && (
        <p className="mt-6 text-sm text-arena-dim">Belum ada skor yang tersimpan untuk permainan ini.</p>
      )}
    </>
  );
}

export function GamePreview({ gameKey, onClose }: { gameKey: string | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["admin-game", gameKey],
    enabled: !!gameKey,
    // Permainan live disegarkan tiap 5 detik supaya skor terlihat berjalan.
    refetchInterval: (q) => (q.state.data?.status === "live" ? 5000 : false),
    queryFn: async (): Promise<GameDetail> => {
      const { data, error } = await supabase.rpc("admin_get_game", { p_game_key: gameKey as string });
      if (error) throw error;
      return data as unknown as GameDetail;
    },
  });
  const game = query.data;

  return (
    <Sheet open={!!gameKey} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-6 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-display text-xl font-bold uppercase tracking-wider text-arena-ink">
              {game ? (game.code ?? `#${game.key_short}`) : "Pratinjau"}
            </SheetTitle>
            {game && <StatusBadge status={game.status} />}
          </div>
          <SheetDescription>
            {game
              ? `${sportLabel(game.sport)} · ${formatLabel(
                  typeof game.state.mode === "string" ? game.state.mode : null,
                  typeof game.state.format === "string" ? game.state.format : null,
                )}`
              : "Memuat permainan…"}
          </SheetDescription>
        </SheetHeader>

        {query.isLoading && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-arena-dim">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat…
          </div>
        )}
        {query.isError && (
          <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Gagal memuat permainan. Coba lagi sebentar lagi.
          </p>
        )}
        {game && <Preview game={game} />}
      </SheetContent>
    </Sheet>
  );
}
