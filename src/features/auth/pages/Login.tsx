import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../../platform/auth/auth';

const demo = [
  { email: 'sahana@pharmachain.io', label: 'Pharmacy' },
  { email: 'manufacturer@pharmachain.io', label: 'Manufacturer' },
  { email: 'dealer@pharmachain.io', label: 'Dealer' },
  { email: 'transport@pharmachain.io', label: 'Transport' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('sahana@pharmachain.io');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) { navigate('/dashboard', { replace: true }); }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(identity, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-50 via-white to-sky-50">
      {/* Top bar with PharmaChain logo */}
      <header className="border-b border-indigo-100/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2.5 px-4 sm:px-6">
          <img src="/logo.jpg" alt="PharmaChain Logo" className="h-9 w-9 rounded-lg object-contain" aria-hidden="true" />
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-lg font-bold text-transparent">
            PharmaChain
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-xl shadow-indigo-100/60">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md">
                <ShieldCheck size={24} aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Pharmacy Login</h1>
              <p className="mt-1 text-sm text-slate-500">
                Sign in to manage medicine traceability
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {/* Username / Email */}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Username / Email</span>
                <span className="relative block">
                  <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-identity"
                    name="identity"
                    type="text"
                    autoComplete="username"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="you@pharmacy.com"
                    required
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </span>
              </label>

              {/* Password */}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                <span className="relative block">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-10 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Login button */}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn size={16} aria-hidden="true" />
                {busy ? 'Signing in…' : 'Login'}
              </button>

              {/* Forgot password */}
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>

            {/* Sign up */}
            <p className="mt-8 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
              New to PharmaChain?{' '}
              <Link
                to="/signup"
                className="font-semibold text-indigo-600 transition-colors hover:text-indigo-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Sign Up
              </Link>
            </p>

            {/* Demo accounts */}
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Demo accounts (password: <span className="font-mono">demo123</span>):
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demo.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => { setIdentity(d.email); setPassword('demo123'); }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-slate-400">
        PharmaChain — Pharmacy Supply Chain Management
      </footer>
    </div>
  );
}
