import { useCallback, useState } from 'react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { useQrMatrix, moduleAt } from './useQrMatrix';

interface QRCodeDisplayProps {
  payload: string;
  pixelSize?: number; // rendered px
  showActions?: boolean;
  label?: string;
}

/**
 * Real, scannable QR code for the given payload (encoded with the `qrcode`
 * package). Pointing the in-app camera scanner — or any phone QR scanner —
 * at it decodes to the verification URL, which the app verifies against the
 * live batch registry.
 */
export default function QRCodeDisplay({
  payload, pixelSize = 180, showActions = true, label,
}: QRCodeDisplayProps) {
  const matrix = useQrMatrix(payload);
  const [copied, setCopied] = useState(false);
  const cell = matrix.size ? pixelSize / matrix.size : 0;

  const download = useCallback(() => {
    if (!matrix.size) return;
    const pad = 32;
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize + pad * 2;
    canvas.height = pixelSize + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    for (let r = 0; r < matrix.size; r++)
      for (let c = 0; c < matrix.size; c++)
        if (moduleAt(matrix, r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${payload.replace(/[^a-z0-9-]/gi, '_')}.png`;
    a.click();
  }, [matrix, cell, pixelSize, payload]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard unavailable */ }
  }, [payload]);

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div
        role="img"
        aria-label={label ?? `QR code for ${payload}`}
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <svg width={pixelSize} height={pixelSize} shapeRendering="crispEdges">
          {matrix.size > 0 &&
            Array.from({ length: matrix.size }, (_, r) =>
              Array.from({ length: matrix.size }, (_, c) =>
                moduleAt(matrix, r, c)
                  ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#111827" />
                  : null,
              ),
            )}
        </svg>
      </div>
      <p className="max-w-full break-all text-center font-mono text-[11px] text-slate-400">{payload}</p>
      {showActions && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={download} aria-label="Download QR code" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <Download size={15} />
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Print QR code" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <Printer size={15} />
          </button>
          <button type="button" onClick={copy} aria-label="Copy verification link" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
}
