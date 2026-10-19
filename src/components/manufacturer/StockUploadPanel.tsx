// ---------------------------------------------------------------------------
// StockUploadPanel — manufacturer file-based medicine stock upload (Feature 1).
// POSTs the CSV/XLSX to /api/platform/stock/upload (real server parsing +
// validation + Batch upserts) and reports added/updated/failed per row.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

type UploadError = { row: number; medicineName: string; error: string };
type UploadResult = {
  ok: true; total: number; added: number; updated: number; failed: number;
  items: { batchNumber: string; medicineName: string; quantity: number; status: string }[];
  updatedItems: { batchNumber: string; medicineName: string; quantityAdded: number }[];
  errors: UploadError[];
};

const SAMPLE_CSV = [
  'Medicine Name,Medicine ID,Batch Number,Quantity,Expiry Date,Manufacturer,Strength',
  'Dolo 650 Tablet,DOLO-650,SAMPLE-BATCH-001,10,2027-12-31,Micro Labs,650mg',
  'Azithral 500 Tablet,AZI-500,SAMPLE-BATCH-002,25,2027-06-30,Alembic,500mg',
].join('\n');

export default function StockUploadPanel() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine-stock-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) { toast('Choose a CSV or Excel file first.', 'error'); return; }
    const token = localStorage.getItem('pc_token');
    if (!token) { toast('Not signed in.', 'error'); return; }
    setBusy(true);
    setResult(null);
    setRequestError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(apiUrl('/api/platform/stock/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setRequestError(body.error || `Upload failed (${res.status}).`); return; }
      setResult(body as UploadResult);
      toast(`Upload processed: ${body.added} added, ${body.updated} updated, ${body.failed} failed.`, body.failed ? 'error' : 'success');
    } catch {
      setRequestError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8" aria-label="Upload medicine stock file">
      <h2 className="text-base font-semibold text-slate-900">Upload Medicine Stock</h2>
      <p className="mt-1 text-sm text-slate-500">
        Import stock in bulk from a CSV or Excel file. Columns: Medicine Name, Medicine ID/Code, Batch Number,
        Quantity, Expiry Date, Manufacturer (Strength optional). Existing batch numbers are updated instead of duplicated;
        every row is validated against the medicine master.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          aria-label="Medicine stock file (CSV or Excel)"
          className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3.5 file:py-2.5 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <Upload size={15} aria-hidden="true" /> {busy ? 'Uploading…' : 'Upload stock file'}
        </button>
        <button
          type="button"
          onClick={downloadSample}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <Download size={14} aria-hidden="true" /> Download sample CSV
        </button>
      </div>
      {fileName && <p className="mt-2 text-xs text-slate-400">Selected: {fileName}</p>}

      {requestError && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">{requestError}</p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm" aria-live="polite">
          <p className="font-semibold text-emerald-800">
            Upload processed — {result.added} medicine batch(es) added, {result.updated} updated, {result.failed} failed, of {result.total} row(s).
          </p>
          {result.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-emerald-900">
              {result.items.map((it) => (
                <li key={it.batchNumber} className="flex items-center gap-2">
                  <FileSpreadsheet size={13} aria-hidden="true" />
                  <span>Added <strong className="font-mono">{it.batchNumber}</strong> — {it.medicineName} × {it.quantity} ({it.status})</span>
                </li>
              ))}
            </ul>
          )}
          {result.updatedItems.length > 0 && (
            <ul className="mt-2 space-y-1 text-emerald-900">
              {result.updatedItems.map((it) => (
                <li key={`u-${it.batchNumber}`}>
                  Updated <strong className="font-mono">{it.batchNumber}</strong> — {it.medicineName} +{it.quantityAdded} units
                </li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Validation errors</p>
              <ul className="mt-1.5 space-y-1 text-xs text-amber-900">
                {result.errors.map((e, i) => (
                  <li key={i}>Row {e.row} ({e.medicineName}): {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
