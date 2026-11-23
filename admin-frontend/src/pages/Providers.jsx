import { useEffect, useMemo, useState } from 'react';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { apiRequest, BASE } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, Alert, SearchInput, Badge, Empty, Field, Spinner } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';
import { ImageIcon, ProvidersIcon } from '../components/Icons.jsx';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function Providers() {
  const { readOnly } = useAuth();
  const res = useResource('/providers', { initial: [] });
  const rows = res.data ?? [];
  const [company, setCompany] = useState('All');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const companies = useMemo(() => ['All', ...new Set(rows.map((r) => r.company))], [rows]);
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (company !== 'All' && r.company !== company) return false;
    if (status !== 'all' && (r.status === 1) !== (status === 'active')) return false;
    return !q || r.name.toLowerCase().includes(q);
  });
  const active = rows.filter((r) => r.status === 1).length;

  return (
    <div className="page">
      <PageHeader crumb="Games" title="Providers"
        subtitle={`${rows.length} providers · ${active} active · click a logo to change it`} />
      {res.error && <Alert>{res.error}</Alert>}

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__group toolbar__grow">
            <span className="toolbar__label">Search</span>
            <SearchInput value={search} onChange={setSearch} placeholder="Provider name" />
          </div>
          <div className="toolbar__group">
            <span className="toolbar__label">Company</span>
            <select className="select" value={company} onChange={(e) => setCompany(e.target.value)}>
              {companies.map((c) => <option key={c} value={c}>{c === 'All' ? 'All companies' : c}</option>)}
            </select>
          </div>
          <div className="toolbar__group">
            <span className="toolbar__label">Status</span>
            <div className="seg">
              {['all', 'active', 'inactive'].map((s) => (
                <button key={s} className={`seg__btn ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)}>
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {res.loading && !rows.length ? (
          <div className="pgrid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skel" style={{ height: 170, borderRadius: 14 }} />)}</div>
        ) : filtered.length ? (
          <div className="pgrid">
            {filtered.map((p) => (
              <div className="pcard" key={p.uid}>
                <button className="pcard__logo" onClick={() => setEditing(p)} aria-label={`Change image for ${p.name}`} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <span className="pcard__mono">{initials(p.name)}</span>}
                  <span className="pcard__edit"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ImageIcon width={15} height={15} /> Change image</span></span>
                </button>
                <div className="pcard__body">
                  <span className="pcard__name" title={p.name}>{p.name}</span>
                  <div className="pcard__meta">
                    <span>{p.company}</span>
                    <Badge tone={p.status === 1 ? 'green' : 'red'} dot>{p.status === 1 ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={ProvidersIcon} title="No providers match" text="Try another company, status or search." />
        )}
      </section>

      {editing && (
        <ImageModal provider={editing} onClose={() => setEditing(null)}
          onSaved={async () => { await res.refresh(); setEditing(null); }} />
      )}
    </div>
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

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

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
      const r = await fetch(`${BASE}/providers/${provider.uid}/image/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.message || 'Upload failed.');
      }
      onSaved();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title="Provider image" subtitle={provider.name} icon={ImageIcon} onClose={onClose}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--primary" onClick={uploadFile} disabled={busy || !file}>
          {busy && file && <Spinner />}Upload file
        </button>
      </>}>
      <div className="imgpreview">
        {preview ? <img src={preview} alt="" /> : <span className="pcard__mono">{initials(provider.name)}</span>}
      </div>
      <Field label="Image URL">
        <div className="inline-form">
          <input className="input" value={url} placeholder="https://…"
            onChange={(e) => { setUrl(e.target.value); setPreview(e.target.value); setFile(null); }} />
          <button type="button" className="btn btn--soft" onClick={saveUrl} disabled={busy}>Save URL</button>
        </div>
      </Field>
      <div className="or-divider">or upload a file</div>
      <Field label="Image file" hint="PNG, JPG, SVG or WebP. Max 5 MB.">
        <input className="input" type="file" accept="image/*" onChange={pickFile} />
      </Field>
      {error && <Alert>{error}</Alert>}
    </Modal>
  );
}
