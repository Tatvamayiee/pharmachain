import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Factory, Cross, Map as MapIcon, QrCode, ShieldCheck, ShoppingBag, Truck, User, Users } from 'lucide-react';

const FEATURES = [
  { icon: Boxes, title: 'Batch Management', text: 'Create, track and audit every medicine batch from production line to point of sale.' },
  { icon: QrCode, title: 'QR Verification', text: 'Customers scan a package to instantly confirm authenticity, expiry and recall status.' },
  { icon: Truck, title: 'Shipment Tracking', text: 'Live status across manufacturer → distributor → dealer → hospital → customer.' },
  { icon: ShieldCheck, title: 'Recall Control', text: 'Initiate recalls with severity, notify every stakeholder and track affected stock.' },
  { icon: MapIcon, title: 'Expiry Monitoring', text: 'Automated alerts before batches expire so stock rotates safely.' },
  { icon: Users, title: 'Role Dashboards', text: 'Six dedicated workspaces — each role sees exactly what its responsibility demands.' },
];

const ROLES = [
  { icon: Factory, label: 'Manufacturers' },
  { icon: Truck, label: 'Distributors' },
  { icon: ShoppingBag, label: 'Dealers & Pharmacies' },
  { icon: Cross, label: 'Hospitals' },
  { icon: User, label: 'Customers' },
  { icon: ShieldCheck, label: 'Regulators' },
];

const JOURNEY = ['Manufactured', 'QR Generated', 'Packed', 'Dispatched', 'In Transit', 'Distributor', 'Dealer / Cross', 'Delivered', 'Verified'];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-[#F5F8FF] to-transparent">
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="mx-auto w-fit rounded-full border border-indigo-100 bg-white px-4 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm">
            Pharmaceutical supply-chain platform
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Every medicine. <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Fully traceable.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            PharmaChain secures the journey of medicines from the production line to the patient — with batch-level traceability, instant QR verification and regulatory-grade audits.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Explore the demo <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              See features
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="Key features">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">Built for the full supply chain</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          One platform connecting manufacturers, distributors, pharmacies, hospitals, patients and regulators.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
                <f.icon size={21} />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Journey */}
      <section className="border-y border-slate-100 bg-white py-12" aria-label="Traceability journey">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-slate-900">The verified journey</h2>
          <ol className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 text-xs font-semibold text-slate-600 sm:text-sm">
            {JOURNEY.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[11px] text-white" aria-hidden="true">{i + 1}</span>
                {step}
                {i < JOURNEY.length - 1 && <span className="ml-1 text-slate-300" aria-hidden="true">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-label="Supported roles">
        <h2 className="text-center text-2xl font-bold text-slate-900">A dashboard for every role</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {ROLES.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-3 py-5 text-center shadow-sm transition-all hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white" aria-hidden="true">
                <r.icon size={18} />
              </span>
              <p className="text-xs font-semibold text-slate-700">{r.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/about" className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-800 hover:underline">
            Learn more about PharmaChain →
          </Link>
        </div>
      </section>
    </div>
  );
}
