import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [10, 20, 50] as const;

type PageItem = number | "ellipsis-start" | "ellipsis-end";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/**
 * Nomor halaman yang ditampilkan (selalu 7 slot bila halaman > 7):
 * awal `1 2 3 4 5 … 12`, tengah `1 … 5 6 7 … 12`, akhir `1 … 8 9 10 11 12`.
 */
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return range(1, total);
  if (current <= 4) return [...range(1, 5), "ellipsis-end", total];
  if (current >= total - 3) return [1, "ellipsis-start", ...range(total - 4, total)];
  return [1, "ellipsis-start", current - 1, current, current + 1, "ellipsis-end", total];
}

function PageButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-lg border text-xs font-bold transition disabled:opacity-40 sm:size-9 ${
        active
          ? "border-arena-lime bg-arena-lime text-white shadow-md shadow-arena-lime/25"
          : "border-arena-ink/10 bg-white text-arena-ink hover:border-arena-lime"
      }`}
    >
      {children}
    </button>
  );
}

export function Pagination({
  total,
  page,
  pageSize,
  noun,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  /** Kata benda untuk ringkasan, mis. "permainan". */
  noun: string;
  onPage: (next: number) => void;
  onPageSize: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;

  return (
    <nav
      aria-label={`Halaman ${noun}`}
      className="mt-5 flex flex-col gap-3 text-xs text-arena-dim sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        Menampilkan {start + 1}-{Math.min(start + pageSize, total)} dari{" "}
        <strong className="text-arena-ink">{total}</strong> {noun}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PageButton label="Halaman sebelumnya" disabled={current === 1} onClick={() => onPage(current - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PageButton>
        {pageItems(current, totalPages).map((item) =>
          typeof item === "number" ? (
            <PageButton key={item} label={`Halaman ${item}`} active={item === current} onClick={() => onPage(item)}>
              {item}
            </PageButton>
          ) : (
            <span key={item} className="flex size-5 items-center justify-center text-arena-dim sm:size-6" aria-hidden="true">
              …
            </span>
          ),
        )}
        <PageButton label="Halaman berikutnya" disabled={current === totalPages} onClick={() => onPage(current + 1)}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageButton>
        <label className="sm:ml-1">
          <span className="sr-only">Jumlah per halaman</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-8 rounded-lg border border-arena-ink/10 bg-white px-2 text-xs sm:h-9 text-arena-ink outline-none focus:border-arena-lime"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / halaman
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  );
}
