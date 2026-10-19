import { useMemo } from 'react';
import qrcode from 'qrcode';

/**
 * Real QR encoding via the `qrcode` package. The matrix produced here is a
 * genuine, scannable QR code containing the payload — replacing the old
 * decorative pseudo-random matrix that no scanner could read.
 */
export function useQrMatrix(payload: string) {
  return useMemo(() => {
    if (!payload) return { size: 0, data: new Uint8Array(0) };
    const qr = qrcode.create(payload, { errorCorrectionLevel: 'M' });
    // `modules.data` is the raw bit matrix; some @types versions type it as
    // never[] so route through unknown to the real Uint8Array.
    return { size: qr.modules.size, data: qr.modules.data as unknown as Uint8Array };
  }, [payload]);
}

/** True when the module at (row, col) is dark. */
export function moduleAt(m: { size: number; data: Uint8Array }, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= m.size || col >= m.size) return false;
  return m.data[row * m.size + col] === 1;
}
