import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Cross, Eye, EyeOff, Factory, LogIn, ShoppingBag, Truck, User, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_HOME } from '../../data/demoAccounts';
import type { UserRole } from '../../types';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  organization: z.string().trim().max(120).optional(),
  role: z.enum(['manufacturer', 'distributor', 'dealer', 'hospital', 'customer']),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_ICONS: Record<string, LucideIcon> = {
  manufacturer: Factory,
  distributor: Truck,
  dealer: ShoppingBag,
  hospital: Cross,
  customer: User,
};

const ROLE_BLURB: Record<string, string> = {
  manufacturer: 'Produce & dispatch medicines',
  distributor: 'Warehouse & redistribution',
  dealer: 'Pharmacy sales & stock',
  hospital: 'Ward inventory & usage',
  customer: 'Verify & track medicines',
};

export default function Register() {
  const { register: authRegister, loggingIn, error } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register, handleSubmit, watch, setError, formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', organization: '', role: 'dealer', email: '', password: '' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: RegisterValues) => {
    const user = await authRegister({
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      organization: values.organization || '',
    });
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
            Create your<br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">PharmaChain account</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-600">
            Join the verified pharmaceutical supply chain — register your organization and start tracking batches, prescriptions and shipments today.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {['Your data is stored securely', 'Role-scoped dashboards', 'QR verification included', 'Audit trail from day one'].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* Register card */}
        <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl shadow-indigo-100/60 sm:p-8" aria-label="Registration form">
          <h2 className="text-xl font-bold text-slate-900">Create account</h2>
          <p className="mt-1 text-sm text-slate-500">Choose your role and set your credentials.</p>

          {/* Role selector */}
          <fieldset className="mt-5" aria-label="Select your role">
            <legend className="mb-2 text-sm font-medium text-slate-700">Role</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_ICONS) as UserRole[]).map((role) => {
                const Icon = ROLE_ICONS[role];
                const active = selectedRole === role;
                return (
                  <label
                    key={role}
                    aria-pressed={active}
                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-indigo-600 ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={19} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[11px] font-semibold leading-tight">{role}</span>
                    <input type="radio" value={role} {...register('role')} className="sr-only" />
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{ROLE_BLURB[selectedRole] ?? ''}</p>
          </fieldset>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Full name</span>
              <input
                type="text" autoComplete="name"
                {...register('name')}
                aria-invalid={!!errors.name}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Jane Doe"
              />
              {errors.name && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.name.message}</span>}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Organization <span className="font-normal text-slate-400">(optional)</span></span>
              <input
                type="text" autoComplete="organization"
                {...register('organization')}
                aria-invalid={!!errors.organization}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                placeholder="Acme Pharmaceuticals"
              />
              {errors.organization && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.organization.message}</span>}
            </label>

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
                  type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-3.5 pr-11 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="At least 6 characters"
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

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit" disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingIn ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Creating account…
                </>
              ) : (
                <><LogIn size={16} aria-hidden="true" /> Create account</>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 transition-colors hover:text-indigo-800 hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
