import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Link2, Loader2, LogIn, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/invite")({
  head: () => ({ meta: [{ title: "Undangan workspace - OTTOPLAY" }] }),
  component: InvitePage,
});

function InvitePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "login" | "success" | "error">("loading");
  const [message, setMessage] = useState("Memeriksa undangan...");
  const [organization, setOrganization] = useState("");
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") || ""
      : "";

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) {
      setStatus("login");
      setMessage("Login atau buat akun terlebih dahulu untuk menerima undangan ini.");
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("Token undangan tidak ditemukan.");
      return;
    }
    let active = true;
    supabase.rpc("accept_organization_invite", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        const row = data?.[0];
        setOrganization(row?.organization_name || "workspace");
        setStatus("success");
        setMessage("Kamu sudah bergabung ke workspace.");
        window.setTimeout(() => navigate({ to: "/workspace" }), 1000);
      }
    });
    return () => {
      active = false;
    };
  }, [auth.loading, auth.session, navigate, token]);

  return (
    <main className="arena-home court-lines grid min-h-screen place-items-center px-4 py-10">
      <section className="relative z-10 w-full max-w-md rounded-[28px] border border-arena-ink/10 bg-white/90 p-7 text-center shadow-[0_20px_50px_-28px] shadow-arena-ink/60 backdrop-blur sm:p-9">
        {status === "loading" && (
          <Loader2 className="mx-auto size-12 animate-spin text-arena-lime" />
        )}
        {status === "login" && <LogIn className="mx-auto size-12 text-arena-lime" />}
        {status === "success" && <CheckCircle2 className="mx-auto size-12 text-emerald-500" />}
        {status === "error" && <XCircle className="mx-auto size-12 text-red-500" />}
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-arena-lime">
          Workspace invitation
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {status === "success" ? `Welcome to ${organization}` : "Gabung ke workspace"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-arena-dim">{message}</p>
        {status === "login" && (
          <a
            href={`/login?returnTo=${encodeURIComponent(`/invite?token=${token}`)}`}
            className="btn-arena mt-6 inline-flex gap-2"
          >
            Login untuk bergabung <ArrowRight className="size-4" />
          </a>
        )}
        {status === "error" && (
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-arena-ink/15 px-5 py-3 text-xs font-bold uppercase tracking-wider text-arena-ink"
          >
            <Link2 className="size-4" /> Kembali
          </Link>
        )}
      </section>
    </main>
  );
}
