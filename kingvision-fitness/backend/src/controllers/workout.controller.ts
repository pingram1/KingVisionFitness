import mongoose from 'mongoose';
import Workout from '../models/Workout';
import User from '../models/User';
import { normalizeWorkoutExercises } from '../validators/workout.validators';

function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(52, Math.max(1, Math.ceil((days + start.getDay() + 1) / 7)));
}

/**
 * PUT /api/workouts/admin/:id
 * Updates the Workout template document only. WorkoutSession history is never
 * modified — completed sessions remain snapshots of what the client logged.
 */
export async function updateWorkoutAdmin(req: any, res: any): Promise<void> {
  try {
    const workoutId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(workoutId)) {
      res.status(400).json({ success: false, message: 'Invalid workout ID' });
      return;
    }

    const existing = await Workout.findById(workoutId);
    if (!existing || !existing.isActive) {
      res.status(404).json({ success: false, message: 'Workout not found' });
      return;
    }

    if (existing.tags?.includes('tutoring')) {
      res.status(400).json({
        success: false,
        message: 'Tutoring videos must be edited separately',
      });
      return;
    }

    const isOwner = existing.createdBy?.toString() === String(req.user._id);
    if (req.user.role !== 'SUPER_ADMIN' && !isOwner) {
      res.status(403).json({ success: false, message: 'Not authorized to edit this workout' });
      return;
    }

    const {
      title,
      description,
      distributionType,
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

    const resolvedWeekNumber =
      isPublic && typeof weekNumber === 'number'
        ? weekNumber
        : isPublic
          ? existing.weekNumber ?? getCurrentWeekNumber()
          : undefined;

    let normalizedExercises;
    try {
      normalizedExercises = normalizeWorkoutExercises(exercises, targetMuscleGroups, {
        isTutoring: false,
        fallbackVideoUrl: videoUrl || undefined,
      });
    } catch (normalizeError: any) {
      if (normalizeError.message === 'WORKOUT_REQUIRES_EXERCISES') {
        res.status(400).json({
          success: false,
          message: 'At least one exercise is required for workouts',
        });
        return;
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
        res.status(400).json({
          success: false,
          message: 'One or more assigned clients are invalid or not ACTIVE_CLIENT tier',
        });
        return;
      }
    }

    const updateFields = {
      title,
      description,
      type: workoutType,
      difficulty,
      duration,
      exercises: normalizedExercises,
      category: [isPublic ? 'weekly_public' : 'custom_client'],
      tags: ['workout', isPublic ? 'weekly' : 'custom'],
      weekNumber: resolvedWeekNumber,
      dayOfWeek: isPublic && typeof dayOfWeek === 'number' ? dayOfWeek : undefined,
      isPublic,
      isCustom,
      assignedTo: isCustom ? assignedTo : [],
      targetMuscleGroups,
      metaTags: {
        intensity: metaTags.intensity ?? existing.metaTags?.intensity ?? 5,
        volumeLoadIndex: metaTags.volumeLoadIndex ?? existing.metaTags?.volumeLoadIndex ?? 0.5,
        cardiovascularStress:
          metaTags.cardiovascularStress ?? existing.metaTags?.cardiovascularStress ?? 5,
        recoveryDemand: metaTags.recoveryDemand ?? existing.metaTags?.recoveryDemand ?? 5,
        skillComplexity: metaTags.skillComplexity ?? existing.metaTags?.skillComplexity ?? 5,
        mobilityDemand: metaTags.mobilityDemand ?? existing.metaTags?.mobilityDemand ?? 5,
      },
      videoUrl: videoUrl || undefined,
    };

    const updated = await Workout.findByIdAndUpdate(
      workoutId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'email profile.firstName profile.lastName')
      .lean();

    if (!updated) {
      res.status(404).json({ success: false, message: 'Workout not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Workout updated',
      data: updated,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Workout validation failed',
        errors: Object.values(error.errors).map((e: any) => ({
          field: e.path,
          message: e.message,
        })),
      });
      return;
    }

    console.error('Update workout error:', error);
    res.status(500).json({ success: false, message: 'Error updating workout' });
  }
}
