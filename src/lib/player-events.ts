// Penyaring event untuk Player hub (D3).
// Status event yang valid: draft, registration, live, completed, cancelled.
// Berkas ini sengaja tanpa impor agar bisa dites langsung dengan Node.

export const INACTIVE_EVENT_STATUSES: readonly string[] = ["completed", "cancelled"];

export type EventWithStatus = { status: string };

/** Event dianggap aktif bila ada dan belum selesai atau dibatalkan. */
export function isActiveEvent(event: EventWithStatus | null | undefined): boolean {
  return Boolean(event) && !INACTIVE_EVENT_STATUSES.includes((event as EventWithStatus).status);
}

/** Menyaring entri pendaftaran pemain menjadi hanya yang event-nya masih aktif. */
export function filterActiveEvents<T extends { event: EventWithStatus | null }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => isActiveEvent(item.event));
}
