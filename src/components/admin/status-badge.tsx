import { STATUS_LABEL, type GameStatus } from "@/lib/admin-games";

const STYLE: Record<GameStatus, string> = {
  live: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700",
  idle: "border-amber-500/40 bg-amber-500/15 text-amber-700",
  finished: "border-arena-ink/15 bg-arena-ink/5 text-arena-dim",
};

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${STYLE[status]}`}
    >
      {status === "live" && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
