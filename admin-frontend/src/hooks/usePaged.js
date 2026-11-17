import { useEffect, useState } from 'react';

/** Client-side paging; returns to page 1 whenever `resetKey` changes. */
export function usePaged(rows, resetKey, initialSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current, setPage, pageSize, setPageSize, total, totalPages, start,
    pageRows: rows.slice(start, start + pageSize),
  };
}
