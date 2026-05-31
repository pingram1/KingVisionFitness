export interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  thighs?: number;
  arms?: number;
}

export interface ProgressEntry {
  date: string;
  weight?: number;
  bodyMeasurements?: BodyMeasurements;
  notes?: string;
}

export interface LogProgressPayload {
  weight?: number;
  bodyMeasurements?: BodyMeasurements;
  notes?: string;
}
