import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, LogOut, Plus, Trophy, Users } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/player")({
  head: () => ({ meta: [{ title: "Beranda Pemain - OTTOPLAY" }] }),
  component: PlayerHomePage,
});

type PlayerEvent = {
  event_id: string;
  display_name: string;
  status: string;
  event: {
    id: string;
    name: string;
    sport: string;
    format: string;
    status: string;
    starts_at: string | null;
    public_code: string;
  } | null;
};

function PlayerHomePage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.loading && !auth.session) navigate({ to: "/login", search: { returnTo: "/player" } });
    if (!auth.loading && auth.isAdmin) navigate({ to: "/admin" });
  }, [auth.loading, auth.session, auth.isAdmin, navigate]);

  const events = useQuery({
    queryKey: ["player-events", auth.session?.user.id],
    enabled: Boolean(auth.session && !auth.isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_players")
        .select("event_id, display_name, status, event:events(id, name, sport, format, status, starts_at, public_code)")
        .eq("player_user_id", auth.session!.user.id)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlayerEvent[];
    },
  });

  if (auth.loading || !auth.session) return <LoadingScreen />;

  const joinedEvents = events.data ?? [];
  const activeEvents = joinedEvents.filter((item) => item.event && !["finished", "cancelled"].includes(item.event.status));

  return (
    <main className="arena-home court-lines min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/player" className="flex items-center gap-3 text-arena-ink" aria-label="Beranda pemain">
            <img src="/brand/logo-light-128.webp" alt="" width={52} height={48} className="h-12 w-auto drop-shadow-[0_6px_10px_rgba(11,42,92,.25)]" />
            <span><strong className="block font-display text-lg font-bold tracking-wide">OTTOPLAY</strong><small className="block text-[10px] font-bold uppercase tracking-[0.24em] text-arena-dim">Player hub</small></span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-arena-ink/10 bg-white/75 px-4 py-2 text-sm text-arena-dim sm:inline">{auth.username || auth.session.user.email}</span>
            <button type="button" onClick={() => void auth.signOut().then(() => navigate({ to: "/login" }))} className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 bg-white/80 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-red-400 hover:text-red-600"><LogOut className="size-4" /> Keluar</button>
          </div>
        </header>

        <section className="mt-10 rounded-[30px] border border-arena-ink/10 bg-white/75 p-6 shadow-[0_24px_60px_-38px] shadow-arena-ink/60 backdrop-blur sm:p-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.28em] text-arena-lime">Player hub</p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-arena-ink sm:text-5xl">Semua pertandinganmu, ada di sini.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-arena-dim">Buka event yang kamu ikuti, lihat jadwal dan hasil pertandingan, atau bergabung ke event publik tanpa perlu mengelola club.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-arena-ink px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-white transition hover:bg-arena-lime hover:text-arena-ink"><Trophy className="size-4" /> Cari event publik</Link>
            <a href="/workspace?create=1" className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 bg-white/80 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"><Plus className="size-4" /> Kelola club / venue</a>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat icon={<CalendarDays />} label="Event diikuti" value={joinedEvents.length} />
          <Stat icon={<Trophy />} label="Event aktif" value={activeEvents.length} />
          <Stat icon={<Users />} label="Status akun" value="Viewer" />
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3"><div><p className="font-display text-xs font-bold uppercase tracking-[0.24em] text-arena-lime">My events</p><h2 className="mt-2 font-display text-2xl font-bold text-arena-ink">Event yang kamu ikuti</h2></div></div>
          {events.isLoading ? <p className="mt-5 rounded-2xl border border-arena-ink/10 bg-white/70 p-6 text-sm text-arena-dim">Memuat event...</p> : events.isError ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Daftar event belum dapat dimuat. Link event publik tetap bisa dibuka kapan saja.</p> : joinedEvents.length === 0 ? <EmptyEvents /> : <div className="mt-5 grid gap-4 md:grid-cols-2">{joinedEvents.map((item) => item.event && <EventCard key={`${item.event_id}-${item.display_name}`} playerEvent={item} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function EventCard({ playerEvent }: { playerEvent: PlayerEvent }) {
  const event = playerEvent.event!;
  return <Link to="/e/$publicCode" params={{ publicCode: event.public_code }} className="group rounded-[22px] border border-arena-ink/10 bg-white/85 p-5 transition hover:-translate-y-0.5 hover:border-arena-lime hover:shadow-[0_18px_36px_-28px] hover:shadow-arena-ink/70"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-arena-lime">{event.sport} · {event.status}</span><h3 className="mt-2 font-display text-xl font-bold text-arena-ink">{event.name}</h3><p className="mt-1 text-sm text-arena-dim">Sebagai {playerEvent.display_name} · {event.format}</p></div><ChevronRight className="size-5 text-arena-dim transition group-hover:translate-x-1 group-hover:text-arena-lime" /></div><p className="mt-5 text-xs font-semibold text-arena-dim">{event.starts_at ? new Date(event.starts_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Waktu belum ditentukan"}</p></Link>;
}

function EmptyEvents() { return <div className="mt-5 rounded-[22px] border border-dashed border-arena-ink/15 bg-white/60 p-8 text-center"><Trophy className="mx-auto size-8 text-arena-lime" /><h3 className="mt-3 font-display text-lg font-bold text-arena-ink">Belum ada event</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-arena-dim">Saat kamu mendaftar lewat QR atau shortlink event, event tersebut akan muncul di sini.</p></div>; }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) { return <div className="rounded-[20px] border border-arena-ink/10 bg-white/75 p-5"><div className="flex items-center gap-2 text-arena-lime">{icon}<span className="text-xs font-bold uppercase tracking-wider text-arena-dim">{label}</span></div><p className="mt-3 font-display text-2xl font-bold text-arena-ink">{value}</p></div>; }
function LoadingScreen() { return <main className="arena-home grid min-h-screen place-items-center text-sm text-arena-dim">Memuat player hub...</main>; }
