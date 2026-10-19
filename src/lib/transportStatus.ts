/**
 * Client mirror of the server's transport status rules (server/routes/transport.cjs).
 * This is the ONLY client-side copy — the server stays authoritative: it
 * re-validates every status transition and role check on each request.
 */
export const TRANSPORT_STATUS_FLOW = [
  'PREPARED', 'PICKED_UP', 'IN_TRANSIT', 'AT_DISTRIBUTION_CENTER',
  'OUT_FOR_DELIVERY', 'AT_PHARMACY', 'DELIVERED',
] as const;

export const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  PREPARED: 'Prepared',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  AT_DISTRIBUTION_CENTER: 'Reached Distribution Center',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  AT_PHARMACY: 'Reached Pharmacy',
  DELIVERED: 'Delivered',
  // Legacy shipment statuses mapped onto the transport flow vocabulary.
  CREATED: 'Prepared',
  VERIFIED: 'Delivered',
};

/** Roles the server permits to update transport location/status. */
export const TRANSPORT_CAN_UPDATE: ReadonlySet<string> = new Set([
  'transport', 'distributor', 'manufacturer', 'dealer', 'hospital', 'pharmacy', 'admin',
]);

/** Normalize a shipment status onto the transport flow vocabulary. */
export function normTransportStatus(s: string): string {
  const u = String(s || '').toUpperCase();
  if (u === 'CREATED' || u === 'PREPARED') return 'PREPARED';
  if (u === 'VERIFIED') return 'DELIVERED';
  return u;
}

/** The next status the server would accept after `current`, or null at the end. */
export function nextTransportStatus(current: string): string | null {
  const flow = TRANSPORT_STATUS_FLOW;
  const idx = flow.indexOf(normTransportStatus(current) as (typeof flow)[number]);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}
