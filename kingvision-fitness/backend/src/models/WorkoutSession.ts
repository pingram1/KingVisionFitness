import mongoose, { Document, Schema } from 'mongoose';

export interface ILoggedSet {
  setIndex: number;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ILoggedExercise {
  name: string;
  sets: ILoggedSet[];
}

export interface IWorkoutSession extends Document {
  userId: Schema.Types.ObjectId;
  workoutId: Schema.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  loggedExercises: ILoggedExercise[];
  createdAt: Date;
  updatedAt: Date;
}

const loggedSetSchema = new Schema<ILoggedSet>(
  {
    setIndex: { type: Number, required: true, min: 0 },
    weight: { type: Number, default: 0, min: 0 },
    reps: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const loggedExerciseSchema = new Schema<ILoggedExercise>(
  {
    name: { type: String, required: true, trim: true },
    sets: { type: [loggedSetSchema], default: [] },
  },
  { _id: false }
);

const workoutSessionSchema = new Schema<IWorkoutSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workoutId: {
      type: Schema.Types.ObjectId,
      ref: 'Workout',
      required: true,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    loggedExercises: {
      type: [loggedExerciseSchema],
      default: [],
    },
  },
  { timestamps: true }
);

workoutSessionSchema.index({ userId: 1, endTime: -1 });
workoutSessionSchema.index({ workoutId: 1, endTime: -1 });

const WorkoutSession = mongoose.model<IWorkoutSession>(
  'WorkoutSession',
  workoutSessionSchema
);

export default WorkoutSession;
