import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ScanLine } from 'lucide-react';
import CameraScanner from '../scanner/CameraScanner';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Scan-QR modal opened from the top navbar. Live camera scanning via
 * html5-qrcode. The two QR systems are dispatched by payload type:
 *   - Transport QR  (https://…/transport/TRQ-… or a raw TRQ-… token)
 *       → the public /transport/:qrId tracking page
 *   - Authentication QR (https://…/verify/<batchNumber> or a batch number)
 *       → the /verify?code=… verification page
 */
const TRANSPORT_TOKEN_RE = /transport\/([A-Za-z0-9_-]+)|^(TRQ-[A-Za-z0-9_-]+)$/i;

function transportTarget(raw: string): string | null {
  const m = raw.trim().match(TRANSPORT_TOKEN_RE);
  const id = m ? (m[1] || m[2]) : '';
  return id ? `/transport/${encodeURIComponent(id)}` : null;
}

export default function QRScannerModal({ isOpen, onClose }: QRScannerModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Unmounting the CameraScanner on close stops the camera stream.
  if (!isOpen) return null;

  // Client-side navigation only: QR deep links (/verify/:code, /track/:code,
  // /transport/:qrId) are React routes, never full-page loads.
  const submitCode = () => {
    const payload = code.trim();
    if (!payload) return;
    onClose();
    const transport = transportTarget(payload);
    if (transport) navigate(transport);
    else navigate(`/verify?code=${encodeURIComponent(payload)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
              aria-hidden="true"
            >
              <ScanLine size={20} />
            </span>
            <h2 id="qr-scanner-title" className="text-lg font-semibold text-slate-900">
              Scan QR Code
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close QR scanner"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <X size={18} />
          </button>
        </div>

        <CameraScanner
          className="h-64"
          onDecoded={(text) => {
            onClose();
            const transport = transportTarget(text);
            if (transport) navigate(transport);
            else navigate(`/verify?code=${encodeURIComponent(text)}`);
          }}
        />

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-100" /> or enter manually <span className="h-px flex-1 bg-slate-100" />
        </div>

        <label className="block">
          <span className="sr-only">Batch number, transport token or QR payload</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
            placeholder="e.g. PCM-2411 or TRQ-…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitCode}
            disabled={!code.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Verify code
          </button>
        </div>
      </div>
    </div>
  );
}
