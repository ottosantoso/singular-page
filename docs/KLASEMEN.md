# Dokumentasi Klasemen dan Papan Gelar

Dokumen ini menjelaskan cara kerja halaman `/klasemen` saat ini: sumber data,
perhitungan statistik pemain, urutan Juara Umum, tampilan Top 3, mode urutan
tabel, serta sembilan gelar di Papan Gelar.

## 1. Ruang Lingkup Data

Klasemen dibangun dari dua sumber utama:

- `arena_players`: daftar seluruh pemain yang terdaftar pada kode arena.
- `arena_matches`: pertandingan dan skor tiap ronde.

Pertandingan dengan `status = "live"` tetap dapat ditampilkan sebagai pertandingan
berjalan, tetapi **belum dihitung** ke klasemen. Pertandingan baru masuk
perhitungan setelah statusnya bukan `live`, agar skor sementara tidak mengubah
peringkat.

Setiap pertandingan memiliki dua tim:

```text
Tim A: team_a, skor: score_a
Tim B: team_b, skor: score_b
```

Semua pemain dalam satu tim menerima statistik pertandingan yang sama. Jika Tim A
menang 21-17, setiap pemain di Tim A mendapat `1 menang`, `21 poin untuk`, dan
`17 poin kebobolan`. Setiap pemain di Tim B mendapat `1 kalah`, `17 poin untuk`,
dan `21 poin kebobolan`.

## 2. Statistik Dasar Pemain

Untuk setiap pemain, sistem mengakumulasi:

- **Main (`games`)**: jumlah pertandingan selesai yang diikuti pemain.
- **Menang (`wins`)**: jumlah pertandingan ketika skor tim pemain lebih besar.
- **Kalah (`losses`)**: jumlah pertandingan ketika skor tim pemain lebih kecil.
- **Seri (`draws`)**: jumlah pertandingan ketika kedua skor sama.
- **Poin (`pointsFor`)**: total skor yang dibuat tim pemain.
- **Poin kebobolan (`pointsAgainst`)**: total skor lawan.

Dari nilai dasar tersebut sistem menghitung metrik berikut.

### 2.1 Win rate

Win rate memakai skor penuh untuk menang dan setengah skor untuk seri:

```text
win rate = ((menang + 0.5 x seri) / main) x 100
```

Contoh:

```text
6 menang, 0 seri, 3 kalah, 9 laga
win rate = ((6 + 0.5 x 0) / 9) x 100 = 66.67% -> tampil 67%
```

Jika ada seri:

```text
4 menang, 2 seri, 3 kalah, 9 laga
win rate = ((4 + 0.5 x 2) / 9) x 100 = 55.56% -> tampil 56%
```

Jadi seri tidak dianggap menang penuh, tetapi tetap memberi kontribusi setengah
menang pada metrik Juara Umum.

### 2.2 % Poin

Kolom **% Poin** mengukur proporsi skor yang dibuat pemain dibandingkan total skor
pertandingan yang melibatkan pemain tersebut:

```text
% poin = pointsFor / (pointsFor + pointsAgainst) x 100
```

Contoh:

```text
pointsFor = 102
pointsAgainst = 90
% poin = 102 / (102 + 90) x 100 = 53.13% -> tampil 53%
```

Interpretasinya:

- `50%` berarti skor yang dibuat dan kebobolan sama besar.
- Di atas `50%` berarti pemain lebih banyak menghasilkan skor daripada kebobolan.
- Di bawah `50%` berarti pemain lebih banyak kebobolan daripada menghasilkan skor.

% Poin bukan persentase kemenangan dan bukan persentase dari total poin pemain
lain. Nilainya hanya membandingkan poin untuk dan poin kebobolan milik pemain itu
sendiri. Jika total `pointsFor + pointsAgainst` adalah nol, sistem mengisi `0%`.

### 2.3 Rata-rata poin per laga

Kolom **Rata/Laga** adalah rata-rata poin yang dibuat tim pemain dalam setiap laga:

```text
rata/laga = pointsFor / main
```

Contoh:

```text
102 poin dari 9 laga
rata/laga = 102 / 9 = 11.33 -> tampil 11.3
```

Angka ini adalah rata-rata skor tim pemain per pertandingan, bukan jumlah poin
individu dari tabel laporan pemain. Dua pemain dalam tim yang sama dapat memiliki
nilai rata/laga yang sama karena mereka menerima skor tim yang sama.

### 2.4 Rata-rata kebobolan per laga

Metrik internal untuk penghargaan **Si Tembok**:

```text
rata-rata kebobolan = pointsAgainst / main
```

Semakin kecil nilainya, semakin baik pertahanan berdasarkan skor yang diberikan
lawan.

### 2.5 Selisih poin

Kolom **Selisih** memakai selisih total skor untuk dan skor kebobolan:

```text
selisih = pointsFor - pointsAgainst
```

Contoh:

```text
pointsFor = 102
pointsAgainst = 87
selisih = 102 - 87 = +15
```

Makna nilai:

- Positif: total skor yang dibuat lebih besar daripada skor kebobolan.
- Negatif: total skor kebobolan lebih besar daripada skor yang dibuat.
- Nol: total keduanya sama.

Sistem juga memiliki metrik internal **selisih per laga**:

```text
selisih/laga = (pointsFor - pointsAgainst) / main
```

Metrik ini dipakai sebagai tie-break Juara Umum, bukan sebagai kolom utama yang
ditampilkan pada tabel.

## 3. Cara Menentukan Peringkat Juara Umum

Mode **Juara Umum** adalah urutan resmi klasemen. Pemain dibandingkan secara
berjenjang dengan prioritas berikut:

1. **Win rate tertinggi**.
2. Jika sama, **% Poin tertinggi**.
3. Jika masih sama, **selisih/laga tertinggi**.
4. Jika masih sama, **jumlah menang terbanyak**.
5. Jika semua kriteria tersebut sama, pemain berbagi peringkat.

Nama pemain hanya digunakan untuk membuat urutan tampilan stabil. Nama tidak
mengalahkan pemain lain dalam penentuan kualitas peringkat.

### 3.1 Contoh perbandingan Top 3

Misalkan hasil perhitungan adalah:

| Pemain | Win rate | % Poin | Selisih/laga | Menang |
|---|---:|---:|---:|---:|
| A | 67% | 54% | +1.7 | 6 |
| B | 67% | 49% | +2.8 | 6 |
| C | 63% | 59% | +3.6 | 5 |

Urutannya tetap:

1. A, karena win rate sama dengan B tetapi % Poin A lebih tinggi.
2. B, karena kalah pada tie-break % Poin dari A, tetapi tetap di atas C karena
   win rate B lebih tinggi.
3. C.

Artinya, total poin bukan penentu pertama Juara Umum. Pemain dengan total poin
lebih tinggi belum tentu berada di atas pemain lain jika win rate atau % Poinnya
lebih rendah.

### 3.2 Peringkat padat dan peringkat yang sama

Jika semua kriteria Juara Umum sama, pemain berbagi peringkat yang sama. Sistem
menggunakan peringkat padat:

```text
Pemain A  #1
Pemain B  #1
Pemain C  #2
```

Tidak ada lompatan ke `#3` setelah dua pemain berbagi `#1`. Untuk ranking resmi, label posisi mengikuti peringkat padat tersebut.

## 4. Provisional dan Batas Minimum Laga

Untuk mencegah pemain dengan sampel sangat kecil langsung memimpin, sistem
menerapkan batas minimum laga:

```text
minimum laga = max(1, ceil(50% x jumlah ronde yang terdeteksi))
```

Contoh:

| Jumlah ronde | Minimum laga resmi |
|---:|---:|
| 1 ronde | 1 |
| 2 ronde | 1 |
| 3 ronde | 2 |
| 4 ronde | 2 |
| 5 ronde | 3 |
| 10 ronde | 5 |

Pemain yang belum mencapai batas tersebut:

- diberi label **Provisional**;
- tidak mendapat nomor peringkat resmi;
- ditampilkan di bawah pemain yang sudah memenuhi syarat;
- tidak dapat mengambil peringkat Juara Umum.

Jika tidak ada seorang pun yang memenuhi batas minimum, sistem menggunakan semua
pemain yang sudah bermain sebagai fallback agar klasemen tetap memiliki peringkat.

## 5. Top 3 Klasemen

Kartu **Top 3 Klasemen** mengambil pemain dari hasil urutan resmi Juara Umum,
bukan dari total poin terbesar dan bukan dari mode sort sementara yang sedang
dipilih pada tabel.

- Kartu mengambil tiga pemain eligible pertama dari urutan resmi Juara Umum.
- Label pada podium tetap memakai nilai `rank` masing-masing pemain.
- Dalam kondisi tie, dua pemain dapat memiliki label rank yang sama; podium tetap merupakan tiga pemain pertama, bukan tiga nilai rank unik.

## 6. Mode Urutan Tabel

Tabel menyediakan beberapa mode tampilan. Mengganti mode ini tidak mengubah data
atau peringkat resmi; hanya mengubah urutan baris tabel.

### 6.1 Juara Umum

Urutan resmi berdasarkan:

```text
win rate -> % poin -> selisih/laga -> jumlah menang
```

### 6.2 Total Poin

Urutan alternatif berdasarkan:

```text
pointsFor terbesar -> selisih total -> nama
```

Ini adalah aturan lama/alternatif, bukan peringkat resmi Juara Umum.

### 6.3 Rata-rata

Urutan alternatif berdasarkan:

```text
rata/laga terbesar -> selisih total -> nama
```

### 6.4 Selisih Poin

Urutan alternatif berdasarkan:

```text
selisih total terbesar -> selisih total -> nama
```

Secara praktis, pembanding utamanya adalah `pointsFor - pointsAgainst`.

## 7. Form dan Pergerakan Peringkat

Kolom **Form** menampilkan lima hasil terakhir yang tersedia untuk pemain:

- `M`: menang.
- `K`: kalah.
- `S`: seri.

Pergerakan peringkat membandingkan urutan berdasarkan hasil sampai ronde terakhir
dengan urutan berdasarkan seluruh pertandingan yang sudah selesai. Indikator naik
atau turun pada baris menunjukkan perubahan posisi tersebut.

Pertandingan live tidak digunakan untuk menghitung pergerakan, sama seperti pada
klasemen utama.

## 8. Papan Gelar

Papan Gelar adalah kumpulan penghargaan statistik di luar satu peringkat utama.
Saat ini ada **9 gelar**. Gelar memakai pertandingan yang sudah selesai dan
umumnya mengabaikan pemain Provisional agar sampel kecil tidak langsung mengambil
gelar.

Jika ada pemain yang belum bermain, pemain tersebut tidak masuk kandidat. Jika
belum ada data yang cukup untuk sebuah gelar, kartu menampilkan **Belum ada
pemenang**.

### 8.1 Juara Umum

**Tujuan:** menampilkan pemilik peringkat resmi tertinggi.

**Rumus/aturan:**

```text
win rate -> % poin -> selisih/laga -> jumlah menang
```

Nilai utama yang ditampilkan adalah win rate, dengan detail jumlah menang, jumlah
laga, dan % Poin.

### 8.2 Mesin Poin

**Tujuan:** mencari pencetak skor paling produktif per pertandingan.

**Rumus:**

```text
pointsFor / main
```

Pemenang adalah pemain dengan rata-rata poin per laga tertinggi. Nilai kartu
ditampilkan dalam format `poin/laga` dan detailnya menyebut total poin serta
jumlah laga.

### 8.3 Si Tembok

**Tujuan:** mencari pemain dengan rata-rata kebobolan paling kecil.

**Rumus:**

```text
pointsAgainst / main
```

Semakin kecil hasilnya, semakin baik. Nilai kartu ditampilkan sebagai
`kebobolan/laga`.

### 8.4 Raja Streak

**Tujuan:** mencari kemenangan beruntun terpanjang.

**Cara hitung:**

1. Hasil pemain dibaca berdasarkan urutan pertandingan.
2. `M` menambah panjang streak berjalan.
3. `K` atau `S` memutus streak dan mengembalikannya ke nol.
4. Nilai gelar adalah streak maksimum yang pernah dicapai.

Gelar hanya diberikan jika ada streak minimal dua kemenangan beruntun. Kartu juga
menandai apakah streak tersebut masih berjalan atau hanya rekor tertinggi.

### 8.5 Mental Baja

**Tujuan:** mencari pemain yang paling sering menang dalam laga ketat.

**Definisi laga ketat:**

```text
abs(score_a - score_b) <= 2
```

Semua pemain dari kedua tim dihitung sebagai peserta laga ketat. Hanya tim yang
menang yang mendapat tambahan kemenangan tipis. Pemenang gelar adalah pemain
dengan jumlah kemenangan tipis terbanyak. Jika jumlahnya sama, rasio kemenangan
tipis terhadap jumlah laga ketat menjadi pembanding berikutnya.

### 8.6 Duo Terbaik

**Tujuan:** mencari pasangan pemain dengan hasil terbaik ketika bermain bersama.

**Cara hitung:**

- Hanya tim yang berisi tepat dua pemain yang dihitung.
- Setiap pasangan diurutkan berdasarkan nama agar pasangan yang sama memakai kunci yang sama.
- Setiap penampilan bersama menambah jumlah laga pasangan.
- Setiap kemenangan tim menambah kemenangan pasangan.
- Selisih poin pasangan dijumlahkan dari skor tim dikurangi skor lawan.
- Jika ada pasangan yang sudah bermain minimal dua kali, hanya pasangan-pasangan tersebut yang menjadi kandidat.
- Pemenang diurutkan berdasarkan rasio menang (`menang/laga`), lalu jumlah laga, lalu selisih poin.

Kartu menampilkan format `menang/laga` dan selisih poin pasangan tersebut.

### 8.7 Giant Killer

**Tujuan:** mencari pemain yang paling sering mengalahkan pemain dengan peringkat
lebih tinggi.

**Cara hitung:**

1. Sistem memakai urutan pemain saat ini sebagai ukuran peringkat.
2. Pertandingan seri tidak dihitung.
3. Untuk setiap pemenang, setiap pemain lawan yang memiliki peringkat lebih tinggi
dihitung sebagai satu `giant kill`.
4. Pemain dengan jumlah hitungan terbanyak memenangkan gelar.

Dalam pertandingan beregu, satu kemenangan tim dapat menghasilkan lebih dari satu
hitungan jika tim pemenang mengalahkan beberapa pemain berperingkat lebih tinggi.

### 8.8 Pendaki Terbaik

**Tujuan:** mencari pemain dengan kenaikan peringkat terbesar dibanding ronde
sebelumnya.

**Cara hitung:**

```text
kenaikan = peringkat sebelumnya - peringkat sekarang
```

Contoh dari `#8` ke `#3` berarti naik `5` peringkat. Gelar hanya diberikan kepada
pemain yang benar-benar naik; pemain yang tetap atau turun tidak menjadi kandidat.

### 8.9 Raja Rotasi

**Tujuan:** memberi penghargaan kepada pemain yang mampu bermain dengan rekan
satu tim paling beragam.

**Rumus:**

```text
jumlah rekan unik = jumlah nama rekan satu tim berbeda yang pernah ditemui
```

Cara hitung:

- Hanya pertandingan selesai yang dihitung.
- Pemain tidak dihitung sebagai rekan dirinya sendiri.
- Rekan yang sama pada beberapa pertandingan hanya dihitung satu kali.
- Kandidat harus sudah bermain minimal 3 laga.
- Peringkat utama berdasarkan jumlah rekan unik terbanyak.
- Jika sama, tie-break memakai jumlah laga terbanyak, lalu jumlah kemenangan.

Nilai kartu menampilkan jumlah `rekan unik`, sedangkan detailnya menampilkan
jumlah laga dan kemenangan pemain. Gelar ini mengukur kemampuan beradaptasi dalam
rotasi, bukan sekadar volume pertandingan atau performa skor.
## 9. Tie dan Tampilan Pemenang Gelar

Perhitungan kandidat mendeteksi nilai yang sama dan menambahkan keterangan bahwa
pemenang imbang dengan pemain lain. Kartu gelar tetap memakai satu pemilik utama
untuk tampilan ringkas, mengikuti urutan kandidat yang sudah ada.

Untuk Juara Umum, tie pada seluruh kriteria utama menghasilkan peringkat yang
sama. Untuk gelar lain, tie-break mengikuti aturan gelar masing-masing jika ada;
selebihnya urutan kandidat dipakai untuk menentukan pemilik visual utama.

## 10. Ringkasan Rumus

```text
win rate       = (menang + 0.5 x seri) / main x 100
% poin         = pointsFor / (pointsFor + pointsAgainst) x 100
rata/laga      = pointsFor / main
rata kebobolan = pointsAgainst / main
selisih        = pointsFor - pointsAgainst
selisih/laga   = selisih / main
minimum laga   = max(1, ceil(0.5 x jumlah ronde))
```

Urutan resmi:

```text
win rate -> % poin -> selisih/laga -> jumlah menang
```