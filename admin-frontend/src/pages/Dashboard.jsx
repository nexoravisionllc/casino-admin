import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api/client.js';
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import AgentPanel from '../components/AgentPanel.jsx';
import MembersPanel from '../components/MembersPanel.jsx';
import GamePanel from '../components/GamePanel.jsx';
import SystemPanel from '../components/SystemPanel.jsx';
import SettingPage from '../components/SettingPage.jsx';
import MoneyPanel from '../components/MoneyPanel.jsx';
import { AgentsList, AgentsTreeview } from '../components/AgentsViews.jsx';
import { UsersList, WaitedUsers } from '../components/UsersViews.jsx';
import { GameHistoryView } from '../components/GameHistoryViews.jsx';
import { DepositView, TransactionHistoryView } from '../components/TransactionsViews.jsx';
import { ProvidersView, GamesView } from '../components/GamesViews.jsx';
import { AreaChart, BarChart } from '../components/Charts.jsx';

export default function Dashboard() {
  const { token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { view } = useParams();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);

  // Section and sub-view come from the URL so routing works and is shareable.
  const isAgents = location.pathname.startsWith('/agents');
  const isMembers = location.pathname.startsWith('/members');
  const isMoney = location.pathname.startsWith('/money');
  const isGames = location.pathname.startsWith('/games');
  const isSystem = location.pathname.startsWith('/system');
  const section = isSystem ? 'system' : isGames ? 'games' : isMoney ? 'money' : isMembers ? 'members' : isAgents ? 'agents' : 'dashboard';
  const agentView = view === 'list' ? 'list' : 'treeview';
  const memberView = ['waited', 'transactions', 'gamehistory'].includes(view) ? view : 'list';
  const moneyView = ['withdraw', 'transaction', 'point-log'].includes(view) ? view : 'deposit';
  const gameView = view === 'list' ? 'list' : 'providers';
  const systemView = ['notices', 'events'].includes(view) ? view : 'setting';

  useEffect(() => {
    let cancelled = false;
    const load = () => apiRequest('/dashboard', { token })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    load();
    // Refresh every 5s so the live FortuneGate header value stays current.
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  const selectSection = (key) => {
    if (key === 'agents') {
      setPanelOpen(true);
      navigate('/agents/treeview');
    } else if (key === 'members') {
      setPanelOpen(true);
      navigate('/members/list');
    } else if (key === 'money') {
      setPanelOpen(true);
      navigate('/money/deposit');
    } else if (key === 'games') {
      setPanelOpen(true);
      navigate('/games/providers');
    } else if (key === 'system') {
      setPanelOpen(true);
      navigate('/system/setting');
    } else if (key === 'dashboard') {
      navigate('/');
    }
  };

  const showAgentPanel = isAgents && panelOpen;
  const showMembersPanel = isMembers && panelOpen;
  const showMoneyPanel = isMoney && panelOpen;
  const showGamePanel = isGames && panelOpen;
  const showSystemPanel = isSystem && panelOpen;

  return (
    <div className="dash">
      {/* Header spans the full width at the top. */}
      <Header stats={data?.header} />

      <div className="dash__lower">
        <Sidebar active={section} onSelect={selectSection} />

        {showAgentPanel && (
          <AgentPanel
            activeView={agentView}
            onSelectView={(v) => navigate(`/agents/${v}`)}
            onCollapse={() => setPanelOpen(false)}
          />
        )}

        {showMembersPanel && (
          <MembersPanel
            activeView={memberView}
            onSelectView={(v) => navigate(`/members/${v}`)}
            onCollapse={() => setPanelOpen(false)}
          />
        )}

        {showMoneyPanel && (
          <MoneyPanel
            activeView={moneyView}
            onSelectView={(v) => navigate(`/money/${v}`)}
            onCollapse={() => setPanelOpen(false)}
          />
        )}

        {showGamePanel && (
          <GamePanel
            activeView={gameView}
            onSelectView={(v) => navigate(`/games/${v}`)}
            onCollapse={() => setPanelOpen(false)}
          />
        )}

        {showSystemPanel && (
          <SystemPanel
            activeView={systemView}
            onSelectView={(v) => navigate(`/system/${v}`)}
            onCollapse={() => setPanelOpen(false)}
          />
        )}

        <div className="dash__body">
          {section === 'system' ? (
            systemView === 'setting' ? <SettingPage /> : <p className="setting__placeholder">{systemView === 'notices' ? 'Notices' : 'Create Events'} — coming soon.</p>
          ) : section === 'members' ? (
            memberView === 'list' ? <UsersList />
              : memberView === 'waited' ? <WaitedUsers />
              : memberView === 'gamehistory' ? <GameHistoryView />
              : <p className="setting__placeholder">Transaction - Coming Soon</p>
          ) : section === 'money' ? (
            moneyView === 'deposit'
              ? <DepositView key="deposit" defaultType="deposit" title="Deposit" />
              : moneyView === 'withdraw'
              ? <DepositView key="withdraw" defaultType="withdraw" title="Withdraw" />
              : moneyView === 'transaction'
              ? <TransactionHistoryView />
              : <p className="setting__placeholder">Point Log - Coming Soon</p>
          ) : section === 'games' ? (
            gameView === 'providers' ? <ProvidersView /> : <GamesView />
          ) : section === 'agents' ? (
            agentView === 'treeview' ? <AgentsTreeview /> : <AgentsList />
          ) : (
            <>
              {error && (
                <p className="dash__error">
                  {error} <button className="linklike" onClick={logout}>Sign in again</button>
                </p>
              )}

              <div className="cards">
                {(data?.cards ?? []).map((c) => (
                  <div className="card" key={c.title}>
                    <div className="card__title">{c.title}</div>
                    <div className="card__value">{Number(c.value).toLocaleString('en-US')}</div>
                    <div className="card__sub">
                      Percentile from previous day
                      <span className="card__delta">↓ {c.changePercent}%</span>
                    </div>
                    <div className="card__spark" />
                  </div>
                ))}
              </div>

              <div className="charts">
                <section className="panel">
                  <h2 className="panel__title">Weekly Data</h2>
                  <AreaChart data={data?.weeklyData ?? []} />
                </section>
                <section className="panel">
                  <h2 className="panel__title">Monthly Game Report</h2>
                  <BarChart data={data?.monthlyData ?? []} />
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
