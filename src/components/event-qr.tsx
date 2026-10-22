import { useMemo } from "react";
import { qrMatrixOrNull, qrSvgPath, qrTotalModules } from "@/lib/qr";

/** QR dibuat di klien sebagai SVG inline: tanpa jaringan, tajam di ukuran apa pun, aman untuk SSR. */
export function EventQr({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const matrix = useMemo(() => qrMatrixOrNull(value), [value]);
  const path = useMemo(() => (matrix ? qrSvgPath(matrix) : ""), [matrix]);
  if (!matrix) {
    return (
      <div role="img" aria-label={label} className={className}>
        <p className="grid h-full place-items-center text-center text-xs text-arena-dim">
          QR belum dapat dibuat. Pakai link publik di samping.
        </p>
      </div>
    );
  }
  const total = qrTotalModules(matrix);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
