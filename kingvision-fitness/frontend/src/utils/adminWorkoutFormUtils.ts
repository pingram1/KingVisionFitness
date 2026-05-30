import type {
  CreateWorkoutPayload,
  DistributionType,
  ExerciseDraft,
  ExerciseEquipment,
  Workout,
  WorkoutDifficulty,
  WorkoutExercise,
  WorkoutType,
} from '../types/workout';
import {
  findInvalidMuscleGroupTokens,
  resolveTargetMuscleGroups,
} from '../constants/muscleGroups';
import { createDefaultExerciseList } from '../components/Admin/ExerciseBuilder';

export type AdminWorkoutFormState = {
  title: string;
  description: string;
  distributionType: DistributionType;
  videoUrl: string;
  duration: string;
  difficulty: WorkoutDifficulty;
  workoutType: WorkoutType;
  muscleFocus: string;
  weekNumber: string;
  dayOfWeek: string;
  intensity: string;
  volumeLoadIndex: string;
  cardiovascularStress: string;
  recoveryDemand: string;
};

export const EMPTY_ADMIN_WORKOUT_FORM: AdminWorkoutFormState = {
  title: '',
  description: '',
  distributionType: 'weekly_public',
  videoUrl: '',
  duration: '30',
  difficulty: 'beginner',
  workoutType: 'mixed',
  muscleFocus: 'full_body',
  weekNumber: '',
  dayOfWeek: '0',
  intensity: '5',
  volumeLoadIndex: '0.5',
  cardiovascularStress: '5',
  recoveryDemand: '5',
};

export function workoutExercisesToDrafts(exercises: WorkoutExercise[] | undefined): ExerciseDraft[] {
  if (!exercises?.length) return createDefaultExerciseList();

  return exercises.map((exercise) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: exercise.name ?? '',
    sets: String(exercise.sets ?? 1),
    targetType: exercise.duration && exercise.duration > 0 ? 'duration' : 'reps',
    targetValue:
      exercise.duration && exercise.duration > 0
        ? String(exercise.duration)
        : exercise.reps ?? '10',
    equipment: (exercise.equipment as ExerciseEquipment) ?? 'bodyweight',
    restTime:
      exercise.restTime != null
        ? typeof exercise.restTime === 'number'
          ? `${exercise.restTime}s`
          : String(exercise.restTime)
        : '60s',
    videoUrl: exercise.videoUrl ?? '',
  }));
}

export function workoutToFormState(workout: Workout): AdminWorkoutFormState {
  const muscleFocus = (workout.targetMuscleGroups ?? ['full_body']).join(', ');
  return {
    title: workout.title ?? '',
    description: workout.description ?? '',
    distributionType: workout.isCustom ? 'custom_client' : 'weekly_public',
    videoUrl: workout.videoUrl ?? '',
    duration: String(workout.duration ?? 30),
    difficulty: workout.difficulty ?? 'beginner',
    workoutType: workout.type ?? 'mixed',
    muscleFocus,
    weekNumber: workout.weekNumber != null ? String(workout.weekNumber) : '',
    dayOfWeek: workout.dayOfWeek != null ? String(workout.dayOfWeek) : '0',
    intensity: String(workout.metaTags?.intensity ?? 5),
    volumeLoadIndex: String(workout.metaTags?.volumeLoadIndex ?? 0.5),
    cardiovascularStress: String(workout.metaTags?.cardiovascularStress ?? 5),
    recoveryDemand: String(workout.metaTags?.recoveryDemand ?? 5),
  };
}

export function getAssignedClientId(workout: Workout): string | null {
  const assignees = workout.assignedTo ?? [];
  if (assignees.length === 0) return null;
  const first = assignees[0];
  if (typeof first === 'string') return first;
  return first._id ?? null;
}

export function validateAdminWorkoutForm(
  form: AdminWorkoutFormState,
  exercises: ExerciseDraft[],
  selectedClientId: string | null
): string | null {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.description.trim()) return 'Description is required.';
  const duration = parseInt(form.duration, 10);
  if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
    return 'Duration must be between 5 and 240 minutes.';
  }
  if (form.videoUrl.trim()) {
    try {
      // eslint-disable-next-line no-new
      new URL(form.videoUrl.trim());
    } catch {
      return 'Video URL must be a valid URL (https://...).';
    }
  }
  const invalidMuscleTokens = findInvalidMuscleGroupTokens(form.muscleFocus);
  if (invalidMuscleTokens.length > 0) {
    return `Invalid muscle group(s): ${invalidMuscleTokens.join(', ')}.`;
  }
  if (form.distributionType === 'custom_client' && !selectedClientId) {
    return 'Select an Active Client to assign this workout to.';
  }
  if (form.distributionType === 'weekly_public') {
    const week = parseInt(form.weekNumber, 10);
    if (!Number.isFinite(week) || week < 1 || week > 52) {
      return 'Week number must be between 1 and 52 for weekly workouts.';
    }
  }
  if (exercises.length === 0) return 'Add at least one exercise.';

  for (let i = 0; i < exercises.length; i += 1) {
    const exercise = exercises[i];
    if (!exercise.name.trim()) return `Exercise ${i + 1}: name is required.`;
    const sets = parseInt(exercise.sets, 10);
    if (!Number.isFinite(sets) || sets < 1) {
      return `Exercise ${i + 1}: sets must be at least 1.`;
    }
    if (!exercise.targetValue.trim()) {
      return `Exercise ${i + 1}: ${
        exercise.targetType === 'duration' ? 'target seconds' : 'reps'
      } are required.`;
    }
    if (exercise.targetType === 'duration') {
      const seconds = parseInt(exercise.targetValue, 10);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) {
        return `Exercise ${i + 1}: target hold must be 1–3600 seconds.`;
      }
    }
    if (exercise.videoUrl.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(exercise.videoUrl.trim());
      } catch {
        return `Exercise ${i + 1}: demo video URL must be valid.`;
      }
    }
  }
  return null;
}

export function buildAdminWorkoutPayload(
  form: AdminWorkoutFormState,
  exercises: ExerciseDraft[],
  selectedClientId: string | null
): CreateWorkoutPayload {
  const payload: CreateWorkoutPayload = {
    title: form.title.trim(),
    description: form.description.trim(),
    distributionType: form.distributionType,
    contentKind: 'workout',
    videoUrl: form.videoUrl.trim() || undefined,
    duration: parseInt(form.duration, 10),
    difficulty: form.difficulty,
    workoutType: form.workoutType,
    targetMuscleGroups: resolveTargetMuscleGroups(form.muscleFocus),
    metaTags: {
      intensity: parseInt(form.intensity, 10) || 5,
      volumeLoadIndex: parseFloat(form.volumeLoadIndex) || 0.5,
      cardiovascularStress: parseInt(form.cardiovascularStress, 10) || 5,
      recoveryDemand: parseInt(form.recoveryDemand, 10) || 5,
      skillComplexity: parseInt(form.intensity, 10) || 5,
      mobilityDemand: 5,
    },
    exercises: exercises.map((exercise) => {
      const base = {
        name: exercise.name.trim(),
        sets: parseInt(exercise.sets, 10),
        restTime: exercise.restTime.trim() || '60s',
        videoUrl: exercise.videoUrl.trim() || undefined,
        equipment: exercise.equipment,
      };
      if (exercise.targetType === 'duration') {
        return {
          ...base,
          reps: '1',
          duration: parseInt(exercise.targetValue, 10) || 60,
        };
      }
      return {
        ...base,
        reps: exercise.targetValue.trim(),
      };
    }),
    assignedTo:
      form.distributionType === 'custom_client' && selectedClientId
        ? [selectedClientId]
        : undefined,
  };

  if (payload.targetMuscleGroups.length === 0) {
    payload.targetMuscleGroups = ['full_body'];
  }

  if (form.distributionType === 'weekly_public') {
    payload.weekNumber = parseInt(form.weekNumber, 10);
    payload.dayOfWeek = parseInt(form.dayOfWeek, 10);
  }

  return payload;
}
