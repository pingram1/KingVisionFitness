import mongoose, { Document, Schema } from 'mongoose';
import { customAlphabet } from 'nanoid';

// Generate unique 6-character invite codes (A–Z, 0–9)
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

// Post interface
export interface IPost {
  _id?: Schema.Types.ObjectId;
  author: Schema.Types.ObjectId;
  content: string;
  images?: string[];
  workoutCompleted?: {
    workoutId: Schema.Types.ObjectId;
    duration: number;
    calories?: number;
  };
  progressUpdate?: {
    weight?: number;
    measurements?: object;
    photos?: string[];
  };
  likes: Schema.Types.ObjectId[];
  comments: IComment[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** KingVision community tenancy — teams, staff bootcamps, or open communities */
export type GroupType = 'athletic_team' | 'bootcamp' | 'public_community';

/** Role within a team, bootcamp, or community — contextual per group membership */
export type GroupMemberRole = 'member' | 'athlete' | 'captain' | 'coach' | 'participant';

export interface IGroupMembership {
  user: Schema.Types.ObjectId;
  role: GroupMemberRole;
  joinedAt: Date;
  workoutsCompleted: number;
  totalMinutes: number;
  /** Community / bootcamp streak from GPS check-ins or attendance */
  streakCount: number;
  /** Team performance score 0–100 derived from workout stats */
  performanceGrade: number;
  /** Frozen sub-scores (strength/speed/endurance) for UI badges. */
  performanceBreakdown?: Record<string, unknown>;
  /** When the grade was last recomputed (e.g. after a coach combine update). */
  lastGradedAt?: Date;
  lastCheckInAt?: Date;
}

// Comment interface
export interface IComment {
  _id?: Schema.Types.ObjectId;
  author: Schema.Types.ObjectId;
  content: string;
  likes: Schema.Types.ObjectId[];
  createdAt: Date;
}

// Group interface
export interface IGroup extends Document {
  name: string;
  description: string;
  coverImage?: string;
  type: 'private' | 'public';
  /** Athletic team, staff bootcamp, or open community — not classroom tenancy */
  groupType: GroupType;
  /** @deprecated Use groupType; kept for legacy documents */
  category?: 'school' | 'corporate' | 'community' | 'challenge' | 'custom';
  /** Tenant bubble (org / KingCamp). Required when `bubbleIsolation` is true. */
  bubbleId?: Schema.Types.ObjectId;
  /**
   * When true, the group lives in a private bubble: list/search APIs MUST scope by `bubbleId`
   * so other schools / bubbles never see this data.
   */
  bubbleIsolation: boolean;
  inviteCode?: string;
  inviteLink?: string;
  /** Role-based roster: coaches assign workouts; athletes/participants log them */
  memberships: IGroupMembership[];
  /** Denormalized member ids for fast queries */
  members: Schema.Types.ObjectId[];
  /** Coach / moderator user ids (athletic teams) */
  coaches: Schema.Types.ObjectId[];
  /** GPS check-in anchor for public communities */
  location?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  /** Human-readable street address for community / bootcamp check-in locations */
  address?: string;
  /** Linked daily workouts for bootcamp archetype */
  bootcampWorkouts: Schema.Types.ObjectId[];
  /** Coach-cloned team workouts (athletic teams) */
  assignedWorkouts: Schema.Types.ObjectId[];
  pendingMembers: Schema.Types.ObjectId[]; // For private groups requiring approval
  bannedMembers: Schema.Types.ObjectId[];
  posts: IPost[];
  announcements: [{
    author: Schema.Types.ObjectId;
    title: string;
    content: string;
    createdAt: Date;
  }];
  challenges: [{
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    goal: string;
    participants: [{
      userId: Schema.Types.ObjectId;
      progress: number;
      completedAt?: Date;
    }];
    winner?: Schema.Types.ObjectId;
    isActive: boolean;
  }];
  weeklyWorkouts: Schema.Types.ObjectId[]; // Assigned weekly workouts for the group
  settings: {
    joinApproval: boolean; // Require admin approval to join
    postApproval: boolean; // Require approval for posts
    membersCanInvite: boolean;
    membersCanPost: boolean;
    maxMembers?: number;
    isArchived: boolean;
    visibility: 'visible' | 'hidden'; // Hidden groups don't appear in search
  };
  stats: {
    totalWorkoutsCompleted: number;
    totalWeightLost: number; // in kg
    averageWorkoutsPerWeek: number;
    mostActiveMembers: [{
      userId: Schema.Types.ObjectId;
      workoutCount: number;
    }];
  };
  tags: string[];
  rules?: string[];
  welcomeMessage?: string;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  generateInviteCode(): string;
  getMembership(userId: string): IGroupMembership | undefined;
  addMembership(userId: string, role?: GroupMemberRole): Promise<void>;
  addMember(userId: string, role?: GroupMemberRole): Promise<void>;
  removeMember(userId: string): Promise<void>;
  createPost(authorId: string, content: string, images?: string[]): Promise<void>;
  /** Coach/trainer — assigns team workouts, views aggregate progress */
  isCoach(userId: string): boolean;
  /** @deprecated Use isCoach */
  isGroupAdmin(userId: string): boolean;
  isAdmin(userId: string): boolean;
  isMember(userId: string): boolean;
  syncMemberIds(): void;
}

// Comment Schema (embedded)
const commentSchema = new Schema<IComment>({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Post Schema (embedded)
const postSchema = new Schema<IPost>({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: [2000, 'Post cannot exceed 2000 characters']
  },
  images: [{
    type: String,
    validate: {
      validator: function(images: string[]) {
        return images.length <= 10;
      },
      message: 'Cannot upload more than 10 images'
    }
  }],
  workoutCompleted: {
    workoutId: {
      type: Schema.Types.ObjectId,
      ref: 'Workout'
    },
    duration: Number,
    calories: Number
  },
  progressUpdate: {
    weight: Number,
    measurements: Schema.Types.Mixed,
    photos: [String]
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const membershipSchema = new Schema<IGroupMembership>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    workoutsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    streakCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    performanceGrade: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    performanceBreakdown: {
      type: Schema.Types.Mixed,
      default: null,
    },
    lastGradedAt: {
      type: Date,
      default: null,
    },
    lastCheckInAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

// Group Schema
const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Group description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    coverImage: String,
    type: {
      type: String,
      enum: ['private', 'public'],
      default: 'public'
    },
    groupType: {
      type: String,
      enum: ['athletic_team', 'bootcamp', 'public_community'],
      default: 'athletic_team',
      index: true,
    },
    category: {
      type: String,
      enum: ['school', 'corporate', 'community', 'challenge', 'custom'],
    },
    bubbleId: {
      type: Schema.Types.ObjectId,
      ref: 'Bubble',
      index: true,
    },
    bubbleIsolation: {
      type: Boolean,
      default: false,
      index: true,
    },
    inviteCode: {
      type: String,
      sparse: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 6,
      minlength: 6,
    },
    inviteLink: String,
    memberships: {
      type: [membershipSchema],
      default: [],
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    coaches: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      radiusMeters: { type: Number, min: 10, default: 150 },
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    bootcampWorkouts: [{
      type: Schema.Types.ObjectId,
      ref: 'Workout',
    }],
    assignedWorkouts: [{
      type: Schema.Types.ObjectId,
      ref: 'Workout',
    }],
    pendingMembers: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    bannedMembers: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    posts: [postSchema],
    announcements: [{
      author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      title: {
        type: String,
        required: true,
        maxlength: [200, 'Announcement title cannot exceed 200 characters']
      },
      content: {
        type: String,
        required: true,
        maxlength: [2000, 'Announcement content cannot exceed 2000 characters']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    challenges: [{
      title: {
        type: String,
        required: true
      },
      description: String,
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      goal: String,
      participants: [{
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        progress: {
          type: Number,
          default: 0
        },
        completedAt: Date
      }],
      winner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    weeklyWorkouts: [{
      type: Schema.Types.ObjectId,
      ref: 'Workout'
    }],
    settings: {
      joinApproval: {
        type: Boolean,
        default: false
      },
      postApproval: {
        type: Boolean,
        default: false
      },
      membersCanInvite: {
        type: Boolean,
        default: true
      },
      membersCanPost: {
        type: Boolean,
        default: true
      },
      maxMembers: {
        type: Number,
        min: [2, 'Group must allow at least 2 members'],
        max: [10000, 'Group cannot exceed 10000 members']
      },
      isArchived: {
        type: Boolean,
        default: false
      },
      visibility: {
        type: String,
        enum: ['visible', 'hidden'],
        default: 'visible'
      }
    },
    stats: {
      totalWorkoutsCompleted: {
        type: Number,
        default: 0
      },
      totalWeightLost: {
        type: Number,
        default: 0
      },
      averageWorkoutsPerWeek: {
        type: Number,
        default: 0
      },
      mostActiveMembers: [{
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        workoutCount: Number
      }]
    },
    tags: [String],
    rules: [String],
    welcomeMessage: {
      type: String,
      maxlength: [1000, 'Welcome message cannot exceed 1000 characters']
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

groupSchema.pre('validate', function (next) {
  if (this.bubbleIsolation && !this.bubbleId) {
    this.invalidate(
      'bubbleId',
      'bubbleId is required when bubbleIsolation is enabled (private bubble tenancy)'
    );
  }
  next();
});

// Indexes
groupSchema.index({ name: 'text', description: 'text' });
/** Invite codes are unique per bubble when set (private bubbles can reuse patterns across tenants). */
groupSchema.index(
  { bubbleId: 1, inviteCode: 1 },
  { unique: true, partialFilterExpression: { inviteCode: { $exists: true, $type: 'string' } } }
);
groupSchema.index({ bubbleId: 1, bubbleIsolation: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ 'memberships.user': 1 });
groupSchema.index({ 'memberships.role': 1 });
groupSchema.index({ type: 1, groupType: 1 });
groupSchema.index({ 'settings.visibility': 1, 'settings.isArchived': 1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ createdAt: -1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for post count
groupSchema.virtual('postCount').get(function() {
  return this.posts.length;
});

// Virtual for active challenges
groupSchema.virtual('activeChallenges').get(function() {
  return this.challenges.filter(c => c.isActive && new Date(c.endDate) > new Date());
});

// Generate unique invite code
groupSchema.methods.generateInviteCode = function(): string {
  const code = nanoid();
  this.inviteCode = code;
  this.inviteLink = `${process.env.APP_URL}/join/${code}`;
  return code;
};

groupSchema.methods.syncMemberIds = function (): void {
  this.members = this.memberships.map((m: IGroupMembership) => m.user);
  this.coaches = this.memberships
    .filter((m: IGroupMembership) => m.role === 'coach')
    .map((m: IGroupMembership) => m.user);
};

groupSchema.methods.getMembership = function (userId: string): IGroupMembership | undefined {
  const uid = userId.toString();
  return this.memberships.find((m: IGroupMembership) => m.user.toString() === uid);
};

groupSchema.methods.addMembership = async function (
  userId: string,
  role: GroupMemberRole = 'athlete'
): Promise<void> {
  const uid = userId.toString();
  if (this.getMembership(uid)) return;

  this.memberships.push({
    user: userId as unknown as Schema.Types.ObjectId,
    role,
    joinedAt: new Date(),
    workoutsCompleted: 0,
    totalMinutes: 0,
    streakCount: 0,
    performanceGrade: 0,
  });
  this.syncMemberIds();
  this.pendingMembers = this.pendingMembers.filter(
    (id: { toString: () => string }) => id.toString() !== uid
  );
  await this.save();
};

groupSchema.methods.addMember = async function (
  userId: string,
  role: GroupMemberRole = 'athlete'
): Promise<void> {
  return this.addMembership(userId, role);
};

groupSchema.methods.removeMember = async function (userId: string): Promise<void> {
  const uid = userId.toString();
  this.memberships = this.memberships.filter(
    (m: IGroupMembership) => m.user.toString() !== uid
  );
  this.syncMemberIds();
  await this.save();
};

// Create a new post
groupSchema.methods.createPost = async function(
  authorId: string,
  content: string,
  images?: string[]
): Promise<void> {
  const newPost = {
    author: authorId,
    content,
    images: images || [],
    likes: [],
    comments: [],
    isPinned: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  this.posts.unshift(newPost); // Add to beginning
  
  // Limit posts to 1000 most recent
  if (this.posts.length > 1000) {
    this.posts = this.posts.slice(0, 1000);
  }
  
  await this.save();
};

groupSchema.methods.isCoach = function (userId: string): boolean {
  const m = this.getMembership(userId);
  return m?.role === 'coach';
};

groupSchema.methods.isGroupAdmin = function (userId: string): boolean {
  return this.isCoach(userId);
};

groupSchema.methods.isAdmin = function (userId: string): boolean {
  return this.isCoach(userId);
};

groupSchema.methods.isMember = function (userId: string): boolean {
  const uid = userId.toString();
  if (this.getMembership(uid)) return true;
  return this.members.some((id: { toString: () => string }) => id.toString() === uid);
};

// Static method to find groups by user (memberships or legacy members[])
groupSchema.statics.findByUser = function (userId: string) {
  return this.find({
    $or: [{ 'memberships.user': userId }, { members: userId }],
    'settings.isArchived': false,
  });
};

// Static method to find public groups (never returns isolated bubble groups)
groupSchema.statics.findPublicGroups = function (limit = 20) {
  return this.find({
    type: 'public',
    'settings.visibility': 'visible',
    'settings.isArchived': false,
    bubbleIsolation: false,
  })
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(limit);
};

/** Lists active groups inside one tenant bubble — use for school/KingCamp scoped APIs. */
groupSchema.statics.findGroupsInBubble = function (
  bubbleId: string,
  filter: Record<string, unknown> = {}
) {
  return this.find({
    bubbleId,
    bubbleIsolation: true,
    'settings.isArchived': false,
    ...filter,
  });
};

interface IGroupModel extends mongoose.Model<IGroup> {
  findByUser(userId: string): mongoose.Query<IGroup[], IGroup>;
  findPublicGroups(limit?: number): mongoose.Query<IGroup[], IGroup>;
  findGroupsInBubble(
    bubbleId: string,
    filter?: Record<string, unknown>
  ): mongoose.Query<IGroup[], IGroup>;
}

const Group = mongoose.model<IGroup, IGroupModel>('Group', groupSchema);

export default Group;