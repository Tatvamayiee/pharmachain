import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    await new Promise((r) => setTimeout(r, 800)); // simulate API
    setSentTo(values.email);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-xl shadow-indigo-100/60">
        {sentTo ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <MailCheck size={26} aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Check your inbox</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              If an account exists for <span className="font-semibold text-slate-700">{sentTo}</span>, a password
              reset link has been sent. The link expires in 30 minutes.
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
              <ArrowLeft size={15} aria-hidden="true" /> Back to login
            </Link>
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <KeyRound size={24} aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-center text-xl font-bold text-slate-900">Forgot password?</h1>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Enter the email linked to your PharmaChain account and we'll send a reset link.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="you@company.com"
                />
                {errors.email && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.email.message}</span>}
              </label>
              <button
                type="submit" disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-500">
              Remembered it? <Link to="/login" className="font-semibold text-indigo-600 hover:underline">Back to login</Link>
            </p>
            <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-center text-xs text-slate-400">
              Demo prototype — no email is actually sent.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
