import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const DEFAULT_STALE_MS = 30_000;

/**
 * Refetch when a tab/screen gains focus, but skip if data was loaded recently.
 * Prevents focus → fetch → state update → callback change → fetch loops that
 * trip the backend rate limiter (429).
 */
export function useFocusRefresh(
  refresh: (showFullScreenLoader: boolean) => void | Promise<void>,
  staleMs = DEFAULT_STALE_MS
): void {
  const lastRefreshRef = useRef(0);
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (hasLoadedRef.current && now - lastRefreshRef.current < staleMs) {
        return;
      }
      lastRefreshRef.current = now;
      const showLoader = !hasLoadedRef.current;
      hasLoadedRef.current = true;
      void refresh(showLoader);
    }, [refresh, staleMs])
  );
}

/** Call after pull-to-refresh so the next focus can still respect staleMs. */
export function markFocusRefreshed(lastRefreshRef: { current: number }): void {
  lastRefreshRef.current = Date.now();
}
