// Anomaly detection & verification engine (reconstruction of original src/lib/ai.ts)
import { getDB, generateId, Batch, ScanRecord } from './db';

export type ScanResult = 'green' | 'orange' | 'red';

export interface Verdict {
  result: ScanResult;
  reasons: string[];
}

export async function verifyCode(code: string, scannedBy: string): Promise<Verdict> {
  const db = await getDB();
  const batch = await db.getFromIndex('batches', 'by-batchNumber', code);

  if (!batch) return { result: 'red', reasons: ['UNKNOWN_CODE'] };

  const reasons: string[] = [];

  // Recalled batches are always counterfeit-risk (red)
  if (batch.status === 'recalled') reasons.push('BATCH_RECALLED');

  // Expired
  if (new Date(batch.expiryDate) < new Date()) reasons.push('EXPIRED');
  // Near expiry (< 30 days) — orange flag
  else if (new Date(batch.expiryDate).getTime() - Date.now() < 30 * 86400_000) reasons.push('NEAR_EXPIRY');

  // Scan-frequency anomalies
  const allScans = await db.getAll('scans');
  const forCode = allScans.filter(s => s.code === code);
  if (forCode.length > 3) reasons.push('MULTIPLE_SCANS');
  const byThisScanner = forCode.filter(s => s.scannedBy === scannedBy).length;
  if (byThisScanner >= 2) reasons.push('MULTIPLE_DIFFERENT_SCANNERS'.replace('DIFFERENT_', 'SAME_SCANNER_REPEAT'));
  const distinctScanners = new Set(forCode.map(s => s.scannedBy)).size;
  if (distinctScanners > 3) reasons.push('MULTIPLE_DIFFERENT_SCANNERS');

  const result: ScanResult =
    reasons.some(r => ['BATCH_RECALLED', 'EXPIRED'].includes(r)) ? 'red'
      : reasons.length > 0 ? 'orange'
        : 'green';

  const record: ScanRecord = { id: generateId(), code, result, reasons, scannedBy, at: new Date().toISOString() };
  await db.add('scans', record);
  return { result, reasons };
}

export function verdictMessage(v: Verdict, batch?: Batch): string {
  if (!batch) return 'This code does not match any batch in the supply chain.';
  switch (v.result) {
    case 'green': return `✅ Authentic: ${batch.drugName} (batch ${batch.batchNumber}).`;
    case 'orange': return `⚠️ Authentic but flagged: ${batch.drugName}. Reasons: ${v.reasons.join(', ')}`;
    case 'red': return `⛔ Do not use: ${batch.drugName || 'product'}. Reasons: ${v.reasons.join(', ')}`;
  }
}

// Simple demand forecast: moving average of last N sales
export async function forecastDemand(drugName: string, days = 30): Promise<number> {
  const db = await getDB();
  const sales = (await db.getAll('sales')).filter(
    s => s.drugName === drugName && Date.now() - new Date(s.createdAt).getTime() < days * 86400_000
  );
  return sales.reduce((a, s) => a + s.quantity, 0);
}

// Detect stock that will run out before the next reorder cycle
export async function lowStock(threshold = 100): Promise<{ drugName: string; quantity: number }[]> {
  const db = await getDB();
  const stock = await db.getAll('stock');
  return stock.filter(s => s.quantity < threshold).map(s => ({ drugName: s.drugName, quantity: s.quantity }));
}
