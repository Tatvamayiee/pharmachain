import { useAuth as useApplicationAuth } from '../../app/providers/AuthContext';

export function useAuth() {
  const auth = useApplicationAuth();

  return {
    user: auth.user,
    loading: auth.initializing,
    login: async (email: string, password: string): Promise<void> => {
      const user = await auth.login(email, password);
      if (!user) throw new Error(auth.error || 'Invalid email or password.');
    },
    logout: auth.logout,
  };
}
