import {
  buildInitialLogState,
  extractErrorMessage,
  formatElapsed,
  parseTargetReps,
  sessionStorageKey,
  SESSION_TTL_MS,
} from './activeWorkoutHelpers';

describe('parseTargetReps', () => {
  it('returns the numeric portion of a range like "8-12"', () => {
    expect(parseTargetReps('8-12')).toBe('8');
  });
  it('returns the first number in free-form text like "AMRAP 30 seconds"', () => {
    expect(parseTargetReps('AMRAP 30 seconds')).toBe('30');
  });
  it('defaults to "10" when undefined', () => {
    expect(parseTargetReps(undefined)).toBe('10');
  });
  it('defaults to "10" when the input has no digits', () => {
    expect(parseTargetReps('max effort')).toBe('10');
  });
});

describe('buildInitialLogState', () => {
  it('creates one row per set with the parsed target reps', () => {
    const result = buildInitialLogState([
      { name: 'Squat', sets: 3, reps: '8-12' } as any,
    ]);
    expect(result).toEqual([
      {
        name: 'Squat',
        sets: [
          { setIndex: 1, weight: '', reps: '8', completed: false },
          { setIndex: 2, weight: '', reps: '8', completed: false },
          { setIndex: 3, weight: '', reps: '8', completed: false },
        ],
      },
    ]);
  });

  it('clamps set count to at least 1 when the template is missing or zero', () => {
    const result = buildInitialLogState([
      { name: 'Bench', reps: '5' } as any,
      { name: 'Curl', sets: 0 } as any,
    ]);
    expect(result[0].sets).toHaveLength(1);
    expect(result[1].sets).toHaveLength(1);
  });

  it('preserves order across multiple exercises', () => {
    const result = buildInitialLogState([
      { name: 'A', sets: 1 } as any,
      { name: 'B', sets: 2 } as any,
      { name: 'C', sets: 1 } as any,
    ]);
    expect(result.map((e) => e.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('formatElapsed', () => {
  it('zero-pads minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(5)).toBe('00:05');
    expect(formatElapsed(65)).toBe('01:05');
    expect(formatElapsed(3599)).toBe('59:59');
  });
  it('handles long sessions (over an hour displays as accumulated minutes)', () => {
    expect(formatElapsed(3600)).toBe('60:00');
    expect(formatElapsed(7322)).toBe('122:02');
  });
});

describe('extractErrorMessage', () => {
  it('extracts a message from an axios-shaped error', () => {
    const err = { response: { data: { message: 'Bad request' } } };
    expect(extractErrorMessage(err)).toBe('Bad request');
  });
  it('returns null when the error lacks a response', () => {
    expect(extractErrorMessage(new Error('boom'))).toBeNull();
  });
  it('returns null when the message is not a string', () => {
    const err = { response: { data: { message: ['array', 'of', 'errors'] } } };
    expect(extractErrorMessage(err)).toBeNull();
  });
  it('returns null for null / non-object inputs without throwing', () => {
    expect(extractErrorMessage(null)).toBeNull();
    expect(extractErrorMessage(undefined)).toBeNull();
    expect(extractErrorMessage('string')).toBeNull();
  });
});

describe('session persistence contract', () => {
  it('builds a namespaced key per workoutId', () => {
    expect(sessionStorageKey('w-123')).toBe('@kvf:active-workout:w-123');
  });
  it('TTL is exactly 24 hours', () => {
    expect(SESSION_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
