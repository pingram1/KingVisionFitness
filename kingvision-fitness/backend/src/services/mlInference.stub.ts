/**
 * Stubs for external ML backends. Replace implementations when wiring infra.
 */

export type InferenceClientName = 'sagemaker' | 'openai';

export interface WeeklyPlanMlRequest {
  userAnonymizedId: string;
  featureSummary: Record<string, number>;
  tier: string;
}

export interface WeeklyPlanMlResponse {
  /** Optional externally generated workout / meal identifiers */
  rankedWorkoutIds?: string[];
  rankedMealPlanIds?: string[];
  rawExplanation?: string;
}

/** SageMaker-hosted model (batch or endpoint) — not connected */
export async function invokeSageMakerWeeklyPlan(
  _request: WeeklyPlanMlRequest
): Promise<WeeklyPlanMlResponse | null> {
  if (!process.env.SAGEMAKER_ENDPOINT_NAME) {
    return null;
  }
  // const client = new SageMakerRuntimeClient({});
  // await client.send(new InvokeEndpointCommand({ ... }));
  return null;
}

/** OpenAI / other LLM for narrative plans — not connected */
export async function invokeOpenAiPlanCoach(
  _request: WeeklyPlanMlRequest & { locale?: string }
): Promise<WeeklyPlanMlResponse | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  // const OpenAI = require('openai');
  return null;
}
