export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface ScheduleUserSummary {
  _id: string;
  email: string;
  profile?: {
    firstName?: string;
    lastName?: string;
  };
}

export interface Booking {
  _id: string;
  clientId: ScheduleUserSummary | string;
  trainerId: ScheduleUserSummary | string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailabilitySlot {
  _id?: string;
  trainerId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
