import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

function RequireAuth({ children }) {
  const { partner } = useAuth();
  return partner ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { partner } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={partner ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/agents" element={<Navigate to="/agents/treeview" replace />} />
      <Route path="/agents/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/members" element={<Navigate to="/members/list" replace />} />
      <Route path="/members/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/money" element={<Navigate to="/money/deposit" replace />} />
      <Route path="/money/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/games" element={<Navigate to="/games/providers" replace />} />
      <Route path="/games/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/system" element={<Navigate to="/system/setting" replace />} />
      <Route path="/system/:view" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
