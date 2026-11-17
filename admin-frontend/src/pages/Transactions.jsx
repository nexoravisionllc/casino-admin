import { useMemo, useState } from 'react';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import TreeView from '../components/TreeView.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Switch, StatusBadge, TypeBadge } from '../components/ui.jsx';
import DateRange, { inRange, todayRange } from '../components/DateRange.jsx';
import MultiSelect from '../components/MultiSelect.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { parseDate, dateTime, usd, typeLabel } from '../lib/format.js';
import { CloseIcon } from '../components/Icons.jsx';

const TX_TYPES = ['deposit', 'withdraw', 'payment', 'collect', 'point-convert', 'coin-deposit', 'rolling payment', 'rolling collect'];
const TX_STATUSES = ['pending', 'finished', 'rejected', 'restored'];

// Money > Transactions: every balance movement, for members and agents.
export default function Transactions() {
  const h = useHierarchy();
  const txs = useResource('/transactions', { realtime: true, initial: [] });
  const [[from, to], setRange] = useState(todayRange);
  const [selectedId, setSelectedId] = useState(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [search, setSearch] = useState('');
  const [excludedTypes, setExcludedTypes] = useState(() => new Set());
  const [statuses, setStatuses] = useState(() => new Set(TX_STATUSES));

  // Include types found in the data that aren't in the known list.
  const allTypes = useMemo(() => [...new Set([...TX_TYPES, ...(txs.data ?? []).map((t) => t.type)])], [txs.data]);
  const selectedTypes = new Set(allTypes.filter((t) => !excludedTypes.has(t)));
  const typeOptions = allTypes.map((t) => ({ value: t, label: typeLabel(t), render: <TypeBadge type={t} label={typeLabel(t)} /> }));
  const statusOptions = TX_STATUSES.map((s) => ({ value: s, label: s, render: <StatusBadge status={s} /> }));

  const scope = useMemo(() => h.scopeLogins(selectedId, { includeSub, includeAgents: true }), [h.scopeLogins, selectedId, includeSub]);
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => (txs.data ?? []).filter((t) => {
    if (excludedTypes.has(t.type)) return false;
    if (!statuses.has(t.status)) return false;
    if (scope && !scope.has(t.userId)) return false;
    if (q && !t.userId.toLowerCase().includes(q) && !(t.memo ?? '').toLowerCase().includes(q)) return false;
    return inRange(parseDate(t.createdAt), from, to);
  }), [txs.data, excludedTypes, statuses, scope, q, from, to]);

  const paged = usePaged(filtered, `${[...excludedTypes].join()}|${[...statuses].join()}|${selectedId}|${from}|${to}|${q}|${includeSub}`);

  return (
    <div className="page">
      <PageHeader crumb="Money" title="Transactions" subtitle="Every balance movement for members and agents." />
      {(h.error || txs.error) && <Alert>{h.error || txs.error}</Alert>}

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
          </div>
          <div className="toolbar">
            <div className="toolbar__group">
              <span className="toolbar__label">Type</span>
              <MultiSelect options={typeOptions} selected={selectedTypes} allLabel="All types"
                onChange={(sel) => setExcludedTypes(new Set(allTypes.filter((t) => !sel.has(t))))} />
            </div>
            <div className="toolbar__group">
              <span className="toolbar__label">Status</span>
              <MultiSelect options={statusOptions} selected={statuses} onChange={setStatuses} allLabel="All statuses" />
            </div>
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
                  <th>#</th><th>Account</th><th>Type</th><th className="r">Amount</th><th className="r">Before</th>
                  <th className="r">After</th><th>Status</th><th>Processed by</th><th>Memo</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((t, i) => {
                  const u = h.userByLogin.get(t.userId);
                  const a = u ? null : h.agentByLogin.get(t.userId);
                  return (
                    <tr key={t.uid}>
                      <td className="table__idx">{paged.start + i + 1}</td>
                      <td><MemberCell name={u?.name ?? a?.name ?? t.userId} loginId={t.userId} role={a?.role} /></td>
                      <td><TypeBadge type={t.type} label={typeLabel(t.type)} /></td>
                      <td className="r amount">{usd(t.amount)}</td>
                      <td className="r num muted">{usd(t.beforeAmount)}</td>
                      <td className="r num">{t.afterAmount == null ? <span className="faint">—</span> : usd(t.afterAmount)}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>{t.managerId || <span className="faint">—</span>}</td>
                      <td className="table__memo">{t.memo || <span className="faint">—</span>}</td>
                      <td className="nowrap muted">{dateTime(t.createdAt)}</td>
                    </tr>
                  );
                })}
                {!paged.pageRows.length && (
                  <TableEmpty cols={10} loading={txs.loading} title="No transactions"
                    text="Nothing matches these filters. Try a wider date range." />
                )}
              </tbody>
            </table>
          </div>
          <TableFoot paged={paged} noun="transactions" />
        </section>
      </div>
    </div>
  );
}
