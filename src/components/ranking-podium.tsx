import { Crown } from "lucide-react";
import { headlineMetric, type RankedStanding, type RankingProfile } from "@/lib/ranking";

const MEDAL = {
  1: { color: "#e0a526", soft: "#fdf3d6", label: "Juara 1" },
  2: { color: "#8fa0b5", soft: "#eef2f7", label: "Peringkat 2" },
  3: { color: "#c2773b", soft: "#f8e9dc", label: "Peringkat 3" },
} as const;

const PEDESTAL_HEIGHT = { 1: "h-28 sm:h-32", 2: "h-20 sm:h-24", 3: "h-14 sm:h-16" } as const;

function medalFor(rank: number) {
  return MEDAL[Math.min(3, Math.max(1, rank)) as 1 | 2 | 3];
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

type Props = {
  rows: readonly RankedStanding[];
  profile: RankingProfile;
};

// Podium tiga besar: juara di tengah, peringkat 2 di kiri, peringkat 3 di kanan.
export function RankingPodium({ rows, profile }: Props) {
  const top = rows.filter((r) => r.games > 0).slice(0, 3);
  if (top.length === 0) return null;
  const slots = [top[1], top[0], top[2]];

  return (
    <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Podium tiga besar">
      {slots.map((row, index) => {
        if (!row) return <li key={`kosong-${index}`} aria-hidden="true" />;
        const medal = medalFor(row.rank);
        const metric = headlineMetric(row, profile);
        const isChampion = row.rank === 1;
        return (
          <li key={row.name} className="flex min-w-0 flex-col items-center text-center">
            <div className="relative">
              {isChampion && (
                <Crown
                  className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 sm:-top-6 sm:size-6"
                  style={{ color: medal.color }}
                  fill={medal.color}
                  aria-hidden="true"
                />
              )}
              <div
                className={`flex items-center justify-center rounded-full border-2 font-display font-bold uppercase ${
                  isChampion
                    ? "size-14 text-xl sm:size-16 sm:text-2xl"
                    : "size-11 text-base sm:size-14 sm:text-xl"
                }`}
                style={{ borderColor: medal.color, background: medal.soft, color: medal.color }}
                aria-hidden="true"
              >
                {row.name.trim().charAt(0) || "?"}
              </div>
            </div>
            <p className="mt-2 w-full truncate px-1 font-display text-xs font-bold uppercase tracking-wide text-arena-ink sm:text-sm">
              {row.name}
            </p>
            <p className="font-display text-lg font-bold leading-tight text-arena-ink sm:text-2xl">
              {metric.value}
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-arena-dim sm:text-xs">
                {metric.label}
              </span>
            </p>
            <p className="mb-2 text-[10px] text-arena-dim sm:text-xs">
              {row.games} main · {row.wins} menang · {signed(row.pointDiff)}
            </p>
            <div
              className={`flex w-full items-start justify-center rounded-t-xl pt-2 font-display text-2xl font-bold text-white shadow-inner sm:text-3xl ${PEDESTAL_HEIGHT[Math.min(3, Math.max(1, row.rank)) as 1 | 2 | 3]}`}
              style={{ background: `linear-gradient(180deg, ${medal.color}, ${medal.color}b3)` }}
            >
              <span aria-label={medal.label}>{row.rank}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
