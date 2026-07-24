export const KG_TO_LBS = 2.20462;

type BodyWeightSource = {
  profile?: { initialWeight?: number | null };
  athleteStats?: { bodyWeight?: number | null };
  progressTracking?: Array<{ date?: Date | string; weight?: number | null }>;
};

/** Resolve body weight in lbs for curl volume scoring. */
export function resolveBodyWeightLbs(
  user: BodyWeightSource,
  overrideLbs?: number
): number | undefined {
  if (typeof overrideLbs === 'number' && overrideLbs > 0) {
    return overrideLbs;
  }

  const kg = user.profile?.initialWeight;
  if (typeof kg === 'number' && kg > 0) {
    return kg * KG_TO_LBS;
  }

  const athleteBw = user.athleteStats?.bodyWeight;
  if (typeof athleteBw === 'number' && athleteBw > 0) {
    return athleteBw;
  }

  const latestTracked = [...(user.progressTracking ?? [])]
    .filter((entry) => typeof entry.weight === 'number' && entry.weight > 0)
    .sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
    )[0];

  if (latestTracked?.weight) {
    return latestTracked.weight;
  }

  return undefined;
}
