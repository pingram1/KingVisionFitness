import mongoose, { Document, Schema } from 'mongoose';
import { customAlphabet } from 'nanoid';

// Generate unique invite codes
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

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
  category: 'school' | 'corporate' | 'community' | 'challenge' | 'custom';
  /** Tenant bubble (school / KingCamp). Required when `bubbleIsolation` is true. */
  bubbleId?: Schema.Types.ObjectId;
  /**
   * When true, the group lives in a private bubble: list/search APIs MUST scope by `bubbleId`
   * so other schools / bubbles never see this data.
   */
  bubbleIsolation: boolean;
  inviteCode?: string;
  inviteLink?: string;
  members: Schema.Types.ObjectId[];
  admins: Schema.Types.ObjectId[];
  moderators: Schema.Types.ObjectId[];
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
  addMember(userId: string): Promise<void>;
  removeMember(userId: string): Promise<void>;
  createPost(authorId: string, content: string, images?: string[]): Promise<void>;
  /** Group Admin — same as admins[] membership; explicit name for RBAC docs. */
  isGroupAdmin(userId: string): boolean;
  isAdmin(userId: string): boolean;
  isMember(userId: string): boolean;
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
    category: {
      type: String,
      enum: ['school', 'corporate', 'community', 'challenge', 'custom'],
      default: 'community'
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
    },
    inviteLink: String,
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    admins: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    moderators: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
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
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ bubbleId: 1, bubbleIsolation: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ admins: 1 });
groupSchema.index({ type: 1, category: 1 });
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

// Add member to group
groupSchema.methods.addMember = async function(userId: string): Promise<void> {
  if (!this.members.includes(userId)) {
    this.members.push(userId);
    
    // Remove from pending if exists
    this.pendingMembers = this.pendingMembers.filter(
      (id: any) => id.toString() !== userId
    );
    
    await this.save();
  }
};

// Remove member from group
groupSchema.methods.removeMember = async function(userId: string): Promise<void> {
  this.members = this.members.filter((id: any) => id.toString() !== userId);
  this.admins = this.admins.filter((id: any) => id.toString() !== userId);
  this.moderators = this.moderators.filter((id: any) => id.toString() !== userId);
  
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

// Check if user is admin
groupSchema.methods.isAdmin = function(userId: string): boolean {
  return this.admins.some((id: any) => id.toString() === userId);
};

// Check if user is member
groupSchema.methods.isMember = function(userId: string): boolean {
  return this.members.some((id: any) => id.toString() === userId);
};

// Static method to find groups by user
groupSchema.statics.findByUser = function(userId: string) {
  return this.find({
    members: userId,
    'settings.isArchived': false
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

const Group = mongoose.model<IGroup>('Group', groupSchema);

export default Group;