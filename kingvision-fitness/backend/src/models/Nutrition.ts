import mongoose, { Document, Schema } from 'mongoose';

export type NutritionDistributionType = 'weekly_public' | 'custom_client';
export type NutritionPlanType = 'general_guide' | 'macro_plan';

export interface IMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface IMealEntry {
  name: string;
  time?: string;
  foodItems: string[];
}

export interface INutrition extends Document {
  title: string;
  description: string;
  /**
   * Distribution control mirrors the Workout content engine:
   * - `weekly_public` is surfaced to BASIC tier in the public library.
   * - `custom_client` is locked to ACTIVE_CLIENT users in `assignedTo`.
   */
  distributionType: NutritionDistributionType;
  /** Differentiates downloadable reference material from prescribed macro plans. */
  planType: NutritionPlanType;
  /** Optional asset (PDF/image) for general guides. */
  fileUrl?: string;
  /** Coach-prescribed macro targets for custom plans. */
  macros?: IMacros;
  /** Coach-scripted daily meal split for custom plans. */
  meals?: IMealEntry[];
  /** Client(s) the plan is assigned to (required when `custom_client`). */
  assignedTo: Schema.Types.ObjectId[];
  /** Trainer or admin who authored the plan. */
  createdBy: Schema.Types.ObjectId;
  /** Public weekly guides may be slotted by week. */
  weekNumber?: number;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const macrosSchema = new Schema<IMacros>(
  {
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fats: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const mealEntrySchema = new Schema<IMealEntry>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    time: { type: String, trim: true, maxlength: 20 },
    foodItems: {
      type: [String],
      default: [],
      validate: {
        validator: (items: string[]) => items.every((i) => i.trim().length > 0),
        message: 'Food items cannot be empty strings',
      },
    },
  },
  { _id: false }
);

const nutritionSchema = new Schema<INutrition>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    distributionType: {
      type: String,
      enum: ['weekly_public', 'custom_client'],
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: ['general_guide', 'macro_plan'],
      required: true,
      index: true,
    },
    fileUrl: { type: String, trim: true },
    macros: { type: macrosSchema, default: undefined },
    meals: { type: [mealEntrySchema], default: undefined },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    weekNumber: { type: Number, min: 1, max: 52 },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

nutritionSchema.pre<INutrition>('validate', function (next) {
  if (this.distributionType === 'custom_client' && this.assignedTo.length === 0) {
    return next(new Error('Custom client plans must include at least one assigned client'));
  }

  if (this.planType === 'macro_plan') {
    if (!this.macros) {
      return next(new Error('Macro plans require a macros object'));
    }
    if (!this.meals || this.meals.length === 0) {
      return next(new Error('Macro plans require at least one meal'));
    }
  }

  next();
});

nutritionSchema.index({ distributionType: 1, isActive: 1, createdAt: -1 });

const Nutrition = mongoose.model<INutrition>('Nutrition', nutritionSchema);
export default Nutrition;
