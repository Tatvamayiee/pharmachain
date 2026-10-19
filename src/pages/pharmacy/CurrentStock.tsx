import { useMyStock } from '../dealer/Stock';

export default function CurrentStock() {
  const { stock } = useMyStock();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Current Stock</h1>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Expiry</th></tr>
          </thead>
          <tbody>
            {stock.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.batchNumber}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2">₹{s.price}</td>
                <td className="px-4 py-2 text-xs">{new Date(s.expiryDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {stock.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No stock</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
