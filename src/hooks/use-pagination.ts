import { useEffect, useMemo, useState } from "react";

// Client-side pagination over an already-fetched array. Deliberately not server paging:
// these lists (pupils, staff, invoices, etc.) are fetched in full for instant search/filter
// anyway, so paging is purely a display convenience — slicing an in-memory array is instant,
// unlike a server round-trip per page.
//
// `resetKey` should be a value that changes whenever the caller's search/filter inputs change
// (e.g. `` `${query}-${classFilter}` ``) — without it, typing a new search while on page 3
// would keep showing page 3 of the new, unrelated result set instead of jumping back to page 1.
export function usePagination<T>(items: T[], pageSize = 25, resetKey?: string | number) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // If the underlying list shrinks (a filter is applied, a row is deleted) such that the
  // current page no longer exists, snap back rather than showing a blank page.
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [totalPages, page]);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize],
  );

  return { pageItems, page, setPage, totalPages, pageSize, total: items.length };
}
