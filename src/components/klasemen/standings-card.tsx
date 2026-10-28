import { useMemo, useState } from "react";
import { BarChart3, List, Trophy } from "lucide-react";
import { Avatar } from "@/components/klasemen/avatar";
import type { Result } from "@/lib/klasemen-insights";
import { sortPlayers, type Movement, type RankedPlayer, type SortMode } from "@/lib/klasemen-ranking";

const SORT_OPTIONS: Array<{ key: SortMode; label: string }> = [
  { key: "juara", label: "Juara Umum" },
  { key: "poin", label: "Total Poin" },
  { key: "rata", label: "Rata-rata/Laga" },
  { key: "selisih", label: "Selisih Poin" },
];

const SORT_NOTE: Record<SortMode, string> = {
  juara: "Juara Umum: win rate, lalu % poin, selisih poin per laga, lalu jumlah menang. Seri penuh berbagi peringkat.",
  poin: "Urutan Total Poin: poin terbanyak, lalu selisih poin (aturan lama). Bukan peringkat resmi.",
  rata: "Urutan rata-rata poin per laga. Bukan peringkat resmi.",
  selisih: "Urutan total selisih poin. Bukan peringkat resmi.",
};

function signedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function StandingsCard({
  ordered,
  form,
  movement,
  maxPoints,
  minGames,
}: {
  ordered: RankedPlayer[];
  form: Map<string, Result[]>;
  movement: Map<string, Movement>;
  maxPoints: number;
  minGames: number;
}) {
  const [tab, setTab] = useState<"tabel" | "grafik">("tabel");
  const [mode, setMode] = useState<SortMode>("juara");
  const rows = useMemo(() => sortPlayers(ordered, mode), [ordered, mode]);
  const hasProvisional = ordered.some((p) => p.provisional);

  return (
    <section className="kl-card kl-table-card">
      <div className="kl-card-head">
        <div>
          <h2 className="kl-card-title">
            <Trophy aria-hidden="true" /> Klasemen Pertandingan
          </h2>
          <p className="kl-card-sub">Peringkat resmi berdasarkan win rate, bukan sekadar total poin.</p>
        </div>
        <div className="kl-sortbar">
          <select
            className="kl-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as SortMode)}
            aria-label="Urutkan klasemen"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Urutkan: {o.label}
              </option>
            ))}
          </select>
          <div className="kl-tabs" role="tablist" aria-label="Tampilan klasemen">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "tabel"}
              className={`kl-tab ${tab === "tabel" ? "is-active" : ""}`}
              onClick={() => setTab("tabel")}
            >
              <List aria-hidden="true" /> Tabel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "grafik"}
              className={`kl-tab ${tab === "grafik" ? "is-active" : ""}`}
              onClick={() => setTab("grafik")}
            >
              <BarChart3 aria-hidden="true" /> Grafik
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="kl-empty">Belum ada data untuk kode ini.</p>
      ) : tab === "tabel" ? (
        <div className="kl-scroll">
          <table className="kl-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Pejuang</th>
                <th>Main</th>
                <th>Menang</th>
                <th>Win Rate</th>
                <th>Poin</th>
                <th>Rata/Laga</th>
                <th>% Poin</th>
                <th>Selisih</th>
                <th>Form</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, index) => {
                const official = mode === "juara";
                const rankLabel = official ? (p.rank !== null ? p.rank : "–") : index + 1;
                const top = official ? p.rank === 1 : index === 0;
                const badge = typeof rankLabel === "number" && rankLabel <= 3 ? `kl-rankbadge--${rankLabel}` : "";
                const mv = official && p.rank !== null ? movement.get(p.name) : undefined;
                const results = (form.get(p.name) ?? []).slice(-5);
                return (
                  <tr key={p.name} className={top ? "is-leader" : undefined}>
                    <td>
                      <span className={`kl-rankbadge ${badge}`}>{rankLabel}</span>
                    </td>
                    <td>
                      <div className="kl-player">
                        <Avatar name={p.name} />
                        <span>{p.name}</span>
                        {mv && mv.delta !== 0 && (
                          <span className={`kl-move ${mv.delta > 0 ? "up" : "down"}`} title={`Dari #${mv.from} ke #${mv.to} di Ronde ${mv.round}`}>
                            {mv.delta > 0 ? "▲" : "▼"}
                            {Math.abs(mv.delta)}
                          </span>
                        )}
                        {p.provisional && (
                          <span
                            className="kl-badge kl-badge--auto"
                            title={`Baru ${p.games} laga. Minimal ${minGames} laga untuk masuk peringkat resmi.`}
                          >
                            Provisional
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{p.games}</td>
                    <td>{p.wins}</td>
                    <td>
                      <div className="kl-bar">
                        <div className="kl-bar-track">
                          <div className="kl-bar-fill" style={{ width: `${p.winRate}%` }} />
                        </div>
                        <span className="kl-bar-val">{p.winRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="kl-bar" style={{ minWidth: "6.5rem" }}>
                        <span className="kl-num">{p.pointsFor}</span>
                        <div className="kl-bar-track">
                          <div className="kl-bar-fill kl-bar-fill--red" style={{ width: `${(p.pointsFor / maxPoints) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="kl-num">{p.games > 0 ? p.avgFor.toFixed(1) : "—"}</td>
                    <td className="kl-num">{p.games > 0 ? `${p.pointPct.toFixed(0)}%` : "—"}</td>
                    <td className={`kl-num ${p.pointDiff > 0 ? "kl-pos" : p.pointDiff < 0 ? "kl-neg" : ""}`}>
                      {signedValue(p.pointDiff)}
                    </td>
                    <td>
                      <div className="kl-form" aria-label="Hasil 5 laga terakhir">
                        {results.length === 0 ? (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        ) : (
                          results.map((r, i) => (
                            <i key={i} className={r} title={r === "W" ? "Menang" : r === "L" ? "Kalah" : "Seri"}>
                              {r === "S" ? "S" : r === "W" ? "M" : "K"}
                            </i>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="kl-legend">
            <span>Poin</span>
            <span className="r">Win rate</span>
          </div>
          <div className="kl-chart">
            {rows.map((p) => (
              <div key={p.name} className="kl-chart-row">
                <b>{p.name}</b>
                <div className="kl-chart-bars">
                  <div className="kl-chart-line">
                    <div className="kl-bar-track">
                      <div className="kl-bar-fill" style={{ width: `${(p.pointsFor / maxPoints) * 100}%` }} />
                    </div>
                    <em>{p.pointsFor} poin</em>
                  </div>
                  <div className="kl-chart-line">
                    <div className="kl-bar-track">
                      <div className="kl-bar-fill kl-bar-fill--red" style={{ width: `${p.winRate}%` }} />
                    </div>
                    <em>{p.winRate.toFixed(0)}%</em>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="kl-rulenote">
        {SORT_NOTE[mode]}
        {hasProvisional && mode === "juara"
          ? ` Provisional = belum mencapai ${minGames} laga (50% jumlah ronde), tampil di bawah tanpa peringkat.`
          : ""}
      </p>
    </section>
  );
}
