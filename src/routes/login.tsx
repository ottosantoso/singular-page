import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, LogIn, UserPlus, UserRound, Trophy, Table2, CircleDot, Goal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loginIdToEmail, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Masuk — OTTOPLAY ARENA" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const returnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo") || ""
      : "";
  const verified =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("verified") === "1";

  useEffect(() => {
    const targetEmail = localStorage.getItem("ottoplay:last-verification-email") || "";
    const until = targetEmail ? Number(localStorage.getItem(`ottoplay:verification-resend:${targetEmail}`) || 0) : 0;
    if (targetEmail && until > Date.now()) {
      setVerificationEmail(targetEmail);
      setResendSeconds(Math.ceil((until - Date.now()) / 1000));
    }
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function startResendCooldown(targetEmail: string) {
    const until = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(`ottoplay:verification-resend:${targetEmail.toLowerCase()}`, String(until));
    localStorage.setItem("ottoplay:last-verification-email", targetEmail.toLowerCase());
    setVerificationEmail(targetEmail);
    setResendSeconds(300);
  }

  function getVerificationRedirect() {
    const currentOrigin = window.location.origin;
    const configuredUrl = import.meta.env["VITE_PUBLIC_APP_URL"]?.trim() || "";
    const currentHostIsLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const configuredUrlIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(configuredUrl.replace(/\/$/, ""));
    const baseUrl = configuredUrl && (!configuredUrlIsLocal || currentHostIsLocal)
      ? configuredUrl
      : currentOrigin;
    return `${baseUrl.replace(/\/$/, "")}/auth-callback?next=${encodeURIComponent("/login?verified=1")}`;
  }

  async function resendVerificationEmail() {
    const targetEmail = verificationEmail.trim().toLowerCase();
    if (!targetEmail || resendSeconds > 0) return;
    setSubmitting(true);
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: { emailRedirectTo: getVerificationRedirect() },
    });
    if (resendError) setError(resendError.message);
    else {
      startResendCooldown(targetEmail);
      setMessage("Link verifikasi baru sudah dikirim. Periksa inbox atau folder spam.");
    }
    setSubmitting(false);
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError = params.get("error_description") || params.get("error");
    if (authError) {
      const normalized = authError.toLowerCase();
      setMode("login");
      setError(
        normalized.includes("expired") || normalized.includes("invalid")
          ? "Link verifikasi sudah kedaluwarsa atau sudah pernah digunakan. Daftar ulang untuk mendapatkan link baru."
          : authError.replace(/\+/g, " "),
      );
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }
    if (!auth.loading && auth.session) navigate({ to: auth.landingPath });
    if (verified) setMessage("Email berhasil diverifikasi. Silakan masuk dengan akunmu.");
  }, [auth.loading, auth.session, auth.landingPath, navigate, verified]);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!username.trim() || !password) {
      setError("Email atau username lama dan password wajib diisi.");
      return;
    }
    if (mode === "register" && !email.trim()) {
      setError("Email wajib diisi agar link verifikasi bisa dikirim.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setSubmitting(true);
    if (mode === "register") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getVerificationRedirect(),
          data: {
            username: username.trim().toLowerCase(),
            display_name: displayName.trim() || username.trim(),
          },
        },
      });
      if (signUpError)
        setError(
          signUpError.message.toLowerCase().includes("already")
            ? "Username atau email sudah dipakai."
            : signUpError.message,
        );
      else if (data.session && returnTo) window.location.assign(returnTo);
      else {
        setMode("login");
        setPassword("");
        startResendCooldown(email.trim());
        setMessage("Akun berhasil dibuat. Cek email, klik link verifikasi, lalu masuk dengan username dan password tadi.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginIdToEmail(username),
        password,
      });
      if (signInError) {
        const lower = signInError.message.toLowerCase();
        if (lower.includes("email not confirmed") && username.includes("@")) {
          const targetEmail = username.trim().toLowerCase();
          const until = Number(localStorage.getItem(`ottoplay:verification-resend:${targetEmail}`) || 0);
          setVerificationEmail(targetEmail);
          setResendSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
        }
        setError(
          lower.includes("email not confirmed")
            ? "Email belum diverifikasi. Cek inbox lalu klik link verifikasi."
            : lower.includes("invalid")
              ? "Email atau password salah."
              : signInError.message,
        );
      } else if (returnTo) window.location.assign(returnTo);
    }
    setSubmitting(false);
  }

  return (
    <main className="login-page min-h-screen">
      <div className="login-page__wash" aria-hidden="true" />
      <div className="login-page__layout">
        <section className="login-page__intro">
          <Link to="/" className="login-page__brand" aria-label="Kembali ke OTTOPLAY ARENA">
            <span className="login-page__brand-mark"><img src="/brand/logo-light-128.webp" alt="" width={70} height={64} /></span>
            <span>
              <strong>OTTO <em>PLAY</em> ARENA</strong>
              <small>Mainkan strategi, biarkan OTTO beraksi.</small>
            </span>
          </Link>
          <div className="login-page__intro-copy">
            <p className="login-page__eyebrow">OTTOPLAY ARENA</p>
            <h2>Lebih dari sekadar <span>bermain.</span><br />Ini tentang strategi!</h2>
            <p>Bergabung dengan komunitas raket, tingkatkan skill, dan rasakan keseruan pertandingan dengan sistem live scoring real-time.</p>
          </div>
          <div className="login-page__sports" aria-label="Cabang olahraga">
            <SportBadge icon={<Trophy />} label="Padel" detail="Strategi & kerja sama" tone="lime" />
            <SportBadge icon={<Table2 />} label="Tenis Meja" detail="Refleks & kecepatan" tone="blue" />
            <SportBadge icon={<CircleDot />} label="Badminton" detail="Ketangkasan & fokus" tone="violet" />
            <SportBadge icon={<Goal />} label="Tenis" detail="Presisi & konsistensi" tone="gold" />
          </div>
          <p className="login-page__tagline">Let's Play!</p>
        </section>

        <section className="login-page__card" aria-label="Form autentikasi">
          <div className="login-page__card-head">
            <div>
              <p className="login-page__card-kicker">OTTOPLAY WORKSPACE</p>
              <h1>{mode === "login" ? <>Masuk atau <span>Registrasi</span></> : <>Buat akun <span>OTTOPLAY</span></>}</h1>
              <p>{mode === "login" ? "Bergabung dengan OTTO Play Arena untuk menikmati pengalaman bermain yang lebih seru." : "Daftar untuk menyimpan profil dan riwayat pertandinganmu."}</p>
            </div>
            <span className="login-page__card-icon">{mode === "login" ? <UserRound /> : <UserPlus />}</span>
          </div>
          <div className="login-page__tabs" role="tablist" aria-label="Mode autentikasi">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={mode === "login" ? "is-active" : ""}><LogIn /> Masuk</button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={mode === "register" ? "is-active" : ""}><UserPlus /> Registrasi</button>
          </div>
          <form onSubmit={onSubmit} className="login-page__form" noValidate>
            {mode === "register" && <Field label="Nama tampilan"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama kamu" className="auth-input" /></Field>}
            <Field label={mode === "register" ? "Username" : "Email / Username"}>
              <div className="login-page__input-wrap"><UserRound /><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder={mode === "register" ? "mis. otto_player" : "Masukkan email atau username"} autoComplete="username" autoCapitalize="none" className="auth-input" /></div>
            </Field>
            {mode === "register" && <Field label="Email verifikasi" hint="Wajib"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kamu@club.com" required autoComplete="email" className="auth-input" /></Field>}
            <Field label="Password">
              <div className="login-page__input-wrap"><span className="login-page__input-icon"><Goal /></span><input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="auth-input" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Tampilkan password" className="login-page__eye">{showPassword ? <EyeOff /> : <Eye />}</button></div>
            </Field>
            {mode === "login" && <div className="login-page__options"><label><input type="checkbox" defaultChecked /> <span>Ingat saya</span></label><button type="button" onClick={() => setMessage("Gunakan link reset password dari Supabase untuk mengganti password.")}>Lupa password?</button></div>}
            {message && <p className="login-page__message is-success">{message}</p>}
            {verificationEmail && <div className="login-page__resend">
              <span>Belum menerima email verifikasi?</span>
              <button type="button" onClick={resendVerificationEmail} disabled={submitting || resendSeconds > 0}>
                {resendSeconds > 0 ? `Kirim ulang dalam ${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, "0")}` : "Kirim ulang email"}
              </button>
            </div>}
            {error && <p className="login-page__message is-error">{error}</p>}
            <button type="submit" disabled={submitting} className="login-page__submit">{submitting && <Loader2 className="animate-spin" />}{mode === "login" ? "Masuk" : "Buat akun"}<ArrowRight /></button>
          </form>
          <p className="login-page__legal">Dengan melanjutkan, Anda menyetujui <span>Syarat & Ketentuan</span> dan <span>Kebijakan Privasi</span> kami.</p>
        </section>
      </div>
    </main>
  );
}

function SportBadge({ icon, label, detail, tone }: { icon: ReactNode; label: string; detail: string; tone: string }) {
  return <div className={`login-page__sport login-page__sport--${tone}`}><span>{icon}</span><strong>{label}</strong><small>{detail}</small></div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-arena-dim">
        <span>{label}</span>
        {hint && <span className="normal-case font-normal tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}






