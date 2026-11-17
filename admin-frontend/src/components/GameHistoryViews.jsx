import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { apiRequest } from '../api/client.js';
import { LevelBadge } from './LevelBadge.jsx';
import Pagination from './Pagination.jsx';

const money = (v) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => {
  const x = new Date(d);
  return `${dateStr(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
};

function UserBadge() {
  return <span className="user-circle">U</span>;
}

// Members > Game History: agents/users tree + game-history table with a
// Bet / Win / Profit / Cancel summary.
export function GameHistoryView() {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const today = useMemo(() => dateStr(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState(null); // { kind, uid }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const refresh = useCallback(async () => {
    try {
      const [ps, us, gh] = await Promise.all([
        apiRequest('/agents', { token }),
        apiRequest('/users', { token }),
        apiRequest('/game-history', { token }),
      ]);
      setPartners(ps ?? []);
      setUsers(us ?? []);
      setRows(gh ?? []);
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

  // Login ids in scope based on the tree selection.
  const scopeLogins = useMemo(() => {
    if (!selected) return null; // all
    if (selected.kind === 'user') {
      const u = users.find((x) => x.uid === selected.uid);
      return new Set(u ? [u.loginId] : []);
    }
    return new Set(users
      .filter((u) => userAncestors(u).some((p) => p.uid === selected.uid))
      .map((u) => u.loginId));
  }, [selected, users, userAncestors]);

  // Full filtered set (used for both the table and the summary).
  const filtered = useMemo(() => rows.filter((r) => {
    if (scopeLogins && !scopeLogins.has(r.userId)) return false;
    const d = dateStr(new Date(r.createdAt));
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [rows, scopeLogins, from, to]);

  // Combine the events of a round (bet + win + cancel) into a single row.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = r.roundId ? `r:${r.userId}:${r.roundId}` : `u:${r.uid}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const rounds = [];
    for (const events of map.values()) {
      const sorted = [...events].sort((a, b) => a.uid - b.uid);
      const first = sorted[0], last = sorted[sorted.length - 1];
      let bet = 0, win = 0, cancel = 0, rolling = 0;
      for (const e of events) {
        if (e.type === 'BET') { bet += Number(e.amount); rolling += Number(e.rolling); }
        else if (e.type === 'WIN') win += Number(e.amount);
        else if (e.type === 'CANCEL') cancel += Number(e.amount);
      }
      rounds.push({
        key: last.uid, sortUid: last.uid,
        userId: first.userId, providerName: first.providerName,
        gameName: first.gameName, gameCode: first.gameCode,
        bet, win, cancel, rolling,
        roundId: first.roundId, beforeAmount: first.beforeAmount, afterAmount: last.afterAmount,
        company: first.company, createdAt: last.createdAt,
      });
    }
    rounds.sort((a, b) => b.sortUid - a.sortUid);
    return rounds;
  }, [filtered]);

  useEffect(() => { setPage(1); }, [selected, from, to, pageSize]);
  const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize));
  const pageRows = grouped.slice((page - 1) * pageSize, page * pageSize);

  // Summary over the full grouped set.
  const summary = useMemo(() => {
    let bet = 0, win = 0, cancel = 0, rolling = 0;
    for (const r of grouped) { bet += r.bet; win += r.win; cancel += r.cancel; rolling += r.rolling; }
    return { bet, win, cancel, rolling, profit: bet - win - rolling };
  }, [grouped]);

  const dash = <span className="muted">—</span>;

  return (
    <div className="agents-split users-split">
      {/* Left: tree */}
      <section className="panel treecol users-tree">
        <div className="treecol__head">Members</div>
        {error && <p className="dash__error">{error}</p>}
        <ul className="tree">
          {roots.map((n) => (
            <GhTreeNode key={`${n.kind}-${n.data.uid}`} node={n} selected={selected} onSelect={setSelected} />
          ))}
        </ul>
      </section>

      {/* Right: filters + table + summary */}
      <section className="panel users-panel">
        <div className="txfilters">
          <label className="txfield">
            <span className="txfield__label">Start date</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="txfield">
            <span className="txfield__label">End date</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <h2 className="panel__title">Game History</h2>
        <div className="table-wrap">
          <table className="table agents-table gh-table">
            <thead>
              <tr>
                <th>#</th><th>User</th><th>Provider</th><th>Game</th><th>Bet</th><th>Win</th>
                <th>Cancel</th><th>Rolling</th><th>RoundId</th><th>Before</th><th>After</th><th>API</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const u = userByLogin.get(r.userId);
                return (
                  <tr key={r.key}>
                    <td>{(page - 1) * pageSize + i + 1}</td>
                    <td>
                      <span className="member">
                        <UserBadge />
                        <span className="member__txt">{u ? u.name : r.userId}<small>@{r.userId}</small></span>
                      </span>
                    </td>
                    <td>{r.providerName || dash}</td>
                    <td>{r.gameName || r.gameCode || dash}</td>
                    <td className="gh-bet">${money(r.bet)}</td>
                    <td className="gh-win">${money(r.win)}</td>
                    <td className="gh-cancel">${money(r.cancel)}</td>
                    <td className="gh-roll">{r.rolling > 0 ? `$${money(r.rolling)}` : dash}</td>
                    <td className="nowrap">{r.roundId || dash}</td>
                    <td className="nowrap">${money(r.beforeAmount)}</td>
                    <td className="nowrap">${money(r.afterAmount)}</td>
                    <td>{r.company || dash}</td>
                    <td className="nowrap">{fmtTime(r.createdAt)}</td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr><td colSpan="13" className="table__empty">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary pills */}
        <div className="gh-summary">
          <span className="ghpill ghpill--bet">Bet: ${money(summary.bet)}</span>
          <span className="ghpill ghpill--win">Win: ${money(summary.win)}</span>
          <span className="ghpill ghpill--roll">Rolling: ${money(summary.rolling)}</span>
          <span className="ghpill ghpill--profit">Profit: ${money(summary.profit)}</span>
          <span className="ghpill ghpill--cancel">Cancel: ${money(summary.cancel)}</span>
        </div>

        {/* Pagination */}
        <div className="upager">
          <select className="upager__size" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="upager__info">
            Showing {grouped.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, grouped.length)} of {grouped.length} entries
          </span>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </section>
    </div>
  );
}

function GhTreeNode({ node, selected, onSelect }) {
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
            <GhTreeNode key={`${c.kind}-${c.data.uid}`} node={c} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
