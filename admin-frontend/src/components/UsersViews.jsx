import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { apiRequest } from '../api/client.js';
import { LevelBadge } from './LevelBadge.jsx';
import { AdjustModal } from './UserModals.jsx';
import { SearchIcon } from './Icons.jsx';
import Pagination from './Pagination.jsx';

const money = (v) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Original-style timestamp: YYYY-MM-DD HH:mm:ss.
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
};

// Red circle "U" badge marking an end user in the tree and table.
function UserBadge() {
  return <span className="user-circle">U</span>;
}

// The four balance/point action buttons ($ green/orange, P green/orange).
const ACTIONS = [
  { field: 'balance', mode: 'pay', sym: '$', tone: 'green', label: 'Balance Payment' },
  { field: 'balance', mode: 'collect', sym: '$', tone: 'orange', label: 'Balance Collect' },
  { field: 'point', mode: 'pay', sym: 'P', tone: 'green', label: 'Point Payment' },
  { field: 'point', mode: 'collect', sym: 'P', tone: 'orange', label: 'Point Collect' },
];

export function UsersList() {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // { kind: 'agent'|'user', uid }
  const [modal, setModal] = useState(null); // { user, field, mode }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const refresh = useCallback(async () => {
    try {
      const [ps, us] = await Promise.all([
        apiRequest('/agents', { token }),
        apiRequest('/users', { token }),
      ]);
      setPartners(ps ?? []);
      setUsers(us ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh, tick]);

  const byPartner = useMemo(() => new Map(partners.map((p) => [p.uid, p])), [partners]);

  // Ancestor agent chain (root -> ... -> direct parent) for a user.
  const userAncestors = useCallback((u) => {
    const chain = [];
    let pid = u.partnerId;
    while (pid != null) {
      const parent = byPartner.get(pid);
      if (!parent) break;
      chain.unshift(parent);
      pid = parent.partnerId;
    }
    return chain;
  }, [byPartner]);

  // Combined tree: agents as branches, users as leaves under their partner.
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

  // Which users the table shows, based on the tree selection.
  const scopedUsers = useMemo(() => {
    if (!selected) return users;
    if (selected.kind === 'user') return users.filter((u) => u.uid === selected.uid);
    // Agent selected: every user whose ancestor chain includes this agent.
    return users.filter((u) => userAncestors(u).some((p) => p.uid === selected.uid));
  }, [selected, users, userAncestors]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => scopedUsers.filter((u) =>
    !q || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q)), [scopedUsers, q]);

  // Reset to page 1 whenever the result set changes.
  useEffect(() => { setPage(1); }, [q, selected, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const afterAdjust = (updated) => {
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));
    setModal(null);
  };

  return (
    <div className="agents-split users-split">
      {/* Left: agents + users tree */}
      <section className="panel treecol users-tree">
        <div className="treecol__head">Users Treeview</div>
        {error && <p className="dash__error">{error}</p>}
        <ul className="tree">
          {roots.map((n) => (
            <UserTreeNode key={`${n.kind}-${n.data.uid}`} node={n} selected={selected} onSelect={setSelected} />
          ))}
        </ul>
      </section>

      {/* Right: users table */}
      <section className="panel users-panel">
        <div className="filters">
          <div className="filters__search">
            <SearchIcon width={16} height={16} />
            <input name="userSearch" autoComplete="off" placeholder="Search name or ID"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <h2 className="panel__title">Users List</h2>
        <div className="table-wrap">
          <table className="table agents-table users-table">
            <thead>
              <tr>
                <th>#</th><th>Member</th><th>Role</th><th>Parents</th><th>PartnerId</th><th>Balance</th>
                <th>Deposit/Withdraw</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u, i) => (
                <tr key={u.uid}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td>
                    <span className="member">
                      <UserBadge />
                      <span className="member__txt">{u.name}<small>@{u.loginId}</small></span>
                    </span>
                  </td>
                  <td><span className="badge badge--member">Member</span></td>
                  <td>
                    {userAncestors(u).length
                      ? <span className="rolecircles">{userAncestors(u).map((p) => <LevelBadge key={p.uid} role={p.role} />)}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {byPartner.get(u.partnerId)
                      ? <span className="member__txt">{byPartner.get(u.partnerId).name}<small>@{byPartner.get(u.partnerId).loginId}</small></span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="stack">
                      <span className="bal-line"><span className="coin coin--usd">$</span>{money(u.balance)}</span>
                      <span className="bal-line"><span className="coin coin--point">P</span>{money(u.point)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="stack dw">
                      <span className="dw-line dw-line--dep">{money(u.depositAmount)} ({money(u.depositCount)})</span>
                      <span className="dw-line dw-line--wd">{money(u.withdrawAmount)} ({money(u.withdrawCount)})</span>
                    </div>
                  </td>
                  <td><span className="badge">{(u.status || '').toUpperCase() || 'NORMAL'}</span></td>
                  <td>
                    <div className="uactions">
                      {ACTIONS.map((a) => (
                        <button
                          key={`${a.field}-${a.mode}`}
                          className={`uact uact--${a.tone}`}
                          data-label={a.label}
                          title={a.label}
                          onClick={() => setModal({ user: u, field: a.field, mode: a.mode })}
                        >
                          {a.sym}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr><td colSpan="9" className="table__empty">No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {modal && (
        <AdjustModal
          user={modal.user} field={modal.field} mode={modal.mode}
          onClose={() => setModal(null)} onSaved={afterAdjust}
        />
      )}
    </div>
  );
}

function UserTreeNode({ node, selected, onSelect }) {
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
            <UserTreeNode key={`${c.kind}-${c.data.uid}`} node={c} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Members > Waited Users: end users awaiting approval (Status != Active). Approving
// a user flips them to Active — they leave this page, stay in the Users List, and
// the header's "Waited Users" count drops by one.
export function WaitedUsers() {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [ps, us] = await Promise.all([
        apiRequest('/agents', { token }),
        apiRequest('/users', { token }),
      ]);
      setPartners(ps ?? []);
      setUsers(us ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);
  useEffect(() => { refresh(); }, [refresh, tick]);

  const byPartner = useMemo(() => new Map(partners.map((p) => [p.uid, p])), [partners]);

  // Pending = anything that is not yet "Active".
  const pending = useMemo(
    () => users.filter((u) => (u.status || '').toLowerCase() !== 'active'),
    [users]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => pending.filter((u) =>
    !q || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q)), [pending, q]);

  useEffect(() => { setPage(1); }, [q, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const approve = async (u) => {
    setBusyId(u.uid);
    try {
      await apiRequest(`/users/${u.uid}/approve`, { method: 'POST', token });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const dash = <span className="muted">—</span>;

  return (
    <section className="panel">
      <div className="filters">
        <div className="filters__search">
          <SearchIcon width={16} height={16} />
          <input name="waitedSearch" autoComplete="off" placeholder="Search name or ID"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <h2 className="panel__title">Waited Users</h2>
      {error && <p className="dash__error">{error}</p>}
      <div className="table-wrap">
        <table className="table agents-table users-table">
          <thead>
            <tr>
              <th>#</th><th>Member</th><th>Role</th><th>Affiliation</th><th>Email</th><th>Phone</th>
              <th>Bank</th><th>Account No.</th><th>Depositor</th><th>Attachment</th><th>Created</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((u, i) => {
              const parent = byPartner.get(u.partnerId);
              return (
                <tr key={u.uid}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td>
                    <span className="member">
                      <UserBadge />
                      <span className="member__txt">{u.name}<small>@{u.loginId}</small></span>
                    </span>
                  </td>
                  <td><span className="badge badge--member">Member</span></td>
                  <td>
                    {parent
                      ? <span className="member__txt">{parent.name}<small>@{parent.loginId}</small></span>
                      : dash}
                  </td>
                  <td>{u.email || dash}</td>
                  <td>{dash}</td>
                  <td>{u.bankName || dash}</td>
                  <td>{u.bankAccount || dash}</td>
                  <td>{u.bankMaster || dash}</td>
                  <td>{dash}</td>
                  <td className="nowrap">{fmtDate(u.createdAt)}</td>
                  <td>
                    <button className="btn-primary btn-approve" disabled={busyId === u.uid} onClick={() => approve(u)}>
                      {busyId === u.uid ? 'Approving…' : 'Approve'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr><td colSpan="12" className="table__empty">No data available</td></tr>
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
  );
}
