import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  head: () => ({ meta: [{ title: "Verifikasi akun - OTTOPLAY" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState("");
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") || "/login?verified=1"
      : "/login?verified=1";

  useEffect(() => {
    let active = true;
    async function finishVerification() {
      const existing = await supabase.auth.getSession();
      let verificationError = existing.error;
      let hasSession = Boolean(existing.data.session);
      if (!hasSession && new URLSearchParams(window.location.search).get("code")) {
        const exchanged = await supabase.auth.exchangeCodeForSession(window.location.href);
        verificationError = exchanged.error;
        hasSession = Boolean(exchanged.data.session);
      }
      if (!active) return;
      if (verificationError) {
        setError(verificationError.message);
        return;
      }
      if (!hasSession && !window.location.hash.includes("access_token")) {
        setError("Sesi verifikasi tidak ditemukan. Minta link baru jika diperlukan.");
        return;
      }
      await supabase.auth.signOut();
      const target = next.startsWith("/") ? next : "/workspace";
      window.setTimeout(() => window.location.replace(target), 900);
      window.setTimeout(() => {
        if (window.location.pathname === "/auth-callback") window.location.assign(target);
      }, 4500);
    }
    void finishVerification();
    return () => {
      active = false;
    };
  }, [next]);

  return (
    <main className="arena-home court-lines grid min-h-screen place-items-center px-4 py-10">
      <section className="relative z-10 w-full max-w-md rounded-[28px] border border-arena-ink/10 bg-white/90 p-7 text-center shadow-[0_20px_50px_-28px] shadow-arena-ink/60 backdrop-blur sm:p-9">
        {error ? (
          <>
            <XCircle className="mx-auto size-12 text-red-500" />
            <h1 className="mt-5 font-display text-2xl font-bold">Verifikasi belum selesai</h1>
            <p className="mt-2 text-sm leading-6 text-arena-dim">
              Link mungkin sudah kedaluwarsa atau sudah pernah digunakan. Minta link verifikasi baru
              jika diperlukan.
            </p>
            <Link to="/login" className="btn-arena mt-6 inline-flex">
              Kembali ke login
            </Link>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-12 text-arena-lime" />
            <h1 className="mt-5 font-display text-2xl font-bold">Email berhasil diverifikasi</h1>
            <p className="mt-2 text-sm leading-6 text-arena-dim">
              Akunmu sudah aktif. Mengarahkan ke workspace...
            </p>
            <Loader2 className="mx-auto mt-6 size-5 animate-spin text-arena-lime" />
          </>
        )}
        <span className="sr-only">{next}</span>
      </section>
    </main>
  );
}
