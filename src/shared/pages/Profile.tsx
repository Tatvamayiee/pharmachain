import { Building2, Calendar, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../../app/providers/AuthContext';
import { ROLE_LABEL } from '../data/demoAccounts';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  const fields = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone },
    { icon: Building2, label: 'Organization', value: user.organization },
    { icon: MapPin, label: 'Address', value: user.address },
    { icon: ShieldCheck, label: 'Role', value: ROLE_LABEL[user.role] },
    { icon: Calendar, label: 'Member since', value: new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
    { icon: Calendar, label: 'Last login', value: user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-IN') : '—' },
  ];

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details" crumbs={[{ label: 'Profile' }]} />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section aria-label="Profile summary" className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-3xl font-bold text-white shadow-md" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">{user.name}</h2>
          <p className="text-sm text-indigo-600">{ROLE_LABEL[user.role]}</p>
          <p className="mt-1 text-xs text-slate-400">{user.organization}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={13} aria-hidden="true" /> Active account
          </span>
        </section>

        <section aria-label="Account details" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Account details</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            {fields.map((f) => (
              <div key={f.label} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                <f.icon size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-slate-400">{f.label}</dt>
                  <dd className="break-words text-sm font-medium text-slate-800">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400">
            Profile editing is disabled in this prototype. In production, changes sync to the identity provider.
          </p>
        </section>
      </div>
    </>
  );
}
