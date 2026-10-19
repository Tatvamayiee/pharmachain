import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Eye, EyeOff, Factory, Cross, LogIn, ShieldCheck, ShoppingBag, Truck, User, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DEMO_ACCOUNTS, ROLE_HOME } from '../../data/demoAccounts';
import type { UserRole } from '../../types';

const loginSchema = z.object({
  role: z.enum(['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'transport', 'admin']),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof loginSchema>;

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  manufacturer: Factory,
  distributor: Truck,
  dealer: ShoppingBag,
  hospital: Cross,
  customer: User,
  transport: Truck,
  admin: ShieldCheck,
};

export default function Login() {
  const { login, loggingIn, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const {
    register, handleSubmit, setValue, watch, setError, formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { role: 'manufacturer', email: '', password: '', remember: true },
  });

  const selectedRole = watch('role');

  const chooseRole = (role: UserRole) => {
    clearError();
    setValue('role', role, { shouldValidate: true });
    const acc = DEMO_ACCOUNTS.find((a) => a.role === role);
    if (acc) {
      setValue('email', acc.email);
      setValue('password', acc.password);
    }
  };

  const onSubmit = async (values: LoginValues) => {
    const user = await login(values.email, values.password, values.remember);
    if (user) {
      navigate(ROLE_HOME[user.role], { replace: true });
    } else {
      setError('password', { type: 'manual', message: ' ' }); // surface auth error below form too
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-b from-indigo-50 via-[#F5F8FF] to-sky-50">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:py-16">
        {/* Brand panel */}
        <section className="hidden flex-col justify-center lg:flex" aria-label="About PharmaChain">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900">
            Secure pharmaceutical<br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">supply-chain traceability</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-600">
            Track every medicine from manufacturer to patient — batches, shipments, QR verification, recalls and expiry monitoring in one platform.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {['End-to-end batch lineage', 'Instant QR authenticity checks', 'Real-time shipment tracking', 'Regulatory-grade audit trail'].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Login card */}
        <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl shadow-indigo-100/60 sm:p-8" aria-label="Login form">
          <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Select your role and enter your credentials.</p>

          {/* Role selector */}
          <fieldset className="mt-5" aria-label="Select your role">
            <legend className="mb-2 text-sm font-medium text-slate-700">Role</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_ICONS) as UserRole[]).map((role) => {
                const Icon = ROLE_ICONS[role];
                const active = selectedRole === role;
                return (
                  <button
                    key={role} type="button" onClick={() => chooseRole(role)}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={19} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[11px] font-semibold leading-tight">{roleLabelShort(role)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email" autoComplete="username"
                {...register('email')}
                aria-invalid={!!errors.email}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="you@company.com"
              />
              {errors.email && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.email.message}</span>}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
              <span className="relative block">
                <input
                  type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-3.5 pr-11 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {errors.password && errors.password.message !== ' ' && (
                <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.password.message}</span>
              )}
            </label>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox" {...register('remember')}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                Forgot password?
              </Link>
            </div>

            {(error || errors.password?.message === ' ') && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                {error ?? 'Login failed. Check the demo credentials below.'}
              </p>
            )}

            <button
              type="submit" disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingIn ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <><LogIn size={16} aria-hidden="true" /> Login</>
              )}
            </button>
          </form>

          {/* Demo access */}
          <div className="mt-5">
            <button
              type="button" onClick={() => setDemoOpen((v) => !v)} aria-expanded={demoOpen}
              className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <span className="flex items-center gap-2"><Users size={15} className="text-indigo-600" aria-hidden="true" /> Demo Access</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${demoOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {demoOpen && (
              <div className="mt-2 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 animate-fade-in">
                <p className="text-[11px] leading-relaxed text-slate-500">
                  One-click fill for each role. All demo passwords follow the pattern <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">role123</code> (e.g. manufacturer123).
                </p>
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = ROLE_ICONS[acc.role];
                  return (
                    <button
                      key={acc.role} type="button"
                      onClick={() => chooseRole(acc.role)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-indigo-100 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <Icon size={15} className="shrink-0 text-indigo-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-700">{acc.label}</span>
                        <span className="block truncate text-[11px] text-slate-400">{acc.email}</span>
                      </span>
                      <code className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{acc.password}</code>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            New to PharmaChain?{' '}
            <Link to="/register" className="font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Building2 size={13} aria-hidden="true" /> Secure supply-chain portal
          </div>
        </section>
      </div>
    </div>
  );
}

function roleLabelShort(role: UserRole): string {
  const map: Record<UserRole, string> = {
    manufacturer: 'Manufacturer', distributor: 'Distributor', dealer: 'Dealer',
    hospital: 'Hospital', customer: 'Customer', transport: 'Transporter', admin: 'Admin',
  };
  return map[role];
}
