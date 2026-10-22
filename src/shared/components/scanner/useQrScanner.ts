import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Module-level camera lock: browsers grant exclusive access to a camera
 * device, so a second live scanner (e.g. the Scan-QR modal over the verify
 * page) would hang forever waiting for the device. Starting a new scanner
 * therefore force-stops the previous one first and waits briefly while the
 * device is released.
 */
let activeStop: (() => void) | null = null;

/** getUserMedia can hang indefinitely when the camera is held by another
 *  app/tab; race it so the UI can surface an actionable message. */
const CAMERA_TIMEOUT_MS = 12_000;
function withTimeout<T>(p: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => {
      const err = new Error(message);
      err.name = 'TimeoutError';
      rej(err);
    }, CAMERA_TIMEOUT_MS)),
  ]);
}

export function useQrScanner(onDecoded: (text: string) => void) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Unique per component instance — two mounted scanners (page + modal) must
  // never share a DOM element id, or html5-qrcode binds to the wrong one.
  const regionId = `pc-qr-region-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const decodedRef = useRef(onDecoded);
  decodedRef.current = onDecoded;
  const stopRef = useRef<() => void>(() => {});

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try { await s.stop(); s.clear(); } catch { /* camera already gone */ }
    }
  }, []);

  stopRef.current = () => {
    if (activeStop === stopRef.current) activeStop = null;
    void stop();
  };

  const start = useCallback(async () => {
    setError(null);
    if (scannerRef.current) return;

    // Exclusive camera: take over from any other live scanner instance.
    if (activeStop && activeStop !== stopRef.current) {
      activeStop();
      // Let the previous session fully release the device before reopening.
      await new Promise((r) => setTimeout(r, 700));
    }

    setStarting(true);
    try {
      // Request the camera explicitly first so a permission denial produces a
      // clear message instead of an html5-qrcode internal error.
      let stream: MediaStream | null = null;
      try {
        stream = await withTimeout(
          navigator.mediaDevices.getUserMedia({ video: true }),
          'The camera did not start in time. It may be in use by another app or browser tab — close those and try again.'
        );
      } catch (permErr) {
        const name = (permErr as DOMException)?.name;
        if (name === 'TimeoutError') throw permErr; // keep the actionable timeout message
        if (name === 'NotAllowedError') throw new Error('Camera permission was denied. Allow camera access in your browser settings and try again.');
        if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new Error('No camera was found on this device.');
        throw new Error('Camera could not be started. Check that another app is not using it.');
      }
      stream.getTracks().forEach((t) => t.stop()); // release; html5-qrcode reopens it

      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;
      await withTimeout(
        scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decoded) => { decodedRef.current(decoded); },
          () => { /* per-frame no-code: ignore */ }
        ),
        'The camera did not start in time. It may be in use by another app or browser tab — close those and try again.'
      );
      setScanning(true);
      activeStop = stopRef.current;
    } catch (e) {
      scannerRef.current = null;
      setError(e instanceof Error ? e.message : 'Camera could not be started.');
      setScanning(false);
    } finally {
      setStarting(false);
    }
  }, [regionId]);

  // Stop the camera when the host unmounts or hides the scanner.
  useEffect(() => () => { stopRef.current(); }, []);

  return { scanning, starting, error, start, stop, regionId };
}
