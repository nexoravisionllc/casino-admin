import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { usePaged } from '../hooks/usePaged.js';
import { LevelBadge, LevelChain, MemberCell, levelLetter } from '../components/LevelBadge.jsx';
import { PageHeader, StatusBadge, Alert, SearchInput, TableEmpty, Wallet } from '../components/ui.jsx';
import MultiSelect from '../components/MultiSelect.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import {
  RateEditModal, CreateSubModal, ChangePasswordModal, ConfirmDeleteModal, rateBounds,
} from '../components/AgentModals.jsx';
import { dateTime } from '../lib/format.js';
import { EditIcon, UserPlusIcon, TrashIcon, KeyIcon, NetworkIcon } from '../components/Icons.jsx';

const RATE_COLS = [
  { key: 'casinoRate', label: 'Casino' },
  { key: 'slotRate', label: 'Slot' },
  { key: 'sportsRate', label: 'Sports' },
];

export default function AgentList() {
  const { partner } = useAuth();
  const navigate = useNavigate();
  const h = useHierarchy();
  const [excluded, setExcluded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  const roles = useMemo(() => [...new Set(h.agents.map((r) => r.role))].sort((a, b) => a - b), [h.agents]);
  const roleOptions = roles.map((r) => ({
    value: r, label: `Level ${levelLetter(r)}`,
    render: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LevelBadge role={r} size="sm" />{r === 1 ? 'Admin' : `Level ${levelLetter(r)}`}</span>,
  }));
  const selectedRoles = new Set(roles.filter((r) => !excluded.has(r)));

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => h.agents.filter((r) => {
    if (excluded.has(r.role)) return false;
    return !q || r.name.toLowerCase().includes(q) || r.loginId.toLowerCase().includes(q) || (r.referralId ?? '').toLowerCase().includes(q);
  }), [h.agents, excluded, q]);

  const paged = usePaged(filtered, `${q}|${[...excluded].join()}`);
  const done = async () => { await h.refresh(); setModal(null); };

  return (
    <div className="page">
      <PageHeader
        crumb="Agents" title="Agent List" subtitle={`${h.agents.length} agents in your network`}
        actions={<button className="btn btn--ghost" onClick={() => navigate('/agents/treeview')}><NetworkIcon width={16} height={16} /> Tree view</button>}
      />
      {h.error && <Alert>{h.error}</Alert>}

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__group toolbar__grow">
            <span className="toolbar__label">Search</span>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, login ID or referral" />
          </div>
          <div className="toolbar__group">
            <span className="toolbar__label">Level</span>
            <MultiSelect
              options={roleOptions} selected={selectedRoles} allLabel="All levels"
              onChange={(sel) => setExcluded(new Set(roles.filter((r) => !sel.has(r))))}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Agent</th><th>Hierarchy</th><th>Parent</th><th>Wallet</th>
                <th>Rates</th><th>Status</th><th>Created</th><th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.map((a, i) => {
                const parent = h.agentById.get(a.partnerId);
                return (
                  <tr key={a.uid}>
                    <td className="table__idx">{paged.start + i + 1}</td>
                    <td><MemberCell name={a.name} loginId={a.loginId} role={a.role} /></td>
                    <td><LevelChain chain={h.ancestors(a)} /></td>
                    <td>
                      {parent
                        ? <span className="member__txt"><span className="member__name">{parent.name}</span><span className="member__id">@{parent.loginId}</span></span>
                        : <span className="faint">—</span>}
                    </td>
                    <td>{a.role === 1 ? <span className="faint">—</span> : <Wallet balance={a.balance} point={a.point} />}</td>
                    <td>
                      {a.role === 1 ? <span className="faint">—</span> : (
                        <div className="stack">
                          {RATE_COLS.map(({ key, label }) => (
                            <span className="rate-line" key={key}>
                              <span className="rate-line__k">{label}</span>
                              <b>{Number(a[key] ?? 0).toFixed(1)}%</b>
                              <button className="edit-btn" onClick={() => setModal({ type: 'rate', agent: a, rateKey: key })} aria-label={`Edit ${label} rate`} title="Edit">
                                <EditIcon width={12} height={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="nowrap muted">{dateTime(a.createdAt)}</td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="icon-btn icon-btn--sm" title="Create sub" aria-label="Create sub" onClick={() => setModal({ type: 'createsub', agent: a })}>
                          <UserPlusIcon width={15} height={15} />
                        </button>
                        <button className="icon-btn icon-btn--sm" title="Change password" aria-label="Change password" onClick={() => setModal({ type: 'password', agent: a })}>
                          <KeyIcon width={15} height={15} />
                        </button>
                        {a.uid !== partner?.uid && (
                          <button className="icon-btn icon-btn--sm icon-btn--danger" title="Delete" aria-label="Delete" onClick={() => setModal({ type: 'delete', agent: a })}>
                            <TrashIcon width={15} height={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!paged.pageRows.length && <TableEmpty cols={9} loading={h.loading} title="No agents match" text="Try a different search or level filter." />}
            </tbody>
          </table>
        </div>
        <TableFoot paged={paged} noun="agents" />
      </section>

      {modal?.type === 'rate' && (
        <RateEditModal agent={modal.agent} rateKey={modal.rateKey} {...rateBounds(h.agents, modal.agent, modal.rateKey)}
          onClose={() => setModal(null)} onSaved={done} />
      )}
      {modal?.type === 'createsub' && <CreateSubModal parent={modal.agent} onClose={() => setModal(null)} onCreated={done} />}
      {modal?.type === 'password' && <ChangePasswordModal agent={modal.agent} onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {modal?.type === 'delete' && <ConfirmDeleteModal agent={modal.agent} onClose={() => setModal(null)} onDone={done} />}
    </div>
  );
}
