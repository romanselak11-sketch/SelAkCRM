import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken, setToken, type Me } from '../api';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const m = await api<Me>('/auth/me');
      setMe({ ...m, permissions: m.permissions ?? [] });
    } catch {
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const setSession = useCallback((token: string, user: Me) => {
    setToken(token);
    setMe({ ...user, permissions: user.permissions ?? [] });
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}
