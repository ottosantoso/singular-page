import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loginIdToEmail, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Masuk â€” OTTOPLAY ARENA" }, { name: "robots", content: "noindex" }],
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
  const returnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo") || "/workspace"
      : "/workspace";

  useEffect(() => {
    if (!auth.loading && auth.session) navigate({ to: "/workspace" });
  }, [auth.loading, auth.session, navigate]);

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
          emailRedirectTo: `${window.location.origin}/auth-callback?next=/workspace`,
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
      else if (data.session) window.location.assign(returnTo);
      else setMessage("Akun berhasil dibuat. Cek email lalu klik link verifikasi sebelum masuk.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginIdToEmail(username),
        password,
      });
      if (signInError) {
        const lower = signInError.message.toLowerCase();
        setError(
          lower.includes("email not confirmed")
            ? "Email belum diverifikasi. Cek inbox lalu klik link verifikasi."
            : lower.includes("invalid")
              ? "Email atau password salah."
              : signInError.message,
        );
      } else window.location.assign(returnTo);
    }
    setSubmitting(false);
  }

  return (
    <main className="arena-home court-lines flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-arena-dim transition hover:text-arena-ink"
        >
          <ArrowLeft className="size-4" /> Beranda
        </Link>
        <div className="rounded-[28px] border border-arena-ink/10 bg-white/90 p-6 shadow-[0_20px_50px_-28px] shadow-arena-ink/60 backdrop-blur sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-arena-lime">
                OTTOPLAY WORKSPACE
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                {mode === "login" ? "Masuk ke arena." : "Buat akun baru."}
              </h1>
              <p className="mt-2 text-sm leading-6 text-arena-dim">
                {mode === "login"
                  ? "Kelola club, event, member, dan pertandingan live."
                  : "Mulai workspace untuk organisasi olahraga kamu."}
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-arena-ink text-white">
              {mode === "login" ? <LogIn className="size-5" /> : <UserPlus className="size-5" />}
            </span>
          </div>
          <div className="mt-7 grid grid-cols-2 rounded-full bg-slate-100 p-1">
            <button
              onClick={() => switchMode("login")}
              className={`rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${mode === "login" ? "bg-white text-arena-ink shadow-sm" : "text-arena-dim"}`}
            >
              Masuk
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider ${mode === "register" ? "bg-white text-arena-ink shadow-sm" : "text-arena-dim"}`}
            >
              Registrasi
            </button>
          </div>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Username">
              <input
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="mis. otto_admin"
                autoComplete="username"
                autoCapitalize="none"
                className="auth-input"
              />
            </Field>
            {mode === "register" && (
              <>
                <Field label="Nama tampilan">
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Nama kamu"
                    className="auth-input"
                  />
                </Field>
                <Field label="Email login & verifikasi" hint="Wajib untuk akun baru">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="kamu@club.com"
                    required
                    autoComplete="email"
                    className="auth-input"
                  />
                </Field>
              </>
            )}
            <Field label="Password">
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="auth-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label="Tampilkan password"
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-arena-dim"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {message && (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-arena inline-flex w-full items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Masuk" : "Buat akun"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-arena-dim">
            Verifikasi email dulu. Setelah aktif, kamu dapat memilih atau membuat workspace
            club/venue.
          </p>
        </div>
      </div>
    </main>
  );
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
