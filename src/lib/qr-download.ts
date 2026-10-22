// Unduh QR sebagai PNG yang dibuat di klien (canvas), tanpa jaringan (D8).
import { QR_QUIET_ZONE, qrMatrixOrNull, qrPixelScale, qrTotalModules } from "@/lib/qr";

/** Mengembalikan true bila unduhan dimulai; false bila QR/canvas tidak dapat dibuat. */
export function downloadQrPng(value: string, filename: string): Promise<boolean> {
  const matrix = qrMatrixOrNull(value);
  if (!matrix) return Promise.resolve(false);
  const total = qrTotalModules(matrix);
  const scale = qrPixelScale(total);
  const size = total * scale;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(false);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#000000";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect((x + QR_QUIET_ZONE) * scale, (y + QR_QUIET_ZONE) * scale, scale, scale);
      }
    });
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(true);
    }, "image/png");
  });
}
