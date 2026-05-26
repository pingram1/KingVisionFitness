import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

export type SubscriptionTier = 'BASIC' | 'SPECIFIED' | 'ACTIVE_CLIENT';

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = [
  'BASIC',
  'SPECIFIED',
  'ACTIVE_CLIENT',
] as const;

/**
 * Platform-level Role-Based Access Control role.
 *
 * Keep this strictly separate from `subscriptionTier`, which gates *product*
 * features (Basic learning loop vs. premium channels). `role` gates *platform*
 * capabilities (admin portal, trainer tooling, etc.).
 *
 *  - SUPER_ADMIN: Owner / platform admin. Full access to the Admin Portal.
 *  - TRAINER:     Coach with elevated access to client/group management.
 *  - CLIENT:      Default end-user role.
 */
export type UserRole = 'SUPER_ADMIN' | 'TRAINER' | 'CLIENT';

export const USER_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'TRAINER', 'CLIENT'] as const;

export interface IUserMlProfile {
  /** Anonymized / bucketed metabolic heuristic for recommenders */
  metabolicTypeTag?: string | null;
  /** Smoothed adherence 0–1 from completed sessions */
  adherenceRate: number;
  /** Fixed-size embedding for cosine similarity (filled by batch job or on-device sync) */
  similarityVector: number[];
  vectorDimension: number;
  embeddingVersion: string;
  lastComputedAt?: Date | null;
  /** Free-form feature buckets (e.g. { sleep_debt: 0.2 }) */
  featureBuckets?: Record<string, number>;
}

export interface IPriorEngagement {
  workoutId: Schema.Types.ObjectId;
  residualScore: number;
  completedAt: Date;
  /** Snapshot of tag vector used when event was recorded */
  tagSnapshot?: number[];
}

/**
 * Raw athletic-combine measurements. Units are imperial (lbs, inches, seconds)
 * so the KingVision performance algorithm can apply ratios directly. All
 * fields are optional — partial submissions still yield a valid grade.
 */
export interface IAthleteStatHistoryEntry {
  date: Date;
  metric:
    | 'bodyWeight'
    | 'height'
    | 'squatMax'
    | 'benchMax'
    | 'deadliftMax'
    | 'pushUpCount'
    | 'sitUpCount'
    | 'fortyYardDash';
  oldValue: number | null;
  newValue: number;
}

export interface IAthleteStats {
  bodyWeight?: number;
  height?: number;
  squatMax?: number;
  benchMax?: number;
  deadliftMax?: number;
  pushUpCount?: number;
  sitUpCount?: number;
  fortyYardDash?: number;
  /** Cached overall grade (0-100). Derived; recomputed whenever stats change. */
  performanceGrade?: number;
  /** Frozen breakdown so the UI can show category scores without recomputing. */
  performanceBreakdown?: Record<string, unknown>;
  /** Append-only log of metric changes for coach progression views. */
  statHistory?: IAthleteStatHistoryEntry[];
  lastUpdatedAt?: Date;
}

// User interface
export interface IUser extends Document {
  email: string;
  password: string;
  /** Platform RBAC role — orthogonal to subscriptionTier. */
  role: UserRole;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    dateOfBirth?: Date;
    phone?: string;
    bio?: string;
    height?: number; // in cm
    initialWeight?: number; // in kg
    targetWeight?: number; // in kg
    fitnessGoals?: string[];
    fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  subscription: {
    tier: 'standard' | 'active-client';
    status: 'active' | 'inactive' | 'cancelled' | 'trial';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: Date;
    trialEndsAt?: Date;
  };
  /** Product / recommender tier — drives Basic learning loop vs premium channels */
  subscriptionTier: SubscriptionTier;
  /** Anonymized ML-facing profile; no PII */
  mlProfile: IUserMlProfile;
  /** Derived “residual” engagements for similarity (can be synced from completed workouts) */
  priorEngagements: IPriorEngagement[];
  /** Groups this user belongs to (teams, bootcamps, communities) */
  groups: Schema.Types.ObjectId[];
  /** Per-group role — a user may be a coach in one team and an athlete in another */
  groupMemberships: Array<{
    group: Schema.Types.ObjectId;
    role: 'member' | 'athlete' | 'captain' | 'coach' | 'participant';
    joinedAt: Date;
  }>;
  /** Combine-style measurements driving the team performance leaderboard. */
  athleteStats?: IAthleteStats;
  customWorkouts: Schema.Types.ObjectId[];
  completedWorkouts: [{
    workoutId: Schema.Types.ObjectId;
    sessionId?: Schema.Types.ObjectId;
    completedAt: Date;
    duration: number; // in minutes
    notes?: string;
  }];
  mealPlans: Schema.Types.ObjectId[];
  progressTracking: [{
    date: Date;
    weight?: number;
    bodyMeasurements?: {
      chest?: number;
      waist?: number;
      hips?: number;
      thighs?: number;
      arms?: number;
    };
    photos?: string[];
    notes?: string;
  }];
  notifications: {
    workoutReminders: boolean;
    mealReminders: boolean;
    groupActivity: boolean;
    directMessages: boolean;
    weeklyProgress: boolean;
  };
  settings: {
    units: 'metric' | 'imperial';
    language: string;
    timezone: string;
    privacy: {
      profileVisibility: 'public' | 'friends' | 'private';
      shareProgress: boolean;
      allowMessages: boolean;
    };
  };
  /** Expo push token for mobile alerts (admin / trainer devices). */
  expoPushToken?: string;
  trainer?: {
    isTrainer: boolean;
    specializations?: string[];
    certifications?: string[];
    yearsExperience?: number;
    clientIds?: Schema.Types.ObjectId[];
  };
  lastActive: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
  toJSON(): any;
}

const mlProfileSchema = new Schema<IUserMlProfile>(
  {
    metabolicTypeTag: { type: String, default: null },
    adherenceRate: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },
    similarityVector: { type: [Number], default: [] },
    vectorDimension: { type: Number, default: 16 },
    embeddingVersion: { type: String, default: 'kv-embed-v1' },
    lastComputedAt: { type: Date, default: null },
    featureBuckets: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const priorEngagementSchema = new Schema<IPriorEngagement>(
  {
    workoutId: { type: Schema.Types.ObjectId, ref: 'Workout', required: true },
    residualScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    completedAt: { type: Date, default: Date.now },
    tagSnapshot: [{ type: Number }],
  },
  { _id: false }
);

// User Schema
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'TRAINER', 'CLIENT'],
      default: 'CLIENT',
      required: true,
      index: true,
    },
    profile: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
      },
      avatar: {
        type: String,
        default: null
      },
      dateOfBirth: {
        type: Date,
        default: null
      },
      phone: {
        type: String,
        default: null
      },
      bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
      },
      height: {
        type: Number,
        min: [0, 'Height must be positive'],
        default: null
      },
      initialWeight: {
        type: Number,
        min: [0, 'Weight must be positive'],
        default: null
      },
      targetWeight: {
        type: Number,
        min: [0, 'Weight must be positive'],
        default: null
      },
      fitnessGoals: [{
        type: String,
        enum: ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility', 'general_fitness', 'sports_performance']
      }],
      fitnessLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
      }
    },
    subscription: {
      tier: {
        type: String,
        enum: ['standard', 'active-client'],
        default: 'standard'
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled', 'trial'],
        default: 'trial'
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      currentPeriodEnd: Date,
      trialEndsAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days trial
      }
    },
    subscriptionTier: {
      type: String,
      enum: ['BASIC', 'SPECIFIED', 'ACTIVE_CLIENT'],
      default: 'BASIC',
      index: true,
    },
    mlProfile: {
      type: mlProfileSchema,
      default: () => ({}),
    },
    priorEngagements: {
      type: [priorEngagementSchema],
      default: [],
    },
    groups: [{
      type: Schema.Types.ObjectId,
      ref: 'Group'
    }],
    groupMemberships: [{
      group: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
      },
      role: {
        type: String,
        enum: ['member', 'athlete', 'captain', 'coach', 'participant'],
        required: true,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    athleteStats: {
      bodyWeight: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      squatMax: { type: Number, min: 0 },
      benchMax: { type: Number, min: 0 },
      deadliftMax: { type: Number, min: 0 },
      pushUpCount: { type: Number, min: 0 },
      sitUpCount: { type: Number, min: 0 },
      fortyYardDash: { type: Number, min: 0 },
      performanceGrade: { type: Number, min: 0, max: 100, default: 0 },
      performanceBreakdown: { type: Schema.Types.Mixed, default: null },
      statHistory: [{
        date: { type: Date, default: Date.now },
        metric: {
          type: String,
          enum: [
            'bodyWeight',
            'height',
            'squatMax',
            'benchMax',
            'deadliftMax',
            'pushUpCount',
            'sitUpCount',
            'fortyYardDash',
          ],
          required: true,
        },
        oldValue: { type: Number, default: null },
        newValue: { type: Number, required: true },
      }],
      lastUpdatedAt: { type: Date, default: null },
    },
    customWorkouts: [{
      type: Schema.Types.ObjectId,
      ref: 'Workout'
    }],
    completedWorkouts: [{
      workoutId: {
        type: Schema.Types.ObjectId,
        ref: 'Workout',
        required: true
      },
      sessionId: {
        type: Schema.Types.ObjectId,
        ref: 'WorkoutSession',
        default: null,
      },
      completedAt: {
        type: Date,
        default: Date.now
      },
      duration: {
        type: Number,
        required: true,
        min: [0, 'Duration must be positive']
      },
      notes: String
    }],
    mealPlans: [{
      type: Schema.Types.ObjectId,
      ref: 'MealPlan'
    }],
    progressTracking: [{
      date: {
        type: Date,
        default: Date.now
      },
      weight: {
        type: Number,
        min: [0, 'Weight must be positive']
      },
      bodyMeasurements: {
        chest: Number,
        waist: Number,
        hips: Number,
        thighs: Number,
        arms: Number
      },
      photos: [String],
      notes: String
    }],
    notifications: {
      workoutReminders: {
        type: Boolean,
        default: true
      },
      mealReminders: {
        type: Boolean,
        default: true
      },
      groupActivity: {
        type: Boolean,
        default: true
      },
      directMessages: {
        type: Boolean,
        default: true
      },
      weeklyProgress: {
        type: Boolean,
        default: true
      }
    },
    settings: {
      units: {
        type: String,
        enum: ['metric', 'imperial'],
        default: 'metric'
      },
      language: {
        type: String,
        default: 'en'
      },
      timezone: {
        type: String,
        default: 'America/New_York'
      },
      privacy: {
        profileVisibility: {
          type: String,
          enum: ['public', 'friends', 'private'],
          default: 'public'
        },
        shareProgress: {
          type: Boolean,
          default: true
        },
        allowMessages: {
          type: Boolean,
          default: true
        }
      }
    },
    expoPushToken: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    trainer: {
      isTrainer: {
        type: Boolean,
        default: false
      },
      specializations: [String],
      certifications: [String],
      yearsExperience: Number,
      clientIds: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
      }]
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshTokens: [String]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
userSchema.index({ 'subscription.tier': 1, 'subscription.status': 1 });
userSchema.index({ groups: 1 });
userSchema.index({ 'trainer.isTrainer': 1 });
userSchema.index({ subscriptionTier: 1, createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function(): string {
  const payload = {
    _id: this._id.toString(),
    email: this.email,
    role: this.role,
    tier: this.subscription.tier,
    subscriptionTier: this.subscriptionTier,
    isTrainer: this.trainer?.isTrainer || false
  };
  
  const secret: string = process.env.JWT_SECRET || 'your-secret-key';
  const options = {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  } as jwt.SignOptions;
  
  return jwt.sign(payload, secret, options);
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function(): string {
  const payload = { _id: this._id.toString() };
  const secret: string = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  const options = { expiresIn: '90d' } as jwt.SignOptions;
  
  const refreshToken = jwt.sign(payload, secret, options);
  
  // Store refresh token
  this.refreshTokens.push(refreshToken);
  
  // Limit stored refresh tokens to 5
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return refreshToken;
};

// Override toJSON to remove sensitive data and guarantee RBAC fields are present.
// This is the single source of truth for the public user payload returned by
// /auth/login, /auth/register, and /users/profile. The frontend AuthContext
// relies on `role` and `subscriptionTier` being present on every response.
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokens;
  delete obj.__v;
  // Explicit RBAC contract — defaults guard against any legacy/partial docs
  // produced before the migration ran.
  obj.role = obj.role || 'CLIENT';
  obj.subscriptionTier = obj.subscriptionTier || 'BASIC';
  return obj;
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email: string, password: string) {
  const user = await this.findOne({ email }).select('+password');
  
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  const isPasswordMatch = await user.comparePassword(password);
  
  if (!isPasswordMatch) {
    throw new Error('Invalid login credentials');
  }
  
  return user;
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;