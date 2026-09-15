import { createFileRoute, Link } from "@tanstack/react-router";
import bannerAsset from "@/assets/otto-play-arena-banner.png.asset.json";
import padelAsset from "@/assets/padel.png.asset.json";
import badmintonAsset from "@/assets/badminton.png.asset.json";
import pingpongAsset from "@/assets/pingpong.png.asset.json";
import tennisAsset from "@/assets/tennis.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OTTOPLAY ARENA — Rotasi Otomatis Padel, Badminton, Tenis" },
      {
        name: "description",
        content:
          "Atur rotasi pemain otomatis untuk padel, badminton, tenis meja, dan tenis. Kocok pasangan, catat skor, dan lihat klasemen real-time.",
      },
      { property: "og:title", content: "OTTOPLAY ARENA — Rotasi Otomatis Olahraga Raket" },
      {
        property: "og:description",
        content:
          "Pilih cabang olahraga, kocok pasangan, dan biarkan rotasi berjalan otomatis dari ronde pertama sampai terakhir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const sports = [
  {
    logo: padelAsset.url,
    name: "Padel",
    desc: "4 pemain per lapangan",
    accent: "oklch(0.62 0.19 143 / 0.55)",
    soft: "oklch(0.93 0.09 150)",
  },
  {
    logo: badmintonAsset.url,
    name: "Badminton",
    desc: "Ganda & rotasi adil",
    accent: "oklch(0.62 0.17 235 / 0.55)",
    soft: "oklch(0.93 0.07 235)",
  },
  {
    logo: pingpongAsset.url,
    name: "Tenis Meja",
    desc: "Ronde cepat, skor instan",
    accent: "oklch(0.65 0.22 15 / 0.55)",
    soft: "oklch(0.94 0.06 15)",
  },
  {
    logo: tennisAsset.url,
    name: "Tenis",
    desc: "Rotasi partner otomatis",
    accent: "oklch(0.75 0.17 85 / 0.6)",
    soft: "oklch(0.95 0.09 90)",
  },
];

const features = [
  { icon: "🎲", title: "Kocok Otomatis", desc: "Partner & lawan diacak tiap ronde, tetap adil buat semua." },
  { icon: "🏆", title: "Skor & Klasemen", desc: "Catat skor per match, klasemen langsung terupdate." },
  { icon: "⏱️", title: "Timer Ronde", desc: "Atur durasi ronde, dapat peringatan sebelum ganti." },
];

const steps = [
  { n: "01", title: "Isi Pejuang", desc: "Masukkan nama pemain yang hadir hari ini." },
  { n: "02", title: "Kocok Ronde", desc: "Otto menyusun pasangan & lawan secara adil." },
  { n: "03", title: "Catat Skor", desc: "Skor tersimpan, klasemen otomatis tersusun." },
];

function Home() {
  return (
    <main className="arena-home court-lines min-h-screen">
      <div className="relative mx-auto w-full max-w-5xl px-5 pb-20 pt-10">
        <nav className="mb-8 flex items-center justify-between">
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-arena-lime">
            Otto Play
          </span>
          <Link
            to="/klasemen"
            className="rounded-full border border-arena-lime/40 bg-white/70 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-arena-ink transition hover:border-arena-lime hover:bg-white"
          >
            Klasemen
          </Link>
        </nav>

        <section className="flex flex-col items-center text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-arena-lime/40 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-arena-lime">
            <span className="h-2 w-2 animate-pulse rounded-full bg-arena-lime" />
            Rotasi otomatis olahraga raket
          </span>

          <div className="relative w-full max-w-xl">
            <span className="float-slow absolute -left-6 -top-6 text-4xl md:-left-12">🎾</span>
            <span
              className="float-slow absolute -right-4 top-4 text-4xl md:-right-12"
              style={{ animationDelay: "1.4s" }}
            >
              🏸
            </span>
            <img
              src={bannerAsset.url}
              alt="OTTO PLAY ARENA"
              className="w-full rounded-2xl shadow-[0_24px_60px_-30px_rgba(20,40,30,0.6)]"
            />
          </div>

          <p className="mt-8 max-w-xl text-base leading-relaxed text-arena-dim">
            Pilih cabang olahraga, kocok pasangan, dan biarkan rotasi berjalan otomatis dari ronde
            pertama sampai terakhir.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="/arena.html" className="btn-arena">
              Mulai Sekarang
            </a>
            <Link
              to="/klasemen"
              className="rounded-full border border-arena-ink/15 bg-white/80 px-7 py-4 font-display text-sm font-bold uppercase tracking-wider text-arena-ink transition hover:-translate-y-0.5 hover:border-arena-lime hover:shadow-lg"
            >
              Lihat Klasemen
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-arena-heading mb-6 text-center">Cabang Olahraga</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sports.map((s) => (
              <div
                key={s.name}
                className="arena-card-static text-center"
                style={
                  {
                    "--sport-accent": s.accent,
                    "--sport-soft": s.soft,
                  } as React.CSSProperties
                }
              >
                <span className="sport-badge mx-auto">
                  <img
                    src={s.logo}
                    alt={`Logo ${s.name}`}
                    loading="lazy"
                    width={512}
                    height={512}
                    className="h-11 w-11 object-contain"
                  />
                </span>
                <span className="mt-3 block font-display text-lg font-bold uppercase tracking-wide">
                  {s.name}
                </span>
                <span className="mt-1 block text-xs text-arena-dim">{s.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="arena-card-static">
              <span className="text-2xl">{f.icon}</span>
              <h3 className="mt-2 font-display text-base font-bold uppercase tracking-wide text-arena-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-arena-dim">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-arena-heading mb-6 text-center">Cara Main</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="arena-card-static flex items-start gap-4">
                <span className="font-display text-3xl font-bold text-arena-lime">{s.n}</span>
                <span>
                  <span className="block font-display text-sm font-bold uppercase tracking-wide">
                    {s.title}
                  </span>
                  <span className="mt-1 block text-sm text-arena-dim">{s.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center text-xs text-arena-dim">
          <span className="font-display uppercase tracking-wider text-arena-lime">
            Ottoplay Arena
          </span>{" "}
          — mainkan strategi, biarkan Otto beraksi.
        </footer>
      </div>
    </main>
  );
}
