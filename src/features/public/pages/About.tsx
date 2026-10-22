import { Link } from 'react-router-dom';
import { Building2, Globe, Lock, ScanLine, ShieldCheck, Workflow } from 'lucide-react';

const PILLARS = [
  { icon: ScanLine, title: 'Verify anything', text: 'Every package carries a QR code linked to its full batch lineage.' },
  { icon: Lock, title: 'Tamper-evident records', text: 'Events are appended to an immutable audit trail visible to regulators.' },
  { icon: Workflow, title: 'Chain of custody', text: 'Ownership transfers are recorded at every hand-off in the chain.' },
  { icon: Globe, title: 'Built for scale', text: 'From a single pharmacy to national distribution networks.' },
];

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">About PharmaChain</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Securing medicines from factory to patient
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600">
        Counterfeit and expired medicines harm patients and undermine trust in healthcare. PharmaChain
        gives every stakeholder in the pharmaceutical supply chain — manufacturers, distributors, dealers,
        hospitals, customers and regulators — a single source of truth for where each batch has been,
        who handled it, and whether it is safe.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <article key={p.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
              <p.icon size={19} />
            </span>
            <h2 className="mt-3.5 font-semibold text-slate-900">{p.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{p.text}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-emerald-900">
          <strong>Prototype notice.</strong> This deployment runs on realistic sample data with mock
          authentication. Connect a backend to run PharmaChain in production.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90">
          Try the demo <Building2 size={15} aria-hidden="true" />
        </Link>
        <Link to="/features" className="text-sm font-semibold text-indigo-600 hover:underline">Explore features →</Link>
      </div>
    </div>
  );
}
