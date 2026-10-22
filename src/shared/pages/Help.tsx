import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, LifeBuoy, Mail, MessageSquare, ScanLine, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const FAQS = [
  { q: 'How do I verify a medicine?', a: 'Scan the QR code on the package from any dashboard using the "Scan QR" button, or go to QR Verification and type the batch number printed on the pack (e.g. PCM-2411-A). You will instantly see the authenticity verdict, expiry and full supply-chain journey.' },
  { q: 'What do the verification results mean?', a: 'Authentic (green) means the batch is registered and valid. Expired (orange) means the batch is past its expiry date. Recalled (red) means the manufacturer has recalled this batch — stop using it. Not found (red) means the code is not in the registry and may be counterfeit.' },
  { q: 'Who can initiate a recall?', a: 'Manufacturers initiate recalls from Recall Management with a reason and severity. Regulatory administrators supervise and can approve or escalate cases. All downstream roles receive notifications.' },
  { q: 'How are shipments tracked?', a: 'Every hand-off (dispatch, transit, receipt) is recorded with a timestamp and actor, building the supply-chain timeline you see on each batch. Shipment statuses range from CREATED to DELIVERED or CANCELLED.' },
  { q: 'Are low-stock alerts automatic?', a: 'Yes. Stock records carry a reorder level; when available quantity drops below it, the owner sees low-stock warnings on the dashboard and in notifications.' },
  { q: 'Is my data secure?', a: 'This prototype uses mock authentication and sample data. The production architecture separates role-based access, never exposes secrets in the client, and keeps an immutable audit trail for regulators.' },
];

const QUICK = [
  { icon: ScanLine, title: 'QR Verification', text: 'Check any batch in seconds.', to: '/verify' },
  { icon: ShieldAlert, title: 'Recall alerts', text: 'Latest safety actions.', to: '/notifications' },
  { icon: BookOpen, title: 'Features guide', text: 'What PharmaChain can do.', to: '/features' },
];

export default function Help() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <>
      <PageHeader title="Help & Support" subtitle="Answers to common questions and ways to reach us" crumbs={[{ label: 'Help & Support' }]} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {QUICK.map((q) => (
          <Link key={q.title} to={q.to} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
              <q.icon size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800 group-hover:text-indigo-700">{q.title}</span>
              <span className="block text-xs text-slate-400">{q.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <section aria-label="Frequently asked questions" className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900 sm:px-6">Frequently asked questions</h2>
        <ul className="divide-y divide-slate-100">
          {FAQS.map((f, i) => {
            const open = openIdx === i;
            return (
              <li key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 sm:px-6"
                >
                  {f.q}
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {open && <p className="animate-fade-in px-5 pb-4 text-sm leading-relaxed text-slate-500 sm:px-6">{f.a}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5">
        <LifeBuoy size={22} className="text-indigo-600" aria-hidden="true" />
        <p className="text-sm text-slate-700">Still stuck?</p>
        <Link to="/contact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
          <MessageSquare size={14} aria-hidden="true" /> Contact support
        </Link>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <a href="mailto:support@pharmachain.com" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline">
          <Mail size={14} aria-hidden="true" /> support@pharmachain.com
        </a>
      </div>
    </>
  );
}
