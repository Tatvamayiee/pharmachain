type Tone = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'muted';

const TONES: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
};

const PALE_YELLOW: Record<string, Tone> = {
  // Shipment statuses
  CREATED: 'default', PACKED: 'info', DISPATCHED: 'purple', IN_TRANSIT: 'info',
  // Transport-QR (QR 2) flow statuses
  PREPARED: 'default', PICKED_UP: 'info', AT_DISTRIBUTION_CENTER: 'purple',
  OUT_FOR_DELIVERY: 'info', AT_PHARMACY: 'info',
  ASSIGNED_TO_DISTRIBUTOR: 'purple', ASSIGNED_TO_DEALER: 'warning',
  DELIVERED: 'success', CANCELLED: 'error',
  // Batch statuses
  active: 'success', expired: 'warning', recalled: 'error', depleted: 'muted',
  // Direct manufacturer procurement orders
  pending: 'warning', accepted: 'info', rejected: 'error', shipped: 'purple',
  received: 'success', cancelled: 'muted',
  // User statuses
  Active: 'success', Pending: 'warning', Suspended: 'error', Rejected: 'error',
  // Verification results
  authentic: 'success', Authentic: 'success',
  quarantine: 'warning',
  // Priorities
  normal: 'default', important: 'warning', emergency: 'error',
};

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
  /** Render underscores as spaces (default true). */
  pretty?: boolean;
}

export default function StatusBadge({ status, tone, pretty = true }: StatusBadgeProps) {
  const resolved = tone ?? PALE_YELLOW[status] ?? 'default';
  const label = pretty ? status.split('_').join(' ') : status;
  return (
    <span
      className={`inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[resolved]}`}
    >
      {label}
    </span>
  );
}
