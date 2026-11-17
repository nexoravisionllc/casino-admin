import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtime } from '../context/RealtimeContext.jsx';

/**
 * GET `path` with the signed-in token. Re-fetches when the path changes and,
 * with `realtime`, whenever the wallet hub reports a change. Pass a null path
 * to skip the request.
 */
export function useResource(path, { realtime = false, initial = null } = {}) {
  const { token } = useAuth();
  const { tick } = useRealtime();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!path) return initial;
    try {
      const d = await apiRequest(path, { token });
      if (live.current) { setData(d); setError(''); }
      return d;
    } catch (e) {
      if (live.current) setError(e.message);
      return null;
    } finally {
      if (live.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token]);

  const rt = realtime ? tick : 0;
  useEffect(() => { refresh(); }, [refresh, rt]);

  return { data, error, loading, refresh, setData };
}
