import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { useRealtime } from './RealtimeContext.jsx';

const StatsContext = createContext({ stats: null, refresh: () => {} });

// Header numbers (Fortune Gate, pending counts, totals). Polled every 5s so the
// live Fortune Gate balance stays current, and re-read on realtime events.
export function StatsProvider({ children }) {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [stats, setStats] = useState(null);

  const refresh = useCallback(
    () => apiRequest('/dashboard/header', { token }).then(setStats).catch(() => {}),
    [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, 5000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => { if (tick) refresh(); }, [tick, refresh]);

  return <StatsContext.Provider value={{ stats, refresh }}>{children}</StatsContext.Provider>;
}

export const useStats = () => useContext(StatsContext);
