import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, BASE } from '../api/client.js';
import { SearchIcon } from './Icons.jsx';

const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
};

function useProviders() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(
    () => apiRequest('/providers', { token })
      .then((d) => { setRows(d ?? []); setError(''); return d ?? []; })
      .catch((e) => { setError(e.message); return []; }),
    [token]);
  useEffect(() => { refresh(); }, [refresh]);
  return { rows, error, refresh };
}

// ---- Providers List ----
export function ProvidersView() {
  const { rows, error, refresh } = useProviders();
  const [company, setCompany] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // provider being edited

  const companies = useMemo(
    () => ['All', ...new Set(rows.map((r) => r.company))], [rows]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (company !== 'All' && r.company !== company) return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <section className="panel">
      {/* Filters: company dropdown + provider name search */}
      <div className="filters">
        <div className="filters__group">
          <span className="filters__label">Company</span>
          <select className="select" value={company} onChange={(e) => setCompany(e.target.value)}>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filters__search">
          <SearchIcon width={16} height={16} />
          <input name="providerSearch" autoComplete="off" placeholder="Search provider name"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <h2 className="panel__title">Providers List</h2>
      {error && <p className="dash__error">{error}</p>}
      <div className="table-wrap">
        <table className="table agents-table">
          <thead>
            <tr>
              <th>No</th><th>Name</th><th>Company</th><th>Status</th><th>Image</th><th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.uid}>
                <td>{i + 1}</td>
                <td className="table__name">{p.name}</td>
                <td>{p.company}</td>
                <td><span className={`badge ${p.status === 1 ? '' : 'badge--off'}`}>{p.status === 1 ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button className="imgcell" onClick={() => setEditing(p)} title="Change image">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} />
                      : <span className="imgcell__none">No image</span>}
                    <span className="imgcell__edit">Change</span>
                  </button>
                </td>
                <td className="nowrap">{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan="6" className="table__empty">No providers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ImageModal
          provider={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await refresh(); setEditing(null); }}
        />
      )}
    </section>
  );
}

// Change a provider's image via URL or file upload; both write image_url.
function ImageModal({ provider, onClose, onSaved }) {
  const { token } = useAuth();
  const [url, setUrl] = useState(provider.imageUrl || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(provider.imageUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const saveUrl = async () => {
    setBusy(true); setError('');
    try {
      await apiRequest(`/providers/${provider.uid}/image`, { method: 'PUT', token, body: { imageUrl: url.trim() || null } });
      onSaved();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  const uploadFile = async () => {
    if (!file) return setError('Choose a file first.');
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/providers/${provider.uid}/image/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.message || 'Upload failed.');
      }
      onSaved();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="amodal-overlay" onMouseDown={onClose}>
      <div className="amodal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="amodal__head">
          <h3>Change Image – {provider.name}</h3>
          <button className="amodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="amodal__body">
          <div className="imgpreview">
            {preview ? <img src={preview} alt="" /> : <span className="imgcell__none">No image</span>}
          </div>

          <label className="afield"><span className="afield__label">Image URL</span>
            <input className="afield__input" value={url} onChange={(e) => { setUrl(e.target.value); setPreview(e.target.value); setFile(null); }}
              placeholder="https://…" /></label>
          <div className="amodal__actions" style={{ marginTop: 8 }}>
            <button className="btn-primary" onClick={saveUrl} disabled={busy}>Save URL</button>
          </div>

          <div className="or-divider"><span>or upload a file</span></div>

          <label className="afield"><span className="afield__label">Upload Image</span>
            <input className="afield__input" type="file" accept="image/*" onChange={pickFile} /></label>

          {error && <p className="amodal__error">{error}</p>}

          <div className="amodal__actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={uploadFile} disabled={busy || !file}>
              {busy ? 'Saving…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pageWindow(current, total, size = 5) {
  let start = Math.max(1, current - Math.floor(size / 2));
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

// ---- Games List (paginated read-only list) ----
export function GamesView() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [company, setCompany] = useState('All');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiRequest('/games', { token })
      .then((d) => setRows(d ?? []))
      .catch((e) => setError(e.message));
  }, [token]);

  const companies = useMemo(() => ['All', ...new Set(rows.map((g) => g.company))], [rows]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((g) => {
    if (company !== 'All' && g.company !== company) return false;
    if (q && !g.name.toLowerCase().includes(q) && !g.symbol.toLowerCase().includes(q)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Reset to page 1 whenever the filters/size change.
  useEffect(() => { setPage(1); }, [company, search, pageSize]);
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <section className="panel">
      <div className="filters">
        <div className="filters__group">
          <span className="filters__label">Company</span>
          <select className="select" value={company} onChange={(e) => setCompany(e.target.value)}>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filters__search">
          <SearchIcon width={16} height={16} />
          <input name="gameSearch" autoComplete="off" placeholder="Search name or symbol"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <h2 className="panel__title">Games List ({filtered.length})</h2>
      {error && <p className="dash__error">{error}</p>}
      <div className="table-wrap">
        <table className="table agents-table">
          <thead>
            <tr><th>No</th><th>Image</th><th>Provider</th><th>Company</th><th>Symbol</th><th>Name</th><th>Category</th><th>Launch</th></tr>
          </thead>
          <tbody>
            {paged.map((g, i) => (
              <tr key={g.uid}>
                <td>{start + i + 1}</td>
                <td>{g.imageUrl ? <img className="gthumb" src={g.imageUrl} alt="" loading="lazy" /> : '—'}</td>
                <td>{g.providerName ?? g.providerId}</td>
                <td>{g.company}</td>
                <td>{g.symbol}</td>
                <td className="table__name">{g.name}</td>
                <td>{g.category}</td>
                <td><span className={`badge ${g.launchEnable ? '' : 'badge--off'}`}>{g.launchEnable ? 'On' : 'Off'}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="8" className="table__empty">No games.</td></tr>}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="pagination">
          <span className="pagination__info">
            Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="pagination__controls">
            <button className="pgbtn" disabled={current === 1} onClick={() => setPage(1)}>«</button>
            <button className="pgbtn" disabled={current === 1} onClick={() => setPage(current - 1)}>‹</button>
            {pageWindow(current, totalPages).map((n) => (
              <button key={n} className={`pgbtn ${n === current ? 'is-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pgbtn" disabled={current === totalPages} onClick={() => setPage(current + 1)}>›</button>
            <button className="pgbtn" disabled={current === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
          <select className="select select--sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}
    </section>
  );
}
