import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import { PageHeader, Alert, SearchInput, Badge, TableEmpty } from '../components/ui.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { GamepadIcon } from '../components/Icons.jsx';

export default function Games() {
  const res = useResource('/games', { initial: [] });
  const rows = res.data ?? [];
  const [company, setCompany] = useState('All');
  const [provider, setProvider] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const companies = useMemo(() => ['All', ...new Set(rows.map((g) => g.company))], [rows]);
  const providers = useMemo(() => ['All', ...[...new Set(rows
    .filter((g) => company === 'All' || g.company === company)
    .map((g) => g.providerName ?? String(g.providerId)))].sort()], [rows, company]);
  const categories = useMemo(() => ['All', ...[...new Set(rows.map((g) => g.category).filter(Boolean))].sort()], [rows]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => rows.filter((g) => {
    if (company !== 'All' && g.company !== company) return false;
    if (provider !== 'All' && (g.providerName ?? String(g.providerId)) !== provider) return false;
    if (category !== 'All' && g.category !== category) return false;
    return !q || g.name.toLowerCase().includes(q) || g.symbol.toLowerCase().includes(q);
  }), [rows, company, provider, category, q]);
  const paged = usePaged(filtered, `${company}|${provider}|${category}|${q}`, 20);
  const enabled = rows.filter((g) => g.launchEnable).length;

  return (
    <div className="page">
      <PageHeader crumb="Games" title="Games" subtitle={`${rows.length.toLocaleString('en-US')} games · ${enabled.toLocaleString('en-US')} launchable`} />
      {res.error && <Alert>{res.error}</Alert>}

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__group toolbar__grow">
            <span className="toolbar__label">Search</span>
            <SearchInput value={search} onChange={setSearch} placeholder="Game name or symbol" />
          </div>
          <div className="toolbar__group">
            <span className="toolbar__label">Company</span>
            <select className="select" value={company} onChange={(e) => { setCompany(e.target.value); setProvider('All'); }}>
              {companies.map((c) => <option key={c} value={c}>{c === 'All' ? 'All companies' : c}</option>)}
            </select>
          </div>
          <div className="toolbar__group">
            <span className="toolbar__label">Provider</span>
            <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((c) => <option key={c} value={c}>{c === 'All' ? 'All providers' : c}</option>)}
            </select>
          </div>
          {categories.length > 2 && (
            <div className="toolbar__group">
              <span className="toolbar__label">Category</span>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Game</th><th>Provider</th><th>Company</th><th>Symbol</th><th>Category</th><th>Launch</th></tr>
            </thead>
            <tbody>
              {paged.pageRows.map((g, i) => (
                <tr key={g.uid}>
                  <td className="table__idx">{paged.start + i + 1}</td>
                  <td>
                    <span className="member">
                      {g.imageUrl
                        ? <img className="gthumb" src={g.imageUrl} alt="" loading="lazy" />
                        : <span className="gthumb gthumb--none"><GamepadIcon width={18} height={18} /></span>}
                      <span className="member__name">{g.name}</span>
                    </span>
                  </td>
                  <td>{g.providerName ?? g.providerId}</td>
                  <td className="muted">{g.company}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{g.symbol}</td>
                  <td>{g.category ? <Badge>{g.category}</Badge> : <span className="faint">—</span>}</td>
                  <td><Badge tone={g.launchEnable ? 'green' : 'red'} dot>{g.launchEnable ? 'On' : 'Off'}</Badge></td>
                </tr>
              ))}
              {!paged.pageRows.length && <TableEmpty cols={7} loading={res.loading} title="No games match" text="Try a different filter or search." />}
            </tbody>
          </table>
        </div>
        <TableFoot paged={paged} sizes={[20, 50, 100]} noun="games" />
      </section>
    </div>
  );
}
