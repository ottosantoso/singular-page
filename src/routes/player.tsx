import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, ChevronRight, LogOut, Plus, Trophy, Users } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  eventStatusLabel,
  participantStatusLabel,
  planLabel,
  roleLabel,
  subscriptionStatusLabel,
} from "@/lib/labels";
import { filterActiveEvents } from "@/lib/player-events";

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
type WorkspaceStatus = {
  organizationId: string;
  name: string;
  roleCode: string;
  planCode: string;
  subscriptionStatus: string | null;
};
type PlayerDashboard = {
  profile: { display_name?: string; username?: string };
  summary: { events: number; matches: number; wins: number; losses: number; draws: number };
  sports: Array<{ sport: string; matches: number; wins: number; losses: number; draws: number }>;
  events: Array<{ event_name: string; sport: string; matches: number; wins: number; losses: number; draws: number; starts_at: string | null }>;
  matches: Array<{ event_name: string; sport: string; round: number; court: number; score_a: number; score_b: number; result: string; played_at: string }>;
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
  const dashboard = useQuery({
    queryKey: ["player-dashboard", auth.session?.user.id],
    enabled: Boolean(auth.session && !auth.isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_player_dashboard");
      if (error) throw error;
      return ((data?.[0] ?? { profile: {}, summary: { events: 0, matches: 0, wins: 0, losses: 0, draws: 0 }, sports: [], events: [], matches: [] }) as unknown) as PlayerDashboard;
    },
  });

  const workspaces = useQuery({
    queryKey: ["player-workspaces", auth.session?.user.id],
    enabled: Boolean(auth.session && !auth.isAdmin),
    queryFn: async (): Promise<WorkspaceStatus[]> => {
      const userId = auth.session!.user.id;
      const memberRes = await supabase
        .from("organization_members")
        .select("organization_id, role_code")
        .eq("user_id", userId)
        .eq("status", "active");
      if (memberRes.error) throw memberRes.error;
      const members = memberRes.data ?? [];
      if (members.length === 0) return [];
      const orgRes = await supabase
        .from("organizations")
        .select("id, name, subscription_plan")
        .in(
          "id",
          members.map((member) => member.organization_id),
        )
        .order("name");
      if (orgRes.error) throw orgRes.error;
      return Promise.all(
        (orgRes.data ?? []).map(async (org) => {
          // Sumber kebenaran paket: organization_subscriptions (lewat RPC kuota).
          // Bila RPC gagal, jatuh ke kolom organizations.subscription_plan.
          const quota = await supabase.rpc("get_organization_quota", {
            p_organization_id: org.id,
          });
          const info = (quota.error ? null : quota.data) as {
            plan_code?: string;
            status?: string;
          } | null;
          return {
            organizationId: org.id,
            name: org.name,
            roleCode: members.find((member) => member.organization_id === org.id)?.role_code ?? "",
            planCode: info?.plan_code ?? org.subscription_plan,
            subscriptionStatus: info?.status ?? null,
          };
        }),
      );
    },
  });

  if (auth.loading || !auth.session) return <LoadingScreen />;

  const joinedEvents = events.data ?? [];
  const activeEvents = filterActiveEvents(joinedEvents);
  const stats = dashboard.data?.summary ?? { events: 0, matches: 0, wins: 0, losses: 0, draws: 0 };

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
          <Stat icon={<CalendarDays />} label="Event diikuti" value={stats.events || joinedEvents.length} />
          <Stat icon={<Trophy />} label="Menang" value={stats.wins} />
          <Stat icon={<Users />} label="Main" value={stats.matches} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[22px] border border-arena-ink/10 bg-white/80 p-5 shadow-[0_18px_36px_-30px] shadow-arena-ink/60 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-arena-lime">Player identity</p><h2 className="mt-2 font-display text-2xl font-bold text-arena-ink">Statistik lintas olahraga</h2></div><BarChart3 className="size-6 text-arena-lime" /></div>
            <div className="mt-5 grid gap-3">{dashboard.data?.sports.length ? dashboard.data.sports.map((sport) => <div key={sport.sport} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><b className="uppercase text-arena-ink">{sport.sport}</b><span className="text-xs font-bold text-arena-dim">{sport.matches} match</span></div><p className="mt-2 text-sm text-arena-dim">{sport.wins} menang · {sport.losses} kalah · {sport.draws} seri</p></div>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-arena-dim">Statistik muncul setelah hasil pertandingan tersimpan.</p>}</div>
          </div>
          <div className="rounded-[22px] border border-arena-ink/10 bg-arena-ink p-5 text-white shadow-[0_18px_36px_-30px] shadow-arena-ink/80 sm:p-6"><p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-lime-300">Record</p><h2 className="mt-2 font-display text-2xl font-bold">Ringkasan karier</h2><div className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-white/10 p-3"><b className="block text-2xl text-lime-300">{stats.wins}</b><small className="text-[10px] uppercase tracking-wider text-white/60">Menang</small></div><div className="rounded-2xl bg-white/10 p-3"><b className="block text-2xl">{stats.losses}</b><small className="text-[10px] uppercase tracking-wider text-white/60">Kalah</small></div><div className="rounded-2xl bg-white/10 p-3"><b className="block text-2xl">{stats.draws}</b><small className="text-[10px] uppercase tracking-wider text-white/60">Seri</small></div></div><p className="mt-5 text-sm leading-6 text-white/65">Hasil dihitung dari Arena yang sudah terhubung ke event dan akunmu.</p></div>
        </section>

        <AccountStatusCard
          username={auth.username || auth.session.user.email || ""}
          activeEvents={activeEvents.length}
          joinedEvents={joinedEvents.length}
          eventsLoading={events.isLoading}
          loading={workspaces.isLoading}
          failed={workspaces.isError}
          workspaces={workspaces.data ?? []}
        />

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
  return <Link to="/e/$publicCode" params={{ publicCode: event.public_code }} className="group rounded-[22px] border border-arena-ink/10 bg-white/85 p-5 transition hover:-translate-y-0.5 hover:border-arena-lime hover:shadow-[0_18px_36px_-28px] hover:shadow-arena-ink/70"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-arena-lime">{event.sport} · {eventStatusLabel(event.status)}</span><h3 className="mt-2 font-display text-xl font-bold text-arena-ink">{event.name}</h3><p className="mt-1 text-sm text-arena-dim">Sebagai {playerEvent.display_name} · {event.format} · {participantStatusLabel(playerEvent.status)}</p></div><ChevronRight className="size-5 text-arena-dim transition group-hover:translate-x-1 group-hover:text-arena-lime" /></div><p className="mt-5 text-xs font-semibold text-arena-dim">{event.starts_at ? new Date(event.starts_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Waktu belum ditentukan"}</p></Link>;
}

function AccountStatusCard({
  username,
  activeEvents,
  joinedEvents,
  eventsLoading,
  loading,
  failed,
  workspaces,
}: {
  username: string;
  activeEvents: number;
  joinedEvents: number;
  eventsLoading: boolean;
  loading: boolean;
  failed: boolean;
  workspaces: WorkspaceStatus[];
}) {
  return (
    <section
      aria-labelledby="account-status-title"
      className="mt-6 rounded-[22px] border border-arena-ink/10 bg-white/80 p-5 shadow-[0_18px_36px_-30px] shadow-arena-ink/60 sm:p-6"
    >
      <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-arena-lime">
        Akun
      </p>
      <h2
        id="account-status-title"
        className="mt-2 font-display text-2xl font-bold text-arena-ink"
      >
        Status akun
      </h2>
      <p className="mt-2 break-words text-sm text-arena-dim">
        {username}
        {eventsLoading
          ? ""
          : ` · ${activeEvents} event aktif dari ${joinedEvents} event diikuti`}
      </p>
      <div className="mt-5">
        {loading ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-arena-dim">Memuat workspace...</p>
        ) : failed ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Daftar workspace belum dapat dimuat. Coba muat ulang halaman ini.
          </p>
        ) : workspaces.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-arena-dim">
            Kamu belum tergabung di workspace mana pun. Akunmu berstatus {roleLabel("player")}.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((workspace) => (
              <li key={workspace.organizationId} className="rounded-2xl bg-slate-50 p-4">
                <b className="block break-words font-display text-lg text-arena-ink">
                  {workspace.name}
                </b>
                <p className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-arena-ink px-3 py-1 text-white">
                    {roleLabel(workspace.roleCode)}
                  </span>
                  <span className="rounded-full border border-arena-ink/15 bg-white px-3 py-1 text-arena-ink">
                    Paket {planLabel(workspace.planCode)}
                  </span>
                  {workspace.subscriptionStatus ? (
                    <span className="rounded-full border border-arena-ink/15 bg-white px-3 py-1 text-arena-dim">
                      {subscriptionStatusLabel(workspace.subscriptionStatus)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyEvents() { return <div className="mt-5 rounded-[22px] border border-dashed border-arena-ink/15 bg-white/60 p-8 text-center"><Trophy className="mx-auto size-8 text-arena-lime" /><h3 className="mt-3 font-display text-lg font-bold text-arena-ink">Belum ada event</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-arena-dim">Saat kamu mendaftar lewat QR atau shortlink event, event tersebut akan muncul di sini.</p></div>; }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) { return <div className="rounded-[20px] border border-arena-ink/10 bg-white/75 p-5"><div className="flex items-center gap-2 text-arena-lime">{icon}<span className="text-xs font-bold uppercase tracking-wider text-arena-dim">{label}</span></div><p className="mt-3 font-display text-2xl font-bold text-arena-ink">{value}</p></div>; }
function LoadingScreen() { return <main className="arena-home grid min-h-screen place-items-center text-sm text-arena-dim">Memuat player hub...</main>; }
