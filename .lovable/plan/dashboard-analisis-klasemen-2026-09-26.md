# Dashboard Analisis Klasemen

## Tujuan
Mengubah penyajian halaman Klasemen menjadi dashboard performa profesional berdasarkan arah “Performance analytics dashboard”, tanpa mengubah pengambilan data, polling, atau perhitungan klasemen yang sudah ada.

## Yang akan dibangun
- Pertahankan navigasi, input kode arena, status muat/gagal, dan tombol download.
- Susun header hasil yang lebih ringkas dengan identitas kode arena dan waktu pembaruan data.
- Tambahkan ringkasan angka dari data yang tersedia: jumlah pemain, pertandingan, total poin, dan rata-rata skor.
- Tampilkan sorotan pemimpin klasemen beserta win rate dan kontribusi poin.
- Tata ulang tabel klasemen agar lebih mudah dipindai, termasuk indikator win rate berbentuk bar.
- Tambahkan panel insight otomatis dari data yang sudah ada: pemain paling konsisten, pencetak poin individu terbanyak, dan pertandingan terketat.
- Tata ulang riwayat pertandingan menjadi kartu skor profesional.
- Tingkatkan laporan pemain menjadi tabel analitik dengan bar performa, tanpa mengubah isi atau rumus data.
- Pastikan seluruh dashboard tetap responsif dan ikut terambil oleh fitur Download Gambar.

## Batasan
- Tidak mengubah `useQuery`, `refetchInterval`, `buildStandings`, sumber data, filter, atau alur program.
- Tidak menambah kebutuhan data baru dan tidak mengubah halaman lain.
- Semua insight dihitung hanya saat render dari data hasil query yang sudah tersedia.

## Teknis
- Perubahan dibatasi pada struktur JSX dan kelas tampilan di halaman Klasemen.
- Menggunakan token warna dan tipografi Arena yang sudah ada, ditambah ikon dari pustaka yang sudah terpasang.
- Validasi akhir mencakup pemeriksaan hasil kompilasi serta tampilan desktop dan ponsel.
