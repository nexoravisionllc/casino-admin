import { ChevronLeftIcon, ChevronRightIcon } from './Icons.jsx';

// Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20
function pageItems(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) items.push('…l');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push('…r');
  items.push(total);
  return items;
}

export function Pager({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const go = (p) => onPage(Math.min(Math.max(1, p), totalPages));
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="pager__btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeftIcon width={15} height={15} />
      </button>
      {pageItems(page, totalPages).map((p) => (typeof p === 'string'
        ? <span key={p} className="pager__gap">…</span>
        : (
          <button key={p} className={`pager__btn ${p === page ? 'is-active' : ''}`} onClick={() => go(p)} aria-current={p === page ? 'page' : undefined}>
            {p}
          </button>
        )))}
      <button className="pager__btn" onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRightIcon width={15} height={15} />
      </button>
    </nav>
  );
}

/** Footer under a table: "Showing a–b of n", page size, and the pager. */
export function TableFoot({ paged, sizes = [10, 20, 50, 100], noun = 'entries' }) {
  const { page, setPage, pageSize, setPageSize, total, totalPages, start } = paged;
  if (!total) return null;
  return (
    <div className="table-foot">
      <span className="pager-info">
        Showing <b>{start + 1}–{Math.min(start + pageSize, total)}</b> of <b>{total.toLocaleString('en-US')}</b> {noun}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label className="pager-size">
          Rows
          <select className="select select--sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <Pager page={page} totalPages={totalPages} onPage={setPage} />
      </div>
    </div>
  );
}

export default Pager;
