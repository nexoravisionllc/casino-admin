import { useMemo, useState } from 'react';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { usePaged } from '../hooks/usePaged.js';
import TreeView from '../components/TreeView.jsx';
import { LevelChain, MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, StatusBadge, Alert, SearchInput, TableEmpty, Wallet } from '../components/ui.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { AdjustModal } from '../components/UserModals.jsx';
import { CreateSubModal } from '../components/AgentModals.jsx';
import { money, dateTime, int } from '../lib/format.js';
import { CloseIcon, UserPlusIcon } from '../components/Icons.jsx';

const ACTIONS = [
  { field: 'balance', mode: 'pay', label: '+$', title: 'Pay balance' },
  { field: 'balance', mode: 'collect', label: '−$', title: 'Collect balance' },
  { field: 'point', mode: 'pay', label: '+P', title: 'Pay points' },
  { field: 'point', mode: 'collect', label: '−P', title: 'Collect points' },
];

export default function Members() {
  const h = useHierarchy();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);

  const scope = useMemo(() => h.scopeLogins(selectedId), [h.scopeLogins, selectedId]);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => h.users.filter((u) => {
    if (scope && !scope.has(u.loginId)) return false;
    return !q || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  }), [h.users, scope, q]);
  const paged = usePaged(filtered, `${q}|${selectedId}`);

  const selectedAgent = selectedId?.startsWith('agent:') ? h.agentById.get(Number(selectedId.split(':')[1])) : null;
  const totals = useMemo(() => filtered.reduce((a, u) => ({ bal: a.bal + Number(u.balance ?? 0), pt: a.pt + Number(u.point ?? 0) }), { bal: 0, pt: 0 }), [filtered]);

  const afterAdjust = (updated) => {
    h.setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? { ...u, ...updated } : u)));
    setModal(null);
  };

  return (
    <div className="page">
      <PageHeader
        crumb="Members" title="Members"
        subtitle={`${int(filtered.length)} members · $${money(totals.bal)} balance · ${money(totals.pt)} P`}
        actions={selectedAgent && (
          <button className="btn btn--primary" onClick={() => setModal({ type: 'create', parent: selectedAgent })}>
            <UserPlusIcon width={16} height={16} /> Add member under {selectedAgent.name}
          </button>
        )}
      />
      {h.error && <Alert>{h.error}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Network" nodes={h.tree} selectedId={selectedId} onSelect={setSelectedId} allLabel="All members" loading={h.loading} />
        </div>

        <section className="card">
          <div className="toolbar">
            <div className="toolbar__group toolbar__grow">
              <span className="toolbar__label">Search</span>
              <SearchInput value={search} onChange={setSearch} placeholder="Name, login ID or email" />
            </div>
            {selectedId && (
              <div className="toolbar__end">
                <span className="scope">
                  Under {h.labelOf(selectedId)}
                  <button onClick={() => setSelectedId(null)} aria-label="Clear filter"><CloseIcon width={13} height={13} /></button>
                </span>
              </div>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Member</th><th>Agent</th><th>Hierarchy</th><th>Wallet</th>
                  <th>Deposits / Withdrawals</th><th>Status</th><th>Joined</th><th className="r">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((u, i) => {
                  const parent = h.agentById.get(u.partnerId);
                  return (
                    <tr key={u.uid}>
                      <td className="table__idx">{paged.start + i + 1}</td>
                      <td><MemberCell name={u.name} loginId={u.loginId} /></td>
                      <td>
                        {parent
                          ? <span className="member__txt"><span className="member__name">{parent.name}</span><span className="member__id">@{parent.loginId}</span></span>
                          : <span className="faint">—</span>}
                      </td>
                      <td><LevelChain chain={h.ancestors(u)} /></td>
                      <td><Wallet balance={u.balance} point={u.point} /></td>
                      <td>
                        <div className="stack num" style={{ fontSize: 12.5 }}>
                          <span><span className="pos">▼ ${money(u.depositAmount)}</span> <span className="faint">× {int(u.depositCount)}</span></span>
                          <span><span style={{ color: 'var(--warn)' }}>▲ ${money(u.withdrawAmount)}</span> <span className="faint">× {int(u.withdrawCount)}</span></span>
                        </div>
                      </td>
                      <td><StatusBadge status={u.status} /></td>
                      <td className="nowrap muted">{dateTime(u.createdAt).slice(0, 10)}</td>
                      <td>
                        <div className="adj" style={{ justifyContent: 'flex-end' }}>
                          {ACTIONS.map((a) => (
                            <button
                              key={`${a.field}-${a.mode}`} title={a.title} aria-label={`${a.title} for ${u.loginId}`}
                              className={`adj__btn adj__btn--${a.mode}`}
                              onClick={() => setModal({ type: 'adjust', user: u, field: a.field, mode: a.mode })}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!paged.pageRows.length && (
                  <TableEmpty cols={9} loading={h.loading} title="No members found"
                    text={selectedId || q ? 'Try clearing the search or selecting “All members”.' : 'Members appear here once they sign up or are created.'} />
                )}
              </tbody>
            </table>
          </div>
          <TableFoot paged={paged} noun="members" />
        </section>
      </div>

      {modal?.type === 'adjust' && (
        <AdjustModal user={modal.user} field={modal.field} mode={modal.mode} onClose={() => setModal(null)} onSaved={afterAdjust} />
      )}
      {modal?.type === 'create' && (
        <CreateSubModal parent={modal.parent} defaultKind="user" onClose={() => setModal(null)}
          onCreated={async () => { await h.refresh(); setModal(null); }} />
      )}
    </div>
  );
}
