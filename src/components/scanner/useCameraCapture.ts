import { useCallback, useEffect, useRef, useState } from 'react';


/**
 * Camera capture hook for still photos (prescription capture).
 * Opens the camera, renders to a canvas, and returns JPEG File objects.
 */
export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setActive(true);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError') setError('Camera permission was denied. Allow camera access in your browser settings and try again.');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError('No camera was found on this device.');
      else setError('Camera could not be started. Check that another app is not using it.');
    } finally {
      setStarting(false);
    }
  }, []);

  /** Grab the current frame as a JPEG File, or null when not active. */
  const capture = useCallback((): File | null => {
    const video = videoRef.current;
    if (!active || !video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    const MAX = 2560;
    const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = canvas.toDataURL('image/jpeg', 0.92);
    const bin = atob(blob.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ts = new Date();
    const name = `prescription-capture-${ts.toISOString().replace(/[:.]/g, '-')}.jpg`;
    return new File([bytes], name, { type: 'image/jpeg' });
  }, [active]);

  // Attach the stream once the video element mounts after `active`.
  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { /* autoplay allowed after gesture */ });
    }
  }, [active]);

  useEffect(() => () => { stop(); }, [stop]);

  return { videoRef, active, starting, error, start, stop, capture };
}
