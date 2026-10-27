import { Button } from "@/src/core/ui";
import { formatCount } from "../../utils/format-number";

/** "Showing 1–4 of 37" with Previous / Next. Pages start at 1. */
export function TablePagination({
  page,
  pageSize,
  total,
  itemCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Rows on this page (the last page can be short). */
  itemCount: number;
  onPageChange: (page: number) => void;
}) {
  const first = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = first + itemCount - 1;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm"
    >
      <p className="text-muted">
        Showing {formatCount(first)}–{formatCount(Math.max(last, 0))} of{" "}
        {formatCount(total)}
      </p>
      <div className="flex gap-1.5">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={last >= total}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
