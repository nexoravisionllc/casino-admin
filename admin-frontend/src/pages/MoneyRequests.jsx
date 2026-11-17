import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import { useStats } from '../context/StatsContext.jsx';
import TreeView from '../components/TreeView.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Switch, StatusBadge, Spinner } from '../components/ui.jsx';
import DateRange, { inRange } from '../components/DateRange.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import { parseDate, dateTime, timeAgo, usd } from '../lib/format.js';
import { CheckIcon, CloseIcon, RefreshIcon, DepositIcon, WithdrawIcon } from '../components/Icons.jsx';

const ACTION_TEXT = {
  accept: { title: 'Accept', past: 'Accepted', tone: undefined },
  reject: { title: 'Reject', past: 'Rejected', tone: 'danger' },
  restore: { title: 'Restore', past: 'Restored', tone: 'warn' },
};

// Money > Deposits / Withdrawals: review queue with accept / reject / restore.
export default function MoneyRequests({ type }) {
  const isDeposit = type === 'deposit';
  // Withdrawals cannot be restored, so they never reach "restored".
  const statuses = isDeposit ? ['pending', 'finished', 'rejected', 'restored'] : ['pending', 'finished', 'rejected'];
  const { token } = useAuth();
  const { refresh: refreshStats } = useStats();
  const h = useHierarchy();
  const txs = useResource('/transactions', { realtime: true, initial: [] });

  const [[from, to], setRange] = useState(['', '']);
  const [tab, setTab] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // { tx, action }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const scope = useMemo(() => h.scopeLogins(selectedId, { includeSub }), [h.scopeLogins, selectedId, includeSub]);
  const q = search.trim().toLowerCase();

  // Everything except the status tab, so the tabs can show counts.
  const base = useMemo(() => (txs.data ?? []).filter((t) => {
    if (t.type !== type) return false;
    if (scope && !scope.has(t.userId)) return false;
    if (q && !t.userId.toLowerCase().includes(q) && !(h.userByLogin.get(t.userId)?.name ?? '').toLowerCase().includes(q)) return false;
    return inRange(parseDate(t.createdAt), from, to);
  }), [txs.data, type, scope, q, from, to, h.userByLogin]);

  const counts = useMemo(() => {
    const c = { all: base.length };
    for (const s of statuses) c[s] = 0;
    for (const t of base) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open on "All" when nothing is pending (first load only).
  const tabChosen = useRef(false);
  useEffect(() => {
    if (tabChosen.current || txs.loading) return;
    tabChosen.current = true;
    if (!counts.pending) setTab('all');
  }, [txs.loading, counts.pending]);

  const rows = tab === 'all' ? base : base.filter((t) => t.status === tab);
  const paged = usePaged(rows, `${tab}|${selectedId}|${from}|${to}|${q}|${includeSub}`);
  const pendingSum = base.filter((t) => t.status === 'pending').reduce((a, t) => a + Number(t.amount), 0);

  const run = async () => {
    const { tx, action } = confirm;
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest(`/transactions/${tx.uid}/${action}`, { method: 'POST', token });
      if (res && res.success === false) setError(res.message || 'Action failed.');
      else setNotice(`${ACTION_TEXT[action].past} ${isDeposit ? 'deposit' : 'withdrawal'} of ${usd(tx.amount)} for @${tx.userId}.`);
      await Promise.all([txs.refresh(), h.refresh()]);
      refreshStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const label = isDeposit ? 'Deposits' : 'Withdrawals';
  const Icon = isDeposit ? DepositIcon : WithdrawIcon;

  return (
    <div className="page">
      <PageHeader
        crumb="Money" title={label}
        subtitle={counts.pending ? `${counts.pending} pending · ${usd(pendingSum)} waiting for review` : 'No pending requests'}
        actions={<button className="btn btn--ghost" onClick={() => txs.refresh()}><RefreshIcon width={15} height={15} /> Refresh</button>}
      />
      {(h.error || txs.error || error) && <Alert>{error || h.error || txs.error}</Alert>}
      {notice && <Alert tone="ok" action={<button className="linklike" onClick={() => setNotice('')}>Dismiss</button>}>{notice}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Network" nodes={h.tree} selectedId={selectedId} onSelect={setSelectedId} allLabel="All members" loading={h.loading} />
        </div>

        <section className="card">
          <div className="toolbar" style={{ paddingBottom: 12 }}>
            <div className="seg" role="tablist" aria-label="Status">
              {['pending', 'all', ...statuses.filter((s) => s !== 'pending')].map((s) => (
                <button key={s} role="tab" aria-selected={tab === s} className={`seg__btn ${tab === s ? 'is-active' : ''}`} onClick={() => setTab(s)}>
                  {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
                  <span className="faint" style={{ fontSize: 11.5 }}>{counts[s] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar">
            <DateRange from={from} to={to} onChange={(f, t) => setRange([f, t])} />
            <div className="toolbar__group toolbar__grow">
              <span className="toolbar__label">Search</span>
              <SearchInput value={search} onChange={setSearch} placeholder="Member name or ID" />
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
                  <th>#</th><th>Member</th><th className="r">Amount</th><th className="r">Before</th><th className="r">After</th>
                  <th>Status</th><th>Bank</th><th>Processed by</th><th>Requested</th><th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((t, i) => {
                  const u = h.userByLogin.get(t.userId);
                  const canRestore = isDeposit && t.status === 'finished';
                  return (
                    <tr key={t.uid}>
                      <td className="table__idx">{paged.start + i + 1}</td>
                      <td><MemberCell name={u?.name ?? t.userId} loginId={t.userId} /></td>
                      <td className={`r amount ${isDeposit ? 'pos' : ''}`} style={isDeposit ? undefined : { color: 'var(--warn)' }}>{usd(t.amount)}</td>
                      <td className="r num muted">{usd(t.beforeAmount)}</td>
                      <td className="r num">{t.afterAmount == null ? <span className="faint">—</span> : usd(t.afterAmount)}</td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>
                        {u?.bankName
                          ? <span className="member__txt"><span className="member__name">{u.bankName}</span><span className="member__id">{[u.bankAccount, u.bankMaster].filter(Boolean).join(' · ')}</span></span>
                          : <span className="faint">—</span>}
                      </td>
                      <td>{t.managerId || <span className="faint">—</span>}</td>
                      <td className="nowrap">
                        <span className="member__txt"><span>{timeAgo(t.createdAt)}</span><span className="member__id">{dateTime(t.createdAt)}</span></span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {t.status === 'pending' && (
                            <>
                              <button className="btn btn--sm btn--primary" onClick={() => setConfirm({ tx: t, action: 'accept' })}>
                                <CheckIcon width={13} height={13} /> Accept
                              </button>
                              <button className="btn btn--sm btn--danger-ghost" onClick={() => setConfirm({ tx: t, action: 'reject' })}>
                                <CloseIcon width={13} height={13} /> Reject
                              </button>
                            </>
                          )}
                          {canRestore && (
                            <button className="btn btn--sm btn--warn-soft" onClick={() => setConfirm({ tx: t, action: 'restore' })}>
                              <RefreshIcon width={13} height={13} /> Restore
                            </button>
                          )}
                          {t.status !== 'pending' && !canRestore && <span className="faint">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!paged.pageRows.length && (
                  <TableEmpty cols={10} loading={txs.loading} title={tab === 'pending' ? 'No pending requests' : `No ${label.toLowerCase()}`}
                    text={tab === 'pending' ? 'You’re all caught up.' : 'Nothing matches the current filters.'} />
                )}
              </tbody>
            </table>
          </div>
          <TableFoot paged={paged} noun="requests" />
        </section>
      </div>

      {confirm && (() => {
        const { tx, action } = confirm;
        const a = ACTION_TEXT[action];
        const u = h.userByLogin.get(tx.userId);
        const effect = action === 'accept'
          ? (isDeposit ? 'The amount will be added to the member’s balance.' : 'The amount will be deducted from the member’s balance.')
          : action === 'reject' ? 'The request will be closed without changing the balance.'
          : 'The deposit will be reversed and the amount taken back from the member’s balance.';
        return (
          <Modal
            title={`${a.title} ${isDeposit ? 'deposit' : 'withdrawal'}?`} icon={Icon} tone={a.tone}
            onClose={() => !busy && setConfirm(null)} onSubmit={run}
            footer={<>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="submit" className={`btn ${action === 'reject' ? 'btn--danger' : action === 'restore' ? 'btn--warn-soft' : 'btn--primary'}`} disabled={busy}>
                {busy && <Spinner />}{a.title}
              </button>
            </>}
          >
            <div className="callout"><span>Member</span><b style={{ fontSize: 14 }}>{u?.name ?? tx.userId} (@{tx.userId})</b></div>
            <div className="callout"><span>Amount</span><b>{usd(tx.amount)}</b></div>
            {u && <div className="callout"><span>Current balance</span><b>{usd(u.balance)}</b></div>}
            <p className="modal__text">{effect}</p>
          </Modal>
        );
      })()}
    </div>
  );
}
