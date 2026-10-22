// QR lokal di klien (D8): tanpa permintaan jaringan, tampil juga saat offline.
// Berkas ini murni (tanpa DOM, tanpa alias "@/") agar bisa dites langsung dengan Node.
import { encode } from "uqr";

/** Zona tenang di sekeliling QR, dalam modul. Standar QR meminta minimal 4. */
export const QR_QUIET_ZONE = 4;

export type QrMatrix = readonly (readonly boolean[])[];

/** Matriks modul QR (true = gelap) tanpa zona tenang. Melempar galat bila teks kosong atau terlalu panjang. */
export function qrMatrix(text: string): QrMatrix {
  if (!text) throw new Error("Teks QR kosong");
  // ecc "M" (pemulihan ~15%) cukup untuk URL yang dipindai dari layar atau kertas.
  return encode(text, { ecc: "M", border: 0 }).data;
}

/** Seperti qrMatrix, tetapi mengembalikan null (bukan melempar) agar UI bisa menampilkan cadangan. */
export function qrMatrixOrNull(text: string): QrMatrix | null {
  try {
    return qrMatrix(text);
  } catch {
    return null;
  }
}

/** Jumlah modul per sisi termasuk zona tenang. */
export function qrTotalModules(matrix: QrMatrix, quiet = QR_QUIET_ZONE): number {
  return matrix.length + quiet * 2;
}

/** Path SVG untuk semua modul gelap (deret horizontal digabung), dalam satuan modul. */
export function qrSvgPath(matrix: QrMatrix, quiet = QR_QUIET_ZONE): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      parts.push(`M${start + quiet} ${y + quiet}h${x - start}v1h-${x - start}z`);
    }
  });
  return parts.join("");
}

/** Piksel per modul untuk PNG: bilangan bulat agar tepi tajam, hasil minimal sebesar targetPx. */
export function qrPixelScale(totalModules: number, targetPx = 320): number {
  return Math.max(1, Math.ceil(targetPx / totalModules));
}
