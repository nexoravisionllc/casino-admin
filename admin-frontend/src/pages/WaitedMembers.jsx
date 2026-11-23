import { useMemo, useState } from 'react';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import { useHierarchy } from '../hooks/useHierarchy.js';
import { usePaged } from '../hooks/usePaged.js';
import { useStats } from '../context/StatsContext.jsx';
import { MemberCell } from '../components/LevelBadge.jsx';
import { PageHeader, Alert, SearchInput, TableEmpty, Spinner } from '../components/ui.jsx';
import { TableFoot } from '../components/Pagination.jsx';
import { dateTime, timeAgo } from '../lib/format.js';
import { CheckIcon } from '../components/Icons.jsx';

// Members whose sign-up is not yet approved (Status != Active). Approving makes
// them Active: they leave this list and the header count drops.
export default function WaitedMembers() {
  const { token, readOnly } = useAuth();
  const { refresh: refreshStats } = useStats();
  const h = useHierarchy();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const pending = useMemo(() => h.users.filter((u) => (u.status || '').toLowerCase() !== 'active'), [h.users]);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => pending.filter((u) =>
    !q || u.name.toLowerCase().includes(q) || u.loginId.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)), [pending, q]);
  const paged = usePaged(filtered, q);

  const approve = async (u) => {
    setBusyId(u.uid);
    setError('');
    try {
      await apiRequest(`/users/${u.uid}/approve`, { method: 'POST', token });
      await h.refresh();
      refreshStats();
      setNotice(`${u.name} (@${u.loginId}) was approved.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const dash = <span className="faint">—</span>;

  return (
    <div className="page">
      <PageHeader crumb="Members" title="Waiting Approval"
        subtitle={pending.length ? `${pending.length} sign-up${pending.length > 1 ? 's' : ''} waiting for review` : 'No sign-ups waiting'} />
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="ok" action={<button className="linklike" onClick={() => setNotice('')}>Dismiss</button>}>{notice}</Alert>}

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__group toolbar__grow">
            <span className="toolbar__label">Search</span>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, login ID or email" />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Member</th><th>Agent</th><th>Email</th><th>Bank</th>
                <th>Account no.</th><th>Depositor</th><th>Requested</th><th className="r">Action</th>
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
                        : dash}
                    </td>
                    <td>{u.email || dash}</td>
                    <td>{u.bankName || dash}</td>
                    <td className="num">{u.bankAccount || dash}</td>
                    <td>{u.bankMaster || dash}</td>
                    <td className="nowrap"><span title={dateTime(u.createdAt)}>{timeAgo(u.createdAt)}</span></td>
                    <td className="r">
                      <button className="btn btn--sm btn--primary" disabled={readOnly || busyId === u.uid} title={readOnly ? DEMO_TITLE : undefined} onClick={() => approve(u)}>
                        {busyId === u.uid ? <Spinner /> : <CheckIcon width={14} height={14} />} Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!paged.pageRows.length && (
                <TableEmpty cols={9} loading={h.loading} title={q ? 'No match' : 'All caught up'}
                  text={q ? 'No waiting member matches your search.' : 'New member sign-ups that need approval will appear here.'} />
              )}
            </tbody>
          </table>
        </div>
        <TableFoot paged={paged} noun="requests" />
      </section>
    </div>
  );
}
