import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User, UserRole } from '../../shared/types';
import { authService } from '../../platform/auth/authService';
import { authLogin, clearBackendSession } from '../../platform/api/backendSync';
import { seedDemoData } from '../../platform/database/db';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  loggingIn: boolean;
  error: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<User | null>;
  register: (input: { name: string; email: string; password: string; role: UserRole; organization?: string }) => Promise<User | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void seedDemoData()
      .then(() => authService.currentSession())
      .then((session) => { if (!cancelled) setUser(session); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to restore session.');
      })
      .finally(() => { if (!cancelled) setInitializing(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    setError(null);
    setLoggingIn(true);
    try {
      const session = await authService.login(email, password);
      authService.setRememberedEmail(remember ? email : null);
      setUser(session);
      // Best-effort backend sync keeps prototype data operations available.
      if (!authService.usesBackendAuth) void authLogin(email, password);
      return session;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      return null;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; role: UserRole; organization?: string }) => {
    setError(null);
    setLoggingIn(true);
    try {
      const session = await authService.register(input);
      authService.setRememberedEmail(input.email);
      setUser(session);
      return session;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
      return null;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      clearBackendSession();
      setUser(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end session.');
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, loggingIn, error, login, register, logout, clearError: () => setError(null) }),
    [user, initializing, loggingIn, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
