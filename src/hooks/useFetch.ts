import { useCallback, useEffect, useState } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  /** Alias of retry — refetches from the source (post-mutation refresh). */
  refetch: () => void;
}

/**
 * Fetches data via the given async loader with loading/error/retry handling.
 * Used by every page for consistent loading skeletons, empty states and
 * error panels. `immediate=false` supports on-demand loading.
 */
export function useFetch<T>(loader: () => Promise<T>, immediate = true): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const retry = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!immediate && tick === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, immediate]);

  return { data, loading, error, retry, refetch: retry };
}
