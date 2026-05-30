import {
  buildExerciseTemplateLookup,
  buildInitialLogState,
  computeWorkoutMetrics,
  extractErrorMessage,
  formatDurationLabel,
  formatElapsed,
  formatVolumeLbs,
  hasWorkoutDrift,
  normalizeExerciseKey,
  parseTargetReps,
  resolveExerciseTemplate,
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
      { name: 'Squat', sets: 3, reps: '8-12', equipment: 'barbell' } as any,
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

  it('prefills seconds for duration-based exercises and hides weight via default 0', () => {
    const result = buildInitialLogState([
      { name: 'Plank', sets: 2, reps: '1', duration: 60, equipment: 'bodyweight' } as any,
    ]);
    expect(result[0].sets[0]).toEqual({
      setIndex: 1,
      weight: '0',
      reps: '60',
      completed: false,
    });
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

describe('hasWorkoutDrift', () => {
  it('detects when the template version changed after the draft started', () => {
    expect(
      hasWorkoutDrift('2026-05-29T10:00:00.000Z', '2026-05-29T11:00:00.000Z')
    ).toBe(true);
  });
  it('returns false when timestamps match', () => {
    expect(
      hasWorkoutDrift('2026-05-29T10:00:00.000Z', '2026-05-29T10:00:00.000Z')
    ).toBe(false);
  });
  it('returns false when either timestamp is missing (legacy drafts)', () => {
    expect(hasWorkoutDrift(undefined, '2026-05-29T10:00:00.000Z')).toBe(false);
    expect(hasWorkoutDrift('2026-05-29T10:00:00.000Z', undefined)).toBe(false);
  });
});

describe('exercise template pairing', () => {
  it('pairs logged exercises to templates by normalized name', () => {
    const lookup = buildExerciseTemplateLookup([
      { name: 'Bench Press', sets: 3, reps: '8' } as any,
      { name: 'Row', sets: 3, reps: '10' } as any,
    ]);
    expect(normalizeExerciseKey('  Bench Press ')).toBe('bench press');
    expect(resolveExerciseTemplate({ name: 'bench press', sets: [] }, lookup)?.reps).toBe('8');
    expect(resolveExerciseTemplate({ name: 'Missing Move', sets: [] }, lookup)).toBeUndefined();
  });

  it('uses the first template when duplicate exercise names exist', () => {
    const lookup = buildExerciseTemplateLookup([
      { name: 'Curl', sets: 3, reps: '12' } as any,
      { name: 'curl', sets: 4, reps: '8' } as any,
    ]);
    expect(resolveExerciseTemplate({ name: 'Curl', sets: [] }, lookup)?.reps).toBe('12');
  });
});

describe('computeWorkoutMetrics', () => {
  it('sums volume for completed weighted sets only and counts finished exercises', () => {
    const metrics = computeWorkoutMetrics([
      {
        name: 'Squat',
        sets: [
          { setIndex: 1, weight: '135', reps: '10', completed: true },
          { setIndex: 2, weight: '135', reps: '8', completed: false },
        ],
      },
      {
        name: 'Pull-up',
        sets: [{ setIndex: 1, weight: '0', reps: '12', completed: true }],
      },
      {
        name: 'Bench',
        sets: [{ setIndex: 1, weight: '185', reps: '5', completed: true }],
      },
    ]);

    expect(metrics.completedSetCount).toBe(3);
    expect(metrics.totalSetCount).toBe(4);
    expect(metrics.totalVolume).toBe(135 * 10 + 185 * 5);
    expect(metrics.completedExerciseCount).toBe(2);
    expect(metrics.totalExerciseCount).toBe(3);
  });
});

describe('formatVolumeLbs', () => {
  it('formats thousands with a k suffix', () => {
    expect(formatVolumeLbs(12500)).toBe('12.5k lbs');
  });
  it('formats smaller values with locale grouping', () => {
    expect(formatVolumeLbs(2500)).toBe('2,500 lbs');
  });
});

describe('formatDurationLabel', () => {
  it('shows minutes under an hour', () => {
    expect(formatDurationLabel(42)).toBe('42 min');
  });
  it('shows hours and minutes for long sessions', () => {
    expect(formatDurationLabel(90)).toBe('1h 30m');
  });
});
