# UI Per-Lapangan untuk Mode Multi-Court

## Ringkasan
Menyesuaikan HTML, CSS, dan template kartu lapangan di `arena.html` agar mode dengan lebih dari satu lapangan memiliki progres dan aksi per lapangan, tanpa mengubah state, algoritma rotasi, perhitungan skor, atau memasang logika klik baru.

## Perubahan
- Pertahankan tampilan dan dua tombol global yang ada saat hanya satu lapangan aktif.
- Tambahkan blok progres di atas daftar lapangan yang hanya tampil pada mode multi-lapangan.
- Tambahkan footer aksi pada setiap `court-card` multi-lapangan berisi “Simpan & Lanjutkan” dan “Selesai”, dengan atribut data sebagai kait untuk logika lanjutan tetapi tanpa event handler.
- Siapkan struktur dan CSS `.court-card.finished`: kontrol edit tersembunyi, skor menjadi tampilan statis, dan banner status selesai muncul.
- Rapikan struktur preview “Rotasi Berikutnya” menjadi item per lapangan yang tetap responsif.
- Gunakan ulang token, radius, shadow, serta gaya tombol yang sudah ada; tidak menambah token warna baru.

## Batasan
- Tidak mengubah fungsi `advanceRound`, state pertandingan, penyimpanan, skor, atau algoritma rotasi.
- Tombol per lapangan bersifat template/dummy dan belum menjalankan aksi.
- Status `.finished` hanya menyediakan tampilan; logika lain dapat menambahkan class/status tersebut nanti.

## Verifikasi
- Periksa bahwa satu lapangan tetap menampilkan kontrol global dan tidak menampilkan progres/aksi per kartu.
- Periksa bahwa multi-lapangan menyembunyikan dua tombol global yang diminta, menampilkan progres, dan menampilkan aksi per kartu.
- Periksa contoh kartu `.finished` melalui DOM untuk memastikan semua kontrol edit tersembunyi dan status selesai tampil.
- Periksa layout desktop dan ponsel tanpa mengubah perilaku rotasi yang sudah ada.
