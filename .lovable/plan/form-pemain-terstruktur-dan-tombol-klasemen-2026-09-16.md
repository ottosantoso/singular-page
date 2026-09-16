# Form Pemain Terstruktur dan Tombol Klasemen

## Perubahan
- Ganti textarea pemain dengan input Nama, pilihan Jenis Kelamin, tombol tambah primer, dan daftar pemain terdaftar.
- Simpan data entri sebagai objek `{ id, name, gender }`, lalu teruskan nama ke alur rotasi lama agar bagian pertandingan lain tidak berubah.
- Sertakan profil pemain terstruktur dalam data sesi agar gender tersedia untuk pengembangan logika pasangan dan sinkronisasi.
- Tambahkan tombol hapus ikon X pada setiap pemain sebelum sesi dimulai.
- Gunakan ulang bentuk form, card, tombol primer, dan tombol sekunder yang sudah ada.
- Ubah tautan Buka Klasemen Online agar benar-benar menggunakan tampilan tombol sekunder yang sama.

## Kompatibilitas
- Mode individu memakai daftar pemain terstruktur secara langsung.
- Mode pasangan tetap bekerja dengan memasangkan pemain terdaftar berurutan, dua pemain per pasangan.
- Data sesi lama tanpa profil gender tetap dapat dibuka.

## Verifikasi
- Tambah dan hapus pemain, periksa ikon gender, mulai pertandingan, serta buka tautan klasemen.
- Periksa tampilan desktop dan ponsel tanpa mengubah bagian lain.
