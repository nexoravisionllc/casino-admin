import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AgentTree from './pages/AgentTree.jsx';
import AgentList from './pages/AgentList.jsx';
import Members from './pages/Members.jsx';
import WaitedMembers from './pages/WaitedMembers.jsx';
import GameHistory from './pages/GameHistory.jsx';
import MoneyRequests from './pages/MoneyRequests.jsx';
import Transactions from './pages/Transactions.jsx';
import PointLog from './pages/PointLog.jsx';
import Providers from './pages/Providers.jsx';
import Games from './pages/Games.jsx';
import Settings from './pages/Settings.jsx';

function RequireAuth({ children }) {
  const { partner } = useAuth();
  return partner ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { partner } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={partner ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />

        <Route path="agents" element={<Navigate to="/agents/treeview" replace />} />
        <Route path="agents/treeview" element={<AgentTree />} />
        <Route path="agents/list" element={<AgentList />} />

        <Route path="members" element={<Navigate to="/members/list" replace />} />
        <Route path="members/list" element={<Members />} />
        <Route path="members/waited" element={<WaitedMembers />} />
        <Route path="members/gamehistory" element={<GameHistory />} />
        {/* Member transactions live under Money > Transactions. */}
        <Route path="members/transactions" element={<Navigate to="/money/transaction" replace />} />

        <Route path="money" element={<Navigate to="/money/deposit" replace />} />
        <Route path="money/deposit" element={<MoneyRequests key="deposit" type="deposit" />} />
        <Route path="money/withdraw" element={<MoneyRequests key="withdraw" type="withdraw" />} />
        <Route path="money/transaction" element={<Transactions />} />
        <Route path="money/point-log" element={<PointLog />} />

        <Route path="games" element={<Navigate to="/games/providers" replace />} />
        <Route path="games/providers" element={<Providers />} />
        <Route path="games/list" element={<Games />} />

        <Route path="system" element={<Navigate to="/system/setting" replace />} />
        <Route path="system/setting" element={<Settings />} />
        {/* Notices / Create Events were never built; send old links to Settings. */}
        <Route path="system/*" element={<Navigate to="/system/setting" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
