import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { logAppSession } from '../api/gamification';

/** Ignore blips shorter than this — accidental foregrounds add noise. */
const MIN_REPORTABLE_MINUTES = 1;

/**
 * Tracks foreground time via the AppState lifecycle and reports it to the
 * gamification engine when the app backgrounds (and on unmount). Mount once
 * on an always-present screen (HomeScreen).
 */
export function useAppUsageTracker(enabled: boolean) {
  const foregroundSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    foregroundSinceRef.current = Date.now();

    const flush = () => {
      const since = foregroundSinceRef.current;
      foregroundSinceRef.current = null;
      if (since === null) return;
      const minutes = Math.round((Date.now() - since) / 60000);
      if (minutes >= MIN_REPORTABLE_MINUTES) {
        logAppSession(minutes).catch(() => {
          // Usage logging is best-effort; never surface errors to the user.
        });
      }
    };

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        if (foregroundSinceRef.current === null) {
          foregroundSinceRef.current = Date.now();
        }
      } else {
        flush();
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      subscription.remove();
      flush();
    };
  }, [enabled]);
}
