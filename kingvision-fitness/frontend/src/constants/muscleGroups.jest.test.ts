import {
  MUSCLE_GROUP_ALIASES,
  MUSCLE_GROUP_OPTIONS,
  findInvalidMuscleGroupTokens,
  resolveTargetMuscleGroups,
} from './muscleGroups';

describe('resolveTargetMuscleGroups', () => {
  it('passes through valid individual groups', () => {
    expect(resolveTargetMuscleGroups('chest, shoulders')).toEqual(['chest', 'shoulders']);
  });

  it('expands upper_body alias to valid API muscle groups', () => {
    expect(resolveTargetMuscleGroups('upper_body')).toEqual([
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'lats',
    ]);
  });

  it('normalizes spaces to underscores', () => {
    expect(resolveTargetMuscleGroups('upper body')).toEqual([
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'lats',
    ]);
  });

  it('deduplicates overlapping tokens', () => {
    expect(resolveTargetMuscleGroups('chest, upper_body')).toEqual([
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'lats',
    ]);
  });
});

describe('findInvalidMuscleGroupTokens', () => {
  it('flags unknown tokens', () => {
    expect(findInvalidMuscleGroupTokens('chest, foo_bar')).toEqual(['foo_bar']);
  });

  it('accepts aliases and valid groups', () => {
    expect(findInvalidMuscleGroupTokens('upper_body, glutes')).toEqual([]);
  });
});

describe('muscle group constants', () => {
  it('includes full_body for backend parity', () => {
    expect(MUSCLE_GROUP_OPTIONS).toContain('full_body');
  });

  it('defines upper_body alias', () => {
    expect(MUSCLE_GROUP_ALIASES.upper_body.length).toBeGreaterThan(0);
  });
});
