// Memuat public/pairing.js (modul UMD tanpa dependensi) ke Node.
// package.json bertipe "module", jadi file itu tidak bisa di-require biasa; dijalankan lewat Function supaya
// cabang `module.exports` yang dipakai.
import fs from 'node:fs';

export function loadPairing() {
  const code = fs.readFileSync(new URL('../public/pairing.js', import.meta.url), 'utf8');
  // Dijalankan lewat Function (realm yang sama dengan tes), bukan vm: objek dari realm lain beda prototipe
  // sehingga assert.deepEqual strict menganggapnya tidak sama walau isinya identik.
  const mod = { exports: {} };
  new Function('module', code)(mod);
  return mod.exports;
}

// RNG deterministik supaya simulasi & tes bisa diulang persis.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
