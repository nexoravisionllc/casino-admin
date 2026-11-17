import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { LevelBadge, levelLetter } from './LevelBadge.jsx';
import AgentDetail from './AgentDetail.jsx';
import { RateEditModal, ReferralEditModal, CreateSubModal, ChangePasswordModal, ConfirmDeleteModal } from './AgentModals.jsx';
import { SearchIcon, UserPlusIcon, TrashIcon } from './Icons.jsx';

const rate = (v) => `${Number(v ?? 0).toFixed(1)}%`;
const date = (d) => (d ? new Date(d).toLocaleString('en-US') : '');
const RATE_LABELS = { casinoRate: 'Casino Rate', slotRate: 'Slot Rate', sportsRate: 'Sport Rate' };

function useAgents() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    return apiRequest('/agents', { token })
      .then((data) => { setRows(data ?? []); setError(''); return data ?? []; })
      .catch((err) => { setError(err.message); return []; });
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);
  return { rows, error, refresh };
}

// Split view: agents tree on the left, selected agent's details on the right.
export function AgentsTreeview() {
  const { partner } = useAuth();
  const { rows, error, refresh } = useAgents();
  const [selectedUid, setSelectedUid] = useState(null);
  const [modal, setModal] = useState(null); // {type, agent, rateKey?}

  // Default selection: the logged-in partner, else the first root.
  useEffect(() => {
    if (selectedUid == null && rows.length) {
      const mine = rows.find((r) => r.uid === partner?.uid);
      setSelectedUid(mine ? mine.uid : rows[0].uid);
    }
  }, [rows, partner, selectedUid]);

  const roots = useMemo(() => {
    const byParent = new Map();
    for (const a of rows) {
      const key = a.partnerId ?? 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(a);
    }
    const build = (k) => (byParent.get(k) ?? []).map((a) => ({ ...a, children: build(a.uid) }));
    return build('root');
  }, [rows]);

  const selected = rows.find((r) => r.uid === selectedUid) ?? null;

  // Bounds for editing the selected agent's rate.
  const rateBounds = (agent, rateKey) => {
    const parent = rows.find((r) => r.uid === agent.partnerId);
    const max = !parent || parent.role === 1 ? 100 : Number(parent[rateKey]);
    const children = rows.filter((r) => r.partnerId === agent.uid);
    const min = children.length ? Math.max(...children.map((c) => Number(c[rateKey]))) : 0;
    return { min, max };
  };

  const afterMutation = async (selectUid) => {
    const data = await refresh();
    if (selectUid != null) setSelectedUid(selectUid);
    else if (!data.some((r) => r.uid === selectedUid)) {
      setSelectedUid(data[0]?.uid ?? null);
    }
    setModal(null);
  };

  return (
    <div className="agents-split">
      {/* Left: tree */}
      <section className="panel treecol">
        <div className="treecol__head">Agents Treeview</div>
        {error && <p className="dash__error">{error}</p>}
        <ul className="tree">
          {roots.map((n) => (
            <TreeNode key={n.uid} node={n} selectedUid={selectedUid} onSelect={setSelectedUid} />
          ))}
        </ul>
      </section>

      {/* Right: details */}
      <AgentDetail
        agent={selected}
        currentUid={partner?.uid}
        onEditRate={(rateKey) => setModal({ type: 'rate', agent: selected, rateKey })}
        onEditReferral={(agent) => setModal({ type: 'referral', agent })}
        onCreateSub={(agent) => setModal({ type: 'createsub', agent })}
        onChangePassword={(agent) => setModal({ type: 'password', agent })}
        onDelete={(agent) => setModal({ type: 'delete', agent })}
      />

      {/* Modals */}
      {modal?.type === 'rate' && (() => {
        const { min, max } = rateBounds(modal.agent, modal.rateKey);
        return (
          <RateEditModal
            agent={modal.agent} rateKey={modal.rateKey} rateLabel={RATE_LABELS[modal.rateKey]}
            min={min} max={max}
            onClose={() => setModal(null)}
            onSaved={() => afterMutation(modal.agent.uid)}
          />
        );
      })()}
      {modal?.type === 'referral' && (
        <ReferralEditModal agent={modal.agent} onClose={() => setModal(null)}
          onSaved={() => afterMutation(modal.agent.uid)} />
      )}
      {modal?.type === 'createsub' && (
        <CreateSubModal parent={modal.agent} onClose={() => setModal(null)}
          onCreated={() => afterMutation(modal.agent.uid)} />
      )}
      {modal?.type === 'password' && (
        <ChangePasswordModal agent={modal.agent} onClose={() => setModal(null)} onDone={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDeleteModal agent={modal.agent} onClose={() => setModal(null)} onDone={() => afterMutation(null)} />
      )}
    </div>
  );
}

function TreeNode({ node, selectedUid, onSelect }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li className="tree__node">
      <div className={`tree__row ${selectedUid === node.uid ? 'is-selected' : ''}`} onClick={() => onSelect(node.uid)}>
        <button
          className={`tree__toggle ${hasChildren ? '' : 'is-leaf'}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setOpen((v) => !v); }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </button>
        <LevelBadge role={node.role} />
        <span className="tree__label" title={`${node.name}(@${node.loginId})`}>{node.name}(@{node.loginId})</span>
      </div>
      {hasChildren && open && (
        <ul className="tree__children">
          {node.children.map((c) => <TreeNode key={c.uid} node={c} selectedUid={selectedUid} onSelect={onSelect} />)}
        </ul>
      )}
    </li>
  );
}

const usd = (v) => '$ ' + Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const RATE_COLS = [
  { key: 'casinoRate', label: 'Casino' },
  { key: 'slotRate', label: 'Slot' },
  { key: 'sportsRate', label: 'Sports' },
];
// Original-style timestamp: YYYY-MM-DD HH:mm:ss.
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
};

function PencilBtn({ onClick }) {
  return (
    <button className="rpencil" onClick={onClick} aria-label="Edit rate">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
      </svg>
    </button>
  );
}

// Flat table of agents with a role-exclude filter, search, editable rates and actions.
export function AgentsList() {
  const { partner } = useAuth();
  const { rows, error, refresh } = useAgents();
  const [excluded, setExcluded] = useState(() => new Set()); // roles removed from the filter
  const [roleOpen, setRoleOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // {type, agent, rateKey?}

  const byUid = useMemo(() => new Map(rows.map((r) => [r.uid, r])), [rows]);
  const existingRoles = useMemo(
    () => [...new Set(rows.map((r) => r.role))].sort((a, b) => a - b), [rows]);
  const includedRoles = existingRoles.filter((r) => !excluded.has(r));

  const toggleRole = (r) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });

  const ancestors = (row) => {
    const chain = [];
    let pid = row.partnerId;
    while (pid != null) {
      const parent = byUid.get(pid);
      if (!parent) break;
      chain.unshift(parent);
      pid = parent.partnerId;
    }
    return chain;
  };

  // Bounds for editing a rate: [highest child rate, master/parent rate].
  const rateBounds = (agent, rateKey) => {
    const parent = byUid.get(agent.partnerId);
    const max = !parent || parent.role === 1 ? 100 : Number(parent[rateKey]);
    const children = rows.filter((r) => r.partnerId === agent.uid);
    const min = children.length ? Math.max(...children.map((c) => Number(c[rateKey]))) : 0;
    return { min, max };
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (excluded.has(r.role)) return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.loginId.toLowerCase().includes(q)) return false;
    return true;
  });

  const afterMutation = async () => { await refresh(); setModal(null); };

  return (
    <section className="panel">
      {/* Filters: role-exclude dropdown + search (no status filter). */}
      <div className="filters">
        <div className="filters__group">
          <span className="filters__label">Role</span>
          <div className="rolefilter">
            <button className="rolefilter__box" onClick={() => setRoleOpen((o) => !o)}>
              <span className="rolefilter__chips">
                {includedRoles.length
                  ? includedRoles.map((r) => (
                      <span className="rolechip" key={r}><LevelBadge role={r} /> {levelLetter(r)}</span>))
                  : <span className="muted">None</span>}
              </span>
              <span className="rolefilter__chev">{roleOpen ? '▲' : '▼'}</span>
            </button>
            {roleOpen && (
              <ul className="rolefilter__menu">
                {existingRoles.map((r) => {
                  const on = !excluded.has(r);
                  return (
                    <li key={r} className={on ? 'is-on' : ''} onClick={() => toggleRole(r)}>
                      <span className="rolefilter__check">{on ? '✓' : ''}</span>
                      <LevelBadge role={r} /> Level {levelLetter(r)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="filters__search">
          <SearchIcon width={16} height={16} />
          <input name="agentSearch" autoComplete="off" placeholder="Search name or ID"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <h2 className="panel__title">Agents List</h2>
      {error && <p className="dash__error">{error}</p>}
      <div className="table-wrap">
        <table className="table agents-table">
          <thead>
            <tr>
              <th>No</th><th>Member</th><th>Partner</th><th>PartnerId</th>
              <th>Balance</th><th>Rate</th><th>Status</th><th>Created At</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const master = byUid.get(a.partnerId);
              return (
              <tr key={a.uid}>
                <td>{i + 1}</td>
                <td>
                  <span className="member">
                    <LevelBadge role={a.role} />
                    <span className="member__txt">{a.name}<small>@{a.loginId}</small></span>
                  </span>
                </td>
                <td>
                  {ancestors(a).length
                    ? <span className="rolecircles">{ancestors(a).map((p) => <LevelBadge key={p.uid} role={p.role} />)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {master
                    ? <span className="member__txt">{master.name}<small>@{master.loginId}</small></span>
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {a.role === 1 ? <span className="muted">—</span> : (
                    <div className="stack">
                      <span className="bal-line">
                        <span className="coin coin--usd">$</span>
                        {Number(a.balance ?? 0).toLocaleString('en-US')}
                      </span>
                      <span className="bal-line">
                        <span className="coin coin--point">P</span>
                        {Number(a.point ?? 0).toLocaleString('en-US')}
                      </span>
                    </div>
                  )}
                </td>
                <td className="rate-col">
                  {a.role === 1 ? <span className="muted">—</span> : (
                    <div className="stack">
                      {RATE_COLS.map(({ key, label }) => (
                        <span className="rate-line" key={key}>
                          <span className="rate-text">{label}: <b>{rate(a[key])}</b></span>
                          <PencilBtn onClick={() => setModal({ type: 'rate', agent: a, rateKey: key })} />
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td><span className="badge">{a.status}</span></td>
                <td className="nowrap">{fmtDate(a.createdAt)}</td>
                <td>
                  <div className="actions">
                    <button className="act act--create" title="Create Sub" onClick={() => setModal({ type: 'createsub', agent: a })}>
                      <UserPlusIcon width={16} height={16} />
                    </button>
                    {a.uid !== partner?.uid && (
                      <button className="act act--del" title="Delete" onClick={() => setModal({ type: 'delete', agent: a })}>
                        <TrashIcon width={16} height={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan="9" className="table__empty">No agents match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'rate' && (() => {
        const { min, max } = rateBounds(modal.agent, modal.rateKey);
        return (
          <RateEditModal
            agent={modal.agent} rateKey={modal.rateKey} rateLabel={RATE_LABELS[modal.rateKey]}
            min={min} max={max} onClose={() => setModal(null)} onSaved={afterMutation} />
        );
      })()}
      {modal?.type === 'createsub' && (
        <CreateSubModal parent={modal.agent} onClose={() => setModal(null)} onCreated={afterMutation} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDeleteModal agent={modal.agent} onClose={() => setModal(null)} onDone={afterMutation} />
      )}
    </section>
  );
}
