import { useState } from 'react';
import { Check, ShieldCheck, UserX } from 'lucide-react';
import TablePage from '../../../shared/pages/TablePage';
import PageHeader from '../../../shared/components/ui/PageHeader';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import ReportsPage from '../../../shared/pages/ReportsPage';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useToast } from '../../../app/providers/ToastContext';
import { dataService } from '../../../platform/data/dataService';
import { MEDICINE_BY_ID, medicineName, mockBatches, userName } from '../../../shared/data/mockData';
import type { Column } from '../../../shared/components/ui/DataTable';

type Any = Record<string, unknown>;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function UserManagement() {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<{ row: Any; action: 'suspend' | 'activate' | 'approve' } | null>(null);

  return (
    <>
      <TablePage
        title="User Management" subtitle="Approve, suspend and manage every account in the ecosystem"
        crumbs={[{ label: 'Administrator' }, { label: 'User Management' }]}
        load={() => dataService.getUsers()}
        buildRows={(list) => list.map((u) => ({
          id: u.id, name: u.name, organization: u.organization, role: u.role, email: u.email,
          location: u.address, status: u.status.charAt(0).toUpperCase() + u.status.slice(1),
          registered: fmt(u.createdAt), lastLogin: u.lastLogin ? fmt(u.lastLogin) : 'Never',
        }))}
        columns={[
          { key: 'name', header: 'User', sortable: true, render: (r: Any) => (
            <div>
              <p className="font-medium text-slate-800">{String(r.name)}</p>
              <p className="text-xs text-slate-400">{String(r.email)}</p>
            </div>
          ) },
          { key: 'organization', header: 'Organization', hideOnMobile: true },
          { key: 'role', header: 'Role', sortable: true, render: (r: Any) => <span className="capitalize">{String(r.role)}</span> },
          { key: 'location', header: 'Location', hideOnMobile: true },
          { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
          { key: 'lastLogin', header: 'Last Login', hideOnMobile: true },
          { key: 'actions', header: 'Actions', hideOnMobile: true, render: (r: Any) => {
            const s = String(r.status);
            return (
              <div className="flex items-center gap-1">
                {s === 'Pending' && (
                  <button type="button" onClick={() => setConfirm({ row: r, action: 'approve' })} aria-label={`Approve ${String(r.name)}`} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Check size={15} /></button>
                )}
                {s === 'Active' ? (
                  <button type="button" onClick={() => setConfirm({ row: r, action: 'suspend' })} aria-label={`Suspend ${String(r.name)}`} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><UserX size={15} /></button>
                ) : (
                  <button type="button" onClick={() => setConfirm({ row: r, action: 'activate' })} aria-label={`Activate ${String(r.name)}`} className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"><ShieldCheck size={15} /></button>
                )}
              </div>
            );
          } },
        ] as unknown as Column<Any>[]}
        searchFields={['name', 'organization', 'email', 'role']}
        filters={[
          {
            label: 'Role', field: 'role',
            options: [
              { value: 'all', label: 'All roles' },
              ...(['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'admin'] as const).map(
                (r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }),
              ),
            ],
          },
          { label: 'Status', field: 'status', options: [{ value: 'all', label: 'All statuses' }, { value: 'Active', label: 'Active' }, { value: 'Pending', label: 'Pending' }, { value: 'Suspended', label: 'Suspended' }] },
        ]}
        emptyMessage="No users found"
      />
      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.action === 'suspend' ? 'Suspend user?' : confirm?.action === 'approve' ? 'Approve registration?' : 'Activate user?'}
        message={confirm ? `This will ${confirm.action} the account "${String(confirm.row.name)}" (${String(confirm.row.organization)}).` : ''}
        confirmLabel={confirm?.action === 'suspend' ? 'Suspend' : confirm?.action === 'approve' ? 'Approve' : 'Activate'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          toast(`${confirm?.row.name} ${confirm?.action === 'suspend' ? 'suspended' : confirm?.action === 'approve' ? 'approved' : 'activated'} (prototype).`, 'success');
          setConfirm(null);
        }}
      />
    </>
  );
}

export function MedicineRegistry() {
  return (
    <TablePage
      title="Medicine Registry" subtitle="All registered medicines across manufacturers"
      crumbs={[{ label: 'Administrator' }, { label: 'Medicine Registry' }]}
      load={async () => [...MEDICINE_BY_ID.values()].map((m) => ({
        id: m.id, name: m.name, genericName: m.genericName, category: m.category,
        form: `${m.dosageForm} · ${m.strength}`, manufacturer: userName(m.manufacturerId),
      }))}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'name', header: 'Medicine', sortable: true },
        { key: 'genericName', header: 'Generic', hideOnMobile: true },
        { key: 'category', header: 'Category', sortable: true },
        { key: 'form', header: 'Form / Strength', hideOnMobile: true },
        { key: 'manufacturer', header: 'Manufacturer' },
      ] as unknown as Column<Any>[]}
      searchFields={['name', 'genericName', 'category', 'manufacturer']}
      emptyMessage="Registry is empty"
    />
  );
}

export function BatchRegistry() {
  return (
    <TablePage
      title="Batch Registry" subtitle="Every production batch in the system"
      crumbs={[{ label: 'Administrator' }, { label: 'Batch Registry' }]}
      load={async () => mockBatches.map((b) => ({
        id: b.id, batch: b.batchNumber, medicine: medicineName(b.medicineId),
        expiry: fmt(b.expiryDate), available: b.availableQuantity, status: b.status,
      }))}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'batch', header: 'Batch', sortable: true, render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.batch)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'expiry', header: 'Expiry', sortable: true },
        { key: 'available', header: 'Available', sortable: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['batch', 'medicine']}
      filters={[{ label: 'Status', field: 'status', options: [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'recalled', label: 'Recalled' }, { value: 'depleted', label: 'Depleted' }] }]}
      emptyMessage="No batches registered"
    />
  );
}

export function ShipmentMonitoring() {
  return (
    <TablePage
      title="Shipment Monitoring" subtitle="All shipments moving through the supply chain"
      crumbs={[{ label: 'Administrator' }, { label: 'Shipment Monitoring' }]}
      load={async () => (await dataService.getShipments()).map((s) => ({
        id: s.id, medicine: medicineName(s.medicineId), from: userName(s.senderId),
        to: s.destination, quantity: s.quantity, status: s.status,
      }))}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'id', header: 'Shipment', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'from', header: 'From', hideOnMobile: true },
        { key: 'to', header: 'Destination', sortable: true },
        { key: 'quantity', header: 'Qty' },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'medicine', 'to']}
      filters={[{ label: 'Status', field: 'status', options: [{ value: 'all', label: 'All' }, ...['IN_TRANSIT', 'DELIVERED', 'DISPATCHED', 'CANCELLED'].map((s) => ({ value: s, label: s.split('_').join(' ') }))] }]}
      emptyMessage="No shipments in the system"
    />
  );
}

export function VerificationLogs() {
  return (
    <TablePage
      title="QR Verification Logs" subtitle="Every verification attempt across the ecosystem"
      crumbs={[{ label: 'Administrator' }, { label: 'QR Verification Logs' }]}
      load={() => dataService.getVerifications()}
      buildRows={(list) => list.map((v) => ({
        id: v.id, batch: v.qrCode, verifiedBy: userName(v.verifiedBy), result: v.result,
        location: v.location, time: fmt(v.timestamp),
      }))}
      columns={[
        { key: 'batch', header: 'Batch / Code', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.batch)}</span> },
        { key: 'verifiedBy', header: 'Verified By', sortable: true },
        { key: 'result', header: 'Result', render: (r: Any) => <StatusBadge status={String(r.result)} /> },
        { key: 'location', header: 'Location', hideOnMobile: true },
        { key: 'time', header: 'Time', sortable: true },
      ] as unknown as Column<Any>[]}
      searchFields={['batch', 'verifiedBy', 'location']}
      filters={[{ label: 'Result', field: 'result', options: [{ value: 'all', label: 'All results' }, { value: 'authentic', label: 'Authentic' }, { value: 'expired', label: 'Expired' }, { value: 'recalled', label: 'Recalled' }, { value: 'invalid', label: 'Invalid' }] }]}
      emptyMessage="No verification history"
    />
  );
}

export function RecallSupervision() {
  return (
    <TablePage
      title="Recall Supervision" subtitle="Review and oversee all recall cases"
      crumbs={[{ label: 'Administrator' }, { label: 'Recall Supervision' }]}
      load={async () => {
        const recalls = await dataService.getRecalls();
        return recalls.map((r) => ({
          id: r.id, batch: r.batchNumber ?? r.batchId,
          medicine: r.medicineName ?? '—',
          reason: r.reason, severity: r.severity, affected: r.affectedQuantity, status: r.status,
        }));
      }}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'reason', header: 'Reason' },
        { key: 'severity', header: 'Severity', render: (r: Any) => <StatusBadge status={String(r.severity) === 'critical' || String(r.severity) === 'high' ? 'recalled' : 'expired'} pretty={false} /> },
        { key: 'affected', header: 'Affected Units' },
        { key: 'status', header: 'Case', render: (r: Any) => <StatusBadge status={String(r.status) === 'open' ? 'Pending' : String(r.status) === 'in_progress' ? 'IN_TRANSIT' : 'DELIVERED'} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch', 'reason']}
      emptyMessage="No recall cases"
    />
  );
}

export function ComplianceMonitoring() {
  return (
    <TablePage
      title="Compliance Monitoring" subtitle="Organizations and their compliance posture"
      crumbs={[{ label: 'Administrator' }, { label: 'Compliance Monitoring' }]}
      load={async () => [
        { id: 'c1', organization: 'Tatva Pharmaceuticals', type: 'Manufacturer', score: 98, lastAudit: fmt(new Date(Date.now() - 20 * 864e5).toISOString()), status: 'Active' },
        { id: 'c2', organization: 'Kaveri Distributors', type: 'Distributor', score: 94, lastAudit: fmt(new Date(Date.now() - 45 * 864e5).toISOString()), status: 'Active' },
        { id: 'c3', organization: 'MediDist Logistics', type: 'Distributor', score: 61, lastAudit: fmt(new Date(Date.now() - 90 * 864e5).toISOString()), status: 'Suspended' },
        { id: 'c4', organization: 'Sahana Medicals', type: 'Dealer', score: 92, lastAudit: fmt(new Date(Date.now() - 30 * 864e5).toISOString()), status: 'Active' },
        { id: 'c5', organization: 'KMCH Hospitals', type: 'Hospital', score: 96, lastAudit: fmt(new Date(Date.now() - 15 * 864e5).toISOString()), status: 'Active' },
      ]}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'organization', header: 'Organization', sortable: true },
        { key: 'type', header: 'Type' },
        { key: 'score', header: 'Compliance Score', sortable: true, render: (r: Any) => (
          <span className={`font-semibold ${Number(r.score) >= 90 ? 'text-emerald-600' : Number(r.score) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{String(r.score)}/100</span>
        ) },
        { key: 'lastAudit', header: 'Last Audit', hideOnMobile: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['organization', 'type']}
      emptyMessage="No organizations"
    />
  );
}

export function AuditLogs() {
  return (
    <TablePage
      title="Audit Logs" subtitle="Immutable record of significant actions across the platform"
      crumbs={[{ label: 'Administrator' }, { label: 'Audit Logs' }]}
      load={() => dataService.getAuditLogs()}
      buildRows={(list) => list.map((a) => ({
        id: a.id, user: userName(a.userId), action: a.action, entity: `${a.entity}:${a.entityId}`,
        description: a.description, time: fmt(a.timestamp),
      }))}
      columns={[
        { key: 'time', header: 'Time', sortable: true },
        { key: 'user', header: 'Actor', sortable: true },
        { key: 'action', header: 'Action', render: (r: Any) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-indigo-700">{String(r.action)}</code> },
        { key: 'entity', header: 'Entity', hideOnMobile: true, render: (r: Any) => <span className="font-mono text-xs text-slate-500">{String(r.entity)}</span> },
        { key: 'description', header: 'Description' },
      ] as unknown as Column<Any>[]}
      searchFields={['user', 'action', 'description']}
      emptyMessage="No audit records"
    />
  );
}

export function AdminReports() {
  return <ReportsPage crumbs={[{ label: 'Administrator' }, { label: 'Reports' }]} subtitle="Regulatory export reports across the ecosystem" />;
}

export function SystemSettings() {
  const { toast } = useToast();
  return (
    <>
      <PageHeader title="System Settings" subtitle="Platform-wide configuration (prototype)" crumbs={[{ label: 'Administrator' }, { label: 'System Settings' }]} />
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { title: 'Verification policy', rows: [['Public verification', 'Allow customers to verify without login'], ['Expiry warning window', '90 days before expiry']] },
          { title: 'Recall policy', rows: [['Auto-notify customers', 'Push recall alerts to customer accounts'], ['Regulator approval required', 'Recalls above high severity']] },
          { title: 'Data retention', rows: [['Audit log retention', '7 years (regulatory)'], ['Verification log retention', '3 years']] },
        ].map((section) => (
          <section key={section.title} aria-label={section.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-slate-900">{section.title}</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {section.rows.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{k}</p>
                    <p className="text-xs text-slate-400">{v}</p>
                  </div>
                  <button type="button" onClick={() => toast(`"${k}" setting updated (prototype).`, 'info')} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
