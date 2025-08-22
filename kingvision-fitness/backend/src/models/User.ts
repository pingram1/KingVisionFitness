import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// User interface
export interface IUser extends Document {
  email: string;
  password: string;
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
  groups: Schema.Types.ObjectId[];
  customWorkouts: Schema.Types.ObjectId[];
  completedWorkouts: [{
    workoutId: Schema.Types.ObjectId;
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
    groups: [{
      type: Schema.Types.ObjectId,
      ref: 'Group'
    }],
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
userSchema.index({ email: 1 });
userSchema.index({ 'subscription.tier': 1, 'subscription.status': 1 });
userSchema.index({ groups: 1 });
userSchema.index({ 'trainer.isTrainer': 1 });
userSchema.index({ createdAt: -1 });

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
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      tier: this.subscription.tier,
      isTrainer: this.trainer?.isTrainer || false
    },
    process.env.JWT_SECRET || 'your-secret-key',
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function(): string {
  const refreshToken = jwt.sign(
    { _id: this._id },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    { expiresIn: '90d' }
  );
  
  // Store refresh token
  this.refreshTokens.push(refreshToken);
  
  // Limit stored refresh tokens to 5
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return refreshToken;
};

// Override toJSON to remove sensitive data
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokens;
  delete obj.__v;
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