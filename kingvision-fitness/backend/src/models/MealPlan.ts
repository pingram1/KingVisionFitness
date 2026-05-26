import mongoose, { Document, Schema } from 'mongoose';

export type MealPlanMetaTags = {
  satietyIndex: number;
  proteinDensity: number;
  carbLoadIndex: number;
  fiberScore: number;
  prepTimeMinutes: number;
  sodiumAware: boolean;
  culturalTags?: string[];
};

export interface IMealPlan extends Document {
  title: string;
  description: string;
  /** Searchable lexical tags plus meta for recommenders */
  tags: string[];
  metaTags: MealPlanMetaTags;
  calorieTargetDaily?: number;
  meals?: Array<{ name: string; notes?: string; caloriesApprox?: number }>;
  weekNumber?: number;
  dayOfWeek?: number;
  isPublic: boolean;
  isCustom: boolean;
  createdBy: Schema.Types.ObjectId;
  assignedTo: Schema.Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mealPlanMetaTagsSchema = new Schema<MealPlanMetaTags>(
  {
    satietyIndex: { type: Number, default: 0.5, min: 0, max: 1 },
    proteinDensity: { type: Number, default: 0.5, min: 0, max: 1 },
    carbLoadIndex: { type: Number, default: 0.5, min: 0, max: 1 },
    fiberScore: { type: Number, default: 0.5, min: 0, max: 1 },
    prepTimeMinutes: { type: Number, default: 25, min: 0 },
    sodiumAware: { type: Boolean, default: false },
    culturalTags: [{ type: String }],
  },
  { _id: false }
);

const mealPlanSchema = new Schema<IMealPlan>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: { type: String, default: '', maxlength: 800 },
    tags: [String],
    metaTags: { type: mealPlanMetaTagsSchema, default: () => ({}) },
    calorieTargetDaily: { type: Number, min: 0 },
    meals: [
      {
        name: { type: String, required: true },
        notes: String,
        caloriesApprox: Number,
      },
    ],
    weekNumber: { type: Number, min: 1, max: 53 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    isPublic: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

mealPlanSchema.index({ isPublic: 1, weekNumber: 1, dayOfWeek: 1 });
mealPlanSchema.index({ assignedTo: 1 });
mealPlanSchema.index({ tags: 1 });
mealPlanSchema.index({
  'metaTags.satietyIndex': 1,
  'metaTags.proteinDensity': 1,
});

const MealPlan = mongoose.model<IMealPlan>('MealPlan', mealPlanSchema);
export default MealPlan;
