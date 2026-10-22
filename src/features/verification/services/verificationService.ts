import type { QRVerification, VerificationResult } from '../../../shared/types';
import { MEDICINE_BY_ID, batchByNumber, mockShipments, userName } from '../../../shared/data/mockData';
import { apiFetch, apiUrl, authHeaders } from '../../../platform/api/api';

export interface VerificationOutcome {
  result: VerificationResult;
  message: string;
  batch: {
    id: string;
    batchNumber: string;
    medicineName: string;
    genericName: string;
    manufacturer: string;
    manufacturingDate: string;
    expiryDate: string;
    storageCondition: string;
    availableQuantity: number;
    status: string;
    qrPayload: string;
    /** Package/serial identifier this system actually has: the batch code. */
    packageId: string;
    /** Recall reason when the batch is recalled (server-provided). */
    recallReason?: string;
    /**
     * Integrity/blockchain status, only when the server really carries one:
     * - 'onchain' when the Batch record carries a blockchain anchor,
     * - null when it does not (the UI must show it as unavailable, never invent it).
     */
    integrity: 'onchain' | null;
  } | null;
  currentOwner: string;
  history: QRVerification[];
}

function fmt(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/**
 * Verifies a QR payload / batch number against the REAL server batch
 * registry — the backend performs the actual verification for every scan,
 * anonymous or authenticated (the endpoint is public by design; the QR is
 * printed on the package and scanned by anyone with a phone camera). The
 * local mock registry is only an offline fallback so demos render when the
 * server is unreachable.
 */
export async function verifyCode(rawInput: string): Promise<VerificationOutcome> {
  const input = rawInput.trim();
  // Accept both raw batch numbers and full verification URLs.
  const parts = input.split('/');
  const code = parts[parts.length - 1] || input;

  try {
    const res = await apiFetch(apiUrl(`/api/platform/verify/${encodeURIComponent(code)}`), {
      headers: authHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) {
      return {
        result: 'invalid',
        message: body.error || 'This medicine could not be verified.',
        batch: null,
        currentOwner: '—',
        history: [],
      };
    }
    if (res.ok && body?.verification) {
      const v = body.verification;
      return {
        result: v.result,
        message: v.message,
        batch: v.batch,
        currentOwner: v.batch.manufacturer || '—',
        history: [],
      };
    }
    // Non-OK, non-404 (server error): fall through to the offline registry.
  } catch { /* server unreachable — fall through to the offline registry */ }

  await new Promise((r) => setTimeout(r, 800)); // simulated scan/lookup latency
  const batch = batchByNumber(code);

  if (!batch) {
    return {
      result: 'invalid',
      message: 'This medicine could not be verified.',
      batch: null,
      currentOwner: '—',
      history: [],
    };
  }

  const medicine = MEDICINE_BY_ID.get(batch.medicineId);
  const expired = new Date(batch.expiryDate).getTime() < Date.now();
  const recalled = batch.status === 'recalled';
  const result: VerificationResult = recalled ? 'recalled' : expired ? 'expired' : 'authentic';

  const lastShipment = [...mockShipments]
    .filter((s) => s.batchId === batch.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const currentOwner = lastShipment ? userName(lastShipment.receiverId) : userName(medicine?.manufacturerId ?? '');

  const message =
    result === 'authentic' ? 'This medicine appears to be authentic.'
    : result === 'expired' ? 'This medicine has expired.'
    : 'This batch has been recalled.';

  return {
    result,
    message,
    batch: {
      id: batch.id,
      batchNumber: batch.batchNumber,
      medicineName: medicine?.name ?? 'Unknown medicine',
      genericName: medicine?.genericName ?? '—',
      manufacturer: userName(medicine?.manufacturerId ?? ''),
      manufacturingDate: fmt(batch.manufacturingDate),
      expiryDate: fmt(batch.expiryDate),
      storageCondition: medicine?.storageCondition ?? '—',
      availableQuantity: batch.availableQuantity,
      status: batch.status,
      qrPayload: batch.qrCode,
      packageId: batch.batchNumber,
      integrity: null,
    },
    currentOwner,
    history: [],
  };
}

export function logVerification(entry: Omit<QRVerification, 'id' | 'timestamp'>): QRVerification {
  return { ...entry, id: `qv-${Date.now()}`, timestamp: new Date().toISOString() };
}
