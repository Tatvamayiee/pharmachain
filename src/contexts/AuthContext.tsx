import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User, UserRole } from '../types';
import { authService } from '../services/authService';
import { authLogin, clearBackendToken } from '../services/backendSync';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  loggingIn: boolean;
  error: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<User | null>;
  register: (input: { name: string; email: string; password: string; role: UserRole; organization?: string }) => Promise<User | null>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUser(authService.currentSession());
    setInitializing(false);
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    setError(null);
    setLoggingIn(true);
    try {
      const session = await authService.login(email, password);
      authService.setRememberedEmail(remember ? email : null);
      setUser(session);
      // Best-effort backend sync: caches the JWT for API calls when the
      // server is reachable. Failure never blocks prototype login.
      authLogin(email, password);
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

  const logout = useCallback(() => {
    authService.logout();
    clearBackendToken();
    setUser(null);
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
