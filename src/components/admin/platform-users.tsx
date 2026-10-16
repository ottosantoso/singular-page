import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  EllipsisVertical,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Membership = {
  organization_id?: string;
  organization_name: string;
  role_code: string;
  status?: string;
};

type PlatformUser = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  is_active: boolean;
  email_confirmed_at: string | null;
  global_roles: string[];
  memberships: Membership[];
};

type PlatformOrganization = { organization_id: string; organization_name: string };

type Feedback = { type: "success" | "error"; message: string } | null;

type RunAction = (
  key: string,
  action: () => Promise<void>,
  successMessage: string,
) => Promise<void>;

const ORGANIZATION_ROLES = [
  ["organization_owner", "Owner organisasi"],
  ["organization_admin", "Admin organisasi"],
  ["event_manager", "Event manager"],
  ["scorer", "Scorer"],
  ["coach", "Coach"],
  ["viewer", "Viewer"],
] as const;

const GLOBAL_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  platform_admin: "Platform Admin",
  player: "Player",
  viewer: "Viewer",
};

const PAGE_SIZES = [10, 20, 50];
const PLATFORM_FILTER = "__platform";
const NO_ORG_FILTER = "__none";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-600",
  "bg-purple-500",
  "bg-orange-500",
  "bg-teal-600",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-cyan-600",
];

const globalRoleLabel = (code: string) => GLOBAL_ROLE_LABELS[code] ?? code;
const orgRoleLabel = (code: string) =>
  ORGANIZATION_ROLES.find(([value]) => value === code)?.[1] ?? code;
const effectiveGlobalRoles = (user: PlatformUser) =>
  user.global_roles.length ? user.global_roles : ["viewer"];
const isPlatformAdmin = (user: PlatformUser) =>
  user.global_roles.some((role) => role === "admin" || role === "platform_admin");
const userName = (user: PlatformUser) => user.display_name || user.username || "Tanpa nama";

const globalRoleTone = (code: string) =>
  code === "admin" || code === "platform_admin"
    ? "bg-violet-100 text-violet-700"
    : code === "player"
      ? "bg-sky-100 text-sky-700"
      : "bg-slate-100 text-slate-600";

const orgRoleTone = (code: string) =>
  code === "organization_owner" || code === "organization_admin"
    ? "bg-violet-100 text-violet-700"
    : "bg-emerald-100 text-emerald-700";

function initials(user: PlatformUser) {
  const parts = userName(user)
    .replace(/[^\p{L}\p{N}\s_.-]/gu, " ")
    .split(/[\s_.-]+/)
    .filter(Boolean);
  const first = parts[0] ?? "?";
  const second = parts[1];
  const text = second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2);
  return text.toUpperCase();
}

function avatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "bg-slate-500";
}

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Aksi gagal dijalankan. Coba lagi.";
}

export function PlatformUsers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

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

  const run: RunAction = async (key, action, successMessage) => {
    setBusyKey(key);
    setFeedback(null);
    try {
      await action();
      await users.refetch();
      setFeedback({ type: "success", message: successMessage });
    } catch (error) {
      setFeedback({ type: "error", message: errorMessage(error) });
    } finally {
      setBusyKey(null);
    }
  };

  const all = useMemo(() => users.data ?? [], [users.data]);

  const stats = useMemo(
    () => ({
      total: all.length,
      active: all.filter((user) => user.is_active).length,
      pending: all.filter((user) => !user.email_confirmed_at).length,
      admins: all.filter(isPlatformAdmin).length,
    }),
    [all],
  );

  const roleOptions = useMemo(() => {
    const codes = new Set<string>(["viewer"]);
    for (const user of all) for (const code of user.global_roles) codes.add(code);
    return [...codes].sort();
  }, [all]);

  const needle = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      all.filter((user) => {
        if (needle) {
          const haystack = [
            user.email,
            user.username,
            user.display_name,
            ...user.memberships.map((m) => m.organization_name),
          ];
          if (!haystack.some((value) => value?.toLowerCase().includes(needle))) return false;
        }
        if (status === "active" && !user.is_active) return false;
        if (status === "inactive" && user.is_active) return false;
        if (status === "pending" && user.email_confirmed_at) return false;
        if (
          role === PLATFORM_FILTER
            ? !isPlatformAdmin(user)
            : role !== "all" && !effectiveGlobalRoles(user).includes(role)
        )
          return false;
        if (orgFilter === NO_ORG_FILTER && user.memberships.length > 0) return false;
        if (
          orgFilter !== "all" &&
          orgFilter !== NO_ORG_FILTER &&
          !user.memberships.some((m) => m.organization_id === orgFilter)
        )
          return false;
        return true;
      }),
    [all, needle, status, role, orgFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const selected = all.find((user) => user.user_id === selectedId) ?? null;

  const filtersActive =
    Boolean(needle) || status !== "all" || role !== "all" || orgFilter !== "all";
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setRole("all");
    setOrgFilter("all");
    setPage(1);
  };
  const applyStat = (next: { status?: string; role?: string }) => {
    setSearch("");
    setOrgFilter("all");
    setStatus(next.status ?? "all");
    setRole(next.role ?? "all");
    setPage(1);
  };

  const toggleStatus = (user: PlatformUser) =>
    run(
      `status-${user.user_id}`,
      async () => {
        const { error } = await supabase.rpc("platform_set_user_status", {
          p_user_id: user.user_id,
          p_is_active: !user.is_active,
        });
        if (error) throw error;
      },
      user.is_active ? `${userName(user)} dinonaktifkan.` : `${userName(user)} diaktifkan.`,
    );

  const togglePlatformAdmin = (user: PlatformUser) => {
    const enabled = !user.global_roles.includes("platform_admin");
    return run(
      `global-${user.user_id}`,
      async () => {
        const { error } = await supabase.rpc("platform_set_user_role", {
          p_user_id: user.user_id,
          p_role_code: "platform_admin",
          p_enabled: enabled,
        });
        if (error) throw error;
      },
      enabled
        ? `${userName(user)} dijadikan platform admin.`
        : `Platform admin ${userName(user)} dicabut.`,
    );
  };

  const setMembership = (user: PlatformUser, organizationId: string, roleCode: string) =>
    run(
      `role-${user.user_id}`,
      async () => {
        const { error } = await supabase.rpc("platform_set_membership_role", {
          p_user_id: user.user_id,
          p_organization_id: organizationId,
          p_role_code: roleCode,
          p_enabled: true,
        });
        if (error) throw error;
      },
      `Role ${orgRoleLabel(roleCode)} untuk ${userName(user)} tersimpan.`,
    );

  return (
    <section className="mt-6 rounded-[26px] border border-arena-ink/10 bg-white/90 p-4 shadow-[0_24px_60px_-40px] shadow-arena-ink/50 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-arena-lime" aria-hidden="true" />
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-arena-ink">
            Manajemen Pengguna
          </h2>
          <p className="mt-1 text-sm text-arena-dim">
            Kelola akun, akses platform, dan keanggotaan organisasi. Pendaftaran baru otomatis masuk
            sebagai viewer.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan pengguna">
        <StatCard
          label="Total Pengguna"
          value={users.isLoading ? undefined : stats.total}
          icon={<Users className="size-6" aria-hidden="true" />}
          tone="bg-blue-100 text-blue-600"
          onClick={() => applyStat({})}
        />
        <StatCard
          label="Aktif"
          value={users.isLoading ? undefined : stats.active}
          icon={<CircleCheck className="size-6" aria-hidden="true" />}
          tone="bg-emerald-100 text-emerald-600"
          onClick={() => applyStat({ status: "active" })}
        />
        <StatCard
          label="Menunggu Verifikasi"
          value={users.isLoading ? undefined : stats.pending}
          icon={<Clock className="size-6" aria-hidden="true" />}
          tone="bg-amber-100 text-amber-600"
          onClick={() => applyStat({ status: "pending" })}
        />
        <StatCard
          label="Admin Platform"
          value={users.isLoading ? undefined : stats.admins}
          icon={<ShieldCheck className="size-6" aria-hidden="true" />}
          tone="bg-violet-100 text-violet-600"
          onClick={() => applyStat({ role: PLATFORM_FILTER })}
        />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-arena-ink/10 bg-white/70 p-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
        <label className="relative block">
          <span className="sr-only">Cari pengguna</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-arena-dim"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, username, email, atau organisasi..."
            className="h-11 w-full rounded-xl border border-arena-ink/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-arena-lime"
          />
        </label>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="pending">Menunggu verifikasi</option>
        </FilterSelect>
        <FilterSelect
          label="Role"
          value={role}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        >
          <option value="all">Semua Role</option>
          <option value={PLATFORM_FILTER}>Admin platform</option>
          {roleOptions.map((code) => (
            <option key={code} value={code}>
              {globalRoleLabel(code)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Organisasi"
          value={orgFilter}
          onChange={(value) => {
            setOrgFilter(value);
            setPage(1);
          }}
        >
          <option value="all">Semua Organisasi</option>
          <option value={NO_ORG_FILTER}>Belum ada organisasi</option>
          {(organizations.data ?? []).map((organization) => (
            <option key={organization.organization_id} value={organization.organization_id}>
              {organization.organization_name}
            </option>
          ))}
        </FilterSelect>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!filtersActive}
          className="h-11 rounded-xl border border-arena-ink/15 bg-white px-4 text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      {feedback && !selected && <FeedbackBanner feedback={feedback} />}

      <div className="mt-4 overflow-hidden rounded-2xl border border-arena-ink/10 bg-white">
        {users.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-arena-dim">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat pengguna...
          </div>
        ) : users.isError ? (
          <p className="m-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Gagal memuat pengguna. Pastikan sesi platform admin masih aktif.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-arena-dim">Belum ada pengguna yang cocok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-arena-ink/10 bg-slate-50/80 text-xs font-bold text-arena-ink">
                  <th className="px-4 py-3.5 font-bold">Pengguna</th>
                  <th className="px-3 py-3.5 font-bold">Status</th>
                  <th className="px-3 py-3.5 font-bold">Akses Global</th>
                  <th className="px-3 py-3.5 font-bold">Organisasi</th>
                  <th className="px-4 py-3.5 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-ink/10">
                {pageItems.map((user) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    busyKey={busyKey}
                    onOpen={() => {
                      setFeedback(null);
                      setSelectedId(user.user_id);
                    }}
                    onToggleStatus={() => void toggleStatus(user)}
                    onTogglePlatformAdmin={() => void togglePlatformAdmin(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!users.isLoading && !users.isError && filtered.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 text-xs text-arena-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            Menampilkan {start + 1}-{Math.min(start + pageSize, filtered.length)} dari{" "}
            <strong className="text-arena-ink">{filtered.length}</strong> pengguna
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <PageButton
              label="Halaman sebelumnya"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </PageButton>
            {pageWindow(currentPage, totalPages).map((number) => (
              <PageButton
                key={number}
                label={`Halaman ${number}`}
                active={number === currentPage}
                onClick={() => setPage(number)}
              >
                {number}
              </PageButton>
            ))}
            <PageButton
              label="Halaman berikutnya"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageButton>
            <label className="ml-1">
              <span className="sr-only">Jumlah per halaman</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-arena-ink/15 bg-white px-2 text-xs text-arena-ink outline-none focus:border-arena-lime"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} / halaman
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <AccessDialog
        key={selected?.user_id ?? "closed"}
        user={selected}
        organizations={organizations.data ?? []}
        busyKey={busyKey}
        feedback={feedback}
        onClose={() => setSelectedId(null)}
        onToggleStatus={toggleStatus}
        onTogglePlatformAdmin={togglePlatformAdmin}
        onSetMembership={setMembership}
      />
    </section>
  );
}

function pageWindow(current: number, total: number) {
  const size = Math.min(5, total);
  let first = Math.max(1, current - Math.floor(size / 2));
  first = Math.min(first, total - size + 1);
  return Array.from({ length: size }, (_, index) => first + index);
}

function StatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | undefined;
  icon: ReactNode;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-arena-ink/10 bg-white p-4 text-left shadow-[0_10px_26px_-22px] shadow-arena-ink/60 transition hover:border-arena-lime/60"
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${tone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-arena-dim">{label}</span>
        <span className="mt-0.5 block font-display text-3xl font-bold tabular-nums text-arena-ink">
          {value ?? "–"}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-arena-dim transition group-hover:translate-x-0.5 group-hover:text-arena-lime"
        aria-hidden="true"
      />
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative block rounded-xl border border-arena-ink/15 bg-white px-3 pb-1 pt-1.5 transition focus-within:border-arena-lime lg:min-w-40">
      <span className="block text-[10px] font-medium text-arena-dim">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-arena-ink outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function PageButton({
  children,
  label,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-lg border text-xs font-bold transition disabled:opacity-40 ${
        active
          ? "border-arena-lime bg-arena-lime text-primary-foreground"
          : "border-arena-ink/15 bg-white text-arena-ink hover:border-arena-lime"
      }`}
    >
      {children}
    </button>
  );
}

function FeedbackBanner({ feedback }: { feedback: NonNullable<Feedback> }) {
  return (
    <p
      role={feedback.type === "error" ? "alert" : "status"}
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        feedback.type === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {feedback.message}
    </p>
  );
}

function UserRow({
  user,
  busyKey,
  onOpen,
  onToggleStatus,
  onTogglePlatformAdmin,
}: {
  user: PlatformUser;
  busyKey: string | null;
  onOpen: () => void;
  onToggleStatus: () => void;
  onTogglePlatformAdmin: () => void;
}) {
  const verified = Boolean(user.email_confirmed_at);
  const shownMemberships = user.memberships.slice(0, 2);
  const extra = user.memberships.length - shownMemberships.length;

  return (
    <tr className="transition hover:bg-emerald-50/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user.user_id)}`}
            aria-hidden="true"
          >
            {initials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-arena-ink">{userName(user)}</p>
            <p className="truncate text-xs text-arena-dim">
              {user.email || "Email belum diisi"}
              {user.username ? ` · @${user.username}` : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
          >
            <span
              className={`size-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-red-500"}`}
              aria-hidden="true"
            />
            {user.is_active ? "Aktif" : "Nonaktif"}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${verified ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`}
          >
            {verified ? "Email terverifikasi" : "Menunggu verifikasi"}
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {effectiveGlobalRoles(user).map((code) => (
            <span
              key={code}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${globalRoleTone(code)}`}
            >
              {globalRoleLabel(code)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        {user.memberships.length === 0 ? (
          <span className="text-xs text-arena-dim">Belum ada</span>
        ) : (
          <ul className="space-y-1">
            {shownMemberships.map((membership) => (
              <li
                key={`${membership.organization_id ?? membership.organization_name}-${membership.role_code}`}
                className={`flex flex-wrap items-center gap-1.5 ${membership.status && membership.status !== "active" ? "opacity-50" : ""}`}
              >
                <span className="text-xs font-medium text-arena-ink">
                  {membership.organization_name}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${orgRoleTone(membership.role_code)}`}
                >
                  {orgRoleLabel(membership.role_code)}
                </span>
              </li>
            ))}
            {extra > 0 && <li className="text-[11px] text-arena-dim">+{extra} organisasi lain</li>}
          </ul>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-arena-lime hover:bg-emerald-100"
          >
            <KeyRound className="size-3.5" aria-hidden="true" /> Atur akses
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Aksi cepat untuk ${userName(user)}`}
                className="flex size-9 items-center justify-center rounded-lg text-arena-dim transition hover:bg-slate-100 hover:text-arena-ink"
              >
                <EllipsisVertical className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={busyKey === `status-${user.user_id}`}
                onSelect={onToggleStatus}
              >
                {user.is_active ? <Ban className="size-4" /> : <Check className="size-4" />}
                {user.is_active ? "Nonaktifkan" : "Aktifkan"}
              </DropdownMenuItem>
              {!user.global_roles.includes("admin") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={busyKey === `global-${user.user_id}`}
                    onSelect={onTogglePlatformAdmin}
                  >
                    <ShieldCheck className="size-4" />
                    {user.global_roles.includes("platform_admin")
                      ? "Cabut platform admin"
                      : "Jadikan platform admin"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

function AccessDialog({
  user,
  organizations,
  busyKey,
  feedback,
  onClose,
  onToggleStatus,
  onTogglePlatformAdmin,
  onSetMembership,
}: {
  user: PlatformUser | null;
  organizations: PlatformOrganization[];
  busyKey: string | null;
  feedback: Feedback;
  onClose: () => void;
  onToggleStatus: (user: PlatformUser) => Promise<void>;
  onTogglePlatformAdmin: (user: PlatformUser) => Promise<void>;
  onSetMembership: (user: PlatformUser, organizationId: string, roleCode: string) => Promise<void>;
}) {
  const firstMembership = user?.memberships.find((membership) => membership.organization_id);
  const [organizationId, setOrganizationId] = useState(firstMembership?.organization_id ?? "");
  const [roleCode, setRoleCode] = useState(firstMembership?.role_code ?? "viewer");

  const chooseOrganization = (id: string) => {
    setOrganizationId(id);
    const existing = user?.memberships.find((membership) => membership.organization_id === id);
    setRoleCode(existing?.role_code ?? "viewer");
  };

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user.user_id)}`}
                  aria-hidden="true"
                >
                  {initials(user)}
                </span>
                <span className="min-w-0 truncate">{userName(user)}</span>
              </DialogTitle>
              <DialogDescription>
                {user.email || "Email belum diisi"}
                {user.username ? ` · @${user.username}` : ""}
              </DialogDescription>
            </DialogHeader>

            {feedback && <FeedbackBanner feedback={feedback} />}

            <div className="space-y-5">
              <section className="rounded-2xl border border-arena-ink/10 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-arena-ink">
                  Status akun
                </h3>
                <p className="mt-1 text-xs text-arena-dim">
                  Saat ini{" "}
                  <strong className="text-arena-ink">
                    {user.is_active ? "aktif" : "nonaktif"}
                  </strong>
                  . Akun nonaktif tidak dapat dipakai masuk.
                </p>
                <button
                  type="button"
                  disabled={busyKey === `status-${user.user_id}`}
                  onClick={() => void onToggleStatus(user)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-arena-ink/15 px-3 py-2 text-xs font-bold uppercase tracking-wider transition hover:border-arena-lime disabled:opacity-50"
                >
                  {user.is_active ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                  {user.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </section>

              {!user.global_roles.includes("admin") && (
                <section className="rounded-2xl border border-arena-ink/10 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-arena-ink">
                    Akses platform
                  </h3>
                  <p className="mt-1 text-xs text-arena-dim">
                    Role global: {effectiveGlobalRoles(user).map(globalRoleLabel).join(", ")}.
                  </p>
                  <button
                    type="button"
                    disabled={busyKey === `global-${user.user_id}`}
                    onClick={() => void onTogglePlatformAdmin(user)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-arena-ink/15 px-3 py-2 text-xs font-bold uppercase tracking-wider transition hover:border-arena-lime disabled:opacity-50"
                  >
                    <ShieldCheck className="size-3.5" />
                    {user.global_roles.includes("platform_admin")
                      ? "Cabut platform admin"
                      : "Jadikan platform admin"}
                  </button>
                </section>
              )}

              <section className="rounded-2xl border border-arena-ink/10 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-arena-ink">
                  Role organisasi
                </h3>
                <p className="mt-1 text-xs text-arena-dim">
                  {user.memberships.length
                    ? user.memberships
                        .map(
                          (membership) =>
                            `${membership.organization_name} (${orgRoleLabel(membership.role_code)})`,
                        )
                        .join(", ")
                    : "Belum tergabung di organisasi mana pun."}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    aria-label="Organisasi"
                    value={organizationId}
                    onChange={(event) => chooseOrganization(event.target.value)}
                    className="h-10 rounded-xl border border-arena-ink/15 bg-white px-3 text-sm outline-none focus:border-arena-lime"
                  >
                    <option value="">Pilih organisasi...</option>
                    {organizations.map((organization) => (
                      <option
                        key={organization.organization_id}
                        value={organization.organization_id}
                      >
                        {organization.organization_name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Role organisasi"
                    value={roleCode}
                    onChange={(event) => setRoleCode(event.target.value)}
                    className="h-10 rounded-xl border border-arena-ink/15 bg-white px-3 text-sm outline-none focus:border-arena-lime"
                  >
                    {ORGANIZATION_ROLES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!organizationId || busyKey === `role-${user.user_id}`}
                  onClick={() => void onSetMembership(user, organizationId, roleCode)}
                  className="mt-3 rounded-xl bg-arena-ink px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-arena-lime hover:text-arena-ink disabled:opacity-50"
                >
                  Atur role
                </button>
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
