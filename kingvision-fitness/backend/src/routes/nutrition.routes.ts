import express, { Router } from 'express';
import mongoose from 'mongoose';
import Nutrition, {
  type IMacros,
  type IMealEntry,
  type NutritionDistributionType,
  type NutritionPlanType,
} from '../models/Nutrition';
import User from '../models/User';
import { auth, authorizeRoles, requireSubscriptionTier } from '../middleware/auth';

const router: Router = express.Router();

const DISTRIBUTION_TYPES: NutritionDistributionType[] = ['weekly_public', 'custom_client'];
const PLAN_TYPES: NutritionPlanType[] = ['general_guide', 'macro_plan'];

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseMacros(input: unknown): IMacros | null {
  if (!input || typeof input !== 'object') return null;
  const { calories, protein, carbs, fats } = input as Record<string, unknown>;
  if (
    !isNonNegativeNumber(calories) ||
    !isNonNegativeNumber(protein) ||
    !isNonNegativeNumber(carbs) ||
    !isNonNegativeNumber(fats)
  ) {
    return null;
  }
  return { calories, protein, carbs, fats };
}

function parseMeals(input: unknown): IMealEntry[] | null {
  if (!Array.isArray(input)) return null;
  const meals: IMealEntry[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') return null;
    const { name, time, foodItems } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) return null;
    const items = Array.isArray(foodItems)
      ? foodItems.map((item) => String(item).trim()).filter(Boolean)
      : [];
    meals.push({
      name: name.trim(),
      time: typeof time === 'string' && time.trim() ? time.trim() : undefined,
      foodItems: items,
    });
  }
  return meals;
}

function formatNutritionSummary(doc: any) {
  return {
    _id: doc._id,
    title: doc.title,
    description: doc.description,
    distributionType: doc.distributionType,
    planType: doc.planType,
    fileUrl: doc.fileUrl ?? null,
    macros: doc.macros ?? null,
    meals: doc.meals ?? null,
    weekNumber: doc.weekNumber ?? null,
    tags: doc.tags ?? [],
    assignedTo: doc.assignedTo ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// @route   POST /api/nutrition
// @desc    Publish nutrition content (general guide or macro plan)
// @access  Private — SUPER_ADMIN or TRAINER
router.post(
  '/',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const {
        title,
        description,
        distributionType,
        planType,
        fileUrl,
        macros,
        meals,
        assignedTo,
        weekNumber,
        tags,
      } = req.body as {
        title?: string;
        description?: string;
        distributionType?: NutritionDistributionType;
        planType?: NutritionPlanType;
        fileUrl?: string;
        macros?: unknown;
        meals?: unknown;
        assignedTo?: unknown;
        weekNumber?: number;
        tags?: unknown;
      };

      if (!title?.trim() || !description?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title and description are required',
        });
      }

      if (!distributionType || !DISTRIBUTION_TYPES.includes(distributionType)) {
        return res.status(400).json({
          success: false,
          message: `distributionType must be one of: ${DISTRIBUTION_TYPES.join(', ')}`,
        });
      }

      if (!planType || !PLAN_TYPES.includes(planType)) {
        return res.status(400).json({
          success: false,
          message: `planType must be one of: ${PLAN_TYPES.join(', ')}`,
        });
      }

      const assignedIds: mongoose.Types.ObjectId[] = [];
      if (distributionType === 'custom_client') {
        if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Custom client plans require at least one assigned client',
          });
        }
        for (const id of assignedTo) {
          if (!mongoose.Types.ObjectId.isValid(String(id))) {
            return res.status(400).json({
              success: false,
              message: `Invalid client id: ${id}`,
            });
          }
          assignedIds.push(new mongoose.Types.ObjectId(String(id)));
        }

        const validClients = await User.find({
          _id: { $in: assignedIds },
          subscriptionTier: 'ACTIVE_CLIENT',
        }).select('_id');

        if (validClients.length !== assignedIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more assigned clients are invalid or not ACTIVE_CLIENT tier',
          });
        }
      }

      let parsedMacros: IMacros | undefined;
      let parsedMeals: IMealEntry[] | undefined;
      if (planType === 'macro_plan') {
        const macrosResult = parseMacros(macros);
        if (!macrosResult) {
          return res.status(400).json({
            success: false,
            message: 'Macro plans require calories, protein, carbs, and fats (non-negative numbers)',
          });
        }
        const mealsResult = parseMeals(meals);
        if (!mealsResult || mealsResult.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Macro plans require at least one meal with a name',
          });
        }
        parsedMacros = macrosResult;
        parsedMeals = mealsResult;
      } else if (macros) {
        const macrosResult = parseMacros(macros);
        if (macrosResult) parsedMacros = macrosResult;
      }

      const doc = await Nutrition.create({
        title: title.trim(),
        description: description.trim(),
        distributionType,
        planType,
        fileUrl: typeof fileUrl === 'string' && fileUrl.trim() ? fileUrl.trim() : undefined,
        macros: parsedMacros,
        meals: parsedMeals,
        assignedTo: assignedIds,
        createdBy: req.user._id,
        weekNumber: typeof weekNumber === 'number' ? weekNumber : undefined,
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      });

      res.status(201).json({
        success: true,
        message: 'Nutrition plan published',
        data: formatNutritionSummary(doc),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error creating nutrition plan';
      console.error('Create nutrition error:', error);
      res.status(500).json({ success: false, message });
    }
  }
);

// @route   GET /api/nutrition/weekly
// @desc    List weekly public nutrition guides (Basic tier library)
// @access  Public (auth optional)
router.get('/weekly', async (_req: any, res: any) => {
  try {
    const items = await Nutrition.find({
      distributionType: 'weekly_public',
      isActive: true,
    })
      .sort({ weekNumber: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      data: items.map(formatNutritionSummary),
    });
  } catch (error) {
    console.error('Fetch weekly nutrition error:', error);
    res.status(500).json({ success: false, message: 'Error fetching weekly guides' });
  }
});

// @route   GET /api/nutrition/custom
// @desc    Custom macro plans assigned to the logged-in active client
// @access  Private — ACTIVE_CLIENT
router.get(
  '/custom',
  auth,
  requireSubscriptionTier('ACTIVE_CLIENT'),
  async (req: any, res: any) => {
    try {
      const items = await Nutrition.find({
        distributionType: 'custom_client',
        assignedTo: req.user._id,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: items.map(formatNutritionSummary),
      });
    } catch (error) {
      console.error('Fetch custom nutrition error:', error);
      res.status(500).json({ success: false, message: 'Error fetching custom plans' });
    }
  }
);

// @route   GET /api/nutrition/admin/recent
// @desc    Recent nutrition publications for the Admin Content Studio
// @access  Private — SUPER_ADMIN or TRAINER
router.get(
  '/admin/recent',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 8, 50);
      const items = await Nutrition.find({ isActive: true })
        .populate('assignedTo', 'email profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: items.map((item: any) => ({
          ...formatNutritionSummary(item),
          assignedTo: (item.assignedTo ?? []).map((u: any) => ({
            _id: u?._id ?? u,
            email: u?.email ?? '',
            firstName: u?.profile?.firstName ?? '',
            lastName: u?.profile?.lastName ?? '',
          })),
        })),
      });
    } catch (error) {
      console.error('Fetch admin nutrition error:', error);
      res.status(500).json({ success: false, message: 'Error fetching nutrition plans' });
    }
  }
);

// @route   GET /api/nutrition/recipes
// @desc    Legacy recipe stub kept for backwards compatibility
// @access  Public
router.get('/recipes', async (_req: any, res: any) => {
  res.set('Deprecation', 'true');
  res.status(410).json({
    success: false,
    message: 'Legacy recipes endpoint removed — use GET /api/nutrition/weekly',
  });
});

// @route   GET /api/nutrition/meal-plans
// @desc    Legacy meal plan stub — removed
// @access  Private
router.get('/meal-plans', auth, async (_req: any, res: any) => {
  res.set('Deprecation', 'true');
  res.status(410).json({
    success: false,
    message: 'Legacy meal-plans endpoint removed — use GET /api/nutrition/custom',
  });
});

export default router;
