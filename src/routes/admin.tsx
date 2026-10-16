import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, LogOut, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  formatLabel,
  relativeTime,
  sportLabel,
  type GameListItem,
  type GameListResponse,
  type StatusFilter,
} from "@/lib/admin-games";
import { StatusBadge } from "@/components/admin/status-badge";
import { GamePreview } from "@/components/admin/game-preview";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin — OTTOPLAY ARENA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "live", label: "Live" },
  { key: "idle", label: "Tidak aktif" },
  { key: "finished", label: "Selesai" },
];

function AdminPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.session) navigate({ to: "/login" });
  }, [auth.loading, auth.session, navigate]);

  return (
    <main className="arena-home court-lines min-h-screen">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 bg-white/80 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Beranda
          </Link>
          {auth.session && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-arena-dim">
                Masuk sebagai <strong className="text-arena-ink">{auth.username ?? "…"}</strong>
              </span>
              <button
                type="button"
                onClick={() => auth.signOut()}
                className="inline-flex items-center gap-1.5 rounded-full border border-arena-ink/15 bg-white/80 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-destructive hover:text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" /> Keluar
              </button>
            </div>
          )}
        </nav>

        {auth.loading || !auth.session ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-arena-dim">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memeriksa akses…
          </div>
        ) : !auth.isAdmin ? (
          <div className="mx-auto max-w-md rounded-[22px] border border-arena-ink/10 bg-white/85 p-6 text-center">
            <ShieldAlert className="mx-auto size-10 text-amber-600" aria-hidden="true" />
            <h1 className="mt-3 font-display text-lg font-bold uppercase tracking-wider">Akses ditolak</h1>
            <p className="mt-2 text-sm text-arena-dim">
              Panel ini khusus role platform admin. Jika kamu mengelola club atau venue, gunakan Workspace organisasi.
            </p>
            <Link
              to="/workspace"
              className="btn-arena mt-5 inline-flex items-center justify-center"
            >
              Buka Workspace
            </Link>
          </div>
        ) : (
          <Dashboard />
        )}
      </div>
    </main>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin-games", tab, debounced],
    // Daftar disegarkan otomatis tiap 10 detik supaya status live tetap terbaru.
    refetchInterval: 10_000,
    queryFn: async (): Promise<GameListResponse> => {
      const { data, error } = await supabase.rpc(
        "admin_list_games",
        debounced
          ? { p_status: tab, p_search: debounced, p_limit: 200 }
          : { p_status: tab, p_limit: 200 },
      );
      if (error) throw error;
      return data as unknown as GameListResponse;
    },
  });

  const counts = query.data?.counts;
  const items = query.data?.items ?? [];

  return (
    <>
      <header className="border-b border-arena-ink/10 pb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-arena-ink sm:text-4xl">
          Panel <span className="text-arena-lime">Admin</span>
        </h1>
        <p className="mt-2 text-sm text-arena-dim">
          Pantau permainan yang sedang berjalan dan yang sudah selesai. Tampilan hanya baca.
        </p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3" aria-label="Ringkasan">
        <Metric label="Live sekarang" value={counts?.live} tone="live" />
        <Metric label="Tidak aktif" value={counts?.idle} tone="idle" />
        <Metric label="Selesai" value={counts?.finished} tone="finished" />
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filter status" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            const n = counts?.[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-4 py-2 font-display text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "border-arena-lime bg-arena-lime text-primary-foreground"
                    : "border-arena-ink/15 bg-white/80 text-arena-ink hover:border-arena-lime"
                }`}
              >
                {t.label}
                {n !== undefined && <span className="ml-1.5 opacity-80">{n}</span>}
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Cari permainan</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-arena-dim" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode, host, atau pemain"
            className="h-10 w-full rounded-full border border-arena-ink/15 bg-white/85 pl-9 pr-4 text-sm outline-none transition focus:border-arena-lime"
          />
        </label>
      </div>

      <div className="mt-4">
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-arena-dim">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat…
          </div>
        ) : query.isError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Gagal memuat daftar permainan. Coba muat ulang halaman.
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-arena-ink/10 bg-white/70 p-8 text-center text-sm text-arena-dim">
            {debounced ? "Tidak ada permainan yang cocok dengan pencarian." : "Belum ada permainan di kategori ini."}
          </p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {items.map((g) => (
              <li key={g.game_key}>
                <GameRow game={g} onOpen={() => setOpenKey(g.game_key)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <GamePreview gameKey={openKey} onClose={() => setOpenKey(null)} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | undefined; tone: "live" | "idle" | "finished" }) {
  const color = tone === "live" ? "text-emerald-600" : tone === "idle" ? "text-amber-600" : "text-arena-ink";
  return (
    <div className="rounded-2xl border border-arena-ink/10 bg-white/80 p-4">
      <p className="text-xs text-arena-dim">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${color}`}>{value ?? "–"}</p>
    </div>
  );
}

function GameRow({ game, onOpen }: { game: GameListItem; onOpen: () => void }) {
  const finished = game.status === "finished";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-[18px] border border-arena-ink/10 bg-white/85 p-4 text-left shadow-[0_10px_26px_-22px] shadow-arena-ink/60 transition hover:border-arena-lime/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold uppercase tracking-wider text-arena-ink">
            {game.code ?? `#${game.key_short}`}
          </span>
          <StatusBadge status={game.status} />
        </div>
        <p className="mt-1 text-sm text-arena-ink">
          {sportLabel(game.sport)} · {formatLabel(game.mode, game.format)}
        </p>
        <p className="mt-0.5 text-xs text-arena-dim">
          {game.players} pemain
          {game.courts ? ` · ${game.courts} lapangan` : ""}
          {game.round ? ` · ronde ${game.round}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-arena-dim">
          {game.owner ? `Host ${game.owner}` : "Host tidak tercatat"} ·{" "}
          {finished ? (game.auto_closed ? "ditutup otomatis " : "selesai ") : "aktivitas "}
          {relativeTime(finished ? (game.finished_at ?? game.last_activity_at) : game.last_activity_at)}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-arena-dim transition group-hover:translate-x-0.5 group-hover:text-arena-lime" aria-hidden="true" />
    </button>
  );
}
