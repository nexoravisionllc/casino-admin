import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { useResource } from '../hooks/useResource.js';
import { usePaged } from '../hooks/usePaged.js';
import { useStats } from '../context/StatsContext.jsx';
import TreeView from '../components/TreeView.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Switch, StatusBadge, Spinner, TxLinks, Field } from '../components/ui.jsx';
import DateRange, { inRange } from '../components/DateRange.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import { parseDate, dateTime, timeAgo, usd } from '../lib/format.js';
import { CheckIcon, CloseIcon, RefreshIcon, DepositIcon, WithdrawIcon, EyeIcon } from '../components/Icons.jsx';

const ACTION_TEXT = {
  accept: { title: 'Accept', past: 'Accepted', tone: undefined },
  reject: { title: 'Reject', past: 'Rejected', tone: 'danger' },
  restore: { title: 'Restore', past: 'Restored', tone: 'warn' },
};


const MAX_REASON = 500;

// "Crypto USDT/BSC to 0xabc… · paid manually · tx 0x…" -> { coin: 'USDT/BSC', address: '0xabc…' }
const cryptoTarget = (memo) => {
  const [coin, ...rest] = memo.slice(7).split(' to ');
  return { coin, address: rest.join(' to ').split(' · ')[0] };
};

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  if (!text || !navigator.clipboard) return null;
  return (
    <button type="button" className="btn btn--sm btn--ghost" style={{ flex: 'none' }}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const Row = ({ k, children }) => (
  <div className="kv__row"><span className="kv__k">{k}</span><span className="kv__v" style={{ whiteSpace: 'normal' }}>{children}</span></div>
);

// Crypto withdrawals (on-chain payouts) carry "Crypto <COIN>/<NETWORK> to <address>" as their memo.
const isCrypto = (t) => typeof t.memo === 'string' && t.memo.startsWith('Crypto ');

// Can be accepted: pending, or a withdrawal stuck in "processing" (balance already debited).
const canAccept = (t) => t.status === 'pending' || (t.type === 'withdraw' && t.status === 'processing');

// Money > Deposits / Withdrawals: review queue with details, accept / reject / restore.
// Withdrawals are paid out manually: the admin sends the funds, then accepts
// (optionally with the payment reference); a rejection needs a reason. The
// member is emailed either way and their pages update live.
export default function MoneyRequests({ type }) {
  const isDeposit = type === 'deposit';
  // Withdrawals cannot be restored, so they never reach "restored".
  // "processing" only appears when an older backend accepted a withdrawal with
  // the former automatic payout; such a row can still be accepted (finished).
  const statuses = isDeposit ? ['pending', 'finished', 'rejected', 'restored'] : ['pending', 'processing', 'finished', 'rejected'];
  const { token, readOnly } = useAuth();
  const { refresh: refreshStats } = useStats();
  const h = useHierarchy();
  const txs = useResource('/transactions', { realtime: true, initial: [] });

  const [[from, to], setRange] = useState(['', '']);
  const [tab, setTab] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null); // { tx, action }
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [details, setDetails] = useState(null); // { uid, data?, error? }
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

  const openConfirm = (tx, action) => {
    setReason('');
    setReference('');
    setError('');
    setConfirm({ tx, action });
  };

  // Load the full request (member, email, payout target) for the details dialog.
  const openDetails = async (uid) => {
    setDetails({ uid });
    try {
      const data = await apiRequest(`/transactions/${uid}`, { token });
      setDetails((d) => (d?.uid === uid ? { uid, data } : d));
    } catch (err) {
      setDetails((d) => (d?.uid === uid ? { uid, error: err.message } : d));
    }
  };

  const needsReason = confirm?.action === 'reject' && !isDeposit;
  const takesReference = confirm?.action === 'accept' && !isDeposit;

  const run = async () => {
    const { tx, action } = confirm;
    if (needsReason && !reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      const body = action === 'reject' ? { reason: reason.trim() }
        : takesReference ? { reference: reference.trim() } : undefined;
      const res = await apiRequest(`/transactions/${tx.uid}/${action}`, { method: 'POST', token, body });
      if (res && res.success === false) {
        setError(res.message || 'Action failed.');
        return; // keep the dialog open so the admin can fix the input
      }
      setNotice(`${ACTION_TEXT[action].past} ${isDeposit ? 'deposit' : 'withdrawal'} of ${usd(tx.amount)} for @${tx.userId}.${res?.email ? ` ${res.email}` : ''}`);
      setConfirm(null);
      setDetails(null);
      await Promise.all([txs.refresh(), h.refresh()]);
      refreshStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
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
      {(h.error || txs.error || (error && !confirm)) && <Alert>{(!confirm && error) || h.error || txs.error}</Alert>}
      {notice && <Alert tone="ok" action={<button className="linklike" onClick={() => setNotice('')}>Dismiss</button>}>{notice}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Network" nodes={h.tree} selectedId={selectedId} onSelect={setSelectedId} allLabel="All members" loading={h.loading} />
        </div>

        <section className="card">
          <div className="toolbar" style={{ paddingBottom: 12 }}>
            <div className="seg" role="tablist" aria-label="Status">
              {['pending', 'all', ...statuses.filter((s) => s !== 'pending' && (s !== 'processing' || counts.processing))].map((s) => (
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
                  <th>Status</th><th>{isDeposit ? 'Bank' : 'Pay to'}</th><th>Processed by</th><th>Requested</th><th className="r">Actions</th>
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
                      <td>
                        <StatusBadge status={t.status} />
                        {t.status === 'rejected' && t.rejectReason && (
                          <div className="member__id" style={{ maxWidth: 220, whiteSpace: 'normal', marginTop: 4 }} title={t.rejectReason}>
                            {t.rejectReason.length > 80 ? `${t.rejectReason.slice(0, 80)}…` : t.rejectReason}
                          </div>
                        )}
                      </td>
                      <td>
                        {isCrypto(t)
                          ? <span className="member__txt" style={{ maxWidth: 260 }}><span className="member__name">{cryptoTarget(t.memo).coin}</span><span className="member__id" style={{ wordBreak: 'break-all' }}>{cryptoTarget(t.memo).address}</span></span>
                          : u?.bankName
                          ? <span className="member__txt"><span className="member__name">{u.bankName}</span><span className="member__id">{[u.bankAccount, u.bankMaster].filter(Boolean).join(' · ')}</span></span>
                          : <span className="faint">—</span>}
                        {t.txLinks?.length ? <div className="table__txtags"><TxLinks links={t.txLinks} /></div> : null}
                      </td>
                      <td>{t.managerId || <span className="faint">—</span>}</td>
                      <td className="nowrap">
                        <span className="member__txt"><span>{timeAgo(t.createdAt)}</span><span className="member__id">{dateTime(t.createdAt)}</span></span>
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn--sm btn--ghost" onClick={() => openDetails(t.uid)} title="View request details">
                            <EyeIcon width={13} height={13} /> Details
                          </button>
                          {canAccept(t) && (
                            <button className="btn btn--sm btn--primary" onClick={() => openConfirm(t, 'accept')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                              <CheckIcon width={13} height={13} /> Accept
                            </button>
                          )}
                          {t.status === 'pending' && (
                            <>
                              <button className="btn btn--sm btn--danger-ghost" onClick={() => openConfirm(t, 'reject')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                                <CloseIcon width={13} height={13} /> Reject
                              </button>
                            </>
                          )}
                          {canRestore && (
                            <button className="btn btn--sm btn--warn-soft" onClick={() => openConfirm(t, 'restore')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                              <RefreshIcon width={13} height={13} /> Restore
                            </button>
                          )}
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

      {details && !confirm && (() => {
        const d = details.data;
        const t = d?.transaction ?? (txs.data ?? []).find((x) => x.uid === details.uid);
        const m = d?.member;
        const c = d?.crypto;
        const target = !c && t && isCrypto(t) ? cryptoTarget(t.memo) : null;
        return (
          <Modal
            title={`${isDeposit ? 'Deposit' : 'Withdrawal'} request #${details.uid}`} icon={Icon} size="lg"
            subtitle={t ? `${usd(t.amount)} · requested ${dateTime(t.createdAt)}` : undefined}
            onClose={() => setDetails(null)}
            footer={<>
              <button type="button" className="btn btn--ghost" onClick={() => setDetails(null)}>Close</button>
              {t?.status === 'pending' && (
                <button type="button" className="btn btn--danger-ghost" onClick={() => openConfirm(t, 'reject')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                  <CloseIcon width={14} height={14} /> Reject
                </button>
              )}
              {t && canAccept(t) && (
                <button type="button" className="btn btn--primary" onClick={() => openConfirm(t, 'accept')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}>
                  <CheckIcon width={14} height={14} /> Accept
                </button>
              )}
            </>}
          >
            {details.error && <Alert>{details.error}</Alert>}
            {!d && !details.error && <p className="modal__text"><Spinner /> Loading details…</p>}
            {t && (
              <div className="kv" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <Row k="Status"><StatusBadge status={t.status} /></Row>
                <Row k="Amount"><b>{usd(t.amount)}</b></Row>
                <Row k="Member">{m ? `${m.name} (@${m.loginId})` : `@${t.userId}`}</Row>
                {m && <Row k="Email">{m.email || <span className="faint">No email on file</span>}</Row>}
                {m && <Row k="Current balance">{usd(m.balance)}</Row>}
                {m && <Row k="Account status">{m.status}</Row>}
                {m && !isDeposit && <Row k="Past withdrawals">{`${Number(m.withdrawCount)} · ${usd(m.withdrawAmount)}`}</Row>}
                {m && <Row k="Past deposits">{`${Number(m.depositCount)} · ${usd(m.depositAmount)}`}</Row>}
                {(c || target) && <Row k="Coin / network">{c ? `${c.coin} · ${c.network}` : target.coin}</Row>}
                {(c || target) && (
                  <Row k="Pay to address">
                    <span style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12.5 }}>{c?.address ?? target.address}</span>
                    <CopyButton text={c?.address ?? target.address} />
                  </Row>
                )}
                {!c && !target && m && (
                  <Row k={isDeposit ? 'Bank' : 'Pay to bank'}>
                    {m.bankName ? [m.bankName, m.bankAccount, m.bankMaster].filter(Boolean).join(' · ') : <span className="faint">No bank details</span>}
                    {m.bankAccount && <CopyButton text={m.bankAccount} />}
                  </Row>
                )}
                <Row k="Balance before / after">{usd(t.beforeAmount)} → {t.afterAmount == null ? '—' : usd(t.afterAmount)}</Row>
                <Row k="Requested">{dateTime(t.createdAt)}</Row>
                {t.updatedAt && <Row k="Processed">{dateTime(t.updatedAt)}{t.managerId ? ` by ${t.managerId}` : ''}</Row>}
                {t.rejectReason && <Row k="Reject reason"><span style={{ whiteSpace: 'pre-wrap' }}>{t.rejectReason}</span></Row>}
                {t.txLinks?.length ? <Row k="Payout transaction"><TxLinks links={t.txLinks} /></Row> : null}
                {t.memo && <Row k="Memo"><span style={{ wordBreak: 'break-all' }}>{t.memo}</span></Row>}
              </div>
            )}
          </Modal>
        );
      })()}

      {confirm && (() => {
        const { tx, action } = confirm;
        const a = ACTION_TEXT[action];
        const u = h.userByLogin.get(tx.userId);
        const effect = action === 'accept' && tx.status === 'processing'
          ? 'This withdrawal was accepted earlier under the old automatic payout and its amount is already deducted. Only accept after you have sent the funds yourself: it is marked finished (no further balance change) and the member is emailed.'
          : action === 'accept' && !isDeposit
          ? 'Only accept after you have sent the funds yourself. The amount will be deducted from the member’s balance, the request marked finished, and the member emailed.'
          : action === 'accept' ? 'The amount will be added to the member’s balance.'
          : action === 'reject' && !isDeposit ? 'The request will be closed without changing the balance. The member sees the reason and is emailed.'
          : action === 'reject' ? 'The request will be closed without changing the balance.'
          : 'The deposit will be reversed and the amount taken back from the member’s balance.';
        return (
          <Modal
            title={`${a.title} ${isDeposit ? 'deposit' : 'withdrawal'}?`} icon={Icon} tone={a.tone}
            onClose={() => !busy && setConfirm(null)} onSubmit={run}
            footer={<>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="submit" className={`btn ${action === 'reject' ? 'btn--danger' : action === 'restore' ? 'btn--warn-soft' : 'btn--primary'}`}
                disabled={busy || (needsReason && !reason.trim())}>
                {busy && <Spinner />}{action === 'accept' && !isDeposit ? 'Funds sent — accept' : a.title}
              </button>
            </>}
          >
            {error && <Alert>{error}</Alert>}
            <div className="callout"><span>Member</span><b style={{ fontSize: 14 }}>{u?.name ?? tx.userId} (@{tx.userId})</b></div>
            <div className="callout"><span>Amount</span><b>{usd(tx.amount)}</b></div>
            {u && <div className="callout"><span>Current balance</span><b>{usd(u.balance)}</b></div>}
            {isCrypto(tx) && <div className="callout"><span>Pay to</span><b style={{ wordBreak: 'break-all' }}>{cryptoTarget(tx.memo).coin} · {cryptoTarget(tx.memo).address}</b></div>}
            {takesReference && (
              <Field label="Payment reference (optional)" hint={isCrypto(tx) ? 'The transaction hash of the payout you sent; shown to the member with an explorer link.' : 'E.g. the bank transfer ID; included in the member’s email.'}>
                <input className="input" value={reference} maxLength={128} onChange={(e) => setReference(e.target.value)}
                  placeholder={isCrypto(tx) ? '0x…' : 'Transfer ID'} autoFocus spellCheck={false} />
              </Field>
            )}
            {action === 'reject' && (
              <Field label={isDeposit ? 'Reason (optional)' : 'Reason for the member'} hint={`${reason.trim().length}/${MAX_REASON}`}>
                <textarea className="input" style={{ height: 'auto', minHeight: 90, padding: '10px 12px', resize: 'vertical' }}
                  value={reason} maxLength={MAX_REASON} onChange={(e) => setReason(e.target.value)} autoFocus
                  placeholder="e.g. The wallet address does not match the selected network." required={needsReason} />
              </Field>
            )}
            <p className="modal__text">{effect}</p>
          </Modal>
        );
      })()}
    </div>
  );
}
