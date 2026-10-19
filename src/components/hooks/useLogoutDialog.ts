import { useCallback, useState } from 'react';

/**
 * Small helper hook that owns the open/close/confirm flow of the logout
 * confirmation dialog. Pass a callback to run after the user confirms.
 */
export function useLogoutDialog(onConfirm: () => void) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const confirm = useCallback(() => {
    setIsOpen(false);
    onConfirm();
  }, [onConfirm]);

  return { isOpen, open, close, confirm };
}
