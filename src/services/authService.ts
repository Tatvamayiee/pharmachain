import type { User, UserRole } from '../types';
import { apiUrl } from '../lib/api';
import { DEMO_ACCOUNTS, ROLE_HOME } from '../data/demoAccounts';

const SESSION_KEY = 'pharmachain_session_v1';
const REMEMBER_KEY = 'pharmachain_remember_email';
const TOKEN_KEY = 'pc_token';

/**
 * Auth bridge flag. Default false → pure prototype (localStorage demo
 * accounts, no network). When true (VITE_USE_BACKEND_AUTH), login calls the
 * backend /api/auth/login and stores the returned JWT for API calls. The
 * backend must be running and seeded with the same demo accounts.
 */
const USE_BACKEND_AUTH = import.meta.env.VITE_USE_BACKEND_AUTH === 'true';

export const authService = {
  sessionKey: SESSION_KEY,

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

  currentSession(): User | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },

  async login(email: string, password: string): Promise<User> {
    if (USE_BACKEND_AUTH) {
      const res = await fetch(apiUrl('/api/auth/login'), {
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
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    // Prototype authentication: validate against the public demo accounts in
    // the browser only. No network request, no token — the session lives in
    // localStorage (see SESSION_KEY). Production auth replaces this entirely.
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

  logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Create a real account via the backend. The backend issues the JWT and
   * returns the user; the session is stored exactly like a login so the
   * user lands directly in their dashboard. Prototype mode (no backend) is
   * not supported for registration — the server is the source of truth.
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
    const res = await fetch(apiUrl('/api/auth/register'), {
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
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },
};
