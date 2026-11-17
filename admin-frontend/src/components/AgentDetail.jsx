import { LevelBadge } from './LevelBadge.jsx';

const usd = (v) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const pct = (v) => `${Number(v ?? 0).toFixed(1)} %`;
const date = (d) => (d ? new Date(d).toLocaleString('en-US') : '');

function PencilBtn({ onClick }) {
  return (
    <button className="pencil" onClick={onClick} aria-label="Edit rate">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
      </svg>
    </button>
  );
}

// Right-hand agent info table. The top admin's own rates are hidden.
export default function AgentDetail({ agent, currentUid, onEditRate, onEditReferral, onCreateSub, onChangePassword, onDelete }) {
  if (!agent) {
    return (
      <section className="detail">
        <div className="detail__head">Agent Details</div>
        <p className="detail__empty">Select an agent in the tree to see details.</p>
      </section>
    );
  }

  const isAdmin = agent.role === 1;
  const isSelf = agent.uid === currentUid;

  return (
    <section className="detail">
      <div className="detail__head">Agent Details (#{agent.uid})</div>

      <table className="detail__table">
        <tbody>
          <tr>
            <th>ID</th><td>{agent.loginId}</td>
            <th>Name</th><td>{agent.name}</td>
          </tr>
          <tr>
            <th>Role</th><td><LevelBadge role={agent.role} /> Level {agent.role}</td>
            <th>State</th><td><span className="badge">{agent.status}</span></td>
          </tr>
          {!isAdmin && (
            <>
              <tr>
                <th>Casino Rate</th>
                <td className="rate-cell">{pct(agent.casinoRate)} <PencilBtn onClick={() => onEditRate('casinoRate')} /></td>
                <th>Slot Rate</th>
                <td className="rate-cell">{pct(agent.slotRate)} <PencilBtn onClick={() => onEditRate('slotRate')} /></td>
              </tr>
              <tr>
                <th>Sport Rate</th>
                <td className="rate-cell">{pct(agent.sportsRate)} <PencilBtn onClick={() => onEditRate('sportsRate')} /></td>
                <th>Balance</th><td>{usd(agent.balance)}</td>
              </tr>
              <tr>
                <th>Point</th><td>{Number(agent.point ?? 0).toLocaleString('en-US')} P</td>
                <th>Created Date</th><td>{date(agent.createdAt)}</td>
              </tr>
            </>
          )}
          {isAdmin && (
            <tr>
              <th>Balance</th><td>{usd(agent.balance)}</td>
              <th>Created Date</th><td>{date(agent.createdAt)}</td>
            </tr>
          )}
          <tr>
            <th>Referral ID</th>
            <td className="rate-cell" colSpan="3">
              {agent.referralId || '—'} <PencilBtn onClick={() => onEditReferral(agent)} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="detail__actions">
        <button className="btn-create" onClick={() => onCreateSub(agent)}>＋ Create Sub</button>
        <button className="btn-pass" onClick={() => onChangePassword(agent)}>⚙ Change Password</button>
        {!isSelf && <button className="btn-del" onClick={() => onDelete(agent)}>🗑 Delete</button>}
      </div>
    </section>
  );
}
