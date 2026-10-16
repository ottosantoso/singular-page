import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Login memakai username (mis. "shn_admin"). Supabase Auth butuh email, jadi username diubah
 * menjadi email sintetis (domain ".invalid" tidak pernah bisa menerima email sungguhan).
 * Kalau yang diketik sudah berisi "@", dipakai apa adanya (untuk user dengan email asli).
 */
export const LOGIN_EMAIL_DOMAIN = "users.ottoplay.invalid";

export function loginIdToEmail(input: string): string {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${LOGIN_EMAIL_DOMAIN}`;
}

type Profile = { username: string | null; roles: string[]; organizationRoles: string[] };

/**
 * Sesi + role user saat ini.
 * PENTING: cek role di sini hanya untuk tampilan (menyembunyikan halaman). Penjaga sebenarnya ada di
 * database: fungsi admin_* menolak siapa pun yang bukan admin (error 42501).
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // Listener hanya mengisi state (tanpa query ke Supabase di dalamnya, supaya tidak deadlock).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [roles, prof, orgRoles] = await Promise.all([
        supabase.from("user_roles").select("role_code").eq("user_id", userId),
        supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
        supabase
          .from("organization_members")
          .select("role_code")
          .eq("user_id", userId)
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      setProfile({
        username: prof.data?.username ?? null,
        roles: (roles.data ?? []).map((r) => r.role_code),
        organizationRoles: (orgRoles.data ?? []).map((r) => r.role_code),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    loading: !sessionReady || (!!userId && profile === null),
    session,
    username: profile?.username ?? null,
    roles: profile?.roles ?? [],
    organizationRoles: profile?.organizationRoles ?? [],
    isAdmin: !!profile?.roles.some((role) => role === "admin" || role === "platform_admin"),
    hasWorkspace: (profile?.organizationRoles.length ?? 0) > 0,
    landingPath: profile?.roles.some((role) => role === "admin" || role === "platform_admin")
      ? "/admin"
      : (profile?.organizationRoles.length ?? 0) > 0
        ? "/workspace"
        : "/player",
    signOut,
  };
}
