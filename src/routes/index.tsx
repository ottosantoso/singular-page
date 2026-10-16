import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ChevronRight, Trophy, UserRound, CalendarDays, RefreshCw, Play, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import bannerAsset from '@/assets/otto-play-arena-banner.png.asset.json';
import padelAsset from '@/assets/padel.png.asset.json';
import hero from '@/assets/sports-hero.jpg';
import padelCourt from '@/assets/padel-court.jpg';
import badmintonCourt from '@/assets/badminton-court.jpg';
import pingpongCourt from '@/assets/pingpong-court.jpg';
import tennisCourt from '@/assets/tennis-court.jpg';
import dice from '@/assets/dice.jpg';
import trophy from '@/assets/trophy.jpg';
import stopwatch from '@/assets/stopwatch.jpg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'OTTO PLAY ARENA — Sports • Strategy • Together' },
    { name: 'description', content: 'Mainkan strategi, biarkan Otto bereaksi. Rotasi otomatis untuk padel, badminton, tenis meja, dan tenis, lengkap dengan skor dan klasemen.' },
    { property: 'og:title', content: 'OTTO PLAY ARENA — Sports • Strategy • Together' },
    { property: 'og:description', content: 'Pilih olahraga, kocok pasangan, dan catat skor. Main bersama dengan rotasi otomatis OTTOPLAY ARENA.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Home,
});

const sports = [
  { name: 'PADEL', desc: '4 pemain per lapangan.', image: padelCourt, type: 'padel' },
  { name: 'BADMINTON', desc: 'Ganda & rotasi adil.', image: badmintonCourt, type: 'badminton' },
  { name: 'TENIS MEJA', desc: 'Ronde cepat, skor instan.', image: pingpongCourt, type: 'pingpong' },
  { name: 'TENIS', desc: 'Rotasi partner otomatis.', image: tennisCourt, type: 'tennis' },
];
const features = [
  { title: 'KOCOK OTOMATIS', desc: 'Partner & lawan diacak tiap ronde, tetap adil buat semua.', image: dice, type: 'dice', href: '/arena.html' },
  { title: 'SKOR & KLASEMEN', desc: 'Catat skor per match, klasemen langsung ter-update.', image: trophy, type: 'trophy', href: '/klasemen' },
  { title: 'TIMER RONDE', desc: 'Atur durasi ronde, dapat peringatan sebelum ganti.', image: stopwatch, type: 'stopwatch', href: '/arena.html' },
];
const steps = [
  { n: '01', title: 'Isi Pejuang', desc: 'Masukkan nama pemain yang hadir hari ini.' },
  { n: '02', title: 'Kocok Ronde', desc: 'Otto menyusun pasangan & lawan secara adil.' },
  { n: '03', title: 'Catat Skor', desc: 'Skor tersimpan, klasemen otomatis tersusun.' },
];

function Home() {
  return (
    <main className="sports-home arena-home court-lines">
      <nav className="home-nav" aria-label="Navigasi utama">
        <div className="home-width home-nav-inner">
          <Link to="/" className="home-logo" aria-label="OTTO PLAY ARENA Beranda">
            <span className="home-logo-mark"><img src={padelAsset.url} alt="" width={48} height={48} /></span>
            <span className="home-wordmark">OTTO <em>PLAY</em><small>A R E N A</small></span>
          </Link>
          <div className="home-badges">
            <span className="home-badge"><span className="home-pulse" />OTTO PLAY</span>
            <span className="home-badge"><RefreshCw /> ROTASI OTOMATIS OLAHRAGA RAKET</span>
          </div>
          <div className="home-nav-actions">
            <Button asChild variant="outline" className="home-button"><Link to="/klasemen"><Trophy />Klasemen</Link></Button>
            <Dialog>
              <DialogTrigger asChild><Button className="home-button home-button-red home-event"><CalendarDays />Event & Promo<span className="home-new">NEW</span></Button></DialogTrigger>
              <DialogContent>
                <DialogTitle>Event & Promo</DialogTitle>
                <DialogDescription>Belum ada event atau promo yang diumumkan.</DialogDescription>
                <Button asChild><a href="/arena.html">Mulai bermain <ArrowRight /></a></Button>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" className="home-button"><UserRound />Login</Button></DialogTrigger>
              <DialogContent>
                <DialogTitle>Masuk ke Arena</DialogTitle>
                <DialogDescription>Main lokal tanpa akun, atau sambungkan arena dengan kode dan PIN melalui “Main bareng di beberapa HP” di halaman Arena.</DialogDescription>
                <Button asChild><a href="/arena.html">Buka Arena <ArrowRight /></a></Button>
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline" className="home-button"><Link to="/admin"><ShieldCheck />Admin Platform</Link></Button>
          </div>
        </div>
      </nav>
      <section className="home-hero">
        <img src={hero} className="home-hero-image" width={1920} height={1024} alt="Atlet padel, badminton, tenis meja, dan tenis beraksi dengan semangat merah putih" fetchPriority="high" />
        <div className="home-width">
          <div className="home-hero-copy">
            <p className="home-eyebrow">SPORTS • STRATEGY • TOGETHER</p>
            <h1>OTTO <span>PLAY</span> ARENA</h1>
            <p className="home-subtitle">Mainkan strategi, biarkan Otto bereaksi. Rotasi otomatis penuh strategi sampai game berakhir.</p>
            <p className="home-description">Pilih cabang olahraga, kocok pasangan, dan biarkan rotasi berjalan otomatis dari ronde pertama sampai terakhir.</p>
            <div className="home-hero-actions">
              <Button asChild className="home-button home-button-red home-cta btn-arena"><a href="/arena.html"><Play fill="currentColor" /> MULAI SEKARANG <ChevronRight /></a></Button>
              <Button asChild variant="outline" className="home-button home-cta"><Link to="/klasemen"><Trophy /> LIHAT KLASEMEN</Link></Button>
            </div>
          </div>
        </div>
        <p className="home-slogan">Strategi<br />Bertemu<br /><span>Peluang!</span></p>
      </section>
      <span className="home-dots" aria-hidden="true" /><span className="home-dots home-dots-right" aria-hidden="true" />
      <div className="home-width home-content">
        <section aria-labelledby="sports-title">
          <h2 id="sports-title" className="home-section-title">CABANG OLAHRAGA</h2>
          <div className="home-sport-grid">
            {sports.map(s => <a href="/arena.html" key={s.name} className={`home-sport home-sport-${s.type} arena-card-static`} aria-label={`Buka Arena ${s.name}`}>
              <img src={s.image} alt={`Raket dan perlengkapan ${s.name.toLowerCase()}`} className="home-sport-image" width={480} height={768} loading="lazy" />
              <div className="home-sport-body"><h3>{s.name}</h3><p>{s.desc}</p><span className="home-arrow" aria-hidden="true"><ArrowRight /></span></div>
            </a>)}
          </div>
        </section>
        <section className="home-feature-grid" aria-label="Fitur Arena">
          {features.map(f => <a key={f.title} href={f.href} className={`home-feature home-feature-${f.type}`}>
            <img src={f.image} alt="" width={512} height={512} loading="lazy" />
            <div><h3>{f.title}</h3><p>{f.desc}</p></div>
            <span className="home-arrow" aria-hidden="true"><ArrowRight /></span>
          </a>)}
        </section>
        <section className="home-how">
          <h2>CARA MAIN</h2>
          <div className="home-step-grid">{steps.map(s => <div className="home-step" key={s.n}><strong>{s.n}</strong><div><h3>{s.title}</h3><p>{s.desc}</p></div></div>)}</div>
        </section>
        <footer className="home-footer">
          <img src={bannerAsset.url} alt="OTTO PLAY ARENA" width={140} height={48} className="mx-auto mb-3 h-auto w-28 rounded" loading="lazy" />
          Ottoplay Arena — mainkan strategi, biarkan Otto beraksi.
        </footer>
      </div>
    </main>
  );
}
