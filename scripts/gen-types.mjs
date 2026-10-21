// Regenerasi src/integrations/supabase/types.ts dari proyek DEVELOPMENT (D6).
// Jalankan: npm run types:gen   (butuh SUPABASE_ACCESS_TOKEN atau `supabase login`)
//
// Sumber sengaja dikunci ke development (kocok-arena-development), bukan produksi:
// migrasi diterapkan ke development lebih dulu, tipe dibuat dari sana.
// Keluaran selalu UTF-8 tanpa BOM dengan akhir baris LF, dan berkas lama
// tidak disentuh bila CLI gagal atau keluarannya tidak berbentuk tipe database.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEV_PROJECT_REF = "owptsovberbfwvvdxjiu";
export const TYPES_PATH = "src/integrations/supabase/types.ts";

/** Menyeragamkan keluaran CLI; melempar galat bila bukan tipe database yang utuh. */
export function normalizeTypes(raw) {
  const text = String(raw ?? "")
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n");
  if (!text.includes("export type Database")) {
    throw new Error("Keluaran tidak memuat 'export type Database'; berkas tidak ditulis.");
  }
  if (!text.includes("export const Constants")) {
    throw new Error("Keluaran terpotong (tidak ada 'Constants'); berkas tidak ditulis.");
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function main() {
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? "npx.cmd" : "npx",
    ["--yes", "supabase", "gen", "types", "typescript", "--project-id", DEV_PROJECT_REF],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: windows },
  );
  if (result.error || result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      result.error?.message ||
      `proses berakhir dengan kode ${result.status ?? "tak dikenal"}`;
    console.error(detail);
    console.error("types:gen gagal; types.ts tidak diubah.");
    process.exit(result.status || 1);
  }
  let text;
  try {
    text = normalizeTypes(result.stdout);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  writeFileSync(TYPES_PATH, text, { encoding: "utf8" });
  console.log(`Tipe dari development (${DEV_PROJECT_REF}) ditulis ke ${TYPES_PATH}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
