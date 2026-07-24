import { useCallback, useEffect, useState } from 'react';

import { fetchFitnessTrack } from '../api/everydayStats';
import type { AthleteDesignation, FitnessTrack } from '../types/athleteStats';

interface UseFitnessTrackResult {
  track: FitnessTrack;
  athleteDesignation: AthleteDesignation;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resolves athletic vs everyday track from the backend `/me/fitness-track`
 * endpoint (authoritative). Defaults to everyday when the API is unavailable.
 */
export function useFitnessTrack(): UseFitnessTrackResult {
  const [track, setTrack] = useState<FitnessTrack>('everyday');
  const [athleteDesignation, setAthleteDesignation] = useState<AthleteDesignation>('none');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const remote = await fetchFitnessTrack();
      setTrack(remote.track);
      setAthleteDesignation(remote.athleteDesignation);
    } catch {
      // Safe default — everyday clients must never be blocked from their test log.
      setTrack('everyday');
      setAthleteDesignation('none');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { track, athleteDesignation, loading, refresh };
}
