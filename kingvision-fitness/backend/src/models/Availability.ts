import mongoose, { Document, Schema } from 'mongoose';

export interface IAvailability extends Document {
  trainerId: Schema.Types.ObjectId;
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  /** Local wall-clock time, e.g. "09:00" */
  startTime: string;
  /** Local wall-clock time, e.g. "17:00" */
  endTime: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const availabilitySchema = new Schema<IAvailability>(
  {
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Trainer is required'],
      index: true,
    },
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: [0, 'Day must be 0–6'],
      max: [6, 'Day must be 0–6'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      validate: {
        validator: (value: string) => TIME_PATTERN.test(value),
        message: 'startTime must be HH:MM (24-hour)',
      },
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      validate: {
        validator: (value: string) => TIME_PATTERN.test(value),
        message: 'endTime must be HH:MM (24-hour)',
      },
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

availabilitySchema.index({ trainerId: 1, dayOfWeek: 1 }, { unique: true });

const Availability = mongoose.model<IAvailability>('Availability', availabilitySchema);

export default Availability;
