// Full pagination: ‹ 1 2 3 … N › — renders a button for every page.
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const go = (p) => onPage(Math.min(Math.max(1, p), totalPages));
  return (
    <div className="pager-nums">
      <button className="pager-nums__btn" onClick={() => go(page - 1)} disabled={page <= 1}>‹</button>
      {pages.map((p) => (
        <button
          key={p}
          className={`pager-nums__btn pager-nums__num ${p === page ? 'is-active' : ''}`}
          onClick={() => go(p)}
        >
          {p}
        </button>
      ))}
      <button className="pager-nums__btn" onClick={() => go(page + 1)} disabled={page >= totalPages}>›</button>
    </div>
  );
}
