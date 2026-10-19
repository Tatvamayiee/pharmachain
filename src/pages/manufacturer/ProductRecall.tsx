import { useState } from 'react';
import { getDB, logActivity, notify } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { useBatches } from './ManufacturerDashboard';

export default function ProductRecall() {
  const { user } = useAuth();
  const { batches, refresh } = useBatches();
  const [done, setDone] = useState('');

  const recall = async (batchNumber: string) => {
    const db = await getDB();
    const idx = await db.getFromIndex('batches', 'by-batchNumber', batchNumber);
    if (!idx) return;
    await db.put('batches', { ...idx, status: 'recalled' });
    await logActivity(user?.name ?? '', 'recall', `Batch ${batchNumber} recalled`);
    await notify(null, '⚠️ Product recall', `Batch ${batchNumber} (${idx.drugName}) has been recalled by the manufacturer.`);
    setDone(batchNumber); refresh();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Product Recall</h1>
      <p className="mb-4 text-sm text-slate-500">Mark a batch as recalled. Every future QR scan of a recalled batch returns RED.</p>
      <div className="space-y-2">
        {batches.filter(b => b.status !== 'recalled').map(b => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{b.drugName}</p>
              <p className="font-mono text-xs text-slate-500">{b.batchNumber} · {b.quantity} units</p>
            </div>
            <button onClick={() => recall(b.batchNumber)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Recall</button>
          </div>
        ))}
      </div>
      {done && <p className="mt-4 text-sm text-emerald-600">Batch {done} recalled — all supply-chain users notified.</p>}
    </div>
  );
}
