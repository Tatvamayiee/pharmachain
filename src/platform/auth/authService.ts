import type { User, UserRole } from '../../shared/types';
import { apiFetch, apiUrl, setBackendSessionActive } from '../api/api';
import { DEMO_ACCOUNTS, ROLE_HOME } from '../../shared/data/demoAccounts';

const SESSION_KEY = 'pharmachain_session_v1';
const REMEMBER_KEY = 'pharmachain_remember_email';
const LEGACY_TOKEN_KEY = 'pc_token';

/**
 * Auth bridge flag. Default false → prototype login against local demo
 * accounts. When true (VITE_USE_BACKEND_AUTH), the backend issues an HttpOnly
 * cookie; the browser never receives or stores the JWT.
 */
const USE_BACKEND_AUTH = import.meta.env.PROD || import.meta.env.VITE_USE_BACKEND_AUTH === 'true';

export const authService = {
  sessionKey: SESSION_KEY,
  usesBackendAuth: USE_BACKEND_AUTH,

  homeFor(role: UserRole): string {
    return ROLE_HOME[role];
  },

  rememberedEmail(): string | null {
    return localStorage.getItem(REMEMBER_KEY);
  },

  setRememberedEmail(email: string | null) {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  },

  async currentSession(): Promise<User | null> {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (USE_BACKEND_AUTH) {
      try {
        const res = await apiFetch(apiUrl('/api/auth/me'));
        if (!res.ok) {
          setBackendSessionActive(false);
          return null;
        }
        const data = await res.json();
        if (!data.user?.role) {
          setBackendSessionActive(false);
          return null;
        }
        setBackendSessionActive(true);
        return data.user as User;
      } catch {
        setBackendSessionActive(false);
        return null;
      }
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },

  async login(email: string, password: string): Promise<User> {
    if (USE_BACKEND_AUTH) {
      const res = await apiFetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid email or password.');
      const u = (data.user || {}) as Partial<User>;
      if (!u.role) throw new Error('Backend login response did not include a user role.');
      const session: User = {
        id: u.id || '',
        name: u.name || email,
        email: u.email || email,
        role: u.role,
        organization: u.organization || '',
        phone: u.phone || '',
        address: u.address || '',
        status: u.status || 'active',
        createdAt: u.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      setBackendSessionActive(true);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    // Prototype authentication: validate against the public demo accounts in
    // the browser only. The session profile is cached locally; API credentials
    // are never stored in browser-accessible storage.
    await new Promise((resolve) => setTimeout(resolve, 600)); // keep login loading state visible
    const account = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password,
    );
    if (!account) throw new Error('Invalid email or password.');

    const session: User = {
      id: `demo-${account.role}`,
      name: account.name,
      email: account.email,
      role: account.role,
      organization: account.organization,
      phone: '',
      address: account.location,
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
      lastLogin: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async logout(): Promise<void> {
    if (USE_BACKEND_AUTH) {
      const res = await apiFetch(apiUrl('/api/auth/logout'), { method: 'POST' });
      if (!res.ok) throw new Error('Could not end the server session. Please retry.');
    } else {
      await apiFetch(apiUrl('/api/auth/logout'), { method: 'POST' }).catch(() => undefined);
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setBackendSessionActive(false);
  },

  /**
   * Create a real account via the backend. The backend sets an HttpOnly
   * session cookie and returns the user profile; prototype mode (no backend)
   * does not support registration.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    organization?: string;
  }): Promise<User> {
    if (!USE_BACKEND_AUTH) {
      throw new Error('Registration requires the backend. Start the server and set VITE_USE_BACKEND_AUTH=true.');
    }
    const res = await apiFetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Registration failed.');
    const u = (data.user || {}) as Partial<User>;
    if (!u.role) throw new Error('Backend registration response did not include a user role.');
    const session: User = {
      id: u.id || '',
      name: u.name || input.name,
      email: u.email || input.email,
      role: u.role,
      organization: u.organization || input.organization || '',
      phone: u.phone || '',
      address: u.address || '',
      status: u.status || 'active',
      createdAt: u.createdAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setBackendSessionActive(true);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
};
