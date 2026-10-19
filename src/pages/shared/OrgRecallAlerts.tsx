import { useMemo } from 'react';
import { AlertTriangle, Megaphone, PackageX, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { useFetch } from '../../hooks/useFetch';
import { dataService } from '../../services/dataService';
import { exportCsv } from '../../services/exportService';
import { ExportButton } from '../../components/ui/inputs';
import type { Recall } from '../../types';

interface Row extends Record<string, unknown> {
  id: string; medicine: string; batch: string; reason: string;
  severity: string; affected: number; manufacturer: string; createdAt: string;
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Recall Alerts for dealer / hospital orgs — REAL recall cases derived from
 * recalled batches on the server, so a manufacturer recall appears here
 * immediately without any client-side propagation.
 */
export function OrgRecallAlerts({ role }: { role: 'dealer' | 'hospital' }) {
  const orgLabel = role === 'dealer' ? 'Dealer' : 'Hospital';
  const recallsQ = useFetch<Recall[]>(() => dataService.getRecalls());

  const rows: Row[] = useMemo(
    () =>
      (recallsQ.data ?? []).map((r) => ({
        id: r.id,
        medicine: r.medicineName ?? '—',
        batch: r.batchNumber ?? r.batchId,
        reason: r.reason,
        severity: r.severity,
        affected: r.affectedQuantity,
        manufacturer: r.manufacturerId || '—',
        createdAt: fmt(r.createdAt),
      })),
    [recallsQ.data]
  );

  const columns: Column<Row>[] = [
    {
      key: 'medicine', header: 'Medicine', sortable: true,
      render: (r) => (
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <PackageX size={15} className="shrink-0 text-red-500" aria-hidden="true" />
          {r.medicine}
        </span>
      ),
    },
    { key: 'batch', header: 'Batch', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.batch}</span> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-72 truncate text-slate-600" title={r.reason}>{r.reason}</span> },
    {
      key: 'severity', header: 'Severity', render: (r) => (
        <StatusBadge
          status={r.severity === 'critical' || r.severity === 'high' ? 'recalled' : 'expired'}
          tone={r.severity === 'critical' || r.severity === 'high' ? 'error' : 'warning'}
          pretty={false}
        />
      ),
    },
    { key: 'manufacturer', header: 'Issued by', hideOnMobile: true },
    { key: 'createdAt', header: 'Initiated', hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader
        title="Recall Alerts"
        subtitle={`Recalled batches reported by manufacturers — check your stock against this list${orgLabel === 'Dealer' ? ' before dispatching or selling' : ''}`}
        crumbs={[{ label: orgLabel }, { label: 'Recall Alerts' }]}
        actions={
          <ExportButton
            onExport={() =>
              exportCsv('recall-alerts', ['Medicine', 'Batch', 'Reason', 'Severity', 'Issued by', 'Initiated'],
                rows.map((r) => [r.medicine, r.batch, r.reason, r.severity, r.manufacturer, r.createdAt]))
            }
          />
        }
      />

      {rows.length > 0 && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{rows.length} active recall{rows.length === 1 ? '' : 's'}</span> — quarantine affected
            stock immediately and stop selling or dispensing these batches.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={recallsQ.loading}
        emptyMessage="No active recalls — all batches are safe to sell or dispense"
        skeletonRows={3}
      />

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <Megaphone size={13} aria-hidden="true" />
        Recalls are issued by manufacturers and appear here in real time.
        <AlertTriangle size={13} aria-hidden="true" className="text-slate-300" />
      </p>
    </>
  );
}
