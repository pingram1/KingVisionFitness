import express, { Router } from 'express';
import mongoose from 'mongoose';
import Workout from '../models/Workout';
import WorkoutSession, { ILoggedExercise } from '../models/WorkoutSession';
import User from '../models/User';
import { auth, authorizeRoles } from '../middleware/auth';
import {
  createWorkoutValidators,
  normalizeWorkoutExercises,
} from '../validators/workout.validators';
import { updateWorkoutAdmin } from '../controllers/workout.controller';

const router: Router = express.Router();

function parseLoggedExercises(raw: unknown): ILoggedExercise[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((exercise) => {
      if (!exercise || typeof exercise !== 'object') return null;
      const name = String((exercise as { name?: unknown }).name ?? '').trim();
      if (!name) return null;

      const setsRaw = (exercise as { sets?: unknown }).sets;
      const sets = Array.isArray(setsRaw)
        ? setsRaw
            .map((set) => {
              if (!set || typeof set !== 'object') return null;
              const setIndex = Number((set as { setIndex?: unknown }).setIndex);
              const weight = Number((set as { weight?: unknown }).weight ?? 0);
              const reps = Number((set as { reps?: unknown }).reps ?? 0);
              const completed = Boolean((set as { completed?: unknown }).completed);
              if (!Number.isFinite(setIndex) || setIndex < 0) return null;
              return {
                setIndex,
                weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
                reps: Number.isFinite(reps) && reps >= 0 ? reps : 0,
                completed,
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null)
        : [];

      return { name, sets };
    })
    .filter((e): e is ILoggedExercise => e !== null);
}

async function userCanAccessWorkout(
  workout: InstanceType<typeof Workout>,
  userId: string
): Promise<boolean> {
  if (!workout.isActive) return false;
  if (workout.isPublic) return true;
  if (workout.isCustom) {
    return workout.assignedTo.some((id) => id.toString() === userId);
  }
  return workout.createdBy?.toString() === userId;
}

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(52, Math.max(1, Math.ceil((days + start.getDay() + 1) / 7)));
}

// @route   GET /api/workouts/weekly
// @desc    Get current week's public workouts
// @access  Public
router.get('/weekly', async (req: any, res: any) => {
  try {
    const parsed = req.query.weekNumber ? parseInt(String(req.query.weekNumber), 10) : NaN;
    const weekNumber = Number.isFinite(parsed) ? parsed : getCurrentWeekNumber();
    let workouts = await Workout.find({
      isPublic: true,
      isActive: true,
      weekNumber,
      tags: { $nin: ['tutoring'] },
    })
      .sort({ dayOfWeek: 1, title: 1 })
      .lean();

    if (workouts.length === 0 && !req.query.weekNumber) {
      workouts = await Workout.find({
        isPublic: true,
        isActive: true,
        tags: { $nin: ['tutoring'] },
      })
        .sort({ weekNumber: 1, dayOfWeek: 1, title: 1 })
        .lean();
    }

    res.json({
      success: true,
      data: workouts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly workouts',
    });
  }
});

// @route   GET /api/workouts/custom
// @desc    Get custom workouts assigned to the logged-in user
// @access  Private
router.get('/custom', auth, async (req: any, res: any) => {
  try {
    const workouts = await Workout.find({
      isCustom: true,
      assignedTo: req.user._id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: workouts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching custom workouts',
    });
  }
});

// @route   GET /api/workouts/published
// @desc    Recently published content (admin / trainer)
// @access  Private — SUPER_ADMIN | TRAINER
router.get(
  '/published',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const limitRaw = parseInt(String(req.query.limit ?? '8'), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 8;
      const kind = String(req.query.kind ?? 'all');

      const filter: Record<string, unknown> = { isActive: true };

      if (req.user.role !== 'SUPER_ADMIN') {
        filter.createdBy = req.user._id;
      }

      if (kind === 'tutoring') {
        filter.tags = 'tutoring';
      } else if (kind === 'workout') {
        filter.tags = { $nin: ['tutoring'] };
      }

      const workouts = await Workout.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title description duration difficulty isPublic isCustom videoUrl tags weekNumber dayOfWeek metaTags createdAt exercises assignedTo')
        .populate('assignedTo', 'email profile.firstName profile.lastName')
        .lean();

      res.json({
        success: true,
        data: workouts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching published content',
      });
    }
  }
);

// @route   PUT /api/workouts/admin/:id
// @desc    Update a published workout template (does not mutate WorkoutSession history)
// @access  Private — SUPER_ADMIN | TRAINER
router.put(
  '/admin/:id',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  createWorkoutValidators,
  updateWorkoutAdmin
);

// @route   POST /api/workouts/:id/complete
// @desc    Log a completed workout session with per-set data
// @access  Private
router.post('/:id/complete', auth, async (req: any, res: any) => {
  try {
    const workoutId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(workoutId)) {
      return res.status(400).json({ success: false, message: 'Invalid workout ID' });
    }

    const workout = await Workout.findById(workoutId);
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }

    const userId = String(req.user._id);
    if (!(await userCanAccessWorkout(workout, userId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this workout' });
    }

    const startTime = new Date(req.body.startTime ?? Date.now());
    const endTime = new Date(req.body.endTime ?? Date.now());
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startTime or endTime' });
    }
    if (endTime.getTime() < startTime.getTime()) {
      return res.status(400).json({ success: false, message: 'endTime must be after startTime' });
    }

    const loggedExercises = parseLoggedExercises(req.body.loggedExercises);
    const durationMinutes = Math.max(
      1,
      Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    );

    const session = await WorkoutSession.create({
      userId: req.user._id,
      workoutId: workout._id,
      startTime,
      endTime,
      durationMinutes,
      loggedExercises,
    });

    const user = await User.findById(req.user._id);
    if (user) {
      user.completedWorkouts.push({
        workoutId: workout._id as never,
        sessionId: session._id as never,
        completedAt: endTime,
        duration: durationMinutes,
      });
      await user.save();
    }

    workout.completionCount = (workout.completionCount ?? 0) + 1;
    await workout.save();

    return res.status(201).json({
      success: true,
      message: 'Workout logged successfully',
      data: {
        sessionId: session._id,
        workoutId: workout._id,
        durationMinutes,
        completedAt: endTime,
      },
    });
  } catch (error) {
    console.error('Complete workout error:', error);
    res.status(500).json({ success: false, message: 'Error logging workout completion' });
  }
});

// @route   GET /api/workouts/:id
// @desc    Get specific workout
// @access  Private
router.get('/:id', auth, async (req: any, res: any) => {
  try {
    const workout = await Workout.findById(req.params.id).lean();
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }

    const userId = String(req.user._id);
    const canAccess =
      workout.isActive &&
      (workout.isPublic ||
        (workout.isCustom &&
          (workout.assignedTo ?? []).some((id) => String(id) === userId)) ||
        String(workout.createdBy) === userId);

    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this workout' });
    }

    res.json({
      success: true,
      data: workout,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching workout',
    });
  }
});

// @route   POST /api/workouts
// @desc    Create workout or tutoring video (admin / trainer)
// @access  Private — SUPER_ADMIN | TRAINER
router.post(
  '/',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  createWorkoutValidators,
  async (req: any, res: any) => {
    try {
      const {
        title,
        description,
        distributionType,
        contentKind = 'workout',
        videoUrl,
        duration,
        difficulty,
        workoutType = 'mixed',
        targetMuscleGroups = ['full_body'],
        metaTags = {},
        weekNumber,
        dayOfWeek,
        assignedTo = [],
        exercises,
      } = req.body;

      const isPublic = distributionType === 'weekly_public';
      const isCustom = distributionType === 'custom_client';
      const isTutoring = contentKind === 'tutoring';

      const resolvedWeekNumber =
        isPublic && !isTutoring
          ? typeof weekNumber === 'number'
            ? weekNumber
            : getCurrentWeekNumber()
          : undefined;

      let normalizedExercises;
      try {
        normalizedExercises = normalizeWorkoutExercises(exercises, targetMuscleGroups, {
          isTutoring,
          fallbackVideoUrl: videoUrl || undefined,
        });
      } catch (normalizeError: any) {
        if (normalizeError.message === 'WORKOUT_REQUIRES_EXERCISES') {
          return res.status(400).json({
            success: false,
            message: 'At least one exercise is required for workouts',
          });
        }
        throw normalizeError;
      }

      if (isCustom) {
        const clientIds = Array.isArray(assignedTo) ? assignedTo : [];
        const validClients = await User.find({
          _id: { $in: clientIds },
          subscriptionTier: 'ACTIVE_CLIENT',
        }).select('_id');

        if (validClients.length !== clientIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more assigned clients are invalid or not ACTIVE_CLIENT tier',
          });
        }
      }

      const workout = new Workout({
        title,
        description,
        type: isTutoring ? 'mixed' : workoutType,
        difficulty,
        duration,
        exercises: normalizedExercises,
        category: isTutoring
          ? ['tutoring', 'basic_tier']
          : [isPublic ? 'weekly_public' : 'custom_client'],
        tags: isTutoring
          ? ['tutoring', 'basic_tier']
          : ['workout', isPublic ? 'weekly' : 'custom'],
        weekNumber: resolvedWeekNumber,
        dayOfWeek: isPublic && !isTutoring ? dayOfWeek : undefined,
        isPublic: isPublic || isTutoring,
        isCustom,
        createdBy: req.user._id,
        assignedTo: isCustom ? assignedTo : [],
        equipment: ['bodyweight'],
        location: 'any',
        targetMuscleGroups,
        metaTags: {
          intensity: metaTags.intensity ?? 5,
          volumeLoadIndex: metaTags.volumeLoadIndex ?? 0.5,
          cardiovascularStress: metaTags.cardiovascularStress ?? 5,
          recoveryDemand: metaTags.recoveryDemand ?? 5,
          skillComplexity: metaTags.skillComplexity ?? 5,
          mobilityDemand: metaTags.mobilityDemand ?? 5,
        },
        videoUrl: videoUrl || undefined,
        isActive: true,
      });

      await workout.save();

      res.status(201).json({
        success: true,
        message: isTutoring ? 'Tutoring video published' : 'Workout published',
        data: workout,
      });
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Workout validation failed',
          errors: Object.values(error.errors).map((e: any) => ({
            field: e.path,
            message: e.message,
          })),
        });
      }

      console.error('Create workout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating workout',
      });
    }
  }
);

export default router;
