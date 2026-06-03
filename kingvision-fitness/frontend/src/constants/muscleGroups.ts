/** Must stay in sync with backend `muscleGroupOptions` in workout.validators.ts */
export const MUSCLE_GROUP_OPTIONS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
  'lower_back',
  'traps',
  'lats',
  'full_body',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUP_OPTIONS)[number];

/** Shorthand presets trainers often type — expanded to valid API muscle groups. */
export const MUSCLE_GROUP_ALIASES: Record<string, readonly MuscleGroup[]> = {
  upper_body: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'lats'],
  lower_body: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'lats', 'biceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  core: ['abs', 'obliques', 'lower_back'],
};

export const MUSCLE_GROUP_PRESETS: { label: string; groups: MuscleGroup[] }[] = [
  { label: 'Full Body', groups: ['full_body'] },
  { label: 'Upper Body', groups: [...MUSCLE_GROUP_ALIASES.upper_body] },
  { label: 'Lower Body', groups: [...MUSCLE_GROUP_ALIASES.lower_body] },
  { label: 'Push', groups: [...MUSCLE_GROUP_ALIASES.push] },
  { label: 'Pull', groups: [...MUSCLE_GROUP_ALIASES.pull] },
  { label: 'Legs', groups: [...MUSCLE_GROUP_ALIASES.legs] },
];

const VALID_SET = new Set<string>(MUSCLE_GROUP_OPTIONS);

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse comma-separated muscle focus text into API-valid targetMuscleGroups.
 * Expands aliases like `upper_body` and drops duplicates.
 */
export function resolveTargetMuscleGroups(raw: string): MuscleGroup[] {
  const tokens = raw
    .split(',')
    .map(normalizeToken)
    .filter(Boolean);

  const resolved = new Set<MuscleGroup>();

  for (const token of tokens) {
    const alias = MUSCLE_GROUP_ALIASES[token];
    if (alias) {
      alias.forEach((group) => resolved.add(group));
      continue;
    }
    if (VALID_SET.has(token)) {
      resolved.add(token as MuscleGroup);
    }
  }

  return Array.from(resolved);
}

/** Returns unrecognized tokens so the form can show a helpful validation error. */
export function findInvalidMuscleGroupTokens(raw: string): string[] {
  const tokens = raw
    .split(',')
    .map(normalizeToken)
    .filter(Boolean);

  return tokens.filter((token) => !MUSCLE_GROUP_ALIASES[token] && !VALID_SET.has(token));
}
