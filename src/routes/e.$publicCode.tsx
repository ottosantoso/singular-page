import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Share2, Trophy, Users } from "lucide-react";
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
  status: string;
  seed: number | null;
  registered_at: string;
  checked_in_at: string | null;
};

type PublicPayload = {
  event: PublicEvent | null;
  players: PublicPlayer[];
  me: { display_name: string; status: string } | null;
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
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
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
    const { data, error: registerError } = await supabase.rpc("register_event_guest", {
      p_public_code: publicCode,
      p_display_name: displayName,
      ...(phone ? { p_phone: phone } : {}),
      ...(email ? { p_email: email } : {}),
      ...(photoUrl ? { p_photo_url: photoUrl } : {}),
      p_consent_to_show_name: consent,
    });
    if (registerError || !data?.[0]) {
      setMessage(registerError?.message || "Pendaftaran belum berhasil.");
    } else {
      localStorage.setItem(storageKey, data[0].registration_token);
      setDisplayName("");
      setPhone("");
      setEmail("");
      setPhotoUrl("");
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
    <main className="arena-home court-lines min-h-screen px-4 py-8 sm:px-6 sm:py-12">
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
              {payload.players.map((player) => (
                <div key={`${player.display_name}-${player.registered_at}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-arena-ink">{player.display_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-arena-dim">{player.status}</p>
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
                  <form onSubmit={register} className="mt-5 space-y-3">
                    <input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nama tampil *" className="auth-input" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp (opsional)" className="auth-input" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opsional)" className="auth-input" />
                    <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="URL foto/avatar (opsional)" className="auth-input" />
                    <label className="flex gap-2 text-xs leading-5 text-arena-dim">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      Nama saya boleh tampil di daftar peserta dan hasil event.
                    </label>
                    {message && <p className="rounded-xl bg-white/70 p-3 text-xs text-arena-dim">{message}</p>}
                    <button disabled={submitting} className="btn-arena w-full justify-center gap-2">
                      {submitting && <Loader2 className="size-4 animate-spin" />} Daftar event
                    </button>
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
