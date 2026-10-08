# Catatan Perubahan (Changelog)

Urutan **terbaru di atas**. Untuk tahu perbaikan terakhir, cukup baca bagian paling atas.
Setiap kali ada perubahan, tambahkan bagian baru di atas bagian sebelumnya (jangan menimpa yang lama).

Format tiap bagian: tanggal, judul singkat, lalu daftar **Ditambah / Diubah / Diperbaiki**, dan **Catatan** kalau ada hal yang perlu diwaspadai.

---

## 2026-10-08 — Gabung perubahan Lovable + klasemen muat di layar HP

Branch: `fix/tampilan-arena` (sudah digabung dengan `main` terbaru, 11 commit Lovable tanggal 7–8 Oktober)

### Diperbaiki
- **Tabel Klasemen di HP:** kolom "Menang" dan "Poin" dulu terpotong dan baru terlihat kalau digeser, karena `table { min-width: 460px }` di `arena-refinement.css`. Sekarang tabel selebar layar dengan sel lebih rapat (≤ 639px). Sudah diukur muat di lebar 320, 360, dan 390px, dan tabel di layar "Turnamen selesai" (7 kolom) muat di 360px. Tablet dan desktop tidak berubah.

### Hasil pengecekan ulang (12 pemain, 2 lapangan, Chromium)
| Masalah | `main` Lovable saja | Branch ini |
|---|---|---|
| Papan lapangan di HP | 4.089 px dari atas (terkubur) | sekitar 480 px |
| Teks status langkah 4 | 152 karakter, panjang | 36 karakter |
| Footer | masih menggantung ("jadi .") | lengkap |
| Kartu Mode/Format desktop | tidak meluber | tidak meluber |
| Klasemen di HP | Poin terpotong | muat |
| Error JavaScript | 0 | 0 |

### Catatan
- Perbaikan tampilan ditaruh di `public/arena-refinement.css` sesuai aturan di `AGENTS.md` (tampilan terpisah dari skrip permainan).
- Belum dikerjakan: lihat daftar sisa pada bagian 2026-10-07 di bawah (gambar berbasis alamat Lovable, keamanan data/PIN, teks "@2026.peternakkoding.shn" yang tampak seperti placeholder).

## 2026-10-07 — Tampilan arena: lapangan di atas pada layar HP

Branch: `fix/tampilan-arena` (dibuat dari `main` terbaru, sudah memuat perubahan Lovable hari ini)

### Dari Lovable (sudah di `main`, dicek ulang di rilis ini)
- Tata letak responsif lintas perangkat: kartu Mode/Format fluid (tidak terpotong lagi), kolom kiri desktop lebih lebar, 1 kolom di bawah 1024px, area sentuh minimal 44px, aman untuk layar berponi.
- Ikon langkah, latar dan hiasan tematik per olahraga, panduan 3 langkah di layar kosong.
- Catatan: teks petunjuk mode Custom (`#customHint`) sekarang disembunyikan lewat CSS; keterangannya tetap ada di kartu "Custom".

### Diubah
- **Layar HP/tablet (<1024px):** saat turnamen berjalan, papan "Sedang bermain" tampil paling atas; Pengaturan, Klasemen, dan Kelola pemain pindah ke bawahnya. Dulu papan lapangan baru terlihat setelah scroll sekitar 3.400 px.
- Setelah menekan "Kocok & Mulai" di layar kecil, halaman otomatis menggulir ke papan lapangan.
- Teks status di langkah 4 diringkas menjadi "Rotasi lapangan: Mandiri (otomatis)." (keterangan lengkapnya sudah ada di bawah pilihan Rotasi).
- Footer dilengkapi: "...jadi tinggal main aja."

### Diperbaiki
- Nomor peringkat 10, 11, 12 di Klasemen sementara tidak lagi pecah jadi dua baris.

### Belum dikerjakan (daftar sisa)
- Gambar logo dan ikon memakai alamat khusus Lovable (`/__l5e/assets-v1/...`); rusak di luar hosting Lovable.
- Keamanan data: tabel arena terbuka untuk baca/ubah lewat kunci publik, fungsi `kocok_*` tidak ada di migrasi repo, PIN 4 angka tanpa pembatasan percobaan yang bisa diverifikasi.
- Bagikan klasemen ke WhatsApp, ekspor/cetak hasil, tampilan layar besar, bisa dipasang sebagai aplikasi (PWA).

## 2026-10-06 — Americano lebih adil + pilihan Rotasi lapangan

Branch: `feat/americano-rotasi-fleksibel`

**Masalah yang diperbaiki.** Dengan 12 pemain dan 2 lapangan, Americano mode lapangan jalan sendiri-sendiri memilih 4 orang dulu (yang paling lama menunggu), baru menyusun pasangan dari 4 orang itu. Akibatnya grup yang sama terkunci dan partner yang sama berulang (contoh: Afgan & Rosa). Di simulasi 24 pertandingan, 86% sesi punya pasangan yang sama ≥3 kali; setelah perbaikan 0%.

### Ditambah
- **Pilihan "Rotasi lapangan"** (Pengaturan, langkah 3; muncul untuk Americano dan Pasangan Tetap dengan >1 lapangan):
  - **Otomatis** (default): Mandiri kalau pemain ≥ 4 × lapangan + 4 (Pasangan Tetap: cadangan ≥ 3 pasangan), selain itu Serentak. Alasannya ditampilkan di layar.
  - **Mandiri**: tiap lapangan lanjut sendiri begitu selesai.
  - **Serentak**: semua lapangan ganti ronde bersamaan (jumlah main paling merata).
- **Tombol "Selesai" per lapangan di Serentak**: menutup lapangan itu (skor final, tidak dipakai lagi mulai ronde berikutnya), lapangan lain lanjut, dan rotasi berikutnya disusun ulang dengan lapangan lebih sedikit. Menutup lapangan terakhir = turnamen selesai. Di Mandiri tombol ini sudah ada sebelumnya.
- **Titik awal jumlah main** untuk pemain yang masuk atau kembali dari jeda di tengah sesi, supaya tidak dipaksa main terus untuk "mengejar ketinggalan". Tampilan klasemen tetap memakai jumlah main sebenarnya.
- **Peringatan di layar** kalau pemain aktif menyusut sampai Mandiri tidak punya cukup cadangan.
- Tes otomatis (`npm test`, 20 tes) dan simulasi (`npm run sim:pairing`) untuk mesin pairing.

### Diubah
- **Mesin pairing (`public/pairing.js`)**: satu fungsi biaya dipakai di jalur serentak dan mandiri. Urutan prioritas: jumlah main merata > partner tidak berulang (dihitung kuadrat) > lawan bervariasi > tim campur gender > yang lama menunggu didahulukan.
- Mode Mandiri memilih grup dan susunan sekaligus (bukan 4 orang dulu), dari kandidat dengan jumlah main ≤ terkecil + 1, maksimal 14 kandidat per keputusan.
- Mode Mandiri tidak lagi membuat pratinjau "ronde berikutnya" yang tidak pernah dimainkan (dulu ikut mengotori riwayat partner/lawan).
- Daftar istirahat di Mandiri ditampilkan sebagai "Menunggu giliran" dan dihitung langsung dari siapa yang tidak sedang di lapangan.
- Sesi lama (sebelum ada pilihan rotasi) dipulihkan sebagai Mandiri, sama seperti perilaku dulu.

### Diperbaiki
- Memulihkan sesi yang belum selesai saat halaman dibuka bisa gagal (error `ReferenceError` karena variabel dideklarasikan terlalu jauh di bawah).

### Tidak berubah
- **Mexicano dan Super Mexicano** tetap seperti sebelumnya (selalu serentak, #1 & #4 lawan #2 & #3, bonus ×2 di Lapangan 1). Tombol "Selesai" per lapangan di Serentak sengaja **tidak** tersedia untuk keduanya karena akan merusak peringkat.
- Mode Custom tetap manual per lapangan.

### Catatan / batas yang perlu diketahui
- Kalau jumlah pemain **tepat** 4 × lapangan (mis. 8/2, 12/3, 16/4), tidak ada pemain istirahat, jadi di Mandiri grup pasti terkunci. Karena itu Otomatis memilih Serentak.
- 12 pemain hanya punya 66 pasangan unik, jadi tanpa pengulangan paling jauh sekitar 33 pertandingan.
- Di Serentak, keadilan jumlah main sempurna, tapi lapangan yang selesai duluan ikut menunggu (di simulasi sekitar 11–17% lebih sedikit pertandingan dalam waktu yang sama).
- Mode Pasangan Tetap memakai jalur yang sama; hasil simulasinya sudah ada di `scripts/sim-pairing.mjs`, tetapi belum diuji lama di lapangan.
- Semua angka di atas berasal dari simulasi, bukan dari pertandingan nyata.

### Dari pengguna (digabung di rilis ini)
- Tata letak responsif: dua kolom hanya mulai lebar layar ≥ 1024px.
- PIN dibuat otomatis (4 angka) kalau dikosongkan; tidak ada lagi peringatan yang memblokir tombol Mulai. PIN ditampilkan di status koneksi.

---

## 2026-10-05 — Penyederhanaan Pengaturan & sinkron

(Ringkasan dari riwayat commit.)
- Halaman Pengaturan dan tombol di layar "Sedang bermain" disederhanakan.
- Tampilan arena dibuat responsif.
- UI sinkron cloud ("Main bareng di beberapa HP") ditambahkan, beserta perbaikan keamanan.
- Durasi total sesi: pilihan selesaikan pertandingan, 1 ronde lagi, tambah waktu, atau free time.

## 2026-10-01 — Mexicano

- Penyusunan ronde Mexicano berdasarkan peringkat dan fungsi peringkatnya ditambahkan.

---

_Riwayat sebelum tanggal di atas ada di `git log`._
