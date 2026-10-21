// Label Indonesia baku untuk kode dari database (Rencana v2, bagian 5.5).
// Satu berkas untuk seluruh UI: jangan menampilkan kode mentah ke pengguna.
// Berkas ini sengaja tanpa impor agar bisa dites langsung dengan Node.

export const ROLE_LABELS: Readonly<Record<string, string>> = {
  organization_owner: "Owner",
  organization_admin: "Admin",
  event_manager: "Event Manager",
  scorer: "Scorer",
  coach: "Coach",
  player: "Player",
  viewer: "Viewer",
};

export const EVENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Draf",
  registration: "Pendaftaran dibuka",
  live: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const PARTICIPANT_STATUS_LABELS: Readonly<Record<string, string>> = {
  registered: "Terdaftar",
  waitlisted: "Daftar tunggu",
  checked_in: "Sudah hadir",
  withdrawn: "Mengundurkan diri",
};

export const INVOICE_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Draf",
  pending_payment: "Menunggu pembayaran",
  proof_submitted: "Bukti dikirim",
  under_review: "Ditinjau",
  paid: "Lunas",
  rejected: "Ditolak",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
};

// Nama paket mengikuti subscription_plans.name di database.
export const PLAN_LABELS: Readonly<Record<string, string>> = {
  free: "Free",
  club: "Club",
  pro: "Pro",
  enterprise: "Enterprise",
  casual: "Casual",
  squad: "Squad",
};

export const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  trialing: "Masa uji coba",
  active: "Aktif",
  past_due: "Jatuh tempo",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

// "organization_owner" -> "Organization Owner" bila kode belum punya label,
// agar tidak pernah tampil sebagai kode mentah bergaris bawah.
function humanize(code: string): string {
  return code
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelFrom(map: Readonly<Record<string, string>>, code: string | null | undefined): string {
  if (!code) return "-";
  return Object.hasOwn(map, code) ? (map[code] as string) : humanize(code);
}

export const roleLabel = (code: string | null | undefined) => labelFrom(ROLE_LABELS, code);
export const eventStatusLabel = (code: string | null | undefined) =>
  labelFrom(EVENT_STATUS_LABELS, code);
export const participantStatusLabel = (code: string | null | undefined) =>
  labelFrom(PARTICIPANT_STATUS_LABELS, code);
export const invoiceStatusLabel = (code: string | null | undefined) =>
  labelFrom(INVOICE_STATUS_LABELS, code);
export const planLabel = (code: string | null | undefined) => labelFrom(PLAN_LABELS, code);
export const subscriptionStatusLabel = (code: string | null | undefined) =>
  labelFrom(SUBSCRIPTION_STATUS_LABELS, code);
