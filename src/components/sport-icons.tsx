import { Trophy } from "lucide-react";

/** Kunci olahraga yang dipakai di database (events.sport / state permainan). */
export type SportKey = "padel" | "badminton" | "tennis" | "tenismeja";

export interface SportTheme {
  label: string;
  /** Gradient kotak ikon (kelas Tailwind) untuk daftar. */
  tile: string;
  tileText: string;
  /** Warna latar header event (gradient dari -> ke). */
  from: string;
  to: string;
  /** Warna aksen di atas latar gelap header. */
  accent: string;
  /** Panel ke-n (0-3) pada foto sport-equipment.jpg, null = tanpa foto. */
  panel: number | null;
}

export const SPORT_THEMES: Record<SportKey, SportTheme> = {
  padel: {
    label: "Padel",
    tile: "from-blue-500 to-indigo-700",
    tileText: "text-white",
    from: "#0a2a5e",
    to: "#1d4fb8",
    accent: "#a7e84f",
    panel: 0,
  },
  badminton: {
    label: "Badminton",
    tile: "from-teal-400 to-emerald-600",
    tileText: "text-white",
    from: "#07323a",
    to: "#0e6b66",
    accent: "#5ee08a",
    panel: 1,
  },
  tenismeja: {
    label: "Tenis Meja",
    tile: "from-rose-500 to-red-600",
    tileText: "text-white",
    from: "#40101a",
    to: "#9a2230",
    accent: "#ffb199",
    panel: 2,
  },
  tennis: {
    label: "Tenis",
    tile: "from-lime-300 to-yellow-400",
    tileText: "text-[#33400a]",
    from: "#2b3308",
    to: "#68760f",
    accent: "#f2e34a",
    panel: 3,
  },
};

export const DEFAULT_THEME: SportTheme = {
  label: "Olahraga",
  tile: "from-slate-500 to-slate-700",
  tileText: "text-white",
  from: "#0f2740",
  to: "#16405f",
  accent: "#8fe05a",
  panel: null,
};

export function normalizeSport(value: string | null | undefined): SportKey | null {
  const key = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (key === "padel") return "padel";
  if (key === "badminton") return "badminton";
  if (key === "tennis" || key === "tenis") return "tennis";
  if (key === "tenismeja" || key === "tabletennis" || key === "pingpong") return "tenismeja";
  return null;
}

export function sportTheme(value: string | null | undefined): SportTheme {
  const key = normalizeSport(value);
  return key ? SPORT_THEMES[key] : DEFAULT_THEME;
}

type IconProps = { className?: string | undefined };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Kok / shuttlecock. */
export function ShuttlecockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="19.4" r="2.3" />
      <path d="M10.1 17.5 6.6 4.9c3.5-1.1 7.3-1.1 10.8 0l-3.5 12.6" />
      <path d="M9.2 5.5l1.4 11.3M12 5.2v11.6M14.8 5.5l-1.4 11.3" />
    </svg>
  );
}

/** Raket padel: kepala bulat berlubang, gagang pendek. */
export function PadelRacketIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.2c3.6 0 6.3 2.6 6.3 6.2 0 3.4-2.5 5.7-6.3 6.9-3.8-1.2-6.3-3.5-6.3-6.9 0-3.6 2.7-6.2 6.3-6.2Z" />
      <path d="M12 15.3v5.1M10.4 21h3.2" />
      <g fill="currentColor" stroke="none">
        <circle cx="9.6" cy="6.4" r=".75" />
        <circle cx="12" cy="6" r=".75" />
        <circle cx="14.4" cy="6.4" r=".75" />
        <circle cx="8.6" cy="9" r=".75" />
        <circle cx="12" cy="8.8" r=".75" />
        <circle cx="15.4" cy="9" r=".75" />
        <circle cx="10.2" cy="11.5" r=".75" />
        <circle cx="13.8" cy="11.5" r=".75" />
      </g>
    </svg>
  );
}

/** Raket tenis: kepala oval bersenar, gagang panjang. */
export function TennisRacketIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <ellipse cx="12" cy="8.2" rx="5.6" ry="7.2" />
      <path d="M12 1.7v13M10.2 1.9v12.8M13.8 1.9v12.8M7.3 5.3h9.4M6.9 8.2h10.2M7.3 11.1h9.4" strokeWidth="1" />
      <path d="M10.4 15.2 12 18l1.6-2.8M12 18v4.3" />
    </svg>
  );
}

/** Bet tenis meja + bola. */
export function PingPongIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <g transform="rotate(35 12 12)">
        <circle cx="12" cy="8.6" r="6.4" fill="currentColor" fillOpacity=".22" />
        <rect x="9.9" y="14.8" width="4.2" height="6.2" rx="1.2" fill="currentColor" />
      </g>
      <circle cx="19.6" cy="19.6" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SportIcon({ sport, className }: { sport: string | null | undefined; className?: string | undefined }) {
  switch (normalizeSport(sport)) {
    case "badminton":
      return <ShuttlecockIcon className={className} />;
    case "padel":
      return <PadelRacketIcon className={className} />;
    case "tennis":
      return <TennisRacketIcon className={className} />;
    case "tenismeja":
      return <PingPongIcon className={className} />;
    default:
      return <Trophy className={className} aria-hidden="true" />;
  }
}
