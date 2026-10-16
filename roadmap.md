# Arena visual refinement
- [x] Apply screens 3–6 blue/red glass Arena appearance using scoped CSS only.
- [x] Verify unchanged scripts, npm test, mobile widths, and real local score/finish flow; capture before/after screenshots.
- [x] Apply selected Neon Sport Pro appearance while preserving all game code and existing elements.
- [x] Verify images, icons, narrow/wide layouts, and a full local tournament flow in Chromium (320–1920px).

# Homepage reference redesign
- [x] Apply red–white–blue reference, athlete visual, sport cards, and navigation while preserving existing functions.
- [x] Verify mobile/desktop layouts, imagery, and existing Arena/Klasemen navigation.

# Arena sport themes
- [x] Padel, Badminton, Tenis, and Tenis Meja Arena themes with per-sport photo backgrounds, using scoped CSS only (`public/arena-sport-themes.css`); Padel and gameplay scripts untouched.
- [x] Verify 390/1024/1440/1920px layouts and a full local flow (add players, Kocok & Mulai) in Chromium.

# Redesign layar "Pilih Arena Kamu"
- [x] Layar menu pilih olahraga (`#welcomeScreen` di `public/arena.html`) didesain ulang sesuai referensi: background foto lapangan, banner navy, kartu kaca dengan foto + ikon bulat berwarna, kartu Riwayat full-width. CSS terisolasi di `public/arena-menu-redesign.css`; script gameplay, layar Arena, dan Riwayat tidak diubah.

# Format Ying Yang + Tier pemain
- [x] Pilih tier (Newbie–Elite, opsional) saat tambah pemain; tampil di daftar pemain terdaftar; tersimpan di state sesi dan kolom `arena_players.tier` (migrasi `20261016050000_arena_players_tier.sql`).
- [x] Format baru Ying Yang (di samping Super Mexicano) untuk semua olahraga: tim seimbang Pro+Newbie vs Pro+Newbie; logika di `public/pairing.js` hanya aktif lewat `ctx.balanceTier`, Americano/Mexicano/Super tidak berubah (ada tes pembuktian).
