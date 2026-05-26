import mongoose, { Document, Schema } from 'mongoose';

// Exercise interface
export interface IExercise {
  name: string;
  sets: number;
  reps: string; // Can be a range like "8-12" or specific number
  duration?: number; // in seconds, for time-based exercises
  restTime?: number; // in seconds
  weight?: string; // Can be percentage like "70% 1RM" or specific
  videoUrl?: string;
  thumbnailUrl?: string;
  notes?: string;
  muscleGroups: string[];
  equipment?: string;
  alternatives?: string[];
}

// Workout meta-tags for retrieval / cosine features (indexed for recommenders)
export interface IWorkoutMetaTags {
  /** 1–10 perceived exertion scaffold */
  intensity: number;
  /** Normalized approximate tonnage complexity */
  volumeLoadIndex: number;
  /** 1–10 cardiovascular stress */
  cardiovascularStress: number;
  /** 1–10 recovery debt */
  recoveryDemand: number;
  /** 1–10 coordination / technique load */
  skillComplexity?: number;
  mobilityDemand?: number;
}

// Workout interface
export interface IWorkout extends Document {
  title: string;
  description: string;
  type: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'functional' | 'mixed';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // estimated duration in minutes
  exercises: IExercise[];
  warmup?: IExercise[];
  cooldown?: IExercise[];
  category: string[]; // e.g., ['upper body', 'push', 'chest focused']
  tags: string[]; // searchable tags
  weekNumber?: number; // For weekly workout programs
  dayOfWeek?: number; // 0-6, Sunday to Saturday
  isPublic: boolean; // Whether it's part of the weekly public workouts
  isCustom: boolean; // Whether it's a custom plan for specific clients
  createdBy: Schema.Types.ObjectId; // Trainer who created it
  assignedTo: Schema.Types.ObjectId[]; // Clients assigned to this workout
  equipment: string[]; // List of equipment needed
  location: 'gym' | 'home' | 'outdoor' | 'any';
  calories?: number; // Estimated calories burned
  targetMuscleGroups: string[];
  metaTags: IWorkoutMetaTags;
  instructions?: string; // General workout instructions
  videoUrl?: string; // Full workout video if available
  thumbnailUrl?: string;
  completionCount: number; // Track how many times completed
  averageRating: number;
  ratings: [{
    userId: Schema.Types.ObjectId;
    rating: number;
    comment?: string;
    date: Date;
  }];
  isActive: boolean; // For enabling/disabling workouts
  scheduledDate?: Date; // For scheduled workouts
  createdAt: Date;
  updatedAt: Date;
}

// Exercise Schema (embedded document)
const exerciseSchema = new Schema<IExercise>({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true
  },
  sets: {
    type: Number,
    required: [true, 'Number of sets is required'],
    min: [1, 'Must have at least 1 set']
  },
  reps: {
    type: String,
    required: [true, 'Reps are required']
  },
  duration: {
    type: Number,
    min: [0, 'Duration must be positive']
  },
  restTime: {
    type: Number,
    default: 60, // 60 seconds default rest
    min: [0, 'Rest time must be positive']
  },
  weight: String,
  videoUrl: String,
  thumbnailUrl: String,
  notes: String,
  muscleGroups: [{
    type: String,
    enum: [
      'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
      'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
      'lower_back', 'traps', 'lats', 'full_body'
    ]
  }],
  equipment: {
    type: String,
    enum: [
      'barbell', 'dumbbell', 'kettlebell', 'resistance_band', 'cable',
      'machine', 'bodyweight', 'medicine_ball', 'stability_ball', 'trx',
      'pull_up_bar', 'bench', 'box', 'none'
    ]
  },
  alternatives: [String]
}, { _id: false });

const workoutMetaTagsSchema = new Schema<IWorkoutMetaTags>(
  {
    intensity: { type: Number, default: 5, min: 1, max: 10 },
    volumeLoadIndex: { type: Number, default: 0.5, min: 0, max: 1 },
    cardiovascularStress: { type: Number, default: 5, min: 1, max: 10 },
    recoveryDemand: { type: Number, default: 5, min: 1, max: 10 },
    skillComplexity: { type: Number, default: 5, min: 1, max: 10 },
    mobilityDemand: { type: Number, default: 5, min: 1, max: 10 },
  },
  { _id: false }
);

// Workout Schema
const workoutSchema = new Schema<IWorkout>(
  {
    title: {
      type: String,
      required: [true, 'Workout title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Workout description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    type: {
      type: String,
      enum: ['strength', 'cardio', 'hiit', 'flexibility', 'functional', 'mixed'],
      required: [true, 'Workout type is required']
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: [true, 'Difficulty level is required']
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [5, 'Workout must be at least 5 minutes'],
      max: [240, 'Workout cannot exceed 4 hours']
    },
    exercises: {
      type: [exerciseSchema],
      required: [true, 'At least one exercise is required'],
      validate: {
        validator: function(exercises: IExercise[]) {
          return exercises.length > 0;
        },
        message: 'Workout must have at least one exercise'
      }
    },
    warmup: [exerciseSchema],
    cooldown: [exerciseSchema],
    category: [{
      type: String,
      required: true
    }],
    tags: [String],
    weekNumber: {
      type: Number,
      min: [1, 'Week number must be at least 1'],
      max: [52, 'Week number cannot exceed 52']
    },
    dayOfWeek: {
      type: Number,
      min: [0, 'Day must be between 0-6'],
      max: [6, 'Day must be between 0-6']
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    isCustom: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required']
    },
    assignedTo: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    equipment: [{
      type: String,
      enum: [
        'barbell', 'dumbbell', 'kettlebell', 'resistance_band', 'cable',
        'machine', 'bodyweight', 'medicine_ball', 'stability_ball', 'trx',
        'pull_up_bar', 'bench', 'box', 'none'
      ]
    }],
    location: {
      type: String,
      enum: ['gym', 'home', 'outdoor', 'any'],
      default: 'any'
    },
    calories: {
      type: Number,
      min: [0, 'Calories must be positive']
    },
    targetMuscleGroups: [{
      type: String,
      enum: [
        'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
        'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
        'lower_back', 'traps', 'lats', 'full_body'
      ]
    }],
    metaTags: { type: workoutMetaTagsSchema, default: () => ({}) },
    instructions: {
      type: String,
      maxlength: [2000, 'Instructions cannot exceed 2000 characters']
    },
    videoUrl: String,
    thumbnailUrl: String,
    completionCount: {
      type: Number,
      default: 0,
      min: [0, 'Completion count cannot be negative']
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot exceed 5']
    },
    ratings: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      rating: {
        type: Number,
        required: true,
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
      },
      comment: {
        type: String,
        maxlength: [500, 'Comment cannot exceed 500 characters']
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    },
    scheduledDate: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
workoutSchema.index({ createdBy: 1, isCustom: 1 });
workoutSchema.index({ assignedTo: 1 });
workoutSchema.index({ isPublic: 1, weekNumber: 1, dayOfWeek: 1 });
workoutSchema.index({ type: 1, difficulty: 1 });
workoutSchema.index({ tags: 1 });
workoutSchema.index({ targetMuscleGroups: 1 });
workoutSchema.index({ 'metaTags.intensity': 1, difficulty: 1 });
workoutSchema.index({ 'metaTags.recoveryDemand': 1 });

// Virtual for total exercise count
workoutSchema.virtual('totalExercises').get(function() {
  return this.exercises.length + (this.warmup?.length || 0) + (this.cooldown?.length || 0);
});

// Virtual for estimated total time (including rest)
workoutSchema.virtual('estimatedTotalTime').get(function() {
  let totalTime = 0;
  
  // Calculate time for main exercises
  this.exercises.forEach(exercise => {
    if (exercise.duration) {
      totalTime += exercise.duration * exercise.sets;
    } else {
      // Estimate 45 seconds per set if not time-based
      totalTime += 45 * exercise.sets;
    }
    // Add rest time between sets
    totalTime += (exercise.restTime || 60) * (exercise.sets - 1);
  });
  
  // Add time for warmup and cooldown
  [...(this.warmup || []), ...(this.cooldown || [])].forEach(exercise => {
    if (exercise.duration) {
      totalTime += exercise.duration;
    } else {
      totalTime += 45 * exercise.sets;
    }
  });
  
  return Math.ceil(totalTime / 60); // Return in minutes
});

// Method to add rating
workoutSchema.methods.addRating = async function(userId: string, rating: number, comment?: string) {
  // Check if user already rated
  const existingRatingIndex = this.ratings.findIndex(
    (r: any) => r.userId.toString() === userId
  );
  
  if (existingRatingIndex > -1) {
    // Update existing rating
    this.ratings[existingRatingIndex] = {
      userId,
      rating,
      comment,
      date: new Date()
    };
  } else {
    // Add new rating
    this.ratings.push({
      userId,
      rating,
      comment,
      date: new Date()
    });
  }
  
  // Recalculate average rating
  const totalRating = this.ratings.reduce((sum: number, r: any) => sum + r.rating, 0);
  this.averageRating = totalRating / this.ratings.length;
  
  return this.save();
};

// Method to increment completion count
workoutSchema.methods.incrementCompletionCount = async function() {
  this.completionCount += 1;
  return this.save();
};

// Static method to get weekly workouts
workoutSchema.statics.getWeeklyWorkouts = function(weekNumber: number) {
  return this.find({
    isPublic: true,
    weekNumber: weekNumber,
    isActive: true
  }).sort({ dayOfWeek: 1 });
};

// Static method to get custom workouts for a user
workoutSchema.statics.getCustomWorkoutsForUser = function(userId: string) {
  return this.find({
    isCustom: true,
    assignedTo: userId,
    isActive: true
  }).sort({ createdAt: -1 });
};

const Workout = mongoose.model<IWorkout>('Workout', workoutSchema);

export default Workout;