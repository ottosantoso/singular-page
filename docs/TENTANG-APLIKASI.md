# Tentang OTTOPLAY ARENA

Aplikasi untuk mengatur rotasi pemain di sesi main bareng olahraga raket: **padel, badminton, tenis, dan tenis meja**. Host memasukkan pemain yang hadir, aplikasi menyusun pasangan dan lawan secara adil, mencatat skor, dan menampilkan klasemen.

Perubahan terbaru ada di [`CHANGELOG.md`](../CHANGELOG.md) (baca bagian paling atas).

## Halaman

| Alamat | Fungsi |
|---|---|
| `/` | Halaman depan: pilih olahraga dan masuk ke arena. |
| `/arena.html` | Arena: pengaturan sesi, rotasi, skor, klasemen, riwayat. (File statis di `public/`.) |
| `/klasemen` | Klasemen online, dibuka dengan Kode + PIN arena. |
| `/detail-pemain` | Detail statistik pemain. |

## Alur pakai (arena)

1. Pilih olahraga.
2. **Langkah 1** daftarkan pemain; **Langkah 2** jumlah lapangan; **Langkah 3** mode dan format permainan; **Pengaturan lanjutan** (opsional): durasi per ronde dan durasi total.
3. Tekan **Kocok & Mulai**. Kode dan PIN arena dibuat otomatis kalau kosong.
4. Isi skor tiap lapangan, simpan, lanjut ke ronde berikutnya. Pemain bisa ditambah, dijeda, atau kembali di tengah sesi.
5. Selesaikan turnamen: klasemen akhir ditampilkan dan sesi diarsipkan.

## Mode dan format

**Mode rotasi**
- **Individu**: partner diacak ulang tiap ronde.
- **Pasangan Tetap**: pasangan tidak berubah, yang divariasikan hanya lawan.
- **Custom**: host menyusun sendiri siapa lawan siapa di tiap lapangan.

**Format (mode Individu)**
- **Americano**: partner dan lawan diacak, jumlah main dibuat merata, partner diusahakan tidak berulang.
- **Mexicano**: ronde 1 acak; mulai ronde 2 pasangan disusun dari peringkat (#1 & #4 lawan #2 & #3). Selalu serentak.
- **Super Mexicano**: seperti Mexicano, poin di Lapangan 1 dikali 2 (butuh minimal 2 lapangan).

**Rotasi lapangan (Americano dan Pasangan Tetap, >1 lapangan)**
- **Otomatis** (disarankan), **Mandiri** (tiap lapangan lanjut sendiri), atau **Serentak** (semua ganti bersamaan). Aturan lengkap ada di changelog 2026-10-06.

## Cara kerja pairing (singkat)

Logika ada di `public/pairing.js` dan tidak menyentuh tampilan atau database, jadi bisa diuji sendiri. Prioritas aturannya:

1. Jumlah main merata
2. Partner tidak berulang (ulang ke-2 jauh lebih mahal dari ke-1)
3. Lawan bervariasi
4. Tim campur gender (bonus kecil)
5. Yang lama menunggu didahulukan

Bobotnya ada di `WEIGHTS` di `pairing.js` dan hasil penyetelan dengan simulasi; ubah dengan hati-hati lalu jalankan tes dan simulasi.

## Struktur proyek

- `public/arena.html`: seluruh arena (HTML, CSS, JavaScript dalam satu file).
- `public/pairing.js`: mesin pairing.
- `src/routes/`: halaman TanStack (`index`, `klasemen`, `detail-pemain`).
- `supabase/`: konfigurasi dan migrasi database (fungsi `kocok_*` untuk simpan, muat, dan arsip sesi).
- `tests/` dan `scripts/`: tes mesin pairing dan simulasi.

## Perintah

```sh
npm run dev           # jalankan lokal
npm test              # tes mesin pairing
npm run sim:pairing   # simulasi (opsional: npm run sim:pairing -- 100)
```

## Catatan kerja

- Proyek ini terhubung ke Lovable. Commit di branch utama ikut tampil di editor Lovable, jadi **jangan** force push, rebase, atau amend commit yang sudah di-push.
- Setelah mengubah aplikasi, tambahkan bagian baru di paling atas `CHANGELOG.md`.
