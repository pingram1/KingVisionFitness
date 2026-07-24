import { calculateEverydayFitnessScore } from '../everydayFitnessScoring';
import { resolveBodyWeightLbs } from '../bodyWeight';

describe('resolveBodyWeightLbs', () => {
  it('prefers an explicit override when provided', () => {
    expect(resolveBodyWeightLbs({}, 185)).toBe(185);
  });

  it('converts profile initial weight from kg to lbs', () => {
    expect(resolveBodyWeightLbs({ profile: { initialWeight: 82 } })).toBeCloseTo(180.78, 1);
  });

  it('falls back to the latest progress-tracking entry in lbs', () => {
    expect(
      resolveBodyWeightLbs({
        profile: { initialWeight: null },
        progressTracking: [
          { date: '2026-07-01', weight: 160 },
          { date: '2026-07-08', weight: 170 },
        ],
      })
    ).toBe(170);
  });
});

describe('calculateEverydayFitnessScore strength pillar', () => {
  it('scores curls when body weight is available', () => {
    const breakdown = calculateEverydayFitnessScore(
      { curlsWeight: 30, curlsReps: 16 },
      170
    );

    expect(breakdown.strength).not.toBeNull();
    expect(breakdown.strength?.raw).toBeCloseTo(2.82, 2);
    expect(breakdown.strength?.score).toBeGreaterThan(90);
    expect(breakdown.weights.strength).toBeGreaterThan(0);
  });

  it('leaves strength null when body weight is missing', () => {
    const breakdown = calculateEverydayFitnessScore({ curlsWeight: 30, curlsReps: 16 });
    expect(breakdown.strength).toBeNull();
    expect(breakdown.weights.strength).toBe(0);
  });
});
