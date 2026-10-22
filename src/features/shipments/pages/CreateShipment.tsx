import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, Shipment } from '../../../platform/api/api';

export default function CreateShipment() {
  const [drugName, setDrugName] = useState('');
  const [batch, setBatch] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setShipment(await api<Shipment>('/api/shipments', {
        method: 'POST',
        body: JSON.stringify({ drugName, batch, quantity }),
      }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Create failed'); }
  };

  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (shipment) QRCode.toDataURL(shipment.code, { width: 200 }).then(setQrDataUrl);
  }, [shipment]);

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Create Shipment</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border-slate-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Drug name</label>
          <input value={drugName} onChange={e => setDrugName(e.target.value)} required placeholder="e.g. Paracetamol 500mg"
            className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Batch number</label>
          <input value={batch} onChange={e => setBatch(e.target.value)} required placeholder="e.g. B-2024-018"
            className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))}
            className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Create shipment</button>
      </form>

      {shipment && (
        <div className="mt-6 rounded-xl border-slate-200 bg-white p-5 text-center">
          <p className="mb-1 text-sm font-medium text-emerald-600">Shipment {shipment.code} created</p>
          <div className="mx-auto my-4 w-fit rounded-lg border-slate-200 p-3">
            {qrDataUrl && <img src={qrDataUrl} alt={`QR code for ${shipment.code}`} width={160} height={160} />}
          </div>
          <p className="text-xs text-slate-500">Print this QR on the box label. Scan it at any checkpoint.</p>
        </div>
      )}
      <div className="mt-6">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-500 hover:text-slate-700">← Back to Dashboard</button>
      </div>
    </div>
  );
}
