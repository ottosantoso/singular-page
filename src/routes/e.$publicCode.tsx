import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Share2, Trophy, Users, Medal, UserRound, Phone, Mail, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  max_players: number | null;
};

type PublicPlayer = {
  display_name: string;
  tier: string | null;
  status: string;
  seed: number | null;
  registered_at: string;
  checked_in_at: string | null;
};

type PublicPayload = {
  event: PublicEvent | null;
  players: PublicPlayer[];
  me: { display_name: string; tier: string | null; status: string } | null;
  matches: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};

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
  const [message, setMessage] = useState("");
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
      const legacyArgs = {
        p_public_code: publicCode,
        p_display_name: displayName,
        ...(phone ? { p_phone: phone } : {}),
        ...(email ? { p_email: email } : {}),
        p_consent_to_show_name: consent,
        p_tier: tier,
      };
      registrationResult = await supabase.rpc("register_event_guest", legacyArgs);
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
      setMessage("Kamu sudah terdaftar. Link ini bisa dipakai lagi untuk melihat hasil pertandingan.");
      await loadEvent();
    }
    setSubmitting(false);
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

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/e/${publicCode}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Ikut event ${payload?.event?.name || "OTTOPLAY"}: ${shareUrl}`)}`;
  const startLabel = payload?.event?.starts_at
    ? new Date(payload.event.starts_at).toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Waktu event belum ditentukan";
  const matchRows = payload?.matches as Array<{ round?: number; court?: number; team_a?: string[]; team_b?: string[]; score_a?: number; score_b?: number }>;

  const capacityLabel = useMemo(() => {
    if (!payload?.event?.max_players) return `${payload?.players.length ?? 0} pemain terdaftar`;
    return `${payload.players.length}/${payload.event.max_players} pemain terdaftar`;
  }, [payload]);

  if (loading) {
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

  return (
    <main className="public-event-page min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-arena-dim transition hover:text-arena-ink"
        >
          <ArrowLeft className="size-4" /> OTTOPLAY
        </Link>
        <section className="mt-5 overflow-hidden rounded-[30px] bg-arena-ink text-white shadow-[0_24px_60px_-30px] shadow-arena-ink/70">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-arena-lime">
                {payload.event.organization_name}
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                {payload.event.name}
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/70">
                {payload.event.sport} · {payload.event.format} · {startLabel}
                {payload.event.venue_name ? ` · ${payload.event.venue_name}` : ""}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 lg:min-w-48">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Status</p>
              <p className="mt-2 font-display text-xl font-bold text-arena-lime">
                {payload.event.status === "registration" ? "Pendaftaran dibuka" : "Event berjalan"}
              </p>
              <p className="mt-1 text-sm text-white/70">{capacityLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 p-4 sm:px-10">
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(shareUrl)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15"
            >
              <Copy className="size-4" /> Salin link
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-arena-lime px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-arena-ink"
            >
              <Share2 className="size-4" /> Bagikan WhatsApp
            </a>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
          <div className="rounded-[26px] border border-arena-ink/10 bg-white/90 p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">Peserta</p>
                <h2 className="mt-1 font-display text-2xl font-bold">Daftar pemain</h2>
              </div>
              <Users className="size-7 text-arena-lime" />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {payload.players.map((player, index) => (
                <div key={`${player.display_name}-${player.registered_at}`} className="public-event__player-row">
                  <span className="public-event__player-number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-arena-ink">{player.display_name}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-arena-dim">{player.status}</p></div>
                  <span className={`public-event__tier-badge public-event__tier-badge--${player.tier || "intermediate"}`}>{formatTier(player.tier)}</span>
                </div>
              ))}
              {!payload.players.length && <p className="text-sm text-arena-dim">Belum ada pemain terdaftar.</p>}
            </div>
          </div>

          <div className="rounded-[26px] bg-gradient-to-br from-lime-200 via-cyan-100 to-white p-6 sm:p-8">
            {payload.me ? (
              <>
                <CheckCircle2 className="size-8 text-emerald-600" />
                <h2 className="mt-5 font-display text-2xl font-bold">Kamu sudah terdaftar</h2>
                <p className="mt-2 text-sm leading-6 text-arena-dim">
                  Hai {payload.me.display_name}, gunakan link ini lagi untuk melihat jadwal, skor, dan ranking.
                </p>
                {payload.event.status === "registration" && (
                  <button type="button" onClick={() => void cancelRegistration()} disabled={cancelling} className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-red-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-red-700 disabled:opacity-50">
                    {cancelling ? "Membatalkan..." : "Batalkan pendaftaran"}
                  </button>
                )}
              </>
            ) : (
              <>
                <Trophy className="size-8 text-arena-ink" />
                <h2 className="mt-5 font-display text-2xl font-bold">Ikut bermain?</h2>
                <p className="mt-2 text-sm leading-6 text-arena-dim">
                  Tidak perlu membuat akun OTTOPLAY. Daftar sebagai guest, lalu simpan link ini.
                </p>
                {showForm ? (
                  <form onSubmit={register} className="public-event__form">
                    <div className="public-event__form-intro"><span className="public-event__form-icon"><UserRound /></span><div><p className="public-event__form-kicker">Pendaftaran pemain</p><h3>Isi data kamu</h3><p>Nama dan tier akan tampil di daftar peserta event.</p></div></div>
                    <Field label="Nama tampil" required icon={<UserRound />}><input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Contoh: Budi Santoso" className="public-event__input" /></Field>
                    <Field label="Jenis kelamin" required icon={<UserRound />}><div className="public-event__select-wrap"><select required value={gender} onChange={(e) => setGender(e.target.value)} className="public-event__input public-event__select"><option value="">Pilih jenis kelamin</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></select><ChevronDown /></div></Field>

                    <Field label="Pilih tier" required icon={<Medal />} hint="Untuk penyeimbangan pertandingan"><div className="public-event__select-wrap"><select required value={tier} onChange={(e) => setTier(e.target.value)} className="public-event__input public-event__select"><option value="">Pilih level permainan</option><option value="newbie">Newbie</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="pro">Pro</option><option value="elite">Elite</option></select><ChevronDown /></div></Field>
                    <div className="public-event__form-grid"><Field label="WhatsApp" hint="Opsional" icon={<Phone />}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="public-event__input" /></Field><Field label="Email" hint="Opsional" icon={<Mail />}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" className="public-event__input" /></Field></div>
                    <label className="public-event__consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Nama saya boleh tampil di daftar peserta dan hasil event.</span></label>
                    {message && <p className="public-event__message">{message}</p>}
                    <button disabled={submitting} className="public-event__submit">{submitting && <Loader2 className="size-4 animate-spin" />} Daftar event <ArrowLeft className="size-4 rotate-180" /></button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setShowForm(true)} className="btn-arena mt-5 w-full justify-center">
                    Daftar sebagai pemain
                  </button>
                )}
              </>
            )}
            {!payload.me && message && !showForm && <p className="mt-4 text-xs text-arena-dim">{message}</p>}
          </div>
        </section>

        <section className="mt-6 rounded-[26px] border border-arena-ink/10 bg-white/90 p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <Trophy className="size-6 text-arena-lime" />
            <h2 className="font-display text-2xl font-bold">Hasil pertandingan</h2>
          </div>
          {matchRows.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {matchRows.slice(-12).reverse().map((match, index) => (
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
          ) : (
            <p className="mt-4 text-sm leading-6 text-arena-dim">Skor, jadwal lapangan, partner, lawan, dan ranking akan muncul di sini setelah Arena mulai berjalan.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, hint, required, icon, children }: { label: string; hint?: string; required?: boolean; icon: ReactNode; children: ReactNode }) {
  return <label className="public-event__field"><span className="public-event__field-label"><span className="public-event__field-title">{icon}{label}{required && <b>*</b>}</span>{hint && <small>{hint}</small>}</span>{children}</label>;
}

function formatTier(value: string | null | undefined) {
  if (!value) return "Intermediate";
  return value.charAt(0).toUpperCase() + value.slice(1);
}