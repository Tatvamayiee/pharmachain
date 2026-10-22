import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { useQrScanner } from './useQrScanner';

interface CameraScannerProps {
  /** Height of the viewfinder area. */
  className?: string;
  /** Called with each successfully decoded code. */
  onDecoded: (text: string) => void;
  /** Optional caption shown in the placeholder state. */
  hint?: string;
}

/**
 * Live camera scanning panel — shared by QR verification, the Scan-QR modal
 * and the customer scan page. The camera starts only when the user asks for
 * it (browsers require a user gesture for the permissions prompt). Multiple
 * panels can coexist: opening one takes the camera over from another.
 */
export default function CameraScanner({ className = 'h-56', onDecoded, hint }: CameraScannerProps) {
  const { scanning, starting, error, start, stop, regionId } = useQrScanner(onDecoded);

  return (
    <div className={`${className} flex flex-col`}>
      <div className="relative min-h-0 flex-1">
        {/* html5-qrcode renders the video into this unique region */}
        <div
          id={regionId}
          className={`absolute inset-0 overflow-hidden rounded-xl border-2 ${error ? 'border-red-200' : 'border-indigo-200'}`}
        />

        {/* Placeholder / error overlay sits above the (empty) region until the camera starts */}
        {!scanning && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center ${error ? 'border-red-200 bg-red-50/80' : 'border-indigo-200 bg-indigo-50/80'}`}>
            {error ? (
              <>
                <CameraOff size={36} className="text-red-300" aria-hidden="true" />
                <p className="max-w-[260px] text-sm text-red-700">{error}</p>
              </>
            ) : (
              <>
                <ScanLine size={40} className="text-indigo-300" aria-hidden="true" />
                <p className="max-w-[220px] text-sm text-slate-500">{hint ?? 'Live camera scanning for QR codes on medicine packages'}</p>
              </>
            )}
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Camera size={15} aria-hidden="true" />
              {starting ? 'Starting camera…' : 'Enable camera'}
            </button>
          </div>
        )}
      </div>

      {scanning && (
        <button
          type="button"
          onClick={() => void stop()}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Stop camera
        </button>
      )}
    </div>
  );
}
