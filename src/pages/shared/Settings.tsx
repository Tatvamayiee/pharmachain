import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { useToast } from '../../contexts/ToastContext';

interface ToggleRow {
  key: string;
  label: string;
  hint: string;
  defaultOn: boolean;
}

const NOTIFICATION_PREFS: ToggleRow[] = [
  { key: 'shipments', label: 'Shipment updates', hint: 'Dispatch, transit and delivery events', defaultOn: true },
  { key: 'recalls', label: 'Recall alerts', hint: 'Immediately when a batch is recalled', defaultOn: true },
  { key: 'expiry', label: 'Expiry warnings', hint: '90/60/30 days before batch expiry', defaultOn: true },
  { key: 'stock', label: 'Low-stock alerts', hint: 'When stock falls below reorder level', defaultOn: true },
  { key: 'digest', label: 'Weekly digest email', hint: 'Summary of activity every Monday', defaultOn: false },
];

const DISPLAY_PREFS: ToggleRow[] = [
  { key: 'compact', label: 'Compact tables', hint: 'Denser row spacing in data tables', defaultOn: false },
  { key: 'sounds', label: 'Alert sounds', hint: 'Play a sound for critical alerts', defaultOn: false },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-[22px]' : 'left-0.5'}`} aria-hidden="true" />
    </button>
  );
}

function PrefSection({ title, rows }: { title: string; rows: ToggleRow[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.defaultOn])),
  );
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-slate-800">{r.label}</p>
              <p className="text-xs text-slate-400">{r.hint}</p>
            </div>
            <Toggle
              label={r.label} on={state[r.key]}
              onChange={(v) => setState((s) => ({ ...s, [r.key]: v }))}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Settings() {
  const { toast } = useToast();
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Preferences are stored locally in this prototype"
        crumbs={[{ label: 'Settings' }]}
        actions={
          <button
            type="button"
            onClick={() => toast('Settings saved (locally).', 'success')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Save size={15} aria-hidden="true" /> Save changes
          </button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <PrefSection title="Notifications" rows={NOTIFICATION_PREFS} />
        <PrefSection title="Display & alerts" rows={DISPLAY_PREFS} />
        <section aria-label="Security" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:col-span-full sm:p-6">
          <h2 className="font-semibold text-slate-900">Security</h2>
          <div className="mt-4 flex items-start gap-3.5 rounded-xl bg-slate-50 p-4">
            <KeyRound size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-700">Password</p>
              <p className="text-xs text-slate-400">
                Managed by your identity provider in production. This prototype uses fixed demo credentials
                (role123 pattern) and stores no secrets in the interface.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
