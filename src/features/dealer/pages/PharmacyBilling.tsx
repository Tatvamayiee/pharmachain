// ---------------------------------------------------------------------------
// PharmacyBilling — POS billing over the REAL stock database.
//
// Add bill lines (medicine name, quantity, unit price), optionally pin a
// prescription reference, and checkout. The server verifies stock for every
// line, deducts FIFO across released lots, records the sales and persists the
// bill; the receipt below is the server's response, not client-invented math.
// Recent bills come from GET /api/platform/bills. No mock data.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Plus, Printer, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { dataService } from '../../../platform/data/dataService';
import { useToast } from '../../../app/providers/ToastContext';
import type { Bill } from '../../../shared/types';

type Line = { key: number; medicineName: string; quantity: number; unitPrice: number };

let lineSeq = 1;
const newLine = (): Line => ({ key: lineSeq++, medicineName: '', quantity: 1, unitPrice: 0 });

export default function PharmacyBilling() {
  const { toast } = useToast();
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [customerName, setCustomerName] = useState('');
  const [patientRef, setPatientRef] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [recent, setRecent] = useState<Bill[]>([]);

  const loadRecent = useCallback(async () => {
    setRecent(await dataService.getBills());
  }, []);

  useEffect(() => { void loadRecent(); }, [loadRecent]);

  const subtotal = lines.reduce((s, l) => s + (Number.isFinite(l.unitPrice) ? l.unitPrice : 0) * (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
  const estTax = subtotal * 0.05;
  const estTotal = Math.max(subtotal + estTax - (discount || 0), 0);

  const patchLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const checkout = async () => {
    const items = lines
      .filter((l) => l.medicineName.trim().length >= 2)
      .map((l) => ({ medicineName: l.medicineName.trim(), quantity: Math.round(l.quantity), unitPrice: l.unitPrice }));
    if (!items.length) { toast('Add at least one medicine line with a name.', 'error'); return; }
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) { toast('Quantities must be whole numbers of at least 1.', 'error'); return; }
    setBusy(true);
    const result = await dataService.createBill({ customerName, patientRef, prescriptionId, paymentMethod, discount, items });
    setBusy(false);
    if (!result.ok) { toast(result.error, 'error'); return; }
    setLastBill(result.bill);
    toast(`Bill ${result.bill.billNumber} paid — stock updated.`, 'success');
    setLines([newLine()]);
    setCustomerName(''); setPatientRef(''); setPrescriptionId(''); setDiscount(0);
    void loadRecent();
  };

  const printBill = () => {
    if (!lastBill) return;
    const win = window.open('', '_blank', 'width=460,height=640');
    if (!win) { toast('Allow pop-ups to print the receipt.', 'error'); return; }
    const rows = lastBill.items.map((i) =>
      `<tr><td>${i.medicineName}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₹${i.unitPrice.toFixed(2)}</td><td style="text-align:right">₹${i.total.toFixed(2)}</td></tr>`).join('');
    win.document.write(`<!doctype html><title>${lastBill.billNumber}</title>
      <body style="font-family:monospace;font-size:12px;margin:16px">
      <h2 style="margin:0 0 2px">PharmaChain Pharmacy</h2>
      <p style="margin:0 0 8px">GST Invoice · ${lastBill.billNumber}<br/>${new Date(lastBill.createdAt || Date.now()).toLocaleString()}</p>
      <p style="margin:0 0 8px">Customer: ${lastBill.customerName}${lastBill.patientRef ? ` · Ref: ${lastBill.patientRef}` : ''}${lastBill.prescriptionId ? ` · Rx: ${lastBill.prescriptionId}` : ''}</p>
      <table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr>${rows}</table>
      <p style="text-align:right;margin:8px 0 0">Subtotal: ₹${lastBill.subtotal.toFixed(2)}<br/>Tax (5%): ₹${lastBill.tax.toFixed(2)}${lastBill.discount ? `<br/>Discount: −₹${lastBill.discount.toFixed(2)}` : ''}<br/><strong>PAID (${lastBill.paymentMethod.toUpperCase()}): ₹${lastBill.grandTotal.toFixed(2)}</strong></p>
      <p style="margin-top:10px;font-size:10px">Computer-generated invoice — medicines verified via batch QR before sale.</p>
      </body>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div>
      <PageHeader
        title="Billing (POS)"
        subtitle="Multi-medicine bills over live stock — the server verifies every line, deducts FIFO and stores the receipt."
        actions={
          <button type="button" onClick={() => void loadRecent()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        }
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="New bill">
        <h2 className="text-base font-semibold text-slate-900">New bill</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Customer name</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Patient ref (optional)</span>
            <input value={patientRef} onChange={(e) => setPatientRef(e.target.value)} placeholder="CUST-DEMO-0001"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Prescription ID (optional)</span>
            <input value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} placeholder="PRX-…"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>

        <div className="mt-4 space-y-2.5">
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_84px_104px_36px] items-center gap-2">
              <input value={l.medicineName} onChange={(e) => patchLine(l.key, { medicineName: e.target.value })}
                placeholder="Medicine name (e.g. Paracetamol 650)" aria-label={`Medicine name ${l.key}`}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <input type="number" min={1} value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: Number(e.target.value) })}
                aria-label={`Quantity ${l.key}`} className="w-full rounded-xl border border-slate-200 px-2.5 py-2.5 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <input type="number" min={0} step="0.5" value={l.unitPrice} onChange={(e) => patchLine(l.key, { unitPrice: Number(e.target.value) })}
                aria-label={`Unit price ${l.key}`} className="w-full rounded-xl border border-slate-200 px-2.5 py-2.5 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                aria-label={`Remove line ${l.key}`} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <Plus size={13} aria-hidden="true" /> Add medicine line
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'card' | 'upi')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
              <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Discount (₹)</span>
            <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </label>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
            <p className="text-xs text-slate-400">Client estimate — the server's totals are final.</p>
            <p className="mt-0.5 font-semibold text-slate-800 tabular-nums">≈ ₹{estTotal.toFixed(2)} <span className="text-xs font-normal text-slate-400">(incl. 5% tax)</span></p>
          </div>
        </div>

        <button type="button" onClick={() => void checkout()} disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
          <Receipt size={15} aria-hidden="true" /> {busy ? 'Processing…' : 'Checkout & print bill'}
        </button>
      </section>

      {lastBill && (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-label="Bill receipt">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-emerald-800">Bill {lastBill.billNumber} — paid ({lastBill.paymentMethod})</p>
            <button type="button" onClick={printBill}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
              <Printer size={13} aria-hidden="true" /> Print receipt
            </button>
          </div>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-emerald-700/70"><th className="py-1">Item</th><th className="py-1 text-center">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Amount</th></tr></thead>
            <tbody>
              {lastBill.items.map((i, idx) => (
                <tr key={idx} className="border-t border-emerald-100">
                  <td className="py-1.5 text-emerald-900">{i.medicineName} <span className="font-mono text-[10px] text-emerald-600">{i.batchNumber}</span></td>
                  <td className="py-1.5 text-center tabular-nums text-emerald-900">{i.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-900">₹{i.unitPrice.toFixed(2)}</td>
                  <td className="py-1.5 text-right tabular-nums text-emerald-900">₹{i.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-sm text-emerald-900">
            Subtotal ₹{lastBill.subtotal.toFixed(2)} · Tax ₹{lastBill.tax.toFixed(2)}{lastBill.discount ? ` · Discount −₹${lastBill.discount.toFixed(2)}` : ''} · <strong>Paid ₹{lastBill.grandTotal.toFixed(2)}</strong>
          </p>
        </section>
      )}

      <section className="mt-6" aria-label="Recent bills">
        <h2 className="text-sm font-semibold text-slate-800">Recent bills</h2>
        {recent.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-400">
            No bills yet for your organization — completed checkouts appear here.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Bill #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">When</th></tr>
              </thead>
              <tbody>
                {recent.slice(0, 10).map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.billNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{b.customerName}</td>
                    <td className="px-4 py-3 text-slate-500">{b.items.map((i) => `${i.medicineName} ×${i.quantity}`).join(', ')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">₹{b.grandTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(b.createdAt || Date.now()).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
