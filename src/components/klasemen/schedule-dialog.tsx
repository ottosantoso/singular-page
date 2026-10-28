import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { summarizeMatches, teamLabel, type InsightMatch } from "@/lib/klasemen-insights";

type Filter = "semua" | "live" | "selesai";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "semua", label: "Semua" },
  { key: "live", label: "Live" },
  { key: "selesai", label: "Selesai" },
];

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function MatchBadges({ match }: { match: InsightMatch }) {
  return (
    <>
      {match.status === "live" && (
        <span className="kl-badge kl-badge--live" title="Skor berjalan, belum dihitung ke klasemen">
          LIVE
        </span>
      )}
      {match.status === "auto_closed" && (
        <span className="kl-badge kl-badge--auto" title="Sesi ditinggal, ditutup otomatis dengan skor terakhir">
          Ditutup otomatis
        </span>
      )}
    </>
  );
}

export function ScheduleDialog({
  open,
  onOpenChange,
  matches,
  initialRound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Gabungan laga live + selesai.
  matches: InsightMatch[];
  initialRound: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("semua");
  const [round, setRound] = useState<number | "all">("all");
  const [query, setQuery] = useState("");

  // Setiap dialog dibuka, terapkan ronde awal (mis. dari tab "Ronde") dan reset pencarian.
  useEffect(() => {
    if (open) {
      setRound(initialRound ?? "all");
      setFilter("semua");
      setQuery("");
    }
  }, [open, initialRound]);

  const finished = useMemo(() => matches.filter((m) => m.status !== "live"), [matches]);
  const summary = useMemo(() => summarizeMatches(finished), [finished]);
  const liveCount = matches.length - finished.length;
  const rounds = useMemo(() => [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b), [matches]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches
      .filter((m) => (filter === "live" ? m.status === "live" : filter === "selesai" ? m.status !== "live" : true))
      .filter((m) => (round === "all" ? true : m.round === round))
      .filter((m) => (q ? [...m.team_a, ...m.team_b].some((name) => name.toLowerCase().includes(q)) : true))
      .sort((a, b) => a.round - b.round || a.court - b.court);
  }, [matches, filter, round, query]);

  const groups = useMemo(() => {
    const map = new Map<number, InsightMatch[]>();
    visible.forEach((m) => map.set(m.round, [...(map.get(m.round) ?? []), m]));
    return [...map.entries()];
  }, [visible]);

  const sumItems: Array<{ label: string; value: string; note?: string }> = [
    { label: "Total laga", value: String(matches.length), note: liveCount > 0 ? `${liveCount} sedang live` : `${summary.rounds} ronde` },
    { label: "Total poin", value: String(summary.totalPoints), note: "dari laga yang selesai" },
    { label: "Rata-rata total/laga", value: summary.avgTotal.toFixed(1), note: `${summary.avgTeam.toFixed(1)} per tim` },
    { label: "Laga seri", value: String(summary.draws), note: summary.draws === 0 ? "semua laga ada pemenang" : "skor sama" },
    {
      label: "Skor tertinggi",
      value: summary.highest ? String(summary.highest.score_a + summary.highest.score_b) : "—",
      note: summary.highest ? `${summary.highest.score_a} – ${summary.highest.score_b} · Ronde ${summary.highest.round}` : "Belum ada",
    },
    {
      label: "Laga paling ketat",
      value: summary.closest ? `${summary.closest.score_a} – ${summary.closest.score_b}` : "—",
      note: summary.closest ? `${teamLabel(summary.closest.team_a)} vs ${teamLabel(summary.closest.team_b)}` : "Belum ada",
    },
    {
      label: "Kemenangan telak",
      value: summary.biggest ? `${summary.biggest.score_a} – ${summary.biggest.score_b}` : "—",
      note: summary.biggest ? `Selisih ${Math.abs(summary.biggest.score_a - summary.biggest.score_b)} poin` : "Belum ada",
    },
    { label: "Lapangan terpakai", value: String(summary.perCourt.length), note: "unit lapangan" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="kl-dialog">
        <div className="kl-dialog-head">
          <DialogTitle>Semua Pertandingan</DialogTitle>
          <DialogDescription>
            Detail seluruh laga di arena ini beserta ringkasan keseluruhan. Skor live belum dihitung ke klasemen.
          </DialogDescription>
        </div>

        <div className="kl-dialog-body">
          {matches.length === 0 ? (
            <p className="kl-empty">Belum ada pertandingan tercatat.</p>
          ) : (
            <>
              <section aria-label="Ringkasan keseluruhan">
                <div className="kl-sum">
                  {sumItems.map((item) => (
                    <div key={item.label} className="kl-sum-item">
                      <small>{item.label}</small>
                      <b>{item.value}</b>
                      {item.note && <span>{item.note}</span>}
                    </div>
                  ))}
                </div>
                {summary.perCourt.length > 0 && (
                  <div className="kl-courts" aria-label="Jumlah laga per lapangan">
                    {summary.perCourt.map((c) => (
                      <span key={c.court}>
                        Lapangan {c.court}: {c.count} laga
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <div className="kl-dtools">
                <label className="kl-codeinput">
                  <Search aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama pemain…"
                    aria-label="Cari nama pemain"
                  />
                </label>
                <div className="kl-tabs" role="tablist" aria-label="Filter status laga">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={filter === f.key}
                      className={`kl-tab ${filter === f.key ? "is-active" : ""}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <select
                  className="kl-select"
                  value={round}
                  onChange={(e) => setRound(e.target.value === "all" ? "all" : Number(e.target.value))}
                  aria-label="Filter ronde"
                >
                  <option value="all">Semua ronde</option>
                  {rounds.map((r) => (
                    <option key={r} value={r}>
                      Ronde {r}
                    </option>
                  ))}
                </select>
              </div>

              {groups.length === 0 ? (
                <p className="kl-empty">Tidak ada laga yang cocok dengan filter.</p>
              ) : (
                groups.map(([roundNo, list]) => (
                  <section key={roundNo} className="kl-group">
                    <h3>
                      Ronde {roundNo}
                      <span>{list.length} laga</span>
                    </h3>
                    <div className="kl-group-list">
                      {list.map((match) => {
                        const diff = match.score_a - match.score_b;
                        return (
                          <article key={match.id} className="kl-dmatch">
                            <div className="kl-match-top">
                              <span className="c">Lapangan {match.court}</span>
                              <span style={{ display: "inline-flex", gap: ".35rem" }}>
                                <MatchBadges match={match} />
                                {match.status !== "live" && match.status !== "auto_closed" && (
                                  <span className="kl-badge kl-badge--done">Selesai</span>
                                )}
                              </span>
                            </div>
                            <div className="kl-match-body">
                              <p className={`kl-match-team ${diff > 0 ? "is-win" : ""}`} style={{ margin: 0 }}>
                                {teamLabel(match.team_a)}
                              </p>
                              <div className="kl-score">
                                {match.score_a} – {match.score_b}
                              </div>
                              <p className={`kl-match-team right ${diff < 0 ? "is-win" : ""}`} style={{ margin: 0 }}>
                                {teamLabel(match.team_b)}
                              </p>
                            </div>
                            <div className="kl-dmatch-foot">
                              <span>{diff === 0 ? "Seri" : `Selisih ${signed(Math.abs(diff))} poin`}</span>
                              <span>Total {match.score_a + match.score_b} poin</span>
                              {formatTime(match.created_at) && <span>Dicatat {formatTime(match.created_at)}</span>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
