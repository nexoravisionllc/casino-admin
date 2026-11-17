import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { apiRequest } from '../api/client.js';
import { LevelBadge } from './LevelBadge.jsx';
import { SearchIcon } from './Icons.jsx';
import Pagination from './Pagination.jsx';

const money = (v) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const txLabel = (t) => (t || '').replace(/[\s-]+/g, '_').toUpperCase();
// Class-safe type slug (spaces → hyphens) for the txchip color modifier.
const txClass = (t) => 'txchip--' + (t || '').replace(/\s+/g, '-');

function UserBadge() {
  return <span className="user-circle">U</span>;
}

// The Money > Deposit page: transactions treeview + filters + table with
// accept / reject / restore actions. `defaultType` seeds the type filter.
export function DepositView({ defaultType = 'deposit', title = 'Deposit' }) {
  // Withdraw has no "restored" state (no restore action), so its status filter
  // drops that option.
  const statusList = defaultType === 'withdraw'
    ? ['pending', 'finished', 'rejected']
    : ['pending', 'finished', 'rejected', 'restored'];
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // tx uid being processed

  // Filters.
  const today = useMemo(() => dateStr(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [idSearch, setIdSearch] = useState('');
  const [statuses, setStatuses] = useState(() => new Set(statusList)); // all on
  const [statusOpen, setStatusOpen] = useState(false);
  const [includeSub, setIncludeSub] = useState(true);
  const [selected, setSelected] = useState(null); // { kind, uid }

  const refresh = useCallback(async () => {
    try {
      const [ps, us, ts] = await Promise.all([
        apiRequest('/agents', { token }),
        apiRequest('/users', { token }),
        apiRequest('/transactions', { token }),
      ]);
      setPartners(ps ?? []);
      setUsers(us ?? []);
      setTxs(ts ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh, tick]);

  const byPartner = useMemo(() => new Map(partners.map((p) => [p.uid, p])), [partners]);
  const userByLogin = useMemo(() => new Map(users.map((u) => [u.loginId, u])), [users]);

  const userAncestors = useCallback((u) => {
    const chain = [];
    let pid = u?.partnerId;
    while (pid != null) {
      const parent = byPartner.get(pid);
      if (!parent) break;
      chain.unshift(parent);
      pid = parent.partnerId;
    }
    return chain;
  }, [byPartner]);

  // Combined agents + users tree.
  const roots = useMemo(() => {
    const agentsByParent = new Map();
    for (const a of partners) {
      const k = a.partnerId ?? 'root';
      if (!agentsByParent.has(k)) agentsByParent.set(k, []);
      agentsByParent.get(k).push(a);
    }
    const usersByParent = new Map();
    for (const u of users) {
      const k = u.partnerId ?? 'root';
      if (!usersByParent.has(k)) usersByParent.set(k, []);
      usersByParent.get(k).push(u);
    }
    const build = (k) => [
      ...(agentsByParent.get(k) ?? []).map((a) => ({ kind: 'agent', data: a, children: build(a.uid) })),
      ...(usersByParent.get(k) ?? []).map((u) => ({ kind: 'user', data: u, children: [] })),
    ];
    return build('root');
  }, [partners, users]);

  // Login ids in scope, based on the tree selection + include-sub toggle.
  const scopeLogins = useMemo(() => {
    if (!selected) return null; // no selection = all
    if (selected.kind === 'user') {
      const u = users.find((x) => x.uid === selected.uid);
      return new Set(u ? [u.loginId] : []);
    }
    // Agent selected.
    const logins = users
      .filter((u) => {
        if (includeSub) return userAncestors(u).some((p) => p.uid === selected.uid);
        return u.partnerId === selected.uid;
      })
      .map((u) => u.loginId);
    return new Set(logins);
  }, [selected, users, includeSub, userAncestors]);

  const filtered = useMemo(() => {
    const q = idSearch.trim().toLowerCase();
    return txs.filter((t) => {
      if (t.type !== defaultType) return false;
      if (!statuses.has(t.status)) return false;
      if (scopeLogins && !scopeLogins.has(t.userId)) return false;
      if (q && !t.userId.toLowerCase().includes(q)) return false;
      const d = dateStr(new Date(t.createdAt));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [txs, defaultType, statuses, scopeLogins, idSearch, from, to]);

  const toggleStatus = (s) => setStatuses((prev) => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const act = async (uid, action) => {
    if (busy) return;
    setBusy(uid);
    try {
      const res = await apiRequest(`/transactions/${uid}/${action}`, { method: 'POST', token });
      if (res && res.success === false) setError(res.message || 'Action failed.');
      else setError('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="agents-split users-split">
      {/* Left: agents + users tree */}
      <section className="panel treecol users-tree">
        <div className="treecol__head">Members</div>
        <ul className="tree">
          {roots.map((n) => (
            <TxTreeNode key={`${n.kind}-${n.data.uid}`} node={n} selected={selected} onSelect={setSelected} />
          ))}
        </ul>
      </section>

      {/* Right: filters + table */}
      <section className="panel users-panel">
        {/* Filters row: dates + id search */}
        <div className="txfilters">
          <label className="txfield">
            <span className="txfield__label">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="txfield">
            <span className="txfield__label">End</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="txfield txfield--grow">
            <span className="txfield__label">Search</span>
            <span className="txfield__search">
              <SearchIcon width={15} height={15} />
              <input placeholder="ID" value={idSearch} autoComplete="off" onChange={(e) => setIdSearch(e.target.value)} />
            </span>
          </label>
        </div>

        {/* Include sub + status filter (dropdown like the agent-list role filter) */}
        <div className="txfilters txfilters--second">
          <label className="txtoggle">
            <input type="checkbox" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} />
            <span className="txtoggle__track"><span className="txtoggle__dot" /></span>
            Include sub
          </label>
          <div className="filters__group">
            <span className="filters__label">Status</span>
            <div className="rolefilter">
              <button className="rolefilter__box" onClick={() => setStatusOpen((o) => !o)}>
                <span className="rolefilter__chips">
                  {statusList.some((s) => statuses.has(s))
                    ? statusList.filter((s) => statuses.has(s)).map((s) => (
                        <span key={s} className={`txchip txchip--${s} is-on`}>{s.toUpperCase()}</span>))
                    : <span className="muted">None</span>}
                </span>
                <span className="rolefilter__chev">{statusOpen ? '▲' : '▼'}</span>
              </button>
              {statusOpen && (
                <ul className="rolefilter__menu">
                  {statusList.map((s) => {
                    const on = statuses.has(s);
                    return (
                      <li key={s} className={on ? 'is-on' : ''} onClick={() => toggleStatus(s)}>
                        <span className="rolefilter__check">{on ? '✓' : ''}</span>
                        <span className={`txchip txchip--${s} is-on`}>{s.toUpperCase()}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <h2 className="panel__title">{title}</h2>
        {error && <p className="dash__error">{error}</p>}
        <div className="table-wrap">
          <table className="table agents-table tx-table">
            <thead>
              <tr>
                <th>#</th><th>Member</th><th>Type</th><th>Today</th><th>Amount</th>
                <th>Before</th><th>After</th><th>Status</th><th>Bank</th><th>Processor</th><th>Time</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const u = userByLogin.get(t.userId);
                const created = new Date(t.createdAt);
                return (
                  <tr key={t.uid}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="member">
                        <UserBadge />
                        <span className="member__txt">{u ? u.name : t.userId}<small>@{t.userId}</small></span>
                      </span>
                    </td>
                    <td><span className="badge badge--member">{t.type}</span></td>
                    <td className="nowrap">{dateStr(created)}</td>
                    <td className="nowrap"><b>${money(t.amount)}</b></td>
                    <td className="nowrap">${money(t.beforeAmount)}</td>
                    <td className="nowrap">{t.afterAmount == null ? <span className="muted">—</span> : `$${money(t.afterAmount)}`}</td>
                    <td><span className={`badge txbadge--${t.status}`}>{t.status.toUpperCase()}</span></td>
                    <td>{u?.bankName || <span className="muted">—</span>}</td>
                    <td>{t.managerId || <span className="muted">—</span>}</td>
                    <td className="nowrap">{dateStr(created)} {timeStr(created)}</td>
                    <td>
                      <div className="actions">
                        {/* Rows are already scoped to the current type. Deposits
                            can be restored once finished; withdraws cannot. */}
                        {t.status === 'pending' && (
                          <>
                            <button className="tx-btn tx-btn--accept" disabled={busy === t.uid} onClick={() => act(t.uid, 'accept')}>Accept</button>
                            <button className="tx-btn tx-btn--reject" disabled={busy === t.uid} onClick={() => act(t.uid, 'reject')}>Reject</button>
                          </>
                        )}
                        {t.status === 'finished' && defaultType !== 'withdraw' && (
                          <button className="tx-btn tx-btn--restore" disabled={busy === t.uid} onClick={() => act(t.uid, 'restore')}>Restore</button>
                        )}
                        {!(t.status === 'pending' || (t.status === 'finished' && defaultType !== 'withdraw')) && (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan="12" className="table__empty">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TxTreeNode({ node, selected, onSelect }) {
  const [open, setOpen] = useState(true);
  const isUser = node.kind === 'user';
  const hasChildren = node.children.length > 0;
  const isSelected = selected?.kind === node.kind && selected?.uid === node.data.uid;
  return (
    <li className="tree__node">
      <div
        className={`tree__row ${isSelected ? 'is-selected' : ''}`}
        onClick={() => onSelect({ kind: node.kind, uid: node.data.uid })}
      >
        <button
          className={`tree__toggle ${hasChildren ? '' : 'is-leaf'}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setOpen((v) => !v); }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </button>
        {isUser ? <UserBadge /> : <LevelBadge role={node.data.role} />}
        <span className="tree__label" title={`${node.data.name}(@${node.data.loginId})`}>{node.data.name}(@{node.data.loginId})</span>
      </div>
      {hasChildren && open && (
        <ul className="tree__children">
          {node.children.map((c) => (
            <TxTreeNode key={`${c.kind}-${c.data.uid}`} node={c} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

const TX_TYPES = [
  { value: 'deposit', label: 'DEPOSIT' },
  { value: 'withdraw', label: 'WITHDRAW' },
  { value: 'payment', label: 'PAYMENT' },
  { value: 'collect', label: 'COLLECT' },
  { value: 'point-convert', label: 'POINT_CONVERT' },
  { value: 'coin-deposit', label: 'COIN_DEPOSIT' },
  { value: 'rolling payment', label: 'ROLLING_PAYMENT' },
  { value: 'rolling collect', label: 'ROLLING_COLLECT' },
];
const TX_STATUSES = ['pending', 'finished', 'rejected', 'restored'];

// Money > Transaction: every user's transactions across all types. Tree scope +
// From/End dates + ID search + Type/Status multi-selects. Read-only (no actions).
export function TransactionHistoryView() {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [error, setError] = useState('');

  const today = useMemo(() => dateStr(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [idSearch, setIdSearch] = useState('');
  const [types, setTypes] = useState(() => new Set(TX_TYPES.map((t) => t.value)));
  const [typeOpen, setTypeOpen] = useState(false);
  const [statuses, setStatuses] = useState(() => new Set(TX_STATUSES));
  const [statusOpen, setStatusOpen] = useState(false);
  const [includeSub, setIncludeSub] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const refresh = useCallback(async () => {
    try {
      const [ps, us, ts] = await Promise.all([
        apiRequest('/agents', { token }),
        apiRequest('/users', { token }),
        apiRequest('/transactions', { token }),
      ]);
      setPartners(ps ?? []);
      setUsers(us ?? []);
      setTxs(ts ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh, tick]);

  const byPartner = useMemo(() => new Map(partners.map((p) => [p.uid, p])), [partners]);
  const userByLogin = useMemo(() => new Map(users.map((u) => [u.loginId, u])), [users]);

  const userAncestors = useCallback((u) => {
    const chain = [];
    let pid = u?.partnerId;
    while (pid != null) {
      const parent = byPartner.get(pid);
      if (!parent) break;
      chain.unshift(parent);
      pid = parent.partnerId;
    }
    return chain;
  }, [byPartner]);

  const roots = useMemo(() => {
    const agentsByParent = new Map();
    for (const a of partners) {
      const k = a.partnerId ?? 'root';
      if (!agentsByParent.has(k)) agentsByParent.set(k, []);
      agentsByParent.get(k).push(a);
    }
    const usersByParent = new Map();
    for (const u of users) {
      const k = u.partnerId ?? 'root';
      if (!usersByParent.has(k)) usersByParent.set(k, []);
      usersByParent.get(k).push(u);
    }
    const build = (k) => [
      ...(agentsByParent.get(k) ?? []).map((a) => ({ kind: 'agent', data: a, children: build(a.uid) })),
      ...(usersByParent.get(k) ?? []).map((u) => ({ kind: 'user', data: u, children: [] })),
    ];
    return build('root');
  }, [partners, users]);

  const partnerByLogin = useMemo(() => new Map(partners.map((p) => [p.loginId, p])), [partners]);

  // Is partner p inside the subtree of the selected agent (inclusive)?
  const partnerInSubtree = useCallback((p, agentUid) => {
    let cur = p;
    while (cur) {
      if (cur.uid === agentUid) return true;
      cur = byPartner.get(cur.partnerId);
    }
    return false;
  }, [byPartner]);

  const scopeLogins = useMemo(() => {
    if (!selected) return null; // no selection = all users + partners
    if (selected.kind === 'user') {
      const u = users.find((x) => x.uid === selected.uid);
      return new Set(u ? [u.loginId] : []);
    }
    // Agent selected: include its own transactions (e.g. rolling) plus its subtree
    // (include sub) or its direct children.
    const logins = new Set();
    const agent = byPartner.get(selected.uid);
    if (agent) logins.add(agent.loginId);
    if (includeSub) {
      for (const p of partners) if (partnerInSubtree(p, selected.uid)) logins.add(p.loginId);
      for (const u of users) if (userAncestors(u).some((a) => a.uid === selected.uid)) logins.add(u.loginId);
    } else {
      for (const p of partners) if (p.partnerId === selected.uid) logins.add(p.loginId);
      for (const u of users) if (u.partnerId === selected.uid) logins.add(u.loginId);
    }
    return logins;
  }, [selected, users, partners, includeSub, byPartner, partnerInSubtree, userAncestors]);

  const filtered = useMemo(() => {
    const q = idSearch.trim().toLowerCase();
    return txs.filter((t) => {
      if (!types.has(t.type)) return false;
      if (!statuses.has(t.status)) return false;
      if (scopeLogins && !scopeLogins.has(t.userId)) return false;
      if (q && !t.userId.toLowerCase().includes(q)) return false;
      const d = dateStr(new Date(t.createdAt));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [txs, types, statuses, scopeLogins, idSearch, from, to]);

  useEffect(() => { setPage(1); }, [idSearch, from, to, selected, includeSub, pageSize, types, statuses]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleType = (v) => setTypes((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const toggleStatus = (s) => setStatuses((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="agents-split users-split">
      <section className="panel treecol users-tree">
        <div className="treecol__head">Members</div>
        <ul className="tree">
          {roots.map((n) => (
            <TxTreeNode key={`${n.kind}-${n.data.uid}`} node={n} selected={selected} onSelect={setSelected} />
          ))}
        </ul>
      </section>

      <section className="panel users-panel">
        <div className="txfilters">
          <label className="txfield">
            <span className="txfield__label">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="txfield">
            <span className="txfield__label">End</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="txfield txfield--grow">
            <span className="txfield__label">Search</span>
            <span className="txfield__search">
              <SearchIcon width={15} height={15} />
              <input placeholder="ID" value={idSearch} autoComplete="off" onChange={(e) => setIdSearch(e.target.value)} />
            </span>
          </label>
        </div>

        <div className="txfilters txfilters--second">
          <label className="txtoggle">
            <input type="checkbox" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} />
            <span className="txtoggle__track"><span className="txtoggle__dot" /></span>
            Include sub
          </label>
          <div className="filters__group">
            <span className="filters__label">Type</span>
            <div className="rolefilter">
              <button className="rolefilter__box" onClick={() => setTypeOpen((o) => !o)}>
                <span className="rolefilter__chips">
                  {TX_TYPES.some((t) => types.has(t.value))
                    ? TX_TYPES.filter((t) => types.has(t.value)).map((t) => (
                        <span key={t.value} className={`txchip ${txClass(t.value)} is-on`}>{t.label}</span>))
                    : <span className="muted">None</span>}
                </span>
                <span className="rolefilter__chev">{typeOpen ? '▲' : '▼'}</span>
              </button>
              {typeOpen && (
                <ul className="rolefilter__menu">
                  {TX_TYPES.map((t) => {
                    const on = types.has(t.value);
                    return (
                      <li key={t.value} className={on ? 'is-on' : ''} onClick={() => toggleType(t.value)}>
                        <span className="rolefilter__check">{on ? '✓' : ''}</span>
                        <span className={`txchip ${txClass(t.value)} is-on`}>{t.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <div className="filters__group">
            <span className="filters__label">Status</span>
            <div className="rolefilter">
              <button className="rolefilter__box" onClick={() => setStatusOpen((o) => !o)}>
                <span className="rolefilter__chips">
                  {TX_STATUSES.some((s) => statuses.has(s))
                    ? TX_STATUSES.filter((s) => statuses.has(s)).map((s) => (
                        <span key={s} className={`txchip txchip--${s} is-on`}>{s.toUpperCase()}</span>))
                    : <span className="muted">None</span>}
                </span>
                <span className="rolefilter__chev">{statusOpen ? '▲' : '▼'}</span>
              </button>
              {statusOpen && (
                <ul className="rolefilter__menu">
                  {TX_STATUSES.map((s) => {
                    const on = statuses.has(s);
                    return (
                      <li key={s} className={on ? 'is-on' : ''} onClick={() => toggleStatus(s)}>
                        <span className="rolefilter__check">{on ? '✓' : ''}</span>
                        <span className={`txchip txchip--${s} is-on`}>{s.toUpperCase()}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <h2 className="panel__title">Transaction History</h2>
        {error && <p className="dash__error">{error}</p>}
        <div className="table-wrap">
          <table className="table agents-table tx-table">
            <thead>
              <tr>
                <th>#</th><th>Member</th><th>Type</th><th>Before</th><th>Amount</th>
                <th>After</th><th>Status</th><th>Processor</th><th>Time</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t, i) => {
                const u = userByLogin.get(t.userId);
                const p = u ? null : partnerByLogin.get(t.userId);
                const ownerName = u?.name || p?.name || t.userId;
                const created = new Date(t.createdAt);
                return (
                  <tr key={t.uid}>
                    <td>{(page - 1) * pageSize + i + 1}</td>
                    <td>
                      <span className="member">
                        {p ? <LevelBadge role={p.role} /> : <UserBadge />}
                        <span className="member__txt">{ownerName}<small>@{t.userId}</small></span>
                      </span>
                    </td>
                    <td><span className={`txchip ${txClass(t.type)} is-on`}>{txLabel(t.type)}</span></td>
                    <td className="nowrap">${money(t.beforeAmount)}</td>
                    <td className="nowrap"><b>${money(t.amount)}</b></td>
                    <td className="nowrap">{t.afterAmount == null ? <span className="muted">—</span> : `$${money(t.afterAmount)}`}</td>
                    <td><span className={`badge txbadge--${t.status}`}>{t.status.toUpperCase()}</span></td>
                    <td>{t.managerId || <span className="muted">—</span>}</td>
                    <td className="nowrap">{dateStr(created)} {timeStr(created)}</td>
                    <td><span className="muted">—</span></td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr><td colSpan="10" className="table__empty">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="upager">
          <select className="upager__size" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="upager__info">
            Showing {filtered.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </section>
    </div>
  );
}
