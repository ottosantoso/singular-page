import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gamepad2,
  House,
  Layers,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
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
import { Pagination } from "@/components/admin/pagination";
import { PlatformUsers } from "@/components/admin/platform-users";
import { PlatformBilling } from "@/components/admin/platform-billing";
import { SPORT_THEMES, SportIcon, sportTheme } from "@/components/sport-icons";
import hero from "@/assets/sports-hero.jpg";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Panel Admin â€” OTTOPLAY ARENA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Section = "games" | "users" | "billing";
type AuthState = ReturnType<typeof useAuth>;

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "live", label: "Live" },
  { key: "idle", label: "Tidak aktif" },
  { key: "finished", label: "Selesai" },
];

const SECTIONS: { key: Section; label: string; icon: LucideIcon }[] = [
  { key: "games", label: "Permainan", icon: Gamepad2 },
  { key: "users", label: "Pengguna", icon: Users },
  { key: "billing", label: "Billing & Quota", icon: CreditCard },
];

function AdminPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [section, setSection] = useState<Section>("games");

  useEffect(() => {
    if (!auth.loading && !auth.session) navigate({ to: "/login" });
  }, [auth.loading, auth.session, navigate]);

  if (auth.loading || !auth.session || !auth.isAdmin) {
    return <GuardView auth={auth} />;
  }

  return (
    <AdminShell auth={auth} section={section} onSection={setSection}>
      <Dashboard section={section} onSection={setSection} />
    </AdminShell>
  );
}

/** Tampilan sebelum akses terbukti: memeriksa sesi, atau menolak non-admin. */
function GuardView({ auth }: { auth: AuthState }) {
  return (
    <main className="arena-home court-lines min-h-screen">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
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
                Masuk sebagai <strong className="text-arena-ink">{auth.username ?? "â€¦"}</strong>
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
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memeriksa aksesâ€¦
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-[22px] border border-arena-ink/10 bg-white/85 p-6 text-center">
            <ShieldAlert className="mx-auto size-10 text-amber-600" aria-hidden="true" />
            <h1 className="mt-3 font-display text-lg font-bold uppercase tracking-wider">Akses ditolak</h1>
            <p className="mt-2 text-sm text-arena-dim">
              Panel ini khusus role platform admin. Jika kamu mengelola club atau venue, gunakan Workspace organisasi.
            </p>
            <Link to="/workspace" className="btn-arena mt-5 inline-flex items-center justify-center">
              Buka Workspace
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function AdminShell({
  auth,
  section,
  onSection,
  children,
}: {
  auth: AuthState;
  section: Section;
  onSection: (next: Section) => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const username = auth.username ?? "â€¦";
  const current = SECTIONS.find((item) => item.key === section);

  return (
    <div className="min-h-screen bg-[#f1f7f6] text-arena-ink lg:pl-64">
      {menuOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-arena-ink/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        aria-label="Navigasi panel admin"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-[linear-gradient(175deg,#0b2742_0%,#0c3a5a_58%,#0a5645_100%)] text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-6">
          <Link to="/" className="flex items-center gap-3" aria-label="OTTOPLAY ARENA, ke beranda">
            <img src="/brand/logo-dark-128.webp" alt="" width={48} height={46} className="h-12 w-auto drop-shadow-[0_6px_12px_rgba(0,0,0,.45)]" />
            <span className="leading-none">
              <span className="block font-display text-xl font-bold tracking-wide">
                OTTO<span className="text-lime-300">PLAY</span>
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.42em] text-white/60">Arena</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMenuOpen(false)}
            className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-3" aria-label="Menu utama">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Panel admin</p>
          <ul className="space-y-1">
            {SECTIONS.map((item) => {
              const active = section === item.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      onSection(item.key);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                      active
                        ? "bg-arena-lime text-white shadow-lg shadow-black/25"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <item.icon className="size-5" aria-hidden="true" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Pintasan</p>
          <ul className="space-y-1">
            <li>
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <House className="size-5" aria-hidden="true" /> Beranda
              </Link>
            </li>
            <li>
              <Link
                to="/workspace"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <Building2 className="size-5" aria-hidden="true" /> Workspace organisasi
              </Link>
            </li>
          </ul>
        </nav>

        <div className="px-5 pb-5 pt-4">
          <p className="text-center text-[11px] italic text-white/50">Play â€¢ Score â€¢ Connect</p>
          <div className="mt-3 grid grid-cols-4 gap-1 border-t border-white/10 pt-3">
            {(["padel", "badminton", "tennis", "tenismeja"] as const).map((key) => (
              <div key={key} className="flex flex-col items-center gap-1 text-white/60">
                <SportIcon sport={key} className="size-6" />
                <span className="text-[9px] font-medium">{SPORT_THEMES[key].label.replace("Tenis Meja", "Table Tennis")}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-arena-ink/10 bg-white/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl border border-arena-ink/10 bg-white text-arena-ink lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <p className="hidden text-sm text-arena-dim sm:block">
              Panel admin <span className="mx-1 text-arena-ink/30">/</span>
              <strong className="text-arena-ink">{current?.label}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-arena-dim sm:inline-flex">
              Masuk sebagai <strong className="text-arena-ink">{username}</strong>
              <ShieldCheck className="size-4 text-arena-lime" aria-label="Platform admin" />
            </span>
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-full border border-arena-ink/15 bg-white px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-destructive hover:text-destructive"
            >
              <LogOut className="size-4" aria-hidden="true" /> Keluar
            </button>
            <span
              className="grid size-10 place-items-center rounded-full bg-arena-ink font-display text-xs font-bold uppercase text-white"
              aria-hidden="true"
            >
              {username.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2) || "A"}
            </span>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function Dashboard({ section, onSection }: { section: Section; onSection: (next: Section) => void }) {
  const [tab, setTab] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Filter atau pencarian berubah -> kembali ke halaman pertama.
  useEffect(() => {
    setPage(1);
  }, [tab, debounced]);

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
  // Daftar disegarkan tiap 10 detik: jaga halaman tetap valid kalau jumlah data menyusut.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function goToPage(next: number) {
    setPage(next);
    // Kembali ke awal daftar supaya tidak perlu scroll naik setelah pindah halaman.
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 80) listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] border border-white bg-[#e8f3fb] shadow-[0_26px_60px_-42px_rgba(17,45,72,.55)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-no-repeat"
          style={{ backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "72% 38%" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/0 sm:via-white/55" />
        <div className="relative px-5 py-7 sm:px-9 sm:py-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-arena-dim">Panel admin</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-arena-ink sm:text-4xl">
            Kelola Akses <span className="text-arena-lime">Platform</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-arena-dim">
            Kelola akses platform, pengguna, dan pantau permainan dari satu panel.
          </p>
          <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Bagian panel admin">
            {SECTIONS.map((item) => {
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSection(item.key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 font-display text-sm font-bold tracking-wide transition ${
                    active
                      ? "border-arena-lime bg-arena-lime text-white shadow-lg shadow-arena-lime/30"
                      : "border-arena-ink/10 bg-white/90 text-arena-ink hover:border-arena-lime"
                  }`}
                >
                  <item.icon className="size-4" aria-hidden="true" /> {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {section === "users" ? (
        <PlatformUsers />
      ) : section === "billing" ? (
        <PlatformBilling />
      ) : (
        <>
          <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Ringkasan">
            <StatCard
              label="Live sekarang"
              value={counts?.live}
              hint={counts && counts.live === 0 ? "Tidak ada pertandingan aktif" : "Pertandingan berlangsung"}
              icon={Radio}
              tone="bg-emerald-100 text-emerald-600"
              active={tab === "live"}
              onClick={() => setTab("live")}
            />
            <StatCard
              label="Tidak aktif"
              value={counts?.idle}
              hint="Sesi tanpa aktivitas baru"
              icon={Clock}
              tone="bg-amber-100 text-amber-600"
              active={tab === "idle"}
              onClick={() => setTab("idle")}
            />
            <StatCard
              label="Selesai"
              value={counts?.finished}
              hint="Sesi yang sudah ditutup"
              icon={CheckCircle2}
              tone="bg-sky-100 text-sky-600"
              active={tab === "finished"}
              onClick={() => setTab("finished")}
            />
            <StatCard
              label="Total permainan"
              value={counts?.all}
              hint="Semua sesi tercatat"
              icon={Layers}
              tone="bg-violet-100 text-violet-600"
              active={tab === "all"}
              onClick={() => setTab("all")}
            />
          </section>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                        ? "border-arena-lime bg-arena-lime text-white shadow-md shadow-arena-lime/25"
                        : "border-arena-ink/10 bg-white text-arena-ink hover:border-arena-lime"
                    }`}
                  >
                    {t.label}
                    {n !== undefined && <span className="ml-1.5 opacity-80">{n}</span>}
                  </button>
                );
              })}
            </div>
            <label className="relative block sm:w-80">
              <span className="sr-only">Cari permainan</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-arena-dim" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode, host, atau pemain"
                className="h-11 w-full rounded-full border border-arena-ink/10 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-arena-lime focus:ring-2 focus:ring-arena-lime/20"
              />
            </label>
          </div>

          <div ref={listRef} className="mt-4 scroll-mt-20">
            {query.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-arena-dim">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuatâ€¦
              </div>
            ) : query.isError ? (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Gagal memuat daftar permainan. Coba muat ulang halaman.
              </p>
            ) : items.length === 0 ? (
              <p className="rounded-2xl border border-arena-ink/10 bg-white/80 p-8 text-center text-sm text-arena-dim">
                {debounced ? "Tidak ada permainan yang cocok dengan pencarian." : "Belum ada permainan di kategori ini."}
              </p>
            ) : (
              <>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {pageItems.map((g) => (
                    <li key={g.game_key}>
                      <GameRow game={g} onOpen={() => setOpenKey(g.game_key)} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  total={items.length}
                  page={currentPage}
                  pageSize={pageSize}
                  noun="permainan"
                  onPage={goToPage}
                  onPageSize={(next) => {
                    setPageSize(next);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>

          <GamePreview gameKey={openKey} onClose={() => setOpenKey(null)} />
        </>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: LucideIcon;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-[0_14px_30px_-26px] shadow-arena-ink/60 transition hover:border-arena-lime/60 ${
        active ? "border-arena-lime ring-2 ring-arena-lime/15" : "border-arena-ink/10"
      }`}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-arena-dim">{label}</span>
        <span className="block font-display text-3xl font-bold tabular-nums leading-tight text-arena-ink">{value ?? "â€“"}</span>
        <span className="block truncate text-[11px] text-arena-dim">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-arena-dim transition group-hover:translate-x-0.5 group-hover:text-arena-lime" aria-hidden="true" />
    </button>
  );
}

function GameRow({ game, onOpen }: { game: GameListItem; onOpen: () => void }) {
  const finished = game.status === "finished";
  const theme = sportTheme(game.sport);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-[20px] border border-arena-ink/10 bg-white p-4 text-left shadow-[0_12px_28px_-24px] shadow-arena-ink/60 transition hover:border-arena-lime/60"
    >
      <span
        className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-md ${theme.tile} ${theme.tileText}`}
        aria-hidden="true"
      >
        <SportIcon sport={game.sport} className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold uppercase tracking-wider text-arena-ink">
            {game.code ?? `#${game.key_short}`}
          </span>
          <StatusBadge status={game.status} />
        </div>
        <p className="mt-1 text-sm font-semibold text-arena-ink">
          {sportLabel(game.sport)} Â· {formatLabel(game.mode, game.format)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-arena-dim">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" /> {game.players} pemain
          </span>
          {(game.courts || game.round) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {[game.courts ? `${game.courts} lapangan` : "", game.round ? `ronde ${game.round}` : ""].filter(Boolean).join(" Â· ")}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-arena-dim">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {game.owner ? `Host ${game.owner}` : "Host tidak tercatat"} Â·{" "}
            {finished ? (game.auto_closed ? "ditutup otomatis " : "selesai ") : "aktivitas "}
            {relativeTime(finished ? (game.finished_at ?? game.last_activity_at) : game.last_activity_at)}
          </span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-arena-dim transition group-hover:translate-x-0.5 group-hover:text-arena-lime" aria-hidden="true" />
    </button>
  );
}
