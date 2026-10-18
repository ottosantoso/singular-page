import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  Copy,
  Download,
  LayoutDashboard,
  LogOut,
  Mail,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  Share2,
  Sparkles,
  Trophy,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loginIdToEmail, useAuth } from "@/lib/auth";
import { canOrganizationRole } from "@/lib/permissions";

export const Route = createFileRoute("/workspace")({ component: WorkspacePage });

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  subscription_plan: string;
};
type Membership = { organization_id: string; role_code: string; status: string };
type EventRow = {
  id: string;
  name: string;
  sport: string;
  format: string;
  status: string;
  starts_at: string | null;
  public_code: string;
  max_players: number | null;
};
type MemberRow = { user_id: string; role_code: string; status: string; name: string };

async function copyToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback below handles browsers or contexts that deny Clipboard API access.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function getPublicAppUrl() {
  const configuredUrl = import.meta.env["VITE_PUBLIC_APP_URL"]?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Owner",
  organization_admin: "Admin",
  event_manager: "Event Manager",
  scorer: "Scorer",
  coach: "Coach",
  player: "Player",
  viewer: "Viewer",
};
const EDITABLE_ROLES = [
  "organization_admin",
  "event_manager",
  "scorer",
  "coach",
  "player",
  "viewer",
];

function WorkspacePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState(
    () => localStorage.getItem("ottoplay.activeOrganization") ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.session) navigate({ to: "/login" });
  }, [auth.loading, auth.session, navigate]);

  async function loadOrganizations() {
    if (!auth.session) return;
    setLoading(true);
    setError("");
    const membershipRes = await supabase
      .from("organization_members")
      .select("organization_id, role_code, status")
      .eq("user_id", auth.session.user.id)
      .eq("status", "active");
    if (membershipRes.error) {
      setError(membershipRes.error.message);
      setLoading(false);
      return;
    }
    const membershipsData = (membershipRes.data ?? []) as Membership[];
    setMemberships(membershipsData);
    const ids = membershipsData.map((item) => item.organization_id);
    if (!ids.length) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    const orgRes = await supabase
      .from("organizations")
      .select("id, name, slug, logo_url, primary_color, subscription_plan")
      .in("id", ids)
      .order("name");
    if (orgRes.error) setError(orgRes.error.message);
    setOrganizations((orgRes.data ?? []) as Organization[]);
    const nextId = ids.includes(activeId) ? activeId : (orgRes.data?.[0]?.id ?? "");
    setActiveId(nextId);
    if (nextId) localStorage.setItem("ottoplay.activeOrganization", nextId);
    setLoading(false);
  }

  useEffect(() => {
    if (auth.session) void loadOrganizations();
    // The session identity is the only dependency needed for this initial workspace load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session?.user.id]);

  useEffect(() => {
    if (!auth.loading && auth.session && !loading && memberships.length === 0) {
      const createMode = new URLSearchParams(window.location.search).get("create") === "1";
      if (!createMode) navigate({ to: "/player" });
    }
  }, [auth.loading, auth.session, loading, memberships.length, navigate]);

  function selectOrganization(id: string) {
    setActiveId(id);
    localStorage.setItem("ottoplay.activeOrganization", id);
  }

  if (auth.loading || loading) return <LoadingScreen />;
  if (!auth.session) return null;

  const active = organizations.find((org) => org.id === activeId) ?? null;
  const activeMembership = memberships.find((member) => member.organization_id === activeId);

  return (
    <main className="arena-home min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/workspace" className="flex items-center gap-3 text-arena-ink" aria-label="Kembali ke workspace">
            <span className="grid size-11 place-items-center rounded-2xl bg-arena-ink text-sm font-black text-white">
              OP
            </span>
            <span>
              <strong className="block font-display text-lg font-bold tracking-wide">
                OTTOPLAY
              </strong>
              <small className="block text-[10px] font-bold uppercase tracking-[0.24em] text-arena-dim">
                Workspace
              </small>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-arena-ink/10 bg-white/70 px-3 py-2 text-xs text-arena-dim sm:inline-flex">
              {auth.username ?? auth.session.user.email}
            </span>
            <button
              onClick={() => void auth.signOut().then(() => navigate({ to: "/login" }))}
              className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-arena-ink"
            >
              <LogOut className="size-4" /> Keluar
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!active ? (
          <EmptyWorkspace onCreate={() => setShowCreate(true)} />
        ) : (
          <WorkspaceShell
            organization={active}
            membership={activeMembership}
            organizations={organizations}
            onSelect={selectOrganization}
            onCreateOrganization={() => setShowCreate(true)}
            userId={auth.session.user.id}
          />
        )}
      </div>
      {showCreate && (
        <CreateOrganizationDialog
          onClose={() => setShowCreate(false)}
          onCreated={loadOrganizations}
        />
      )}
    </main>
  );
}

function WorkspaceShell({
  organization,
  membership,
  organizations,
  onSelect,
  onCreateOrganization,
  userId,
}: {
  organization: Organization;
  membership?: Membership | undefined;
  organizations: Organization[];
  onSelect: (id: string) => void;
  onCreateOrganization: () => void;
  userId: string;
}) {
  const [tab, setTab] = useState<"overview" | "events" | "members" | "settings">("overview");
  const canManage = canOrganizationRole(membership?.role_code, "members.manage");
  const canManageEvents = canOrganizationRole(membership?.role_code, "events.manage");
  return (
    <>
      <section className="mt-8 rounded-[28px] bg-arena-ink p-6 text-white shadow-2xl shadow-arena-ink/20 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-lime-300">
              Active workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              {organization.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/65">
              Kelola event, anggota, venue, dan pertandingan live dari satu ruang kerja.
            </p>
          </div>
          <WorkspacePicker
            organizations={organizations}
            activeId={organization.id}
            onSelect={onSelect}
            onCreate={onCreateOrganization}
          />
        </div>
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Workspace navigation">
          {(
            [
              ["overview", "Overview", LayoutDashboard],
              ["events", "Events", CalendarDays],
              ["members", "Members", Users],
              ["settings", "Settings", Building2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${tab === key ? "bg-lime-300 text-arena-ink" : "bg-white/10 text-white/75 hover:bg-white/15"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
      </section>
      {tab === "overview" && (
        <Overview organization={organization} onEvents={() => setTab("events")} />
      )}
      {tab === "events" && (
        <EventsPanel organization={organization} userId={userId} canManage={canManageEvents} />
      )}
      {tab === "members" && <MembersPanel organization={organization} canManage={canManage} />}
      {tab === "settings" && <SettingsPanel organization={organization} canManage={canManage} />}
    </>
  );
}

function WorkspacePicker({
  organizations,
  activeId,
  onSelect,
  onCreate,
}: {
  organizations: Organization[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <label className="flex min-w-[230px] items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm">
      <Building2 className="size-4 text-lime-300" />
      <select
        value={activeId}
        onChange={(event) => onSelect(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none [&>option]:text-arena-ink"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onCreate}
        title="Buat workspace baru"
        className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <Plus className="size-4" />
      </button>
    </label>
  );
}

function Overview({
  organization,
  onEvents,
}: {
  organization: Organization;
  onEvents: () => void;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    supabase
      .from("events")
      .select("id, name, sport, format, status, starts_at, public_code, max_players")
      .eq("organization_id", organization.id)
      .order("starts_at", { ascending: true })
      .limit(5)
      .then(({ data }) => setEvents((data ?? []) as EventRow[]));
  }, [organization.id]);
  const live = events.filter((event) => event.status === "live").length;
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="arena-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">
              Command center
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">Hari ini di arena</h2>
          </div>
          <Trophy className="size-7 text-arena-lime" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Event aktif" value={events.length} />
          <Metric label="Live sekarang" value={live} />
          <Metric label="Plan" value={organization.subscription_plan.toUpperCase()} />
        </div>
        <div className="mt-6 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Event terbaru</h3>
          <button
            onClick={onEvents}
            className="text-xs font-bold uppercase tracking-wider text-arena-lime"
          >
            Lihat semua
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {events.length ? (
            events.map((event) => <EventLine key={event.id} event={event} organizationId={organization.id} />)
          ) : (
            <p className="rounded-2xl bg-slate-50 p-5 text-sm text-arena-dim">
              Belum ada event. Buat event pertama untuk mulai menghubungkan Arena.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-[26px] bg-gradient-to-br from-lime-200 via-cyan-100 to-white p-6">
        <Sparkles className="size-7 text-arena-ink" />
        <h2 className="mt-5 font-display text-2xl font-bold text-arena-ink">
          Run every game better.
        </h2>
        <p className="mt-2 text-sm leading-6 text-arena-ink/70">
          Buat event, undang tim, lalu buka Arena saat pemain sudah siap. Skor dan klasemen tetap
          bekerja seperti sebelumnya.
        </p>
        <a
          href={events[0] ? `/arena.html?organization_id=${encodeURIComponent(organization.id)}&event_id=${encodeURIComponent(events[0].id)}&sport=${encodeURIComponent(events[0].sport)}&public_code=${encodeURIComponent(events[0].public_code)}&return_to=${encodeURIComponent("/workspace")}` : "#events"}
          onClick={(event) => { if (!events[0]) { event.preventDefault(); onEvents(); } }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-arena-ink px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
        >
          Buka Arena <ArrowRight className="size-4" />
        </a>
      </div>
    </section>
  );
}

function EventsPanel({
  organization,
  userId,
  canManage,
}: {
  organization: Organization;
  userId: string;
  canManage: boolean;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const { data } = await supabase
      .from("events")
      .select("id, name, sport, format, status, starts_at, public_code, max_players")
      .eq("organization_id", organization.id)
      .order("starts_at", { ascending: true });
    setEvents((data ?? []) as EventRow[]);
  }
  useEffect(() => {
    void load();
  }, [organization.id]);
  return (
    <section className="mt-6 arena-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">
            Competition pipeline
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Events</h2>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="btn-arena gap-2 px-5 py-3 text-xs">
            <Plus className="size-4" /> Buat event
          </button>
        )}
      </div>
      {message && (
        <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            organizationId={organization.id}
            canManage={canManage}
            onChanged={load}
          />
        ))}
        {!events.length && (
          <p className="rounded-2xl bg-slate-50 p-6 text-sm text-arena-dim">
            Belum ada event di workspace ini.
          </p>
        )}
      </div>
      {showForm && (
        <CreateEventDialog
          organizationId={organization.id}
          userId={userId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            setMessage("Event berhasil dibuat.");
            void load();
          }}
        />
      )}
    </section>
  );
}

function EventCard({
  event,
  organizationId,
  canManage,
  onChanged,
}: {
  event: EventRow;
  organizationId: string;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const arenaUrl = `/arena.html?organization_id=${encodeURIComponent(organizationId)}&event_id=${encodeURIComponent(event.id)}&sport=${encodeURIComponent(event.sport)}&public_code=${encodeURIComponent(event.public_code)}&return_to=${encodeURIComponent("/workspace")}`;
  const publicUrl = `/e/${encodeURIComponent(event.public_code)}`;
  const fullPublicUrl = `${getPublicAppUrl()}${publicUrl}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(fullPublicUrl)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Ikut ${event.name}: ${fullPublicUrl}`)}`;

  async function deleteEvent() {
    if (!window.confirm(`Hapus event “${event.name}”? Peserta dan staff event juga akan ikut dihapus.`)) return;
    setDeleting(true);
    const result = await supabase.from("events").delete().eq("id", event.id);
    setDeleting(false);
    if (result.error) {
      window.alert(result.error.message);
      return;
    }
    await onChanged();
  }

  async function copyPublicLink() {
    const copied = await copyToClipboard(fullPublicUrl);
    setCopyMessage(copied ? "Link tersalin" : "Gagal menyalin");
    window.setTimeout(() => setCopyMessage(""), 2200);
  }

  return (
    <>
      <article className="rounded-2xl border border-arena-ink/10 bg-white/75 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-arena-lime/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-arena-ink">
              {event.status}
            </span>
            <h3 className="mt-3 font-display text-xl font-bold">{event.name}</h3>
            <p className="mt-1 text-sm text-arena-dim">
              {event.sport} · {event.format}
              {event.starts_at
                ? ` · ${new Date(event.starts_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
            </p>
          </div>
          <CalendarDays className="size-6 text-arena-lime" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={arenaUrl} className="inline-flex items-center gap-2 rounded-full bg-arena-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
            <Trophy className="size-4" /> Buka Arena
          </a>
          <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-arena-lime px-4 py-2 text-xs font-bold uppercase tracking-wider text-arena-ink">
            <QrCode className="size-4" /> Undang pemain
          </button>
          <button type="button" onClick={() => void copyPublicLink()} className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-arena-ink">
            <Copy className="size-4" /> {copyMessage || "Salin link"}
          </button>
          {canManage && (
            <>
              <button type="button" onClick={() => setPlayersOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-arena-ink">
                <Users className="size-4" /> Peserta
              </button>
              <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-arena-ink/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-arena-ink">
                <Pencil className="size-4" /> Edit
              </button>
              <button type="button" onClick={() => void deleteEvent()} disabled={deleting} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-700 disabled:opacity-50">
                <Trash2 className="size-4" /> {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </>
          )}
        </div>
      </article>
      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-arena-ink/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[min(720px,calc(100vh-2rem))] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">Event invitation</p>
                <h2 className="mt-2 font-display text-2xl font-bold">Undang pemain</h2>
                <p className="mt-1 text-sm text-arena-dim">{event.name}</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-full p-2 text-arena-dim hover:bg-slate-100" aria-label="Tutup">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
              <img src={qrUrl} alt={`QR Code ${event.name}`} className="mx-auto size-44 rounded-2xl border border-arena-ink/10 p-2" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-arena-dim">Link publik</p>
                <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 text-sm font-semibold text-arena-ink">{fullPublicUrl}</p>
                <p className="mt-3 text-xs leading-5 text-arena-dim">Teman bisa daftar tanpa membuat akun. Link yang sama dipakai untuk melihat hasil pertandingan.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => void copyPublicLink()} className="inline-flex items-center justify-center gap-2 rounded-full border border-arena-ink/15 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-arena-ink">
                <Copy className="size-4" /> {copyMessage || "Salin"}
              </button>
              <a href={qrUrl} download={`${event.public_code}-qr.png`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-arena-ink/15 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-arena-ink">
                <Download className="size-4" /> Download QR
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-arena-lime px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-arena-ink">
                <Share2 className="size-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
      {editOpen && (
        <CreateEventDialog
          organizationId={organizationId}
          userId=""
          event={event}
          onClose={() => setEditOpen(false)}
          onCreated={async () => {
            setEditOpen(false);
            await onChanged();
          }}
        />
      )}
      {playersOpen && <ParticipantsDialog event={event} onClose={() => setPlayersOpen(false)} />}
    </>
  );
}

type EventPlayerRow = {
  display_name: string;
  status: string;
  registered_at: string;
};

function ParticipantsDialog({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const [players, setPlayers] = useState<EventPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await supabase
      .from("event_players")
      .select("display_name, status, registered_at")
      .eq("event_id", event.id)
      .neq("status", "withdrawn")
      .order("registered_at", { ascending: true });
    if (result.error) setError(result.error.message);
    setPlayers((result.data ?? []) as EventPlayerRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [event.id]);

  async function withdraw(displayName: string) {
    if (!window.confirm(`Keluarkan ${displayName} dari event? Data tetap disimpan sebagai riwayat.`)) return;
    const result = await supabase
      .from("event_players")
      .update({ status: "withdrawn" })
      .eq("event_id", event.id)
      .eq("display_name", displayName);
    if (result.error) setError(result.error.message);
    else await load();
  }

  return (
    <DialogFrame title={`Peserta · ${event.name}`} onClose={onClose}>
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-arena-dim">Memuat peserta...</p>
      ) : players.length ? (
        <div className="space-y-2">
          {players.map((player) => (
            <div key={player.display_name} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="font-semibold text-arena-ink">{player.display_name}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-arena-dim">{player.status}</p>
              </div>
              <button type="button" onClick={() => void withdraw(player.display_name)} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-700">
                <Trash2 className="size-4" /> Keluarkan
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-arena-dim">Belum ada peserta aktif.</p>
      )}
    </DialogFrame>
  );
}
function MembersPanel({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("player");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const { data } = await supabase
      .from("organization_members")
      .select("user_id, role_code, status")
      .eq("organization_id", organization.id)
      .order("joined_at");
    const rows = data ?? [];
    const ids = rows.map((row) => row.user_id);
    const profiles = ids.length
      ? await supabase.from("profiles").select("id, username, display_name").in("id", ids)
      : { data: [] };
    const names = new Map(
      (profiles.data ?? []).map((profile) => [
        profile.id,
        profile.display_name || profile.username,
      ]),
    );
    setMembers(
      rows.map((row) => ({
        ...row,
        name: names.get(row.user_id) || row.user_id.slice(0, 8),
      })) as MemberRow[],
    );
  }
  useEffect(() => {
    void load();
  }, [organization.id]);
  async function updateRole(userId: string, roleCode: string) {
    const { error } = await supabase
      .from("organization_members")
      .update({ role_code: roleCode })
      .eq("organization_id", organization.id)
      .eq("user_id", userId);
    if (error) setMessage(error.message);
    else {
      setMessage("Role diperbarui.");
      void load();
    }
  }
  async function createInvite(event: FormEvent) {
    event.preventDefault();
    const token = crypto.randomUUID();
    const tokenBytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", tokenBytes);
    const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const invitedBy = (await supabase.auth.getUser()).data.user?.id;
    if (!invitedBy) {
      setMessage("Sesi login tidak ditemukan. Masuk ulang lalu coba lagi.");
      return;
    }
    const result = await supabase.from("organization_invites").insert({
      organization_id: organization.id,
      email: inviteEmail.trim() || null,
      role_code: inviteRole,
      token_hash: tokenHash,
      invited_by: invitedBy,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (result.error) setMessage(result.error.message);
    else {
      const link = `${getPublicAppUrl()}/invite?token=${encodeURIComponent(token)}`;
      setInviteLink(link);
      setMessage("Undangan dibuat. Kirim link ini ke member.");
      setInviteEmail("");
    }
  }
  async function copyInviteLink() {
    const copied = await copyToClipboard(inviteLink);
    setInviteCopyMessage(copied ? "Tersalin" : "Gagal");
    window.setTimeout(() => setInviteCopyMessage(""), 2200);
  }
  return (
    <section className="mt-6 arena-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">
            People & permissions
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Members</h2>
        </div>
        <Users className="size-7 text-arena-lime" />
      </div>
      {message && (
        <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm text-arena-dim">{message}</p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-arena-dim">
            <tr>
              <th className="pb-3">Member</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.user_id} className="border-t border-arena-ink/10">
                <td className="py-4 font-semibold">{member.name}</td>
                <td className="py-4 text-arena-dim">{member.status}</td>
                <td className="py-4">
                  {canManage && member.role_code !== "organization_owner" ? (
                    <select
                      value={member.role_code}
                      onChange={(event) => void updateRole(member.user_id, event.target.value)}
                      className="rounded-full border border-arena-ink/15 bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="organization_admin">Admin</option>
                      {EDITABLE_ROLES.filter((role) => role !== "organization_admin").map(
                        (role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <span className="rounded-full bg-arena-lime/15 px-3 py-2 text-xs font-bold">
                      {ROLE_LABELS[member.role_code] || member.role_code}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && (
        <form onSubmit={createInvite} className="mt-7 rounded-2xl bg-slate-50 p-4">
          <p className="font-display font-bold">Undang member</p>
          {inviteLink && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">Link undangan berlaku 7 hari</p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="min-w-0 flex-1 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void copyInviteLink()}
                  className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                >
                  {inviteCopyMessage || "Salin"}
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="email@club.com"
              className="rounded-full border border-arena-ink/15 bg-white px-4 py-3 text-sm outline-none"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
              className="rounded-full border border-arena-ink/15 bg-white px-4 py-3 text-sm"
            >
              <option value="player">Player</option>
              <option value="scorer">Scorer</option>
              <option value="event_manager">Event Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-arena-ink px-5 py-3 text-xs font-bold uppercase tracking-wider text-white">
              <Mail className="size-4" /> Simpan undangan
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function SettingsPanel({
  organization,
  canManage,
}: {
  organization: Organization;
  canManage: boolean;
}) {
  return (
    <section className="mt-6 arena-card">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">
        Workspace identity
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold">Settings</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-arena-dim">Workspace</p>
          <p className="mt-1 font-semibold">{organization.name}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-arena-dim">Slug</p>
          <p className="mt-1 font-mono text-sm">{organization.slug}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-arena-dim">Subscription</p>
          <p className="mt-1 font-semibold uppercase">{organization.subscription_plan}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs text-arena-dim">Permissions</p>
          <p className="mt-1 font-semibold">
            {canManage ? "Can manage workspace" : "Member access"}
          </p>
        </div>
      </div>
    </section>
  );
}

function CreateOrganizationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await supabase.rpc("create_organization", {
      p_name: name.trim(),
      p_slug: slug.trim().toLowerCase(),
    });
    if (result.error) setError(result.error.message);
    else {
      await onCreated();
      onClose();
    }
    setSaving(false);
  }
  return (
    <DialogFrame title="Buat workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama organisasi">
          <input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slug)
                setSlug(
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, ""),
                );
            }}
            placeholder="Jakarta Padel Club"
            className="auth-input"
          />
        </Field>
        <Field label="Slug publik">
          <input
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="jakarta-padel-club"
            className="auth-input"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="btn-arena w-full">
          {saving ? "Menyimpan..." : "Buat workspace"}
        </button>
      </form>
    </DialogFrame>
  );
}

function CreateEventDialog({
  organizationId,
  userId,
  event: editingEvent,
  onClose,
  onCreated,
}: {
  organizationId: string;
  userId: string;
  event?: EventRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(editingEvent?.name ?? "");
  const [sport, setSport] = useState(editingEvent?.sport ?? "padel");
  const [format, setFormat] = useState(editingEvent?.format ?? "americano");
  const [startsAt, setStartsAt] = useState(
    editingEvent?.starts_at ? toDateTimeLocal(editingEvent.starts_at) : "",
  );
  const [status, setStatus] = useState(editingEvent?.status ?? "registration");
  const [maxPlayers, setMaxPlayers] = useState(editingEvent?.max_players?.toString() ?? "24");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const values = {
      name: name.trim(),
      sport,
      format,
      status,
      max_players: maxPlayers ? Number(maxPlayers) : null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    };
    const result = editingEvent
      ? await supabase.from("events").update(values).eq("id", editingEvent.id)
      : await supabase
        .from("events")
        .insert({
        organization_id: organizationId,
        created_by: userId,
          ...values,
        });
    if (result.error) setError(result.error.message);
    else onCreated();
  }
  return (
    <DialogFrame title={editingEvent ? "Edit event" : "Buat event"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nama event">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Saturday Americano"
            className="auth-input"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Olahraga">
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="auth-input"
            >
              <option value="padel">Padel</option>
              <option value="badminton">Badminton</option>
              <option value="tennis">Tenis</option>
              <option value="tenismeja">Tenis Meja</option>
            </select>
          </Field>
          <Field label="Format">
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="auth-input"
            >
              <option value="americano">Americano</option>
              <option value="mexicano">Mexicano</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status awal">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="auth-input">
              <option value="registration">Registration - siap dibagikan</option>
              <option value="draft">Draft - belum dipublikasikan</option>
            </select>
          </Field>
          <Field label="Maksimal pemain">
            <input type="number" min="4" max="200" value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} className="auth-input" />
          </Field>
        </div>
        <Field label="Mulai (opsional)">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="auth-input"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-arena w-full">{editingEvent ? "Simpan perubahan" : "Buat event"}</button>
      </form>
    </DialogFrame>
  );
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DialogFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-arena-ink/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-arena-dim hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-arena-dim">
        {label}
      </span>
      {children}
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs text-arena-dim">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
function EventLine({ event, organizationId }: { event: EventRow; organizationId: string }) {
  const arenaUrl = `/arena.html?organization_id=${encodeURIComponent(organizationId)}&event_id=${encodeURIComponent(event.id)}&sport=${encodeURIComponent(event.sport)}&public_code=${encodeURIComponent(event.public_code)}&return_to=${encodeURIComponent("/workspace")}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-arena-ink/10 bg-white/75 p-4">
      <div>
        <p className="font-semibold">{event.name}</p>
        <p className="mt-1 text-xs text-arena-dim">
          {event.sport} · {event.format}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
          {event.status}
        </span>
        <a href={arenaUrl} className="rounded-full bg-arena-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">Arena</a>
      </div>
    </div>
  );
}
function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="mx-auto mt-20 max-w-xl text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-[26px] bg-arena-ink text-white">
        <Building2 className="size-9" />
      </div>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-arena-lime">
        First workspace
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">Buat rumah untuk timmu.</h1>
      <p className="mt-3 text-sm leading-6 text-arena-dim">
        Workspace menyimpan event, member, venue, dan seluruh sesi Arena milik organisasi.
      </p>
      <button onClick={onCreate} className="btn-arena mt-7 gap-2">
        <Plus className="size-4" /> Buat workspace
      </button>
    </section>
  );
}
function LoadingScreen() {
  return (
    <main className="arena-home grid min-h-screen place-items-center">
      <div className="text-center">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-arena-lime/20 border-t-arena-lime" />
        <p className="mt-4 text-sm text-arena-dim">Menyiapkan workspace...</p>
      </div>
    </main>
  );
}
