// Tipe + pembaca data untuk halaman admin (pratinjau permainan, HANYA BACA).
// Bentuk state mengikuti yang disimpan arena.html; data lama bisa berbeda (mis. players berupa string),
// jadi semua pembaca di sini toleran terhadap bentuk yang tidak terduga.

export type GameStatus = "live" | "idle" | "finished";
export type StatusFilter = GameStatus | "all";

export interface GameListItem {
  game_key: string;
  status: GameStatus;
  key_short: string;
  code: string | null;
  sport: string | null;
  mode: string | null;
  format: string | null;
  players: number;
  courts: number | null;
  round: number | null;
  owner: string | null;
  last_activity_at: string | null;
  finished_at: string | null;
  /** true = ditutup otomatis oleh sistem karena sepi (bukan diselesaikan host). */
  auto_closed?: boolean;
}

export interface GameCounts {
  live: number;
  idle: number;
  finished: number;
  all: number;
}

export interface GameListResponse {
  counts: GameCounts;
  items: GameListItem[];
}

export interface GameState {
  mode?: unknown;
  format?: unknown;
  round?: unknown;
  courtsRequested?: unknown;
  players?: unknown;
  currentSitOut?: unknown;
  current?: unknown;
  leaderboard?: unknown;
  matchHistory?: unknown;
  [key: string]: unknown;
}

export interface GameDetail {
  game_key: string;
  status: GameStatus;
  key_short: string;
  code: string | null;
  sport: string | null;
  owner: string | null;
  last_activity_at: string | null;
  finished_at: string | null;
  auto_closed?: boolean;
  state: GameState;
}

export interface CourtMatch {
  court: number;
  round: number | null;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  finished: boolean;
}

export interface LeaderRow {
  name: string;
  points: number;
  games: number;
  wins: number;
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  live: "Live",
  idle: "Tidak aktif",
  finished: "Selesai",
};

const SPORT_LABEL: Record<string, string> = {
  padel: "Padel",
  badminton: "Badminton",
  tennis: "Tenis",
  tenismeja: "Tenis Meja",
};

const FORMAT_LABEL: Record<string, string> = {
  americano: "Americano",
  mexicano: "Mexicano",
  super: "Super Mexicano",
  yingyang: "Ying Yang",
};

export function sportLabel(sport: string | null): string {
  if (!sport) return "Olahraga tidak tercatat";
  return SPORT_LABEL[sport] ?? sport.charAt(0).toUpperCase() + sport.slice(1);
}

export function formatLabel(mode: string | null, format: string | null): string {
  if (mode === "pairs") return "Pasangan Tetap";
  if (mode === "custom") return "Custom";
  return FORMAT_LABEL[format ?? "americano"] ?? "Americano";
}

export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "-";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- pembaca state ----------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function nameOf(v: unknown): string {
  if (typeof v === "string") return v;
  const name = asRecord(v)["name"];
  return typeof name === "string" ? name : "";
}

export function namesOf(v: unknown): string[] {
  return asArray(v).map(nameOf).filter(Boolean);
}

function toMatch(raw: unknown, fallbackRound: number | null): CourtMatch {
  const m = asRecord(raw);
  return {
    court: toNum(m["court"]) || 1,
    round: m["round"] === undefined || m["round"] === null ? fallbackRound : toNum(m["round"]),
    teamA: namesOf(m["teamA"]),
    teamB: namesOf(m["teamB"]),
    scoreA: toNum(m["scoreA"]),
    scoreB: toNum(m["scoreB"]),
    finished: m["finished"] === true,
  };
}

export function parsePlayers(state: GameState): string[] {
  return namesOf(state.players);
}

export function parseSitOut(state: GameState): string[] {
  return namesOf(state.currentSitOut);
}

/** Pertandingan di lapangan saat ini (belum ada pemain = lapangan kosong/menunggu, tidak ditampilkan). */
export function parseCurrent(state: GameState): CourtMatch[] {
  const round = typeof state.round === "number" ? state.round : null;
  return asArray(state.current)
    .map((m) => toMatch(m, round))
    .filter((m) => m["teamA"].length > 0 && m["teamB"].length > 0)
    .sort((a, b) => a.court - b.court);
}

/** Semua pertandingan yang sudah tersimpan, terbaru dulu. */
export function parseHistory(state: GameState): CourtMatch[] {
  const out: CourtMatch[] = [];
  for (const entry of asArray(state.matchHistory)) {
    const e = asRecord(entry);
    const round = e["round"] === undefined ? null : toNum(e["round"]);
    for (const m of asArray(e["matches"])) out.push(toMatch(m, round));
  }
  return out
    .filter((m) => m["teamA"].length > 0 && m["teamB"].length > 0)
    .sort((a, b) => (b.round ?? 0) - (a.round ?? 0) || a.court - b.court);
}

export function parseLeaderboard(state: GameState): LeaderRow[] {
  return Object.entries(asRecord(state.leaderboard))
    .map(([name, v]) => {
      const row = asRecord(v);
      return { name, points: toNum(row["points"]), games: toNum(row["games"]), wins: toNum(row["wins"]) };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}
