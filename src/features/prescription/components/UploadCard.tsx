// ---------------------------------------------------------------------------
// UploadCard — prescription file selection + local preview (session only).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, FileText, Lock, Upload, X } from 'lucide-react';
import {
  MAX_FILE_SIZE_MB, createLocalPreviewUrl, formatFileSize,
  normalizePrescriptionFile,
} from '../services/prescriptionService';
import { useCameraCapture } from '../../../shared/components/scanner/useCameraCapture';

interface UploadCardProps {
  file: File | null;
  fileUrl: string | null;
  error: string | null;
  onFileAccepted: (file: File, url: string) => void;
  onFileCleared: () => void;
  onError: (message: string | null) => void;
}

export default function UploadCard({
  file, fileUrl, error, onFileAccepted, onFileCleared, onError,
}: UploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cam = useCameraCapture();

  const accept = useCallback(async (f: File | null | undefined) => {
    onError(null);
    if (!f) return;
    // Normalize BEFORE accepting: sniff real bytes vs declared type. Correctly
    // typed files pass through untouched; mislabeled ones (screenshots saved
    // as .png but really WebP/AVIF/etc.) are re-typed or converted, so the
    // server's fail-closed validation never sees a mismatch.
    const norm = await normalizePrescriptionFile(f);
    if (!norm.ok) { onError(norm.error); return; }
    const url = createLocalPreviewUrl(norm.file);
    onFileAccepted(norm.file, url);
  }, [onError, onFileAccepted]);

  // Reset the input so re-choosing the same file still fires onChange.
  const clearFile = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
    onFileCleared();
  }, [onFileCleared]);

  const takePhoto = () => {
    const shot = cam.capture();
    if (shot) accept(shot);
  };

  // Stop the camera when a file is already chosen or the card unmounts.
  useEffect(() => {
    if (file && cam.active) cam.stop();
  }, [file, cam]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    accept(e.dataTransfer.files?.[0]);
  }, [accept]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="rx-upload-heading">
      <h2 id="rx-upload-heading" className="text-base font-semibold text-slate-900">Prescription upload</h2>
      <p className="mt-0.5 text-sm text-slate-500">PNG, JPG, JPEG or PDF — up to {MAX_FILE_SIZE_MB} MB.</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-700">
        <Lock size={13} aria-hidden="true" /> Secure prescription upload — encrypted at rest, analyzed via AI vision.
      </p>

      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-slate-50/60'}`}
        >
          <Upload size={28} className="text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-500">Drag &amp; drop the prescription file here, or</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <FileText size={15} aria-hidden="true" /> Browse Files
            </button>
            {cam.active ? (
              <button
                type="button"
                onClick={takePhoto}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
              >
                <Camera size={15} aria-hidden="true" /> Capture photo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void cam.start()}
                disabled={cam.starting}
                title="Capture the prescription with your device camera"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Camera size={15} aria-hidden="true" /> {cam.starting ? 'Starting camera…' : 'Camera'}
              </button>
            )}
          </div>
          {cam.active && (
            <div className="mt-4 w-full">
              <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-black">
                <video ref={cam.videoRef} playsInline muted className="max-h-72 w-full object-contain" aria-label="Live camera preview" />
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <button type="button" onClick={takePhoto} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
                  <Camera size={15} aria-hidden="true" /> Capture
                </button>
                <button type="button" onClick={cam.stop} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <CameraOff size={15} aria-hidden="true" /> Stop camera
                </button>
              </div>
            </div>
          )}
          {cam.error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cam.error}</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
            aria-label="Choose prescription file"
          />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {file.type === 'application/pdf' ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50 text-red-600" aria-hidden="true"><FileText size={24} /></span>
            ) : (
              <img src={fileUrl ?? ''} alt={`Preview of ${file.name}`} className="h-14 w-14 rounded-xl border border-slate-200 object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{formatFileSize(file.size)} · {file.type || 'unknown type'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                Replace file
              </button>
              <button
                type="button"
                onClick={clearFile}
                aria-label={`Remove ${file.name}`}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <X size={13} aria-hidden="true" /> Remove
              </button>
            </div>
          </div>
          {file.type !== 'application/pdf' && fileUrl && (
            <img src={fileUrl} alt={`Full preview of ${file.name}`} className="mt-3 max-h-72 w-full rounded-xl border border-slate-200 object-contain" />
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
            aria-label="Replace prescription file"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
