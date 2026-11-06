// Fungsi murni untuk halaman Workspace (Batch C). Tanpa import supaya bisa dites langsung (npm test).

export type InviteStatus = "pending" | "expired" | "accepted";

export const INVITE_TTL_MS = 7 * 86_400_000;

// Status undangan diturunkan dari kolom yang sudah ada (accepted_at, expires_at); tabel tidak punya kolom status.
export function inviteStatus(
  invite: { accepted_at: string | null; expires_at: string },
  now: Date = new Date(),
): InviteStatus {
  if (invite.accepted_at) return "accepted";
  return new Date(invite.expires_at).getTime() > now.getTime() ? "pending" : "expired";
}

export function inviteExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_MS).toISOString();
}

// Hash token undangan di klien. Harus sama dengan encode(digest(token, 'sha256'), 'hex') di
// accept_organization_invite, kalau tidak undangan tidak bisa diterima.
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Mengembalikan pesan galat, atau null kalau waktu valid. Nilai berasal dari input datetime-local.
export function validateEventTimes(startsAt: string, endsAt: string): string | null {
  if (!endsAt) return null;
  if (!startsAt) return "Isi waktu mulai dulu sebelum mengisi waktu selesai.";
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Format waktu tidak valid.";
  return end >= start ? null : "Waktu selesai tidak boleh lebih awal dari waktu mulai.";
}
