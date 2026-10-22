import { useState } from 'react';
import { verifyCode, verdictMessage } from '../../verification/services/ai';
import { getDB } from '../../../platform/database/db';

export default function DrugAlert() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<'green' | 'orange' | 'red' | null>(null);

  const check = async () => {
    setMsg(''); setKind(null);
    const v = await verifyCode(code.trim().toUpperCase(), 'patient');
    const db = await getDB();
    const batch = await db.getFromIndex('batches', 'by-batchNumber', code.trim().toUpperCase());
    setMsg(verdictMessage(v, batch));
    setKind(v.result);
  };

  const color = kind === 'green' ? 'text-emerald-600' : kind === 'orange' ? 'text-amber-600' : kind === 'red' ? 'text-red-600' : '';

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Drug Authenticity Check</h1>
      <p className="mb-4 text-sm text-slate-500">Enter the batch number printed on the pack (or scan its QR).</p>
      <div className="flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. B-2024-001"
          className="flex-1 rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button onClick={check} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Check</button>
      </div>
      {msg && <p className={`mt-4 rounded-xl bg-white border-slate-200 p-4 text-sm font-medium ${color}`}>{msg}</p>}
    </div>
  );
}
