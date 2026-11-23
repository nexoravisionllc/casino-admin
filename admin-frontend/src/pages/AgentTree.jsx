import { useEffect, useMemo, useState } from 'react';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { useHierarchy } from '../hooks/useHierarchy.js';
import TreeView, { agentsOnly } from '../components/TreeView.jsx';
import { LevelBadge, UserBadge, levelLetter } from '../components/LevelBadge.jsx';
import { PageHeader, Card, Stat, StatusBadge, Badge, Alert, Empty } from '../components/ui.jsx';
import {
  RateEditModal, ReferralEditModal, CreateSubModal, ChangePasswordModal, ConfirmDeleteModal, RATE_LABELS, rateBounds,
} from '../components/AgentModals.jsx';
import { usd, pts, int, dateTime, roleName } from '../lib/format.js';
import { DollarIcon, PointIcon, NetworkIcon, UsersIcon, EditIcon, UserPlusIcon, KeyIcon, TrashIcon } from '../components/Icons.jsx';

export default function AgentTree() {
  const { partner } = useAuth();
  const h = useHierarchy();
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // { type, agent, rateKey? }

  // Default selection: the signed-in partner, else the first root.
  useEffect(() => {
    if (selectedId || !h.agents.length) return;
    const mine = h.agents.find((a) => a.uid === partner?.uid);
    setSelectedId(`agent:${(mine ?? h.agents[0]).uid}`);
  }, [h.agents, partner, selectedId]);

  // Keep a valid selection after deletes.
  useEffect(() => {
    if (selectedId && h.agents.length && !h.agentById.has(Number(selectedId.split(':')[1]))) setSelectedId(null);
  }, [h.agents, h.agentById, selectedId]);

  const tree = useMemo(() => agentsOnly(h.tree), [h.tree]);
  const agent = selectedId ? h.agentById.get(Number(selectedId.split(':')[1])) : null;

  const afterMutation = async (selectUid) => {
    await h.refresh();
    if (selectUid != null) setSelectedId(`agent:${selectUid}`);
    setModal(null);
  };

  return (
    <div className="page">
      <PageHeader crumb="Agents" title="Agent Tree" subtitle="Browse your agent network and manage each agent." />
      {h.error && <Alert>{h.error}</Alert>}

      <div className="split">
        <div className="split__aside">
          <TreeView title="Agents" nodes={tree} selectedId={selectedId} onSelect={(id) => id && setSelectedId(id)} loading={h.loading} />
        </div>

        {agent ? (
          <AgentProfile
            agent={agent} h={h} isSelf={agent.uid === partner?.uid}
            onSelect={(uid) => setSelectedId(`agent:${uid}`)}
            onModal={(type, extra) => setModal({ type, agent, ...extra })}
          />
        ) : (
          <Card><Empty title="Select an agent" text="Pick an agent in the tree to see their details." icon={NetworkIcon} /></Card>
        )}
      </div>

      {modal?.type === 'rate' && (
        <RateEditModal
          agent={modal.agent} rateKey={modal.rateKey} {...rateBounds(h.agents, modal.agent, modal.rateKey)}
          onClose={() => setModal(null)} onSaved={() => afterMutation(modal.agent.uid)}
        />
      )}
      {modal?.type === 'referral' && (
        <ReferralEditModal agent={modal.agent} onClose={() => setModal(null)} onSaved={() => afterMutation(modal.agent.uid)} />
      )}
      {modal?.type === 'createsub' && (
        <CreateSubModal parent={modal.agent} onClose={() => setModal(null)}
          onCreated={(created, kind) => afterMutation(kind === 'agent' ? created?.uid ?? modal.agent.uid : modal.agent.uid)} />
      )}
      {modal?.type === 'password' && (
        <ChangePasswordModal agent={modal.agent} onClose={() => setModal(null)} onDone={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDeleteModal agent={modal.agent} onClose={() => setModal(null)}
          onDone={() => afterMutation(modal.agent.partnerId ?? null)} />
      )}
    </div>
  );
}

export function AgentProfile({ agent, h, isSelf, onSelect, onModal }) {
  const { readOnly } = useAuth();
  const isAdmin = agent.role === 1;
  const parent = h.agentById.get(agent.partnerId);
  const childAgents = h.agents.filter((a) => a.partnerId === agent.uid);
  const directUsers = h.users.filter((u) => u.partnerId === agent.uid);
  const allAgents = h.agents.filter((a) => h.isUnder(a, agent.uid)).length;
  const allUsers = h.users.filter((u) => h.isUnder(u, agent.uid)).length;
  const maxOf = (key) => (!parent || parent.role === 1 ? 100 : Number(parent[key]) || 100);

  return (
    <div className="profile">
      <section className="card profile__hero">
        <LevelBadge role={agent.role} size="lg" />
        <div className="profile__who">
          <div className="profile__name">
            {agent.name}
            <StatusBadge status={agent.status} />
            {isSelf && <Badge tone="blue">You</Badge>}
          </div>
          <div className="profile__meta">
            <span>@{agent.loginId}</span><span className="dot" />
            <span>{roleName(agent.role)}</span><span className="dot" />
            <span>#{agent.uid}</span>
          </div>
        </div>
        <div className="profile__actions">
          <button className="btn btn--primary" onClick={() => onModal('createsub')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}><UserPlusIcon width={16} height={16} /> Create sub</button>
          <button className="btn btn--ghost" onClick={() => onModal('password')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}><KeyIcon width={16} height={16} /> Password</button>
          {!isSelf && (
            <button className="btn btn--danger-ghost" onClick={() => onModal('delete')} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}><TrashIcon width={16} height={16} /> Delete</button>
          )}
        </div>
      </section>

      <div className="stats">
        <Stat label="Balance" icon={DollarIcon} tone="gold" value={usd(agent.balance)} small />
        <Stat label="Points" icon={PointIcon} tone="green" value={pts(agent.point)} small />
        <Stat label="Sub-agents" icon={NetworkIcon} tone="blue" value={int(childAgents.length)} small
          foot={<>{int(allAgents)} in whole downline</>} />
        <Stat label="Members" icon={UsersIcon} tone="violet" value={int(directUsers.length)} small
          foot={<>{int(allUsers)} in whole downline</>} />
      </div>

      {!isAdmin && (
        <Card title="Commission rates" subtitle={parent ? `Capped by parent ${parent.name} (@${parent.loginId})` : undefined}>
          <div className="rates">
            {['casinoRate', 'slotRate', 'sportsRate'].map((k) => (
              <div className="rate" key={k}>
                <div style={{ flex: 1 }}>
                  <div className="rate__label">{RATE_LABELS[k]}</div>
                  <div className="rate__value">{Number(agent[k] ?? 0).toFixed(1)}%</div>
                  <div className="rate__bar"><i style={{ width: `${Math.min(100, (Number(agent[k] ?? 0) / maxOf(k)) * 100)}%` }} /></div>
                </div>
                <button className="icon-btn icon-btn--sm" onClick={() => onModal('rate', { rateKey: k })} aria-label={`Edit ${RATE_LABELS[k]}`} disabled={readOnly} title={readOnly ? DEMO_TITLE : 'Edit'}>
                  <EditIcon width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Details">
        <div className="kv">
          <div className="kv__row"><span className="kv__k">Login ID</span><span className="kv__v"><span>{agent.loginId}</span></span></div>
          <div className="kv__row"><span className="kv__k">Name</span><span className="kv__v"><span>{agent.name}</span></span></div>
          <div className="kv__row">
            <span className="kv__k">Parent</span>
            <span className="kv__v">
              {parent
                ? <button className="linklike" onClick={() => onSelect(parent.uid)}>{parent.name} (@{parent.loginId})</button>
                : <span className="faint">—</span>}
            </span>
          </div>
          <div className="kv__row"><span className="kv__k">Level</span><span className="kv__v"><LevelBadge role={agent.role} size="sm" /> <span>{agent.role === 1 ? 'Admin' : `Level ${levelLetter(agent.role)}`}</span></span></div>
          <div className="kv__row">
            <span className="kv__k">Referral ID</span>
            <span className="kv__v">
              <span>{agent.referralId || <span className="faint">Not set</span>}</span>
              <button className="edit-btn" onClick={() => onModal('referral')} aria-label="Edit referral ID" disabled={readOnly} title={readOnly ? DEMO_TITLE : 'Edit'}><EditIcon width={13} height={13} /></button>
            </span>
          </div>
          <div className="kv__row"><span className="kv__k">Created</span><span className="kv__v"><span>{dateTime(agent.createdAt)}</span></span></div>
        </div>
      </Card>

      <Card title="Direct downline" subtitle={`${childAgents.length} agent${childAgents.length === 1 ? '' : 's'} · ${directUsers.length} member${directUsers.length === 1 ? '' : 's'}`}>
        {childAgents.length || directUsers.length ? (
          <div className="chips">
            {childAgents.map((a) => (
              <button key={a.uid} className="chip-btn" onClick={() => onSelect(a.uid)} title="Open agent">
                <LevelBadge role={a.role} size="sm" /> {a.name} <small>@{a.loginId}</small>
              </button>
            ))}
            {directUsers.map((u) => (
              <span key={u.uid} className="chip-btn" style={{ cursor: 'default' }}>
                <UserBadge size="sm" /> {u.name} <small>@{u.loginId}</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>No agents or members under this agent yet. Use <b>Create sub</b> to add one.</p>
        )}
      </Card>
    </div>
  );
}
