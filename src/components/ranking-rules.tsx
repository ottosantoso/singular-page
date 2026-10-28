import { ChevronDown, Scale } from "lucide-react";
import { criterionHint, criterionLabel, profileSummary, type RankingProfile } from "@/lib/ranking";

type Props = {
  profile: RankingProfile;
  // Rentang jumlah main antar pemain; diisi bila ada pemain yang main lebih sedikit.
  gamesSpread?: { min: number; max: number } | null;
};

// Panel "Aturan peringkat": menjelaskan urutan kriteria, acuan, dan catatan perhitungan.
export function RankingRules({ profile, gamesSpread }: Props) {
  const unevenGames = !!gamesSpread && gamesSpread.min !== gamesSpread.max;

  return (
    <details className="group rounded-lg border border-arena-ink/10 bg-card/85 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${profile.accent}26`, color: profile.accent }}
          >
            <Scale className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xs font-bold uppercase tracking-wider text-arena-ink">
              Aturan peringkat {profile.label}
            </span>
            <span className="block truncate text-xs text-arena-dim">{profileSummary(profile)}</span>
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-arena-dim transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="space-y-4 border-t border-arena-ink/10 px-4 py-4 text-sm text-arena-dim sm:px-5">
        <ol className="space-y-3">
          {profile.criteria.map((criterion, index) => (
            <li key={criterion} className="flex gap-3">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white"
                style={{ background: profile.accent }}
              >
                {index + 1}
              </span>
              <span>
                <span className="block font-semibold text-arena-ink">
                  {criterionLabel(criterion, profile)}
                </span>
                <span className="block text-xs leading-relaxed">
                  {criterionHint(criterion, profile)}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed">
          <p>
            <span className="font-semibold text-arena-ink">Acuan: </span>
            {profile.reference}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-arena-ink">Penyesuaian arena: </span>
            {profile.adaptation}
          </p>
        </div>

        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed">
          <li>
            Pertandingan 0–0 dianggap belum dimainkan; skor yang masih berjalan baru dihitung
            setelah ronde ditutup.
          </li>
          <li>Jika semua kriteria sama, pemain berbagi peringkat yang sama (1, 2, 2, 3).</li>
          {unevenGames && gamesSpread && (
            <li>
              Jumlah main pemain tidak sama ({gamesSpread.min}–{gamesSpread.max} game). Peringkat
              memakai total, bukan rata-rata per game, sehingga pemain yang main lebih sedikit bisa
              tertinggal.
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}
