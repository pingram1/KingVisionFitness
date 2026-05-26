import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import type { IExercise } from '../models/Workout';

export const muscleGroupOptions = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body',
] as const;

export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  return next();
}

/** Parse "60", "60s", or numeric seconds into restTime (seconds). */
export function parseRestTimeSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase().replace(/s$/, '');
    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 60;
}

type RawExerciseInput = {
  name?: string;
  sets?: number | string;
  reps?: number | string;
  restTime?: number | string;
  videoUrl?: string;
  muscleGroups?: string[];
  equipment?: string;
};

/** Map validated request exercises into Mongoose-ready exercise documents. */
export function normalizeWorkoutExercises(
  rawExercises: RawExerciseInput[] | undefined,
  targetMuscleGroups: string[],
  options: { isTutoring: boolean; fallbackVideoUrl?: string }
): IExercise[] {
  const muscleFallback =
    targetMuscleGroups.length > 0 ? targetMuscleGroups : ['full_body'];

  if (options.isTutoring) {
    if (Array.isArray(rawExercises) && rawExercises.length > 0) {
      return rawExercises.map((ex) => ({
        name: String(ex.name).trim(),
        sets: typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets), 10) || 1,
        reps: String(ex.reps ?? '1'),
        restTime: parseRestTimeSeconds(ex.restTime),
        muscleGroups: ex.muscleGroups?.length ? ex.muscleGroups : muscleFallback,
        equipment: ex.equipment || 'bodyweight',
        videoUrl: ex.videoUrl || options.fallbackVideoUrl || undefined,
      }));
    }

    return [
      {
        name: 'Tutorial Session',
        sets: 1,
        reps: '1',
        restTime: 0,
        muscleGroups: muscleFallback,
        equipment: 'bodyweight',
        videoUrl: options.fallbackVideoUrl || undefined,
      },
    ];
  }

  if (!Array.isArray(rawExercises) || rawExercises.length === 0) {
    throw new Error('WORKOUT_REQUIRES_EXERCISES');
  }

  return rawExercises.map((ex) => ({
    name: String(ex.name).trim(),
    sets: typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets), 10),
    reps: String(ex.reps),
    restTime: parseRestTimeSeconds(ex.restTime),
    muscleGroups: ex.muscleGroups?.length ? ex.muscleGroups : muscleFallback,
    equipment: ex.equipment || 'bodyweight',
    videoUrl: ex.videoUrl || undefined,
  }));
}

export const createWorkoutValidators = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('distributionType')
    .isIn(['weekly_public', 'custom_client'])
    .withMessage('distributionType must be weekly_public or custom_client'),
  body('contentKind')
    .optional()
    .isIn(['workout', 'tutoring'])
    .withMessage('contentKind must be workout or tutoring'),
  body('videoUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('videoUrl must be a valid URL'),
  body('duration')
    .isInt({ min: 5, max: 240 })
    .withMessage('duration must be between 5 and 240 minutes'),
  body('difficulty')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('difficulty must be beginner, intermediate, or advanced'),
  body('workoutType')
    .optional()
    .isIn(['strength', 'cardio', 'hiit', 'flexibility', 'functional', 'mixed'])
    .withMessage('Invalid workoutType'),
  body('targetMuscleGroups')
    .optional()
    .isArray({ min: 1 })
    .withMessage('targetMuscleGroups must be a non-empty array'),
  body('targetMuscleGroups.*')
    .optional()
    .isIn([...muscleGroupOptions])
    .withMessage('Invalid muscle group'),
  body('metaTags.intensity')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('metaTags.intensity must be 1–10'),
  body('metaTags.volumeLoadIndex')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('metaTags.volumeLoadIndex must be 0–1'),
  body('metaTags.cardiovascularStress')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('metaTags.cardiovascularStress must be 1–10'),
  body('metaTags.recoveryDemand')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('metaTags.recoveryDemand must be 1–10'),
  body('metaTags.skillComplexity')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('metaTags.skillComplexity must be 1–10'),
  body('metaTags.mobilityDemand')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('metaTags.mobilityDemand must be 1–10'),
  body('weekNumber')
    .optional()
    .isInt({ min: 1, max: 52 })
    .withMessage('weekNumber must be 1–52'),
  body('dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('dayOfWeek must be 0–6'),
  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('assignedTo must be an array'),
  body('assignedTo.*')
    .optional()
    .isMongoId()
    .withMessage('Each assignedTo entry must be a valid user ID'),
  body('assignedTo').custom((value, { req }) => {
    if (req.body?.distributionType === 'custom_client') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('assignedTo must contain at least one client ID for custom_client workouts');
      }
    }
    return true;
  }),
  body('exercises')
    .optional()
    .isArray()
    .withMessage('exercises must be an array'),
  body('exercises.*.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Exercise name is required')
    .isLength({ max: 100 })
    .withMessage('Exercise name cannot exceed 100 characters'),
  body('exercises.*.sets')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Exercise sets must be at least 1'),
  body('exercises.*.reps')
    .optional()
    .notEmpty()
    .withMessage('Exercise reps are required'),
  body('exercises.*.restTime')
    .optional(),
  body('exercises.*.videoUrl')
    .optional({ values: 'falsy' })
    .trim()
    .isURL()
    .withMessage('Exercise videoUrl must be a valid URL'),
  body('exercises').custom((value, { req }) => {
    const contentKind = req.body?.contentKind ?? 'workout';
    if (contentKind === 'tutoring') {
      return true;
    }
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('At least one exercise is required for workouts');
    }
    value.forEach((exercise: RawExerciseInput, index: number) => {
      if (!exercise?.name || typeof exercise.name !== 'string' || !exercise.name.trim()) {
        throw new Error(`exercises[${index}].name is required`);
      }
      const sets = typeof exercise.sets === 'number'
        ? exercise.sets
        : parseInt(String(exercise.sets), 10);
      if (!Number.isFinite(sets) || sets < 1) {
        throw new Error(`exercises[${index}].sets must be at least 1`);
      }
      if (
        exercise.reps === undefined ||
        exercise.reps === null ||
        String(exercise.reps).trim() === ''
      ) {
        throw new Error(`exercises[${index}].reps is required`);
      }
    });
    return true;
  }),
  handleValidationErrors,
];
