import { useQuery } from "@tanstack/react-query";
import { Ban, Check, Loader2, Search, UserCog } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PlatformUser = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  is_active: boolean;
  email_confirmed_at: string | null;
  global_roles: string[];
  memberships: { organization_name: string; role_code: string }[];
};

type PlatformOrganization = { organization_id: string; organization_name: string };

const ORGANIZATION_ROLES = [
  ["organization_owner", "Owner organisasi"],
  ["organization_admin", "Admin organisasi"],
  ["event_manager", "Event manager"],
  ["scorer", "Scorer"],
  ["coach", "Coach"],
  ["viewer", "Viewer"],
] as const;

export function PlatformUsers() {
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedRole, setSelectedRole] = useState("viewer");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["platform-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_users");
      if (error) throw error;
      return (data ?? []) as unknown as PlatformUser[];
    },
  });
  const organizations = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_organizations");
      if (error) throw error;
      return (data ?? []) as PlatformOrganization[];
    },
  });

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
      await users.refetch();
    } finally {
      setBusyKey(null);
    }
  };

  const needle = search.trim().toLowerCase();
  const filtered = (users.data ?? []).filter((user) =>
    !needle || [user.email, user.username, user.display_name].some((value) => value?.toLowerCase().includes(needle)),
  );

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider">Kontrol pengguna</h2>
          <p className="mt-1 text-sm text-arena-dim">Semua pendaftaran baru masuk sebagai viewer. Role organisasi diberikan dari sini.</p>
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Cari pengguna</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-arena-dim" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari email atau username" className="h-10 w-full rounded-full border border-arena-ink/15 bg-white/85 pl-9 pr-4 text-sm outline-none focus:border-arena-lime" />
        </label>
      </div>

      <div className="mt-4 rounded-[22px] border border-arena-ink/10 bg-white/85 p-3 shadow-[0_14px_35px_-28px] shadow-arena-ink/60 sm:p-5">
        {users.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-arena-dim"><Loader2 className="size-4 animate-spin" /> Memuat pengguna...</div>
        ) : users.isError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Gagal memuat pengguna. Pastikan sesi platform admin masih aktif.</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-arena-dim">Belum ada pengguna yang cocok.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => (
              <article key={user.user_id} className="rounded-2xl border border-arena-ink/10 bg-white/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserCog className="size-4 text-arena-lime" aria-hidden="true" />
                      <h3 className="truncate font-display font-bold text-arena-ink">{user.display_name || user.username || "Tanpa nama"}</h3>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{user.is_active ? "Aktif" : "Nonaktif"}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${user.email_confirmed_at ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}>{user.email_confirmed_at ? "Email terverifikasi" : "Menunggu verifikasi"}</span>
                    </div>
                    <p className="mt-1 text-sm text-arena-dim">{user.email || "Email belum diisi"} {user.username ? `· @${user.username}` : ""}</p>
                    <p className="mt-2 text-xs text-arena-dim">Global: {user.global_roles.length ? user.global_roles.join(", ") : "viewer"}</p>
                    <p className="mt-1 text-xs text-arena-dim">Organisasi: {user.memberships.length ? user.memberships.map((membership) => `${membership.organization_name} (${membership.role_code})`).join(", ") : "Belum ada"}</p>
                  </div>
                  <button type="button" disabled={busyKey === `status-${user.user_id}`} onClick={() => void run(`status-${user.user_id}`, async () => { const { error } = await supabase.rpc("platform_set_user_status", { p_user_id: user.user_id, p_is_active: !user.is_active }); if (error) throw error; })} className="inline-flex items-center gap-1.5 self-start rounded-full border border-arena-ink/15 px-3 py-2 text-xs font-bold uppercase tracking-wider transition hover:border-arena-lime disabled:opacity-50">
                    {user.is_active ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}{user.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                                  {!user.global_roles.includes("admin") && <button type="button" disabled={busyKey === `global-${user.user_id}`} onClick={() => void run(`global-${user.user_id}`, async () => { const { error } = await supabase.rpc("platform_set_user_role", { p_user_id: user.user_id, p_role_code: "platform_admin", p_enabled: !user.global_roles.includes("platform_admin") }); if (error) throw error; })} className="inline-flex items-center gap-1.5 self-start rounded-full border border-arena-ink/15 px-3 py-2 text-xs font-bold uppercase tracking-wider transition hover:border-arena-lime disabled:opacity-50">
                    {user.global_roles.includes("platform_admin") ? "Cabut platform admin" : "Jadikan platform admin"}
                  </button>}
</div>
                <div className="mt-4 grid gap-2 border-t border-arena-ink/10 pt-4 sm:grid-cols-[1fr_1fr_auto]">
                  <select value={selectedOrg} onChange={(event) => setSelectedOrg(event.target.value)} className="h-10 rounded-xl border border-arena-ink/15 bg-white px-3 text-sm outline-none focus:border-arena-lime">
                    <option value="">Pilih organisasi...</option>
                    {(organizations.data ?? []).map((organization) => <option key={organization.organization_id} value={organization.organization_id}>{organization.organization_name}</option>)}
                  </select>
                  <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className="h-10 rounded-xl border border-arena-ink/15 bg-white px-3 text-sm outline-none focus:border-arena-lime">
                    {ORGANIZATION_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button type="button" disabled={!selectedOrg || busyKey === `role-${user.user_id}`} onClick={() => void run(`role-${user.user_id}`, async () => { const { error } = await supabase.rpc("platform_set_membership_role", { p_user_id: user.user_id, p_organization_id: selectedOrg, p_role_code: selectedRole, p_enabled: true }); if (error) throw error; })} className="rounded-xl bg-arena-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-arena-lime hover:text-arena-ink disabled:opacity-50">Atur role</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
