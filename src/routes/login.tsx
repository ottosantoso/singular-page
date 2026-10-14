import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loginIdToEmail, useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk — OTTOPLAY ARENA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.loading && auth.session && auth.isAdmin) navigate({ to: "/admin" });
  }, [auth.loading, auth.session, auth.isAdmin, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginId.trim() || !password) {
      setError("Isi username dan password.");
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginIdToEmail(loginId),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("invalid")
          ? "Username atau password salah."
          : "Gagal masuk. Coba lagi sebentar lagi.",
      );
    }
  }

  const signedInWithoutAccess = !auth.loading && !!auth.session && !auth.isAdmin;

  return (
    <main className="arena-home court-lines flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-sm">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-arena-dim transition hover:text-arena-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Beranda
        </Link>

        <div className="rounded-[22px] border border-arena-ink/10 bg-white/85 p-6 shadow-[0_14px_34px_-22px] shadow-arena-ink/55 backdrop-blur">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-arena-lime/15 text-arena-lime">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold uppercase tracking-wider text-arena-ink">
                Masuk
              </h1>
              <p className="text-xs text-arena-dim">Panel admin OTTOPLAY ARENA</p>
            </div>
          </div>

          {signedInWithoutAccess ? (
            <div className="space-y-4">
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
                Akun <strong>{auth.username ?? "ini"}</strong> belum punya akses admin.
              </p>
              <button
                type="button"
                onClick={() => auth.signOut()}
                className="w-full rounded-full border border-arena-ink/15 bg-white px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime"
              >
                Keluar
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="loginId">Username</Label>
                <Input
                  id="loginId"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="mis. shn_admin"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-arena-dim hover:text-arena-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-arena-lime px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {submitting ? "Memeriksa…" : "Masuk"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
