import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, AUTH_EXPIRED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'admin-auth';

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage blocked */ }
  }, [auth]);

  // Sign out automatically when the API rejects the stored token.
  useEffect(() => {
    const onExpired = () => setAuth(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = async (loginId, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { loginId, password },
    });
    setAuth({ token: data.token, partner: data.partner });
    return data.partner;
  };

  const logout = () => setAuth(null);

  const value = useMemo(
    () => ({ partner: auth?.partner ?? null, token: auth?.token ?? null, login, logout }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
