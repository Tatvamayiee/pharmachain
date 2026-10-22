// ---------------------------------------------------------------------------
// SafetyAlerts — interaction + dosage alert cards, reading review state
// directly from the single analysis object owned by useScannerReview.
// ---------------------------------------------------------------------------

import { ClipboardCheck } from 'lucide-react';
import type { PrescriptionAnalysis } from '../types/prescription';
import { DosageAlertCard, InteractionAlertCard } from './shared';

interface SafetyAlertsProps {
  analysis: PrescriptionAnalysis;
  onAcknowledge: (kind: 'interaction' | 'dosage', alertId: string) => void;
  onRequestNote: (kind: 'interaction' | 'dosage', alertId: string, title: string) => void;
}

export default function SafetyAlerts({ analysis, onAcknowledge, onRequestNote }: SafetyAlertsProps) {
  const { interactionAlerts, dosageAlerts } = analysis;
  if (interactionAlerts.length === 0 && dosageAlerts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="rx-alerts-heading">
      <h2 id="rx-alerts-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <ClipboardCheck size={17} className="text-indigo-600" aria-hidden="true" /> Safety alerts
      </h2>
      {interactionAlerts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700">Drug interaction alerts ({interactionAlerts.length})</h3>
          <div className="mt-2.5 space-y-3">
            {interactionAlerts.map((a) => (
              <InteractionAlertCard
                key={a.id}
                alert={a}
                onAcknowledge={() => onAcknowledge('interaction', a.id)}
                onNote={() => onRequestNote('interaction', a.id, a.medicines.join(' + '))}
              />
            ))}
          </div>
        </div>
      )}
      {dosageAlerts.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-700">Dosage review alerts ({dosageAlerts.length})</h3>
          <div className="mt-2.5 space-y-3">
            {dosageAlerts.map((a) => (
              <DosageAlertCard
                key={a.id}
                alert={a}
                onAcknowledge={() => onAcknowledge('dosage', a.id)}
                onNote={() => onRequestNote('dosage', a.id, a.medicine)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
