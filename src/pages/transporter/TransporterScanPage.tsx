import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Camera } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import CameraScanner from '../../components/scanner/CameraScanner';

/**
 * Transporter's primary action (QR 2): scan the transport QR on a shipping
 * box. Resolution, current state, history and the permitted update form all
 * live on the real tracking page (/transport/:qrId) — this page only decodes
 * the code and hands off, so there is exactly one implementation of the
 * scan → resolve → update flow.
 */
export default function TransporterScanPage() {
  const navigate = useNavigate();
  const [scanned, setScanned] = useState('');

  const onDecoded = (text: string) => {
    // Accept the full payload URL (https://…/transport/TRQ-…) or a raw token.
    const m = text.trim().match(/transport\/([A-Za-z0-9_-]+)|^(TRQ-[A-Za-z0-9_-]+)$/i);
    const id = m ? (m[1] || m[2]) : '';
    if (!id) {
      setScanned(text.trim());
      return;
    }
    navigate(`/transport/${encodeURIComponent(id)}`);
  };

  return (
    <>
      <PageHeader
        title="Scan Transport QR"
        subtitle="Point the camera at the transport QR printed on the shipping box"
        crumbs={[{ label: 'Transporter' }, { label: 'Scan Transport QR' }]}
      />

      <section aria-label="Transport QR scanner" className="mx-auto max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <CameraScanner
          className="h-80"
          onDecoded={onDecoded}
          hint="Enable the camera and hold the phone steady over the QR on the box"
        />

        <div className="mt-4 flex items-start gap-3 rounded-xl bg-sky-50 p-3.5 text-xs text-sky-900">
          <Camera size={16} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
          <p>
            The transport QR answers <em>“where is this shipment now?”</em> — it is separate from the medicine
            authentication QR on the package, which verifies the medicine record instead.
          </p>
        </div>

        {scanned && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
            <ScanLine size={14} className="mr-1 inline" aria-hidden="true" />
            “<span className="font-mono">{scanned}</span>” is not a transport QR code. Scan the code printed on the
            shipping box (it starts with TRQ-).
          </p>
        )}
      </section>
    </>
  );
}
