import api from '../services/api';
import type { NutritionPlan } from '../types/nutrition';

/** Public weekly nutrition guides for Basic-tier library. */
export async function fetchWeeklyNutritionGuides(): Promise<NutritionPlan[]> {
  const response = await api.get<{ success: boolean; data: NutritionPlan[] }>(
    '/nutrition/weekly'
  );
  return response.data.data ?? [];
}

/** Custom macro plans assigned to the logged-in Active Client. */
export async function fetchCustomNutritionPlans(): Promise<NutritionPlan[]> {
  const response = await api.get<{ success: boolean; data: NutritionPlan[] }>(
    '/nutrition/custom'
  );
  return response.data.data ?? [];
}
