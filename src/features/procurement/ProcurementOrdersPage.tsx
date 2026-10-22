import { useCallback, useEffect, useState } from 'react';
import { Check, PackageCheck, RefreshCw, Send, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthContext';
import { useToast } from '../../app/providers/ToastContext';
import PageHeader from '../../shared/components/ui/PageHeader';
import StatusBadge from '../../shared/components/ui/StatusBadge';
import { dataService } from '../../platform/data/dataService';
import type { ProcurementOrder, ProcurementProduct } from '../../shared/types';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function displayDate(value: string) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function ProcurementOrdersPage({ mode }: { mode: 'buyer' | 'manufacturer' }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [orders, setOrders] = useState<ProcurementOrder[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const [ordersResult, catalogResult] = await Promise.all([
      dataService.getProcurementOrders(),
      mode === 'buyer' ? dataService.getProcurementCatalog() : Promise.resolve(null),
    ]);
    if (!ordersResult.ok) setError(ordersResult.error);
    else setOrders(ordersResult.orders);
    if (catalogResult && !catalogResult.ok) setError(catalogResult.error);
    if (catalogResult?.ok) setProducts(catalogResult.products);
    setLoading(false);
  }, [mode]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = products.find((product) => `${product.manufacturerId}:${product.medicineId}` === selectedProduct);
  const actionLabel: Record<'accept' | 'reject' | 'ship' | 'receive' | 'cancel', string> = {
    accept: 'accepted',
    reject: 'rejected',
    ship: 'marked shipped',
    receive: 'marked received',
    cancel: 'cancelled',
  };

  const placeOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      setError('Choose a medicine and manufacturer before placing an order.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await dataService.createProcurementOrder({
      medicineId: selected.medicineId,
      manufacturerId: selected.manufacturerId,
      quantity,
      notes: notes.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      toast(result.error, 'error');
      return;
    }
    setQuantity(1);
    setNotes('');
    toast(`Order ${result.order.id} sent to ${result.order.manufacturerId}.`, 'success');
    await refresh();
  };

  const updateOrder = async (order: ProcurementOrder, action: 'accept' | 'reject' | 'ship' | 'receive' | 'cancel') => {
    const result = await dataService.updateProcurementOrder(order.id, action);
    if (!result.ok) {
      setError(result.error);
      toast(result.error, 'error');
      return;
    }
    toast(`Order ${order.id} ${actionLabel[action]}.`, 'success');
    await refresh();
  };

  const title = mode === 'buyer' ? 'Order from Manufacturers' : 'Incoming Customer Orders';

  return (
    <>
      <PageHeader
        title={title}
        subtitle={mode === 'buyer'
          ? 'Order released medicines directly from manufacturers and track fulfillment.'
          : 'Review pharmacy and hospital orders for your released inventory.'}
        crumbs={[{ label: mode === 'buyer' ? (user?.role === 'hospital' ? 'Hospital' : 'Pharmacy') : 'Manufacturer' }, { label: title }]}
        actions={
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {error && (
        <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      {mode === 'buyer' && (
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><ShoppingCart size={18} /> Place a medicine order</h2>
          <p className="mb-4 text-sm text-slate-500">Only released stock with available units is listed. Stock is rechecked and reserved when the manufacturer ships your order.</p>
          <form onSubmit={(event) => void placeOrder(event)} className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(120px,1fr)_minmax(0,2fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Medicine and manufacturer</span>
              <select required value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} className={inputClass}>
                <option value="">Select available medicine</option>
                {products.map((product) => (
                  <option key={`${product.manufacturerId}:${product.medicineId}`} value={`${product.manufacturerId}:${product.medicineId}`}>
                    {product.medicineName}{product.strength ? ` · ${product.strength}` : ''} — {product.manufacturerId} ({product.availableQuantity} available)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</span>
              <input required type="number" min={1} max={selected?.availableQuantity ?? 1000000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Order note (optional)</span>
              <input maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery or purchasing notes" className={inputClass} />
            </label>
            <button disabled={submitting || products.length === 0 || (selected !== undefined && quantity > selected.availableQuantity)} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={15} aria-hidden="true" /> {submitting ? 'Sending…' : 'Place order'}
            </button>
          </form>
          {!loading && products.length === 0 && <p className="mt-3 text-sm text-amber-700">No manufacturer batches are currently available to order.</p>}
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{mode === 'buyer' ? 'Your orders' : 'Orders for your products'}</h2>
            <p className="text-xs text-slate-500">{orders.length} order{orders.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {loading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading orders…</p>
          : orders.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">No orders yet.</p>
            : <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <article key={order.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500">{order.id}</span>
                      <StatusBadge status={order.status} />
                      {mode === 'manufacturer' && <span className="text-xs text-slate-500">Buyer: {order.buyerOrganization} ({order.buyerRole})</span>}
                      {mode === 'buyer' && <span className="text-xs text-slate-500">Manufacturer: {order.manufacturerId}</span>}
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">{order.medicineName} <span className="font-normal text-slate-500">× {order.quantity.toLocaleString('en-IN')}</span></p>
                    <p className="mt-0.5 text-xs text-slate-500">Placed {displayDate(order.createdAt)}{order.notes ? ` · ${order.notes}` : ''}</p>
                    {order.decisionNote && <p className="mt-1 text-xs text-slate-600">Update: {order.decisionNote}</p>}
                    {order.allocations?.length > 0 && <p className="mt-1 text-xs text-slate-600">Batches: {order.allocations.map((item) => `${item.batchNumber} (${item.quantity})`).join(', ')}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mode === 'manufacturer' && order.status === 'pending' && <>
                      <button type="button" onClick={() => void updateOrder(order, 'accept')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><Check size={14} /> Accept</button>
                      <button type="button" onClick={() => void updateOrder(order, 'reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"><X size={14} /> Reject</button>
                    </>}
                    {mode === 'manufacturer' && order.status === 'accepted' && <button type="button" onClick={() => void updateOrder(order, 'ship')} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><Send size={14} /> Mark shipped</button>}
                    {mode === 'buyer' && order.status === 'pending' && <button type="button" onClick={() => void updateOrder(order, 'cancel')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel order</button>}
                    {mode === 'buyer' && order.status === 'shipped' && <button type="button" onClick={() => void updateOrder(order, 'receive')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><PackageCheck size={14} /> Confirm received</button>}
                  </div>
                </article>
              ))}
            </div>}
      </section>
    </>
  );
}
