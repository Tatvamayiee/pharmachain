import { createContext, useContext, useEffect, useState } from 'react';
import { User, seedDemoData, logActivity } from './db';
import { apiUrl } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await seedDemoData();
      const saved = localStorage.getItem('pc_user');
      if (saved) {
        try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem('pc_user'); }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid email or password');
    const u = data.user;
    localStorage.setItem('pc_token', data.token);
    localStorage.setItem('pc_user', JSON.stringify(u));
    setUser(u);
    await logActivity(u.name, 'login');
  };

  const logout = () => {
    localStorage.removeItem('pc_user');
    localStorage.removeItem('pc_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
