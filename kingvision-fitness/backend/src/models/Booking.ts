import mongoose, { Document, Schema } from 'mongoose';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
] as const;

export interface IBooking extends Document {
  clientId: Schema.Types.ObjectId;
  trainerId: Schema.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Client is required'],
      index: true,
    },
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Trainer is required'],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      validate: {
        validator: function (this: IBooking, value: Date) {
          return !this.startTime || value > this.startTime;
        },
        message: 'End time must be after start time',
      },
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending',
      index: true,
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ trainerId: 1, startTime: 1 });
bookingSchema.index({ clientId: 1, startTime: -1 });
bookingSchema.index({ trainerId: 1, status: 1, startTime: 1 });

const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
