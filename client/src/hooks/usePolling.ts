import { useEffect, useRef, useCallback } from 'react';

/**
 * usePolling — runs `callback` immediately on mount, then every `intervalMs`.
 * Stops when the component unmounts. Does NOT run if the tab is hidden.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    // Run immediately
    cbRef.current();

    const id = setInterval(() => {
      // Skip if user has navigated away (saves server load)
      if (document.hidden) return;
      cbRef.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);
}

/**
 * useAlertCount — polls /alerts every 60 seconds, returns current count.
 * Only fetches when user is DISPATCHER (caller must guard).
 */
import { useState } from 'react';
import { alertsApi } from '../api/alerts';

export function useAlertCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await alertsApi.list();
      setCount(res.count);
    } catch {
      // ignore — stale count is fine
    }
  }, [enabled]);

  usePolling(fetch, 60_000);

  return count;
}
