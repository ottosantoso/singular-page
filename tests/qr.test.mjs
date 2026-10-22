// Tes QR lokal (D8). Jalankan: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  QR_QUIET_ZONE,
  qrMatrix,
  qrMatrixOrNull,
  qrPixelScale,
  qrSvgPath,
  qrTotalModules,
} from "../src/lib/qr.ts";

const URL_EVENT = "https://ottoplay.example/e/ABC123";

test("matriks persegi dengan ukuran QR yang sah (17 + 4 x versi)", () => {
  const matrix = qrMatrix(URL_EVENT);
  const size = matrix.length;
  assert.ok(size >= 21 && size <= 177, `ukuran ${size}`);
  assert.equal((size - 17) % 4, 0);
  assert.ok(matrix.every((row) => row.length === size));
});

test("tiga pola pencari posisi ada di sudut kiri atas, kanan atas, kiri bawah", () => {
  const matrix = qrMatrix(URL_EVENT);
  const n = matrix.length;
  const finder = (top, left) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const ring = y === 0 || y === 6 || x === 0 || x === 6;
        const core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        assert.equal(matrix[top + y][left + x], ring || core, `(${top + y},${left + x})`);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
});

test("deterministik: teks sama menghasilkan matriks sama; teks beda menghasilkan matriks beda", () => {
  assert.deepEqual(qrMatrix(URL_EVENT), qrMatrix(URL_EVENT));
  assert.notDeepEqual(qrMatrix(URL_EVENT), qrMatrix(`${URL_EVENT}X`));
});

test("path SVG menutup tepat semua modul gelap dan berada di dalam viewBox", () => {
  const matrix = qrMatrix(URL_EVENT);
  const total = qrTotalModules(matrix);
  assert.equal(total, matrix.length + 2 * QR_QUIET_ZONE);
  const path = qrSvgPath(matrix);
  const dark = matrix.flat().filter(Boolean).length;
  let covered = 0;
  for (const m of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
    covered += w;
    assert.ok(x >= QR_QUIET_ZONE && x + w <= total - QR_QUIET_ZONE);
    assert.ok(y >= QR_QUIET_ZONE && y < total - QR_QUIET_ZONE);
  }
  assert.equal(covered, dark);
});

test("zona tenang kosong: tidak ada modul gelap di tepi viewBox", () => {
  const path = qrSvgPath(qrMatrix(URL_EVENT));
  const total = qrTotalModules(qrMatrix(URL_EVENT));
  for (const m of path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    assert.ok(Number(m[1]) >= 4 && Number(m[1]) + Number(m[3]) <= total - 4);
  }
});

test("teks kosong dan teks melebihi kapasitas ditolak (bukan QR rusak)", () => {
  assert.throws(() => qrMatrix(""), /kosong/);
  assert.throws(() => qrMatrix("x".repeat(5000)));
});

test("URL panjang dengan karakter non-ASCII tetap bisa dibuat", () => {
  const matrix = qrMatrix(
    `https://ottoplay.example/e/${encodeURIComponent("Turnamén Ñandú")}?a=${"b".repeat(300)}`,
  );
  assert.ok(matrix.length > 21);
});

test("skala piksel PNG: bilangan bulat, minimal 1, hasil tidak lebih kecil dari target", () => {
  assert.equal(qrPixelScale(41), 8);
  assert.ok(qrPixelScale(41) * 41 >= 320);
  assert.equal(qrPixelScale(10_000), 1);
});

// Pagar regresi D8: pembuatan QR tidak boleh kembali memanggil layanan pihak ketiga.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?|html|css)$/.test(name) ? [full] : [];
  });
}

test("tidak ada rujukan ke layanan QR eksternal di src", () => {
  const offenders = sourceFiles("src").filter((file) =>
    /qrserver|chart\.googleapis\.com\/chart\?.*cht=qr|quickchart\.io\/qr/i.test(
      readFileSync(file, "utf8"),
    ),
  );
  assert.deepEqual(offenders, []);
});

test("qrMatrixOrNull mengembalikan null alih-alih melempar", () => {
  assert.equal(qrMatrixOrNull(""), null);
  assert.equal(qrMatrixOrNull("x".repeat(5000)), null);
  assert.deepEqual(qrMatrixOrNull(URL_EVENT), qrMatrix(URL_EVENT));
});
