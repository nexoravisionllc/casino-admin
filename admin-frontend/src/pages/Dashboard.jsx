import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEMO_TITLE, useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';
import { apiRequest } from '../api/client.js';
import { useStats } from '../context/StatsContext.jsx';
import { PageHeader, Card, Stat, Delta, Alert, Empty, Badge } from '../components/ui.jsx';
import { AreaChart, BarChart, Legend } from '../components/Charts.jsx';
import RtpModal from '../components/RtpModal.jsx';
import { usd, pts, int, timeAgo, dateLong } from '../lib/format.js';
import {
  GateIcon, DollarIcon, NetworkIcon, UsersIcon, DepositIcon, WithdrawIcon, ArrowRightIcon,
  EditIcon, RefreshIcon, UserClockIcon,
} from '../components/Icons.jsx';

const SERIES = [
  { key: 'bet', label: 'Bets', color: 'var(--brand)' },
  { key: 'win', label: 'Wins', color: 'var(--accent)' },
];

const FLOW = {
  agentToUser: { from: 'Agent', to: 'User' },
  userToAgent: { from: 'User', to: 'Agent' },
  userToProvider: { from: 'User', to: 'Game Provider' },
  providerToUser: { from: 'Game Provider', to: 'User' },
};

export default function Dashboard() {
  const { token, partner, readOnly } = useAuth();
  const { tick } = useRealtime();
  const { stats } = useStats();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [rtpOpen, setRtpOpen] = useState(false);
  const [updated, setUpdated] = useState(null);

  const load = () => apiRequest(`/dashboard?tz=${new Date().getTimezoneOffset()}`, { token })
    .then((d) => { setData(d); setError(''); setUpdated(new Date()); })
    .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(id);
  }, [token, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = stats ?? data?.header ?? {};
  const loading = !data && !error;
  const weekly = (data?.weekly ?? []).map((d) => ({ ...d, title: dateLong(`${d.date}T12:00:00Z`) }));
  const monthly = data?.monthly ?? [];
  const weekBet = weekly.reduce((a, d) => a + d.bet, 0);
  const weekWin = weekly.reduce((a, d) => a + d.win, 0);
  const pendingTotal = Number(h.deposit ?? 0) + Number(h.withdraw ?? 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <PageHeader
        title={`${greet}, ${partner?.name ?? ''}`}
        subtitle={`Here’s what’s happening today · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        actions={
          <button className="btn btn--ghost" onClick={load} title={updated ? `Updated ${updated.toLocaleTimeString()}` : undefined}>
            <RefreshIcon width={15} height={15} /> Refresh
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="stats">
        <Stat
          hero label="Fortune Gate balance" icon={GateIcon} tone="gold"
          value={stats || data ? usd(h.fortuneGate) : '—'}
          foot={<>RTP <b>{Number(h.fortuneRtp ?? 0)}%</b>
            <button className="btn btn--sm btn--ghost stat__edit" onClick={() => setRtpOpen(true)} disabled={readOnly} title={readOnly ? DEMO_TITLE : undefined}><EditIcon width={12} height={12} /> Change</button></>}
        />
        <Stat
          label="Member balance" icon={DollarIcon} tone="green"
          value={usd(h.userBalance)} foot={<>Points <b>{pts(h.userPoints)}</b></>}
          onClick={() => navigate('/members/list')}
        />
        <Stat
          label="Agent balance" icon={NetworkIcon} tone="blue"
          value={usd(h.partnerBalance)} foot={<>Points <b>{pts(h.partnerPoints)}</b></>}
          onClick={() => navigate('/agents/list')}
        />
        <Stat
          label="Members" icon={UsersIcon} tone="violet"
          value={int(h.totalUsers ?? h.connectedUsers)}
          foot={Number(h.waitedUsers) > 0
            ? <><Badge tone="orange">{int(h.waitedUsers)} waiting</Badge> <Link className="linklike" to="/members/waited">Review</Link></>
            : <>{int(h.totalAgents)} agents · none waiting</>}
          onClick={() => navigate('/members/list')}
        />
      </div>

      <div className="stats">
        {(data?.cards ?? Object.keys(FLOW).map((key) => ({ key }))).map((c) => (
          <Stat
            key={c.key} small
            label={<span className="flow__dir">{FLOW[c.key]?.from} <ArrowRightIcon width={13} height={13} /> {FLOW[c.key]?.to}</span>}
            value={loading ? <span className="skel" style={{ display: 'block', height: 24, width: '60%' }} /> : usd(c.value)}
            foot={loading ? null : <><Delta value={c.changePercent} /> vs yesterday <b>{usd(c.previous)}</b></>}
          />
        ))}
      </div>

      <div className="dash-grid">
        <Card
          title="Last 7 days" subtitle={`Bets ${usd(weekBet)} · Wins ${usd(weekWin)} · GGR ${usd(weekBet - weekWin)}`}
          actions={<Legend series={SERIES} />}
        >
          <AreaChart data={weekly} series={SERIES} height={250} />
        </Card>

        <Card
          title="Pending requests" subtitle={pendingTotal ? `${pendingTotal} waiting for review` : 'All caught up'}
          bodyClass="card__body--flush"
          actions={
            <div style={{ display: 'flex', gap: 6 }}>
              <Link className="btn btn--sm btn--ghost" to="/money/deposit">Deposits{Number(h.deposit) > 0 && <Badge tone="orange">{h.deposit}</Badge>}</Link>
              <Link className="btn btn--sm btn--ghost" to="/money/withdraw">Withdrawals{Number(h.withdraw) > 0 && <Badge tone="orange">{h.withdraw}</Badge>}</Link>
            </div>
          }
        >
          <div style={{ paddingTop: 12 }}>
            {data?.pending?.length ? (
              <ul className="reqlist">
                {data.pending.map((t) => (
                  <li className="reqlist__item" key={t.uid}>
                    <span className={`reqlist__ico reqlist__ico--${t.type}`}>
                      {t.type === 'deposit' ? <DepositIcon width={17} height={17} /> : <WithdrawIcon width={17} height={17} />}
                    </span>
                    <span className="reqlist__main">
                      <strong>@{t.userId}</strong>
                      <span>{t.type === 'deposit' ? 'Deposit' : 'Withdrawal'} · {timeAgo(t.createdAt)}</span>
                    </span>
                    <span className="reqlist__amt">
                      <span className="amount">{usd(t.amount)}</span>
                      <Link className="linklike" style={{ fontSize: 12 }} to={`/money/${t.type}`}>Review</Link>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={UserClockIcon} title={loading ? 'Loading…' : 'No pending requests'} text={loading ? undefined : 'New deposit and withdrawal requests will show up here.'} />
            )}
          </div>
        </Card>
      </div>

      <Card title="Monthly game report" subtitle="Bets and wins over the last 12 months" actions={<Legend series={SERIES} />}>
        <BarChart data={monthly.map((m) => ({ ...m, title: `${m.label} ${m.month.slice(0, 4)}` }))} series={SERIES} height={260} />
      </Card>

      {rtpOpen && <RtpModal current={h.fortuneRtp} onClose={() => setRtpOpen(false)} />}
    </div>
  );
}
