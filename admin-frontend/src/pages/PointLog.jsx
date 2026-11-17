import { useMemo, useState } from 'react';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import TreeView from '../components/TreeView.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Switch, TypeBadge } from '../components/ui.jsx';
import DateRange, { inRange } from '../components/DateRange.jsx';
import MultiSelect from '../components/MultiSelect.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { parseDate, dateTime, money, typeLabel } from '../lib/format.js';
import { CloseIcon } from '../components/Icons.jsx';

const p = (v) => `${money(v)} P`;

// Money > Point Log: every point movement (PointHistory table).
export default function PointLog() {
  const h = useHierarchy();
  const log = useResource('/point-history', { realtime: true, initial: [] });
  const [[from, to], setRange] = useState(['', '']);
  const [selectedId, setSelectedId] = useState(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [search, setSearch] = useState('');
  const [excludedTypes, setExcludedTypes] = useState(() => new Set());

  const types = useMemo(() => [...new Set((log.data ?? []).map((r) => r.type))].sort(), [log.data]);
  const typeOptions = types.map((t) => ({ value: t, label: typeLabel(t), render: <TypeBadge type={t} label={typeLabel(t)} /> }));
  const selectedTypes = new Set(types.filter((t) => !excludedTypes.has(t)));

  const scope = useMemo(() => h.scopeLogins(selectedId, { includeSub, includeAgents: true }), [h.scopeLogins, selectedId, includeSub]);
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => (log.data ?? []).filter((r) => {
    if (excludedTypes.has(r.type)) return false;
    if (scope && !scope.has(r.userId)) return false;
    if (q && !r.userId.toLowerCase().includes(q) && !(r.memo ?? '').toLowerCase().includes(q)) return false;
    return inRange(parseDate(r.createdAt), from, to);
  }), [log.data, excludedTypes, scope, q, from, to]);

  const totals = useMemo(() => {
    let inP = 0, outP = 0;
    for (const r of filtered) {
      const d = Number(r.afterAmount) - Number(r.beforeAmount);
      if (d >= 0) inP += d; else outP -= d;
    }
    return { inP, outP };
  }, [filtered]);

  const paged = usePaged(filtered, `${[...excludedTypes].join()}|${selectedId}|${from}|${to}|${q}|${includeSub}`);

  return (
    <div className="page">
      <PageHeader
        crumb="Money" title="Point Log"
        subtitle={`${filtered.length.toLocaleString('en-US')} entries · +${p(totals.inP)} paid · −${p(totals.outP)} collected`}
      />
      {(h.error || log.error) && <Alert>{h.error || log.error}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Network" nodes={h.tree} selectedId={selectedId} onSelect={setSelectedId} allLabel="Everyone" loading={h.loading} />
        </div>

        <section className="card">
          <div className="toolbar">
            <DateRange from={from} to={to} onChange={(f, t) => setRange([f, t])} />
            <div className="toolbar__group toolbar__grow">
              <span className="toolbar__label">Search</span>
              <SearchInput value={search} onChange={setSearch} placeholder="Login ID or memo" />
            </div>
            {types.length > 1 && (
              <div className="toolbar__group">
                <span className="toolbar__label">Type</span>
                <MultiSelect options={typeOptions} selected={selectedTypes} allLabel="All types"
                  onChange={(sel) => setExcludedTypes(new Set(types.filter((t) => !sel.has(t))))} />
              </div>
            )}
            <div className="toolbar__group">
              <span className="toolbar__label">Scope</span>
              <Switch checked={includeSub} onChange={setIncludeSub} label="Include sub-agents" />
            </div>
            {selectedId && (
              <span className="scope">
                {h.labelOf(selectedId)}
                <button onClick={() => setSelectedId(null)} aria-label="Clear filter"><CloseIcon width={13} height={13} /></button>
              </span>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Account</th><th>Type</th><th className="r">Change</th><th className="r">Before</th>
                  <th className="r">After</th><th>Memo</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((r, i) => {
                  const u = h.userByLogin.get(r.userId);
                  const a = u ? null : h.agentByLogin.get(r.userId);
                  const delta = Number(r.afterAmount) - Number(r.beforeAmount);
                  return (
                    <tr key={r.uid}>
                      <td className="table__idx">{paged.start + i + 1}</td>
                      <td><MemberCell name={u?.name ?? a?.name ?? r.userId} loginId={r.userId} role={a?.role} /></td>
                      <td><TypeBadge type={r.type} label={typeLabel(r.type)} /></td>
                      <td className={`r amount ${delta >= 0 ? 'pos' : 'neg'}`}>{delta >= 0 ? '+' : '−'}{p(Math.abs(delta))}</td>
                      <td className="r num muted">{p(r.beforeAmount)}</td>
                      <td className="r num">{p(r.afterAmount)}</td>
                      <td className="table__memo">{r.memo || <span className="faint">—</span>}</td>
                      <td className="nowrap muted">{dateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
                {!paged.pageRows.length && (
                  <TableEmpty cols={8} loading={log.loading} title="No point activity"
                    text="Point payments, collections and conversions will be listed here." />
                )}
              </tbody>
            </table>
          </div>
          <TableFoot paged={paged} noun="entries" />
        </section>
      </div>
    </div>
  );
}
