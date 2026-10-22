import { FormEvent, useState } from 'react';
import { getDB, generateId, logActivity, notify } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';
import { useMyStock } from '../../dealer/pages/Stock';

export default function Returns() {
  const { user } = useAuth();
  const { stock, refresh } = useMyStock();
  const [msg, setMsg] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = new FormData(f);
    const drugName = String(data.get('drugName') || '');
    const qty = Number(data.get('quantity') || 0);
    const item = stock.find(s => s.drugName === drugName);
    if (!item || qty <= 0 || qty > item.quantity) return setMsg('Invalid return quantity');
    const db = await getDB();
    await db.put('stock', { ...item, quantity: item.quantity - qty });
    await db.add('stock', { ...item, id: generateId(), quantity: -qty, createdAt: new Date().toISOString() });
    await logActivity(user?.name ?? '', 'customer return', `${item.drugName} −${qty} returned to supplier`);
    await notify('MediDist Dealer', 'Return received', `${user?.name} returned ${item.drugName} ×${qty}`);
    setMsg(`Returned ${qty} units of ${drugName} to the dealer.`);
    f.reset(); refresh(); setMsg(`Returned ${qty} units of ${drugName}.`);
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Returns</h1>
      <form onSubmit={submit} className="space-y-3 rounded-xl border-slate-200 bg-white p-4">
        <select name="drugName" required className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm">
          {stock.map(s => <option key={s.id} value={s.drugName}>{s.drugName} ({s.quantity} on hand)</option>)}
        </select>
        <input name="quantity" type="number" min={1} required placeholder="Quantity to return" className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Process return</button>
      </form>
      {msg && <p className="mt-4 text-sm text-emerald-600">{msg}</p>}
    </div>
  );
}
