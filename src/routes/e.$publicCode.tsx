import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Flame,
  Loader2,
  Mail,
  MapPin,
  Mars,
  Medal,
  Phone,
  Share2,
  Sprout,
  Star,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  Venus,
  VenusAndMars,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SportIcon, sportTheme } from "@/components/sport-icons";
import equipment from "@/assets/sport-equipment.jpg";

export const Route = createFileRoute("/e/$publicCode")({
  head: () => ({
    meta: [{ title: "Event publik - OTTOPLAY" }],
  }),
  component: PublicEventPage,
});

type PublicEvent = {
  id: string;
  name: string;
  public_code: string;
  sport: string;
  format: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  organization_name: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  max_players: number | null;
};

type PublicPlayer = {
  display_name: string;
  gender: string | null;
  tier: string | null;
  status: string;
  seed: number | null;
  registered_at: string;
  checked_in_at: string | null;
};

type PublicPayload = {
  event: PublicEvent | null;
  players: PublicPlayer[];
  me: { display_name: string; tier: string | null; gender?: string | null; status: string } | null;
  matches: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};

type PublicMatch = {
  id?: number | string;
  round?: number;
  court?: number;
  team_a?: string[];
  team_b?: string[];
  score_a?: number | null;
  score_b?: number | null;
  winner?: string | null;
  status?: string;
  played_at?: string;
};

type PublicStanding = { name: string; points: number; games: number; wins: number };

function buildPublicStandings(players: PublicPlayer[], matches: PublicMatch[]) {
  const table = new Map<string, PublicStanding>();
  const ensure = (name: string) => {
    if (!table.has(name)) table.set(name, { name, points: 0, games: 0, wins: 0 });
    return table.get(name)!;
  };
  players.forEach((player) => ensure(player.display_name));
  matches
    .filter((match) => match.status !== "live" && match.score_a != null && match.score_b != null)
    .forEach((match) => {
      const scoreA = Number(match.score_a ?? 0);
      const scoreB = Number(match.score_b ?? 0);
      const aWon = scoreA > scoreB;
      const bWon = scoreB > scoreA;
      (match.team_a ?? []).forEach((name) => {
        const row = ensure(name);
        row.points += scoreA;
        row.games += 1;
        if (aWon) row.wins += 1;
      });
      (match.team_b ?? []).forEach((name) => {
        const row = ensure(name);
        row.points += scoreB;
        row.games += 1;
        if (bWon) row.wins += 1;
      });
    });
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

function publicMatchWon(match: PublicMatch, name: string) {
  const scoreA = Number(match.score_a ?? 0);
  const scoreB = Number(match.score_b ?? 0);
  if (scoreA === scoreB || (match.score_a == null || match.score_b == null)) return null;
  return (match.team_a ?? []).includes(name) ? scoreA > scoreB : scoreB > scoreA;
}

type TierMeta = { key: string; label: string; note: string; icon: LucideIcon };

const TIERS: TierMeta[] = [
  { key: "newbie", label: "Newbie", note: "Baru mulai main", icon: Sprout },
  { key: "beginner", label: "Beginner", note: "Paham dasar permainan", icon: Medal },
  { key: "intermediate", label: "Intermediate", note: "Sudah konsisten", icon: Trophy },
  { key: "advanced", label: "Advanced", note: "Teknik & taktik bagus", icon: Flame },
  { key: "pro", label: "Pro", note: "Level kompetitif", icon: Crown },
  { key: "elite", label: "Elite", note: "Level tertinggi", icon: Star },
];

const GENDERS: { value: string; label: string; icon: LucideIcon; tone: string }[] = [
  { value: "male", label: "Laki-laki", icon: Mars, tone: "pe-tone--male" },
  { value: "female", label: "Perempuan", icon: Venus, tone: "pe-tone--female" },
];

const FORMAT_LABELS: Record<string, string> = {
  americano: "Americano",
  mexicano: "Mexicano",
  super: "Super Mexicano",
  yingyang: "Ying Yang",
  custom: "Custom",
};

function tierMeta(value: string | null | undefined): TierMeta {
  return (
    TIERS.find((tier) => tier.key === value) ?? {
      key: "intermediate",
      label: "Intermediate",
      note: "Sudah konsisten",
      icon: Trophy,
    }
  );
}

function formatLabel(value: string) {
  return FORMAT_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

function playerStatusLabel(value: string) {
  if (value === "registered") return "Terdaftar";
  if (value === "checked_in") return "Check-in";
  if (value === "waitlisted") return "Waitlist";
  return value;
}

function eventStatusLabel(value: string) {
  if (value === "registration") return "Pendaftaran dibuka";
  if (value === "live") return "Event berjalan";
  return "Event selesai";
}

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "?";
  const second = parts[1];
  return (second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2)).toUpperCase();
}

function PublicEventPage() {
  const { publicCode } = Route.useParams();
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState("");
  const [tier, setTier] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const storageKey = `ottoplay.event-registration.${publicCode}`;

  async function loadEvent() {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    const { data, error: loadError } = await supabase.rpc("get_public_event", {
      p_public_code: publicCode,
      ...(token !== null ? { p_registration_token: token } : {}),
    });
    const row = data?.[0] as PublicPayload | undefined;
    if (loadError || !row?.event) {
      setError(loadError?.message || "Event tidak ditemukan atau belum dibuka untuk publik.");
      setPayload(null);
    } else {
      setPayload(row);
      setError("");
      setShowForm(!row.me && row.event.status === "registration");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadEvent();
  }, [publicCode]);

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!payload?.event || payload.event.status !== "registration") {
      setShowForm(false);
      setMessage("Pendaftaran event sudah ditutup.");
      return;
    }
    if (!gender) {
      setMessage("Pilih jenis kelamin dulu.");
      return;
    }
    if (!tier) {
      setMessage("Pilih tier permainan dulu.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    const registrationArgs = {
      p_public_code: publicCode,
      p_display_name: displayName,
      p_gender: gender,
      ...(phone ? { p_phone: phone } : {}),
      ...(email ? { p_email: email } : {}),
      p_consent_to_show_name: consent,
      p_tier: tier,
    };
    let registrationResult = await supabase.rpc("register_event_guest", registrationArgs);
    if (registrationResult.error?.message?.includes("p_gender")) {
      // Database lama belum punya parameter p_gender: kirim ulang tanpa jenis kelamin.
      const legacyArgs = {
        p_public_code: publicCode,
        p_display_name: displayName,
        ...(phone ? { p_phone: phone } : {}),
        ...(email ? { p_email: email } : {}),
        p_consent_to_show_name: consent,
        p_tier: tier,
      };
      registrationResult = await supabase.rpc(
        "register_event_guest",
        legacyArgs as unknown as typeof registrationArgs,
      );
    }
    const { data, error: registerError } = registrationResult;
    if (registerError || !data?.[0]) {
      setMessage(registerError?.message || "Pendaftaran belum berhasil.");
    } else {
      localStorage.setItem(storageKey, data[0].registration_token);
      setDisplayName("");
      setGender("");
      setPhone("");
      setEmail("");
      setMessage(
        data[0].registration_status === "waitlisted"
          ? "Kapasitas penuh. Kamu masuk waitlist dan akan dipromosikan jika ada slot."
          : "Kamu sudah terdaftar. Link ini bisa dipakai lagi untuk melihat hasil pertandingan.",
      );
      await loadEvent();
    }
    setSubmitting(false);
  }

  async function checkIn() {
    const token = localStorage.getItem(storageKey);
    if (!token) return;
    setCheckingIn(true);
    const { error: checkInError } = await supabase.rpc("check_in_event_guest", {
      p_public_code: publicCode,
      p_registration_token: token,
    });
    setMessage(checkInError?.message || "Check-in berhasil. Sampai jumpa di arena!");
    if (!checkInError) await loadEvent();
    setCheckingIn(false);
  }

  async function claimGuest() {
    const token = localStorage.getItem(storageKey);
    const user = (await supabase.auth.getUser()).data.user;
    if (!token || !user) {
      setMessage("Login dulu untuk menyimpan event ini ke Player Hub.");
      return;
    }
    setClaiming(true);
    const { error: claimError } = await supabase.rpc("claim_event_guest", {
      p_public_code: publicCode,
      p_registration_token: token,
    });
    setMessage(claimError?.message || "Event berhasil dikaitkan ke akunmu.");
    if (!claimError) await loadEvent();
    setClaiming(false);
  }

  async function cancelRegistration() {
    if (!window.confirm("Batalkan pendaftaran kamu dari event ini?")) return;
    const token = localStorage.getItem(storageKey);
    if (!token) return;
    setCancelling(true);
    const { data, error: cancelError } = await supabase.rpc("withdraw_event_guest", {
      p_public_code: publicCode,
      p_registration_token: token,
    });
    if (cancelError || !data) {
      setMessage(cancelError?.message || "Pendaftaran belum dapat dibatalkan.");
    } else {
      localStorage.removeItem(storageKey);
      setMessage("Pendaftaran dibatalkan. Kamu bisa mendaftar lagi jika masih tersedia.");
      await loadEvent();
    }
    setCancelling(false);
  }

  function openForm() {
    setShowForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function copyLink() {
    navigator.clipboard
      ?.writeText(shareUrl)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/e/${publicCode}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Ikut event ${payload?.event?.name || "OTTOPLAY"}: ${shareUrl}`)}`;
  const matchRows = (payload?.matches ?? []) as PublicMatch[];

  if (loading && !payload) {
    return (
      <main className="arena-home court-lines grid min-h-screen place-items-center px-4">
        <Loader2 className="size-10 animate-spin text-arena-lime" />
      </main>
    );
  }

  if (error || !payload?.event) {
    return (
      <main className="arena-home court-lines grid min-h-screen place-items-center px-4 py-10">
        <section className="w-full max-w-lg rounded-[28px] border border-arena-ink/10 bg-white/90 p-8 text-center shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-500">Event publik</p>
          <h1 className="mt-3 font-display text-3xl font-bold">Link belum tersedia</h1>
          <p className="mt-3 text-sm leading-6 text-arena-dim">{error}</p>
          <Link to="/" className="btn-arena mt-6 inline-flex gap-2">
            <ArrowLeft className="size-4" /> Kembali ke beranda
          </Link>
        </section>
      </main>
    );
  }

  const ev = payload.event;
  const theme = sportTheme(ev.sport);
  const brandPrimary = ev.primary_color || theme.accent;
  const brandSecondary = ev.secondary_color || theme.to;
  const registrationOpen = ev.status === "registration";
  const playerCount = payload.players.length;
  const activePlayerCount = payload.players.filter((player) => player.status !== "waitlisted").length;
  const waitlistCount = payload.players.filter((player) => player.status === "waitlisted").length;
  const finalMatches = matchRows.filter(
    (match) => match.status !== "live" && match.score_a != null && match.score_b != null,
  );
  const standings = buildPublicStandings(payload.players, matchRows);
  const meName = payload.me?.display_name ?? "";
  const myMatches = finalMatches.filter(
    (match) => (match.team_a ?? []).includes(meName) || (match.team_b ?? []).includes(meName),
  );
  const myWins = myMatches.filter((match) => publicMatchWon(match, meName) === true).length;
  const myPoints = myMatches.reduce((sum, match) => {
    return sum + ((match.team_a ?? []).includes(meName) ? Number(match.score_a ?? 0) : Number(match.score_b ?? 0));
  }, 0);
  const myPartners = new Map<string, { games: number; wins: number }>();
  const myRivals = new Map<string, { games: number; wins: number }>();
  myMatches.forEach((match) => {
    const mineIsA = (match.team_a ?? []).includes(meName);
    const partners = (mineIsA ? match.team_a : match.team_b).filter((name) => name !== meName);
    const rivals = mineIsA ? match.team_b : match.team_a;
    const won = publicMatchWon(match, meName) === true;
    partners.forEach((name) => {
      const row = myPartners.get(name) ?? { games: 0, wins: 0 };
      row.games += 1;
      if (won) row.wins += 1;
      myPartners.set(name, row);
    });
    rivals.forEach((name) => {
      const row = myRivals.get(name) ?? { games: 0, wins: 0 };
      row.games += 1;
      if (won) row.wins += 1;
      myRivals.set(name, row);
    });
  });
  const favoritePartner = [...myPartners.entries()].sort((a, b) => b[1].games - a[1].games)[0];
  const strongestRival = [...myRivals.entries()].sort((a, b) => b[1].games - a[1].games)[0];
  const myStandingIndex = standings.findIndex((standing) => standing.name === meName);
  const fill = ev.max_players ? Math.min(100, Math.round((playerCount / ev.max_players) * 100)) : null;
  const capacityLabel = ev.max_players
    ? `${playerCount}/${ev.max_players} pemain terdaftar`
    : `${playerCount} pemain terdaftar`;

  const start = ev.starts_at ? new Date(ev.starts_at) : null;
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const clock = (value: Date) => value.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = start ? start.toLocaleString("id-ID", { dateStyle: "full" }) : "Waktu event belum ditentukan";
  const timeLabel = start
    ? end && end.toDateString() === start.toDateString()
      ? `${clock(start)} - ${clock(end)}`
      : `Pukul ${clock(start)}`
    : "";

  const words = ev.name.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words[words.length - 1] : "";
  const leadWords = words.length > 1 ? words.slice(0, -1).join(" ") : ev.name;

  const pageStyle = {
    "--pe-accent": theme.accent,
  } as CSSProperties;
  const heroStyle: CSSProperties = {
    background: `linear-gradient(105deg, ${brandSecondary} 0%, ${brandSecondary} 38%, ${brandPrimary} 100%)`,
  };
  const heroImageStyle: CSSProperties | null =
    theme.panel === null
      ? null
      : {
          backgroundColor: theme.to,
          backgroundImage: `url(${equipment})`,
          backgroundBlendMode: "multiply",
          backgroundSize: "400% auto",
          backgroundPosition: `${(theme.panel * 100) / 3}% 42%`,
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 55%)",
          maskImage: "linear-gradient(to right, transparent 0%, #000 55%)",
        };
  const accentStrip: CSSProperties = {
    background: `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 30%, #eefbd9), #d6f6ea 70%, #d3f3fb)`,
  };

  return (
    <main className="public-event-page min-h-screen px-4 py-8 sm:px-6 sm:py-10" style={pageStyle}>
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-arena-dim transition hover:text-arena-ink"
        >
          <ArrowLeft className="size-4" />
          <img src={ev.logo_url || "/brand/logo-light-128.webp"} alt="" width={32} height={29} className="h-7 w-auto object-contain" /> {ev.organization_name || "OTTOPLAY"}
        </Link>

        <section
          className="relative isolate mt-4 overflow-hidden rounded-[28px] text-white shadow-[0_28px_60px_-34px_rgba(8,32,56,.8)]"
          style={heroStyle}
        >
          {heroImageStyle && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full opacity-35 sm:w-[46%] sm:opacity-100"
              style={heroImageStyle}
            />
          )}
          <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm">
                <span className="size-1.5 rounded-full" style={{ background: theme.accent }} aria-hidden="true" />
                {ev.organization_name}
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl">
                {leadWords}
                {lastWord && (
                  <>
                    {" "}
                    <span style={{ color: theme.accent }}>{lastWord}</span>
                  </>
                )}
              </h1>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
                <HeroInfo icon={<SportIcon sport={ev.sport} className="size-5" />} accent={theme.accent}>
                  <dt className="sr-only">Olahraga</dt>
                  <dd className="font-semibold">{theme.label === "Olahraga" ? ev.sport : theme.label}</dd>
                  <dd className="text-xs text-white/65">{formatLabel(ev.format)}</dd>
                </HeroInfo>
                <HeroInfo icon={<CalendarDays className="size-5" />} accent={theme.accent}>
                  <dt className="sr-only">Jadwal</dt>
                  <dd className="font-semibold">{dateLabel}</dd>
                  {timeLabel && <dd className="text-xs text-white/65">{timeLabel}</dd>}
                </HeroInfo>
                {ev.venue_name && (
                  <HeroInfo icon={<MapPin className="size-5" />} accent={theme.accent}>
                    <dt className="sr-only">Lokasi</dt>
                    <dd className="font-semibold">{ev.venue_name}</dd>
                  </HeroInfo>
                )}
              </dl>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0b1f33] shadow-lg transition hover:brightness-105"
                  style={{ background: theme.accent }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Tersalin" : "Salin link"}
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  <Share2 className="size-4" /> Bagikan WhatsApp
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-[#04161f]/55 p-4 backdrop-blur-md lg:min-w-60">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Status</p>
              <p className="mt-2 flex items-center gap-2 font-display text-xl font-bold" style={{ color: theme.accent }}>
                <span className="relative flex size-2.5" aria-hidden="true">
                  {registrationOpen && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: theme.accent }} />
                  )}
                  <span className="relative inline-flex size-2.5 rounded-full" style={{ background: theme.accent }} />
                </span>
                {eventStatusLabel(ev.status)}
              </p>
              <p className="mt-1 text-sm text-white/75">{capacityLabel}</p>
              {fill !== null && (
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fill}
                  aria-label="Kuota pemain"
                >
                  <div className="h-full rounded-full" style={{ width: `${fill}%`, background: theme.accent }} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-start">
          <div className="overflow-hidden rounded-[24px] border border-arena-ink/10 bg-white/90 shadow-[0_18px_40px_-32px_rgba(17,45,72,.6)]">
            <div className="flex items-center justify-between gap-4 border-b border-arena-ink/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-arena-ink/5 text-arena-ink">
                  <Users className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold">Daftar pemain</h2>
                  <p className="text-xs text-arena-dim">Peserta yang sudah bergabung di event ini</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-arena-ink/10 bg-white px-3 py-1.5 font-display text-sm font-bold text-arena-ink">
                <UserRound className="size-4 text-arena-lime" />
                {ev.max_players ? `${activePlayerCount} / ${ev.max_players}` : activePlayerCount}
                {waitlistCount > 0 && <span className="ml-1 text-[10px] text-amber-700">+{waitlistCount} waitlist</span>}
              </span>
            </div>

            {payload.players.length ? (
              <ul className="grid gap-2 p-5">
                {payload.players.map((player, index) => {
                  const meta = tierMeta(player.tier);
                  return (
                    <li key={`${player.display_name}-${player.registered_at}`} className="public-event__player-row">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold pe-tone--${meta.key}`} aria-hidden="true">
                        {initials(player.display_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-arena-ink">
                          <span className="mr-1.5 font-display text-[11px] text-arena-dim">{String(index + 1).padStart(2, "0")}</span>
                          {player.display_name}
                        </p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-arena-dim">{player.gender === "female" ? "Perempuan" : "Laki-laki"} - {playerStatusLabel(player.status)}</p>
                      </div>
                      <TierBadge tier={player.tier} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid place-items-center px-6 py-12 text-center">
                <span
                  className="grid size-24 place-items-center rounded-full text-arena-ink"
                  style={{ background: `color-mix(in srgb, ${theme.accent} 28%, #ffffff)` }}
                >
                  <SportIcon sport={ev.sport} className="size-11" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">Belum ada pemain terdaftar</h3>
                <p className="mt-1 max-w-xs text-sm leading-6 text-arena-dim">
                  Jadilah yang pertama untuk bergabung dan rasakan keseruan pertandingan!
                </p>
                {!payload.me && registrationOpen && (
                  <button
                    type="button"
                    onClick={openForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-arena-ink px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-arena-lime lg:hidden"
                  >
                    <UserPlus className="size-4" /> Daftar sekarang
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            ref={formRef}
            className="scroll-mt-6 overflow-hidden rounded-[24px] border border-arena-ink/10 bg-white/95 shadow-[0_18px_40px_-32px_rgba(17,45,72,.6)]"
          >
            <div className="flex items-start gap-3 px-6 py-5" style={accentStrip}>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-arena-ink text-white">
                {payload.me ? <CheckCircle2 className="size-5" /> : <UserPlus className="size-5" />}
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{payload.me ? "Kamu sudah terdaftar" : "Ikut bermain?"}</h2>
                <p className="mt-0.5 text-xs leading-5 text-arena-ink/70">
                  {payload.me
                    ? `Hai ${payload.me.display_name}, gunakan link ini lagi untuk melihat jadwal, skor, dan ranking.`
                    : "Tidak perlu membuat akun OTTOPLAY. Daftar sebagai guest, lalu simpan link ini."}
                </p>
              </div>
            </div>

            <div className="p-6">
              {payload.me ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-arena-dim">Tier kamu</span>
                    <TierBadge tier={payload.me.tier} />
                    <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-arena-dim">Status</span>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-arena-ink">{playerStatusLabel(payload.me.status)}</span>
                  </div>
                  {message && <p className="public-event__message">{message}</p>}
                  {registrationOpen && payload.me.status === "registered" && (
                    <button
                      type="button"
                      onClick={() => void checkIn()}
                      disabled={checkingIn}
                      className="inline-flex w-full items-center justify-center rounded-full bg-arena-ink px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-arena-lime hover:text-arena-ink disabled:opacity-50"
                    >
                      {checkingIn ? "Memproses..." : "Check-in sekarang"}
                    </button>
                  )}
                  {payload.me.status !== "withdrawn" && (
                    <button
                      type="button"
                      onClick={() => void claimGuest()}
                      disabled={claiming}
                      className="inline-flex w-full items-center justify-center rounded-full border border-arena-ink/15 px-4 py-3 text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime disabled:opacity-50"
                    >
                      {claiming ? "Menghubungkan..." : "Simpan ke Player Hub"}
                    </button>
                  )}
                  {registrationOpen && (
                    <button
                      type="button"
                      onClick={() => void cancelRegistration()}
                      disabled={cancelling}
                      className="inline-flex w-full items-center justify-center rounded-full border border-red-200 px-4 py-3 text-xs font-bold uppercase tracking-wider text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelling ? "Membatalkan..." : "Batalkan pendaftaran"}
                    </button>
                  )}
                </div>
              ) : showForm ? (
                <form onSubmit={register} className="grid gap-4">
                  <FormField label="Nama tampil" required icon={<UserRound />} htmlFor="pe-name">
                    <input
                      id="pe-name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Contoh: Budi Santoso"
                      className="public-event__input"
                    />
                  </FormField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Jenis kelamin" required icon={<VenusAndMars />} htmlFor="pe-gender">
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger id="pe-gender" className={selectTriggerClass} aria-required="true">
                          <SelectValue placeholder="Pilih jenis kelamin">
                            {GENDERS.filter((item) => item.value === gender).map((item) => (
                              <span key={item.value} className="flex items-center gap-2">
                                <span className={`grid size-6 place-items-center rounded-lg ${item.tone}`}>
                                  <item.icon className="size-3.5" />
                                </span>
                                {item.label}
                              </span>
                            ))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {GENDERS.map((item) => (
                            <SelectItem key={item.value} value={item.value} textValue={item.label} className="cursor-pointer rounded-lg py-2">
                              <span className="flex items-center gap-3">
                                <span className={`grid size-8 place-items-center rounded-lg ${item.tone}`}>
                                  <item.icon className="size-4" />
                                </span>
                                <span className="text-sm font-semibold text-arena-ink">{item.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField label="Pilih tier" required icon={<Medal />} htmlFor="pe-tier">
                      <Select value={tier} onValueChange={setTier}>
                        <SelectTrigger id="pe-tier" className={selectTriggerClass} aria-required="true">
                          <SelectValue placeholder="Pilih level permainan">
                            {TIERS.filter((item) => item.key === tier).map((item) => (
                              <span key={item.key} className="flex items-center gap-2">
                                <span className={`grid size-6 place-items-center rounded-lg pe-tone--${item.key}`}>
                                  <item.icon className="size-3.5" />
                                </span>
                                {item.label}
                              </span>
                            ))}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {TIERS.map((item) => (
                            <SelectItem key={item.key} value={item.key} textValue={item.label} className="cursor-pointer rounded-lg py-2">
                              <span className="flex items-center gap-3">
                                <span className={`grid size-8 place-items-center rounded-lg pe-tone--${item.key}`}>
                                  <item.icon className="size-4" />
                                </span>
                                <span className="flex flex-col">
                                  <span className="text-sm font-semibold text-arena-ink">{item.label}</span>
                                  <span className="text-[11px] text-arena-dim">{item.note}</span>
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  <p className="-mt-2 text-[11px] text-arena-dim">Tier dipakai untuk menyeimbangkan pertandingan.</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="WhatsApp" hint="Opsional" icon={<Phone />} htmlFor="pe-phone">
                      <input
                        id="pe-phone"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="public-event__input"
                      />
                    </FormField>
                    <FormField label="Email" hint="Opsional" icon={<Mail />} htmlFor="pe-email">
                      <input
                        id="pe-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="kamu@email.com"
                        className="public-event__input"
                      />
                    </FormField>
                  </div>

                  <label className="public-event__consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>Nama saya boleh tampil di daftar peserta dan hasil event.</span>
                  </label>

                  {message && (
                    <p className="public-event__message" role="status">
                      {message}
                    </p>
                  )}

                  <button disabled={submitting} className="public-event__submit">
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Daftar event
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              ) : (
                <div className="grid gap-3">
                  {registrationOpen ? (
                    <button type="button" onClick={() => setShowForm(true)} className="btn-arena w-full justify-center">
                      Daftar sebagai pemain
                    </button>
                  ) : (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-arena-dim">
                      Pendaftaran event sudah ditutup. Halaman ini tetap bisa dipakai untuk melihat hasil dan ranking.
                    </p>
                  )}
                  {message && <p className="public-event__message">{message}</p>}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[24px] border border-arena-ink/10 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(17,45,72,.6)] sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-lime-100 text-lime-700">
                <Medal className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">Klasemen pejuang</h2>
                <p className="mt-0.5 text-xs text-arena-dim">Sama seperti laporan Arena: poin, jumlah main, dan kemenangan.</p>
              </div>
            </div>
            {finalMatches.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-arena-dim">
                {finalMatches.length} laga final
              </span>
            )}
          </div>
          {standings.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-arena-dim">Klasemen akan muncul setelah skor pertama disimpan.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-arena-dim">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Pejuang</th>
                    <th className="px-3 py-3">Main</th>
                    <th className="px-3 py-3">Menang</th>
                    <th className="px-3 py-3">Win rate</th>
                    <th className="px-3 py-3">Poin</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing, index) => (
                    <tr key={standing.name} className={`border-b border-slate-50 ${standing.name === meName ? "bg-lime-50/70" : ""}`}>
                      <td className="px-3 py-3 font-display font-bold text-arena-dim">{String(index + 1).padStart(2, "0")}</td>
                      <td className="px-3 py-3 font-semibold text-arena-ink">
                        {standing.name}{standing.name === meName && <span className="ml-2 rounded-full bg-lime-100 px-2 py-1 text-[10px] text-lime-800">Kamu</span>}
                      </td>
                      <td className="px-3 py-3 text-arena-dim">{standing.games}</td>
                      <td className="px-3 py-3 text-arena-dim">{standing.wins}</td>
                      <td className="px-3 py-3 text-arena-dim">{standing.games ? `${Math.round((standing.wins / standing.games) * 100)}%` : "-"}</td>
                      <td className="px-3 py-3 font-display font-bold text-arena-ink">{standing.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {payload.me && (
          <section className="mt-6 overflow-hidden rounded-[24px] border border-arena-ink/10 bg-[#0b2737] p-6 text-white shadow-[0_18px_40px_-32px_rgba(17,45,72,.6)] sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-lime-300"><BarChart3 className="size-5" /></span>
              <div>
                <h2 className="font-display text-xl font-bold">Analisa kamu</h2>
                <p className="mt-0.5 text-xs text-white/60">Ringkasan performa dari pertandingan yang kamu ikuti.</p>
              </div>
            </div>
            {myMatches.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-white/70">Belum ada pertandingan yang melibatkan {meName}.</p>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ReportStat label="Peringkat" value={myStandingIndex >= 0 ? `#${myStandingIndex + 1}` : "-"} />
                  <ReportStat label="Main" value={String(myMatches.length)} />
                  <ReportStat label="Menang" value={`${myWins} (${Math.round((myWins / myMatches.length) * 100)}%)`} />
                  <ReportStat label="Poin" value={String(myPoints)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InsightCard label="Partner paling sering" value={favoritePartner ? `${favoritePartner[0]} - ${favoritePartner[1].games}x` : "Belum ada"} />
                  <InsightCard label="Lawan paling sering" value={strongestRival ? `${strongestRival[0]} - ${strongestRival[1].games}x` : "Belum ada"} />
                </div>
              </>
            )}
          </section>

        )}

        <section className="mt-6 overflow-hidden rounded-[24px] border border-arena-ink/10 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(17,45,72,.6)] sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-100 text-amber-600">
              <Trophy className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Hasil pertandingan</h2>
              {!matchRows.length && (
                <p className="mt-0.5 text-xs leading-5 text-arena-dim">
                  Skor, jadwal lapangan, partner, lawan, dan ranking akan muncul di sini setelah Arena mulai berjalan.
                </p>
              )}
            </div>
          </div>
          {matchRows.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[...matchRows]
                .reverse()
                .map((match, index) => (
                  <div key={`${match.round ?? 0}-${match.court ?? index}`} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-arena-dim">
                      <span>Ronde {match.round ?? "-"}</span>
                      <span>Lapangan {match.court ?? "-"}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 text-sm">
                      <span>{(match.team_a ?? []).join(" & ") || "Tim A"}</span>
                      <strong>{match.score_a ?? 0}</strong>
                      <span>{(match.team_b ?? []).join(" & ") || "Tim B"}</span>
                      <strong>{match.score_b ?? 0}</strong>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const selectTriggerClass =
  "h-12 rounded-[13px] border-[#d5e5eb] bg-white/80 px-3.5 text-sm font-medium text-arena-ink shadow-none transition focus:border-arena-lime focus:ring-2 focus:ring-arena-lime/25 data-[state=open]:border-arena-lime data-[placeholder]:font-normal data-[placeholder]:text-[#9aabba]";

const selectContentClass = "rounded-2xl border-arena-ink/10 bg-white p-1 shadow-2xl";

function HeroInfo({ icon, accent, children }: { icon: ReactNode; accent: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10" style={{ color: accent }}>
        {icon}
      </span>
      <div className="min-w-0 text-sm leading-5">{children}</div>
    </div>
  );
}

function FormField({
  label,
  hint,
  required,
  icon,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="public-event__field">
      <label htmlFor={htmlFor} className="public-event__field-label">
        <span className="public-event__field-title">
          {icon}
          {label}
          {required && <b>*</b>}
        </span>
        {hint && <small>{hint}</small>}
      </label>
      {children}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-2 font-display text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
function TierBadge({ tier }: { tier: string | null | undefined }) {
  const meta = tierMeta(tier);
  return (
    <span className={`public-event__tier-badge pe-tone--${meta.key}`}>
      <meta.icon className="size-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
