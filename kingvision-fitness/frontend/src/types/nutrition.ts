export type NutritionDistributionType = 'weekly_public' | 'custom_client';
export type NutritionPlanType = 'general_guide' | 'macro_plan';

export interface NutritionMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface NutritionMeal {
  name: string;
  time?: string;
  foodItems: string[];
}

export interface NutritionAssignee {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface NutritionPlan {
  _id: string;
  title: string;
  description: string;
  distributionType: NutritionDistributionType;
  planType: NutritionPlanType;
  fileUrl: string | null;
  macros: NutritionMacros | null;
  meals: NutritionMeal[] | null;
  weekNumber: number | null;
  tags: string[];
  assignedTo: NutritionAssignee[] | string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNutritionPayload {
  title: string;
  description: string;
  distributionType: NutritionDistributionType;
  planType: NutritionPlanType;
  fileUrl?: string;
  macros?: NutritionMacros;
  meals?: NutritionMeal[];
  assignedTo?: string[];
  weekNumber?: number;
  tags?: string[];
}
