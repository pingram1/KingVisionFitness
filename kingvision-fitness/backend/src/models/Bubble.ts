import mongoose, { Document, Schema } from 'mongoose';

/**
 * Organizational "private bubble" — one school / KingCamp tenant.
 * Groups with `bubbleIsolation` reference this id so list/search APIs can scope queries and prevent cross-bubble leakage.
 */
export type BubbleKind = 'school' | 'kingcamp' | 'organization';

export interface IBubble extends Document {
  name: string;
  /** URL-safe slug for admin consoles and joins (unique). */
  slug: string;
  kind: BubbleKind;
  /** Optional org-wide admins (e.g. district); group-level admins live on Group.admins */
  organizationAdmins: Schema.Types.ObjectId[];
  owner: Schema.Types.ObjectId;
  isActive: boolean;
  settings: {
    /** false = strict "private bubble" — no cross-tenant discovery in product search */
    allowCrossBubbleDiscovery: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const bubbleSchema = new Schema<IBubble>(
  {
    name: {
      type: String,
      required: [true, 'Bubble name is required'],
      trim: true,
      maxlength: [120, 'Name too long'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, 'Slug must be URL-safe'],
    },
    kind: {
      type: String,
      enum: ['school', 'kingcamp', 'organization'],
      required: true,
    },
    organizationAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    settings: {
      allowCrossBubbleDiscovery: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

bubbleSchema.index({ kind: 1, isActive: 1 });
bubbleSchema.index({ owner: 1 });

const Bubble = mongoose.model<IBubble>('Bubble', bubbleSchema);

export default Bubble;
