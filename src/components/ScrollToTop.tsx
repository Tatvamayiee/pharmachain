import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Reloads restore the pre-reload scroll offset while the page's data is
// still loading, landing the user mid-page (or in stale empty space).
// Predictable behavior: every load starts at the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/**
 * Scrolls the main window back to the top on every route change.
 * Without this, navigating from a long page leaves the next page scrolled
 * to the previous offset — content appears "missing" under the fixed navbar
 * until the user scrolls.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Plain two-argument scrollTo: universally supported, always instant.
    // (The options-object form with behavior:'instant' throws TypeError in
    // engines whose ScrollBehavior enum predates 'instant'.)
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch { /* older engines: ignore */ }
  }, [pathname]);

  return null;
}
