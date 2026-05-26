import {
  calculatePerformanceGrade,
  performanceGradeNumber,
  type AthleteStats,
} from '../performanceScoring';

describe('calculatePerformanceGrade', () => {
  it('returns a zeroed result when bodyWeight is missing or non-positive', () => {
    const noBodyWeight = calculatePerformanceGrade({});
    expect(noBodyWeight.overall).toBe(0);
    expect(noBodyWeight.strength).toBeNull();
    expect(noBodyWeight.speed).toBeNull();
    expect(noBodyWeight.endurance).toBeNull();

    const negative = calculatePerformanceGrade({ bodyWeight: -100, squatMax: 300 });
    expect(negative.overall).toBe(0);

    const zero = calculatePerformanceGrade({ bodyWeight: 0, squatMax: 300 });
    expect(zero.overall).toBe(0);
  });

  it('returns 0 overall when bodyWeight is present but no category produced a score', () => {
    const result = calculatePerformanceGrade({ bodyWeight: 180 });
    expect(result.overall).toBe(0);
    expect(result.weights).toEqual({ strength: 0, speed: 0, endurance: 0 });
    expect(result.strength).toBeNull();
    expect(result.endurance).toBeNull();
    expect(result.speed).toBeNull();
  });

  it('scores a 185 lb athlete squatting 315 (1.70× BW) at the advanced strength tier', () => {
    const result = calculatePerformanceGrade({ bodyWeight: 185, squatMax: 315 });
    expect(result.squat).not.toBeNull();
    expect(result.squat!.raw).toBeCloseTo(1.7, 1);
    expect(result.squat!.score).toBeGreaterThanOrEqual(60);
    expect(result.squat!.score).toBeLessThanOrEqual(80);
    expect(result.squat!.tier).toBe('baseline');
    expect(result.strength!.score).toBe(result.squat!.score);
    expect(result.overall).toBeCloseTo(result.strength!.score, 0);
    expect(result.weights).toEqual({ strength: 1, speed: 0, endurance: 0 });
  });

  it('beats a heavier athlete with a worse bodyweight ratio (per the algorithm spec)', () => {
    const lighter = performanceGradeNumber({ bodyWeight: 185, squatMax: 315 });
    const heavier = performanceGradeNumber({ bodyWeight: 300, squatMax: 365 });
    expect(lighter).toBeGreaterThan(heavier);
  });

  it('clamps category scores into [0, 100]', () => {
    const ultra = calculatePerformanceGrade({
      bodyWeight: 200,
      squatMax: 1000,
      benchMax: 700,
      deadliftMax: 1200,
      pushUpCount: 500,
      sitUpCount: 500,
      fortyYardDash: 4.0,
    });
    expect(ultra.overall).toBeLessThanOrEqual(100);
    expect(ultra.squat!.score).toBeLessThanOrEqual(100);
    expect(ultra.deadlift!.score).toBeLessThanOrEqual(100);
    expect(ultra.pushUps!.score).toBeLessThanOrEqual(100);

    const weak = calculatePerformanceGrade({
      bodyWeight: 200,
      squatMax: 1,
      benchMax: 1,
      deadliftMax: 1,
      pushUpCount: 0.1,
      sitUpCount: 0.1,
      fortyYardDash: 30,
    });
    expect(weak.overall).toBeGreaterThanOrEqual(0);
  });

  it('redistributes weights when only some categories are present', () => {
    const strengthOnly = calculatePerformanceGrade({
      bodyWeight: 180,
      squatMax: 270,
      benchMax: 180,
      deadliftMax: 315,
    });
    expect(strengthOnly.weights).toEqual({ strength: 1, speed: 0, endurance: 0 });
    expect(strengthOnly.overall).toBeCloseTo(strengthOnly.strength!.score, 0);

    const strengthAndEndurance = calculatePerformanceGrade({
      bodyWeight: 180,
      squatMax: 270,
      pushUpCount: 40,
    });
    expect(strengthAndEndurance.weights.strength).toBeCloseTo(0.4 / 0.7, 3);
    expect(strengthAndEndurance.weights.endurance).toBeCloseTo(0.3 / 0.7, 3);
    expect(strengthAndEndurance.weights.speed).toBe(0);
  });

  it('boosts push-up score for heavier athletes (mass-adjusted endurance)', () => {
    const lightAthlete = calculatePerformanceGrade({ bodyWeight: 180, pushUpCount: 40 });
    const heavyAthlete = calculatePerformanceGrade({ bodyWeight: 250, pushUpCount: 40 });
    expect(heavyAthlete.pushUps!.score).toBeGreaterThan(lightAthlete.pushUps!.score);
  });

  it('caps the mass boost so a 600 lb athlete does not exploit endurance', () => {
    const moderatelyHeavy = calculatePerformanceGrade({ bodyWeight: 330, pushUpCount: 40 });
    const absurdlyHeavy = calculatePerformanceGrade({ bodyWeight: 600, pushUpCount: 40 });
    // +15% cap kicks in at ~330 lb. After that, more bodyweight should not
    // grant additional boost.
    expect(absurdlyHeavy.pushUps!.score).toBeCloseTo(moderatelyHeavy.pushUps!.score, 1);
  });

  it('penalises slow 40-yard times via the Powerball Index', () => {
    const fast = performanceGradeNumber({ bodyWeight: 200, fortyYardDash: 4.4 });
    const slow = performanceGradeNumber({ bodyWeight: 200, fortyYardDash: 6.0 });
    expect(fast).toBeGreaterThan(slow);
  });

  it('rewards heavier athletes for matching speed (mass-adjusted)', () => {
    const lighterSameTime = performanceGradeNumber({ bodyWeight: 160, fortyYardDash: 4.8 });
    const heavierSameTime = performanceGradeNumber({ bodyWeight: 250, fortyYardDash: 4.8 });
    expect(heavierSameTime).toBeGreaterThan(lighterSameTime);
  });

  it('ignores zero and negative inputs in individual categories instead of crashing', () => {
    const result = calculatePerformanceGrade({
      bodyWeight: 180,
      squatMax: 0,
      benchMax: -50,
      deadliftMax: 405,
      pushUpCount: NaN,
      sitUpCount: 50,
      fortyYardDash: -1,
    });
    expect(result.squat).toBeNull();
    expect(result.bench).toBeNull();
    expect(result.deadlift).not.toBeNull();
    expect(result.pushUps).toBeNull();
    expect(result.sitUps).not.toBeNull();
    expect(result.speed).toBeNull();
    expect(Number.isFinite(result.overall)).toBe(true);
  });

  it('assigns the elite tier only at scores >= 88', () => {
    const elite = calculatePerformanceGrade({
      bodyWeight: 180,
      squatMax: 396, // 2.2× BW
    });
    expect(elite.squat!.score).toBeCloseTo(100, 0);
    expect(elite.squat!.tier).toBe('elite');

    const advanced = calculatePerformanceGrade({
      bodyWeight: 180,
      squatMax: 333, // 1.85× BW → score 75
    });
    expect(advanced.squat!.tier).toBe('advanced');
  });

  it('produces a stable result given identical inputs (no hidden randomness)', () => {
    const stats: AthleteStats = {
      bodyWeight: 200,
      squatMax: 405,
      benchMax: 275,
      deadliftMax: 500,
      pushUpCount: 50,
      sitUpCount: 60,
      fortyYardDash: 4.65,
    };
    const a = calculatePerformanceGrade(stats);
    const b = calculatePerformanceGrade(stats);
    expect(a).toEqual(b);
  });
});

describe('performanceGradeNumber', () => {
  it('returns the same number as calculatePerformanceGrade(...).overall', () => {
    const stats: AthleteStats = {
      bodyWeight: 200,
      squatMax: 405,
      pushUpCount: 50,
    };
    expect(performanceGradeNumber(stats)).toBe(calculatePerformanceGrade(stats).overall);
  });
});
