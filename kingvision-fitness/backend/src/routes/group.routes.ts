import express, { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import Group, { type GroupMemberRole, type GroupType } from '../models/Group';
import User from '../models/User';
import Workout from '../models/Workout';
import { auth, authorizeRoles } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkInBodySchema } from '../schemas/group.schemas';
import { haversineMeters } from '../utils/geo';
import { buildLeaderboard } from '../utils/leaderboard';
import { parseAthleteStatsPayload } from '../utils/athleteStatsPayload';
import { applyAthleteStatsUpdate } from '../services/athleteStats.service';

const router: Router = express.Router();
const inviteAlphabet = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = inviteAlphabet();
    const exists = await Group.exists({ inviteCode: code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique invite code');
}

function formatAdminGroupSummary(group: any) {
  return {
    _id: group._id,
    name: group.name,
    description: group.description,
    groupType: group.groupType,
    groupTypeLabel: GROUP_TYPE_LABELS[group.groupType as GroupType] ?? group.groupType,
    inviteCode: group.inviteCode ?? null,
    memberCount: group.memberships?.length ?? group.members?.length ?? 0,
    type: group.type,
    address: group.address ?? null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

function groupObjectId(id: unknown): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(String(id));
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

/** Keep User.groups + User.groupMemberships in sync after a group role change. */
async function syncUserGroupMembership(
  user: InstanceType<typeof User>,
  groupId: mongoose.Types.ObjectId,
  role: GroupMemberRole
): Promise<void> {
  const gid = groupId.toString();
  if (!user.groups.some((id) => id.toString() === gid)) {
    user.groups.push(groupId as never);
  }
  user.groupMemberships = user.groupMemberships ?? [];
  const existing = user.groupMemberships.find((m) => m.group.toString() === gid);
  if (existing) {
    existing.role = role;
  } else {
    user.groupMemberships.push({
      group: groupId as never,
      role,
      joinedAt: new Date(),
    });
  }
  await user.save();
}

/** Remove a group from the user's mirrored membership arrays. */
async function pruneUserGroupMembership(
  user: InstanceType<typeof User>,
  groupId: mongoose.Types.ObjectId
): Promise<void> {
  const gid = groupId.toString();
  user.groups = user.groups.filter((id) => id.toString() !== gid);
  user.groupMemberships = (user.groupMemberships ?? []).filter(
    (m) => m.group.toString() !== gid
  );
  await user.save();
}

function formatRosterEntry(group: any, membership: any) {
  const user = membership.user;
  const userId = user?._id ?? user;
  const groupType = group.groupType as GroupType;
  const role = membership.role as GroupMemberRole;
  return {
    membershipId: membership._id,
    userId,
    email: user?.email ?? '',
    firstName: user?.profile?.firstName ?? '',
    lastName: user?.profile?.lastName ?? '',
    subscriptionTier: user?.subscriptionTier ?? 'BASIC',
    role: normalizeRoleForGroupType(groupType, role),
    roleLabel: contextualRoleLabel(groupType, role),
    joinedAt: membership.joinedAt,
    performanceGrade: membership.performanceGrade ?? 0,
  };
}

const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  athletic_team: 'Athletic Team',
  bootcamp: 'Bootcamp',
  public_community: 'Public Community',
};

const ROLE_LABELS: Record<GroupMemberRole, string> = {
  member: 'Member',
  athlete: 'Athlete',
  captain: 'Team Captain',
  coach: 'Coach',
  participant: 'Member',
};

function defaultRoleForGroupType(groupType: GroupType): GroupMemberRole {
  if (groupType === 'public_community' || groupType === 'bootcamp') {
    return 'member';
  }
  return 'athlete';
}

function groupTypeNeedsLocation(groupType: GroupType): boolean {
  return groupType === 'public_community' || groupType === 'bootcamp';
}

function parseGroupLocationPayload(body: {
  address?: string;
  location?: {
    latitude?: unknown;
    longitude?: unknown;
    radiusMeters?: unknown;
  };
}): { address: string; location: { latitude: number; longitude: number; radiusMeters: number } } | null {
  const address = body.address?.trim();
  if (!address || !body.location) {
    return null;
  }

  const latitude = Number(body.location.latitude);
  const longitude = Number(body.location.longitude);
  const radiusMeters =
    body.location.radiusMeters != null ? Number(body.location.radiusMeters) : 150;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    address,
    location: {
      latitude,
      longitude,
      radiusMeters: Number.isFinite(radiusMeters) ? Math.max(10, radiusMeters) : 150,
    },
  };
}

/** Map stored roles to the archetype-appropriate display role */
function normalizeRoleForGroupType(
  groupType: GroupType,
  role: GroupMemberRole
): GroupMemberRole {
  if (groupType === 'athletic_team') {
    return role;
  }
  if (role === 'coach') {
    return 'coach';
  }
  return 'member';
}

function contextualRoleLabel(groupType: GroupType, role: GroupMemberRole): string {
  return ROLE_LABELS[normalizeRoleForGroupType(groupType, role)];
}

function formatGroupSummary(group: any, userId: string) {
  const groupType = group.groupType as GroupType;
  const membership = group.getMembership
    ? group.getMembership(userId)
    : group.memberships?.find(
        (m: { user: { toString: () => string } }) => m.user.toString() === userId
      );

  const myRole = membership?.role
    ? normalizeRoleForGroupType(groupType, membership.role as GroupMemberRole)
    : null;

  return {
    _id: group._id,
    name: group.name,
    description: group.description,
    coverImage: group.coverImage,
    groupType: group.groupType,
    groupTypeLabel: GROUP_TYPE_LABELS[groupType] ?? group.groupType,
    type: group.type,
    memberCount: group.memberships?.length ?? group.members?.length ?? 0,
    myRole,
    myRoleLabel: membership?.role ? contextualRoleLabel(groupType, membership.role as GroupMemberRole) : null,
    stats: {
      totalWorkoutsCompleted: group.stats?.totalWorkoutsCompleted ?? 0,
      averageWorkoutsPerWeek: group.stats?.averageWorkoutsPerWeek ?? 0,
    },
  };
}

// @route   GET /api/groups/my-groups
// @desc    Teams / bootcamps the logged-in user belongs to
// @access  Private
router.get('/my-groups', auth, async (req: any, res: any) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      $or: [{ 'memberships.user': userId }, { members: userId }],
      'settings.isArchived': false,
    })
      .select('name description coverImage groupType type memberships members stats settings')
      .sort({ updatedAt: -1 })
      .lean(false);

    const data = groups.map((g) => formatGroupSummary(g, userId.toString()));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching my groups:', error);
    res.status(500).json({ success: false, message: 'Error fetching your groups' });
  }
});

// @route   POST /api/groups/join
// @desc    Join a team/bootcamp via invite code
// @access  Private
router.post('/join', auth, async (req: any, res: any) => {
  try {
    const code = String(req.body.inviteCode ?? '')
      .trim()
      .toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Invite code is required' });
    }

    const group = await Group.findOne({
      inviteCode: code,
      'settings.isArchived': false,
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invite code' });
    }

    const userId = req.user._id.toString();
    if (group.isMember(userId)) {
      return res.json({
        success: true,
        message: 'You are already a member of this group',
        data: formatGroupSummary(group, userId),
      });
    }

    const defaultRole = defaultRoleForGroupType(group.groupType as GroupType);

    await group.addMembership(userId, defaultRole);

    const user = await User.findById(req.user._id);
    if (user) {
      const gid = groupObjectId(group._id);
      if (!user.groups.some((id) => id.toString() === gid.toString())) {
        user.groups.push(gid as never);
      }
      const hasMembership = user.groupMemberships?.some(
        (m) => m.group.toString() === gid.toString()
      );
      if (!hasMembership) {
        user.groupMemberships = user.groupMemberships ?? [];
        user.groupMemberships.push({
          group: gid as never,
          role: defaultRole,
          joinedAt: new Date(),
        });
      }
      await user.save();
    }

    res.json({
      success: true,
      message: `Joined ${group.name}`,
      data: formatGroupSummary(group, userId),
    });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ success: false, message: 'Error joining group' });
  }
});

// ─── Admin routes (SUPER_ADMIN) — register BEFORE /:id ─────────────────────

// @route   GET /api/groups/admin
// @desc    List all teams / bootcamps / communities
// @access  Private — SUPER_ADMIN
router.get('/admin', auth, authorizeRoles('SUPER_ADMIN'), async (_req: any, res: any) => {
  try {
    const groups = await Group.find({ 'settings.isArchived': false })
      .sort({ createdAt: -1 })
      .select('name description groupType inviteCode memberships members type address createdAt updatedAt')
      .lean();

    res.json({
      success: true,
      data: groups.map(formatAdminGroupSummary),
    });
  } catch (error) {
    console.error('Admin groups list error:', error);
    res.status(500).json({ success: false, message: 'Error fetching groups' });
  }
});

// @route   POST /api/groups/admin
// @desc    Create a group with a unique 6-character invite code
// @access  Private — SUPER_ADMIN
router.post('/admin', auth, authorizeRoles('SUPER_ADMIN'), async (req: any, res: any) => {
  try {
    const { name, description, groupType = 'athletic_team', address, location } = req.body as {
      name?: string;
      description?: string;
      groupType?: GroupType;
      address?: string;
      location?: {
        latitude?: number;
        longitude?: number;
        radiusMeters?: number;
      };
    };

    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name and description are required',
      });
    }

    const validTypes: GroupType[] = ['athletic_team', 'bootcamp', 'public_community'];
    if (!validTypes.includes(groupType)) {
      return res.status(400).json({
        success: false,
        message: `groupType must be one of: ${validTypes.join(', ')}`,
      });
    }

    let locationPayload: ReturnType<typeof parseGroupLocationPayload> = null;
    if (groupTypeNeedsLocation(groupType)) {
      locationPayload = parseGroupLocationPayload({ address, location });
      if (!locationPayload) {
        return res.status(400).json({
          success: false,
          message: 'A valid address and geocoded location are required for communities and bootcamps',
        });
      }
    }

    const inviteCode = await generateUniqueInviteCode();

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      groupType,
      type: groupType === 'public_community' ? 'public' : 'private',
      bubbleIsolation: false,
      inviteCode,
      inviteLink: `${process.env.APP_URL || 'https://kingvision.app'}/join/${inviteCode}`,
      createdBy: req.user._id,
      memberships: [],
      members: [],
      ...(locationPayload ?? {}),
      settings: {
        joinApproval: false,
        membersCanPost: true,
        membersCanInvite: true,
        visibility: 'visible',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Group created',
      data: formatAdminGroupSummary(group),
    });
  } catch (error) {
    console.error('Admin create group error:', error);
    res.status(500).json({ success: false, message: 'Error creating group' });
  }
});

// @route   PUT /api/groups/admin/:id
// @desc    Update group details (name, type, address, location)
// @access  Private — SUPER_ADMIN
router.put('/admin/:id', auth, authorizeRoles('SUPER_ADMIN'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const { name, description, groupType, address, location } = req.body as {
      name?: string;
      description?: string;
      groupType?: GroupType;
      address?: string;
      location?: {
        latitude?: number;
        longitude?: number;
        radiusMeters?: number;
      };
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      group.name = name.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({ success: false, message: 'Description cannot be empty' });
      }
      group.description = description.trim();
    }

    const validTypes: GroupType[] = ['athletic_team', 'bootcamp', 'public_community'];
    const nextGroupType = (groupType ?? group.groupType) as GroupType;

    if (groupType !== undefined) {
      if (!validTypes.includes(nextGroupType)) {
        return res.status(400).json({
          success: false,
          message: `groupType must be one of: ${validTypes.join(', ')}`,
        });
      }
      group.groupType = nextGroupType;
      group.type = nextGroupType === 'public_community' ? 'public' : 'private';
    }

    const addressTouched = address !== undefined;
    const locationTouched = location !== undefined;

    if (groupTypeNeedsLocation(nextGroupType)) {
      if (addressTouched || locationTouched) {
        const locationPayload = parseGroupLocationPayload({
          address: address ?? group.address,
          location: location ?? group.location,
        });
        if (!locationPayload) {
          return res.status(400).json({
            success: false,
            message: 'A valid address and geocoded location are required for communities and bootcamps',
          });
        }
        group.address = locationPayload.address;
        group.location = locationPayload.location;
      } else if (
        group.location?.latitude == null ||
        group.location?.longitude == null ||
        !group.address?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Communities and bootcamps require an address and geocoded location',
        });
      }
    } else if (nextGroupType === 'athletic_team' && addressTouched && !address?.trim()) {
      group.address = undefined;
      group.location = undefined;
    }

    await group.save();

    res.json({
      success: true,
      message: 'Group updated',
      data: formatAdminGroupSummary(group),
    });
  } catch (error) {
    console.error('Admin update group error:', error);
    res.status(500).json({ success: false, message: 'Error updating group' });
  }
});

// @route   GET /api/groups/admin/:id/roster
// @desc    Group roster with member profile details
// @access  Private — SUPER_ADMIN
router.get(
  '/admin/:id/roster',
  auth,
  authorizeRoles('SUPER_ADMIN'),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid group ID' });
      }

      const group = await Group.findById(id)
        .select('name description groupType inviteCode memberships')
        .populate(
          'memberships.user',
          'email profile.firstName profile.lastName subscriptionTier'
        )
        .lean();

      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

      const roster = (group.memberships ?? []).map((m: any) => {
        const user = m.user;
        const userId = user?._id ?? user;
        const groupType = group.groupType as GroupType;
        const role = m.role as GroupMemberRole;
        return {
          membershipId: m._id,
          userId,
          email: user?.email ?? '',
          firstName: user?.profile?.firstName ?? '',
          lastName: user?.profile?.lastName ?? '',
          subscriptionTier: user?.subscriptionTier ?? 'BASIC',
          role: normalizeRoleForGroupType(groupType, role),
          roleLabel: contextualRoleLabel(groupType, role),
          joinedAt: m.joinedAt,
        };
      });

      res.json({
        success: true,
        data: {
          group: formatAdminGroupSummary(group),
          roster,
        },
      });
    } catch (error) {
      console.error('Admin group roster error:', error);
      res.status(500).json({ success: false, message: 'Error fetching roster' });
    }
  }
);

// @route   POST /api/groups/admin/:groupId/assign-coach
// @desc    Assign (or create) a coach for an athletic team — SUPER_ADMIN only
// @access  Private — SUPER_ADMIN
router.post(
  '/admin/:groupId/assign-coach',
  auth,
  authorizeRoles('SUPER_ADMIN'),
  async (req: any, res: any) => {
    try {
      const { groupId } = req.params;
      const email = String(req.body.email ?? '')
        .trim()
        .toLowerCase();
      const firstName = String(req.body.firstName ?? '').trim();
      const lastName = String(req.body.lastName ?? '').trim();

      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ success: false, message: 'Invalid group ID' });
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'A valid email is required' });
      }
      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'First name and last name are required',
        });
      }

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      if (group.groupType !== 'athletic_team') {
        return res.status(400).json({
          success: false,
          message: 'Coaches can only be assigned to athletic teams',
        });
      }

      let user = await User.findOne({ email });
      let createdUser = false;
      let temporaryPassword: string | null = null;

      if (!user) {
        temporaryPassword = generateTemporaryPassword();
        user = new User({
          email,
          password: temporaryPassword,
          role: 'CLIENT',
          subscriptionTier: 'BASIC',
          emailVerified: true,
          profile: { firstName, lastName },
        });
        await user.save();
        createdUser = true;
      }

      const userId = String(user._id);
      const gid = groupObjectId(group._id);
      const existingMembership = group.getMembership(userId);

      if (existingMembership?.role === 'coach') {
        return res.json({
          success: true,
          message: `${firstName} ${lastName} is already a coach on this team`,
          data: {
            user: {
              userId: user._id,
              email: user.email,
              firstName: user.profile?.firstName ?? firstName,
              lastName: user.profile?.lastName ?? lastName,
              role: 'coach',
            },
            temporaryPassword: null,
            createdUser: false,
          },
        });
      }

      if (existingMembership) {
        existingMembership.role = 'coach';
        group.syncMemberIds();
        await group.save();
      } else {
        await group.addMembership(userId, 'coach');
      }

      await syncUserGroupMembership(user, gid, 'coach');

      const message = createdUser
        ? `Coach account created and assigned. Share the temporary password with ${firstName}.`
        : `Coach assigned successfully. ${user.profile?.firstName ?? firstName} can log in with their existing credentials.`;

      return res.status(createdUser ? 201 : 200).json({
        success: true,
        message,
        data: {
          user: {
            userId: user._id,
            email: user.email,
            firstName: user.profile?.firstName ?? firstName,
            lastName: user.profile?.lastName ?? lastName,
            role: 'coach',
          },
          temporaryPassword,
          createdUser,
        },
      });
    } catch (error) {
      console.error('Admin assign coach error:', error);
      res.status(500).json({ success: false, message: 'Error assigning coach' });
    }
  }
);

// @route   POST /api/groups/:id/check-in
// @desc    GPS check-in for public communities — increments streak when within radius
// @access  Private (members only)
router.post(
  '/:id/check-in',
  auth,
  validateBody(checkInBodySchema),
  async (req: any, res: any) => {
  try {
    // checkInBodySchema guarantees finite, range-bounded WGS-84 coordinates.
    const { latitude, longitude } = req.body as { latitude: number; longitude: number };

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.groupType !== 'public_community') {
      return res.status(400).json({
        success: false,
        message: 'GPS check-in is only available for public community groups',
      });
    }

    if (
      group.location?.latitude == null ||
      group.location?.longitude == null
    ) {
      return res.status(400).json({
        success: false,
        message: 'This group does not have a check-in location configured yet',
      });
    }

    const userId = req.user._id.toString();
    if (!group.isMember(userId)) {
      return res.status(403).json({ success: false, message: 'You must be a member to check in' });
    }

    const radiusMeters = group.location.radiusMeters ?? 100;
    const distanceMeters = haversineMeters(
      latitude,
      longitude,
      group.location.latitude,
      group.location.longitude
    );

    if (distanceMeters > radiusMeters) {
      return res.status(400).json({
        success: false,
        message: `You are ${Math.round(distanceMeters)}m away. Check-in requires being within ${radiusMeters}m of the group location.`,
        data: {
          distanceMeters: Math.round(distanceMeters),
          radiusMeters,
          withinRadius: false,
        },
      });
    }

    const membership = group.getMembership(userId);
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Membership not found' });
    }

    const now = new Date();
    if (membership.lastCheckInAt) {
      const lastCheckIn = new Date(membership.lastCheckInAt);
      if (lastCheckIn.toDateString() === now.toDateString()) {
        return res.status(400).json({
          success: false,
          message: 'You have already checked in today',
          data: { streakCount: membership.streakCount ?? 0 },
        });
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastCheckIn.toDateString() === yesterday.toDateString()) {
        membership.streakCount = (membership.streakCount ?? 0) + 1;
      } else {
        membership.streakCount = 1;
      }
    } else {
      membership.streakCount = 1;
    }

    membership.lastCheckInAt = now;
    await group.save();

    res.json({
      success: true,
      message: 'Check-in successful!',
      data: {
        streakCount: membership.streakCount,
        distanceMeters: Math.round(distanceMeters),
        radiusMeters,
        withinRadius: true,
      },
    });
  } catch (error) {
    console.error('Error during group check-in:', error);
    res.status(500).json({ success: false, message: 'Error processing check-in' });
  }
  }
);

// @route   POST /api/groups/:id/workouts/:workoutId/modify
// @desc    Clone and customize a KingVision workout for this group (coaches only)
// @access  Private — group coach or SUPER_ADMIN
router.post('/:id/workouts/:workoutId/modify', auth, async (req: any, res: any) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !group.isCoach(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only coaches for this group can modify workouts',
      });
    }

    const source = await Workout.findById(req.params.workoutId);
    if (!source) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }

    const { title, description, exercises, duration, type, difficulty } = req.body;

    const {
      _id: _omitId,
      createdAt: _omitCreated,
      updatedAt: _omitUpdated,
      __v: _omitV,
      ...clonePayload
    } = source.toObject();

    const clone = new Workout({
      ...clonePayload,
      title: title ?? `${source.title} (Team Copy)`,
      description: description ?? source.description,
      exercises: exercises ?? source.exercises,
      duration: duration ?? source.duration,
      type: type ?? source.type,
      difficulty: difficulty ?? source.difficulty,
      isCustom: true,
      isPublic: false,
      createdBy: req.user._id,
      assignedTo: group.members ?? [],
      ratings: [],
      completionCount: 0,
      averageRating: 0,
    });

    await clone.save();

    if (group.groupType === 'bootcamp') {
      group.bootcampWorkouts = group.bootcampWorkouts ?? [];
      group.bootcampWorkouts.push(clone._id as never);
    } else {
      group.assignedWorkouts = group.assignedWorkouts ?? [];
      group.assignedWorkouts.push(clone._id as never);
    }
    await group.save();

    res.status(201).json({
      success: true,
      message: 'Workout customized for your group',
      data: {
        workoutId: clone._id,
        title: clone.title,
        groupId: group._id,
      },
    });
  } catch (error) {
    console.error('Error modifying group workout:', error);
    res.status(500).json({ success: false, message: 'Error modifying workout' });
  }
});

// @route   PATCH /api/groups/:id/members/:userId/role
// @desc    Assign athlete / captain roles (coaches only, athletic teams)
// @access  Private — group coach or SUPER_ADMIN
router.patch('/:id/members/:userId/role', auth, async (req: any, res: any) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const actorId = req.user._id.toString();
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !group.isCoach(actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can manage team roles',
      });
    }

    if (group.groupType !== 'athletic_team') {
      return res.status(400).json({
        success: false,
        message: 'Captain assignment is only available for athletic teams',
      });
    }

    const targetRole = req.body.role as GroupMemberRole;
    if (targetRole !== 'athlete' && targetRole !== 'captain') {
      return res.status(400).json({
        success: false,
        message: 'role must be athlete or captain',
      });
    }

    const targetUserId = req.params.userId;
    const membership = group.getMembership(targetUserId);
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Member not found in this group' });
    }

    if (membership.role === 'coach') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change the role of a coach',
      });
    }

    membership.role = targetRole;
    group.syncMemberIds();
    await group.save();

    const targetUser = await User.findById(targetUserId);
    if (targetUser?.groupMemberships) {
      const userMembership = targetUser.groupMemberships.find(
        (m) => m.group.toString() === String(group._id)
      );
      if (userMembership) {
        userMembership.role = targetRole;
        await targetUser.save();
      }
    }

    res.json({
      success: true,
      message: `Role updated to ${ROLE_LABELS[targetRole]}`,
      data: {
        userId: targetUserId,
        role: targetRole,
        roleLabel: ROLE_LABELS[targetRole],
      },
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ success: false, message: 'Error updating member role' });
  }
});

// @route   GET /api/groups/:id/roster
// @desc    Team roster for coaches (and SUPER_ADMIN)
// @access  Private — group coach or SUPER_ADMIN
router.get('/:id/roster', auth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }

    const group = await Group.findById(id)
      .select('name description groupType inviteCode memberships members type address createdAt updatedAt')
      .populate('memberships.user', 'email profile.firstName profile.lastName subscriptionTier');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requesterId = req.user._id.toString();
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !group.isCoach(requesterId)) {
      return res.status(403).json({
        success: false,
        message: 'Only team coaches can view the roster',
      });
    }

    const roster = (group.memberships ?? []).map((m) => formatRosterEntry(group, m));

    res.json({
      success: true,
      data: {
        group: formatAdminGroupSummary(group),
        roster,
      },
    });
  } catch (error) {
    console.error('Group roster error:', error);
    res.status(500).json({ success: false, message: 'Error fetching roster' });
  }
});

// @route   POST /api/groups/:id/members
// @desc    Coach adds a player to an athletic team by email
// @access  Private — group coach or SUPER_ADMIN
router.post('/:id/members', auth, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const email = String(req.body.email ?? '')
      .trim()
      .toLowerCase();
    const firstName = String(req.body.firstName ?? '').trim();
    const lastName = String(req.body.lastName ?? '').trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email is required' });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
      });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requesterId = req.user._id.toString();
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !group.isCoach(requesterId)) {
      return res.status(403).json({
        success: false,
        message: 'Only team coaches can add players',
      });
    }

    if (group.groupType !== 'athletic_team') {
      return res.status(400).json({
        success: false,
        message: 'Players can only be added to athletic teams',
      });
    }

    let user = await User.findOne({ email });
    let createdUser = false;
    let temporaryPassword: string | null = null;

    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      user = new User({
        email,
        password: temporaryPassword,
        role: 'CLIENT',
        subscriptionTier: 'BASIC',
        emailVerified: true,
        profile: { firstName, lastName },
      });
      await user.save();
      createdUser = true;
    }

    const userId = String(user._id);
    const gid = groupObjectId(group._id);
    const existingMembership = group.getMembership(userId);

    if (existingMembership) {
      if (existingMembership.role === 'coach') {
        return res.status(400).json({
          success: false,
          message: 'This user is already a coach on this team',
        });
      }
      return res.json({
        success: true,
        message: `${firstName} ${lastName} is already on the roster`,
        data: {
          user: {
            userId: user._id,
            email: user.email,
            firstName: user.profile?.firstName ?? firstName,
            lastName: user.profile?.lastName ?? lastName,
            role: existingMembership.role,
          },
          temporaryPassword: null,
          createdUser: false,
        },
      });
    }

    await group.addMembership(userId, 'athlete');
    await syncUserGroupMembership(user, gid, 'athlete');

    const message = createdUser
      ? `Player account created and added. Share the temporary password with ${firstName}.`
      : `${user.profile?.firstName ?? firstName} has been added to the team.`;

    return res.status(createdUser ? 201 : 200).json({
      success: true,
      message,
      data: {
        user: {
          userId: user._id,
          email: user.email,
          firstName: user.profile?.firstName ?? firstName,
          lastName: user.profile?.lastName ?? lastName,
          role: 'athlete',
        },
        temporaryPassword,
        createdUser,
      },
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ success: false, message: 'Error adding player' });
  }
});

// @route   DELETE /api/groups/:id/members/:userId
// @desc    Coach removes a player from an athletic team
// @access  Private — group coach or SUPER_ADMIN
router.delete('/:id/members/:userId', auth, async (req: any, res: any) => {
  try {
    const { id, userId: targetUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid group or user ID' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requesterId = req.user._id.toString();
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !group.isCoach(requesterId)) {
      return res.status(403).json({
        success: false,
        message: 'Only team coaches can remove players',
      });
    }

    if (group.groupType !== 'athletic_team') {
      return res.status(400).json({
        success: false,
        message: 'Roster management is only available for athletic teams',
      });
    }

    const membership = group.getMembership(targetUserId);
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Player not found on this team' });
    }

    if (membership.role === 'coach') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove a coach from the roster here',
      });
    }

    if (targetUserId === requesterId) {
      return res.status(400).json({
        success: false,
        message: 'Coaches cannot remove themselves from the team',
      });
    }

    await group.removeMember(targetUserId);

    const targetUser = await User.findById(targetUserId);
    if (targetUser) {
      await pruneUserGroupMembership(targetUser, groupObjectId(group._id));
    }

    res.json({
      success: true,
      message: 'Player removed from the team',
      data: { userId: targetUserId },
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ success: false, message: 'Error removing player' });
  }
});

// @route   PUT /api/groups/:groupId/athletes/:userId/stats
// @desc    Coach enters / updates athlete combine measurables
// @access  Private — group coach or SUPER_ADMIN
router.put('/:groupId/athletes/:userId/stats', auth, async (req: any, res: any) => {
  try {
    const { groupId, userId: targetUserId } = req.params;
    const requesterId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.groupType !== 'athletic_team') {
      return res.status(400).json({
        success: false,
        message: 'Athlete stats can only be updated for athletic teams',
      });
    }

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isCoach = group.isCoach(requesterId);
    if (!isCoach && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only team coaches can update athlete stats',
      });
    }

    const membership = group.getMembership(targetUserId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Athlete is not a member of this team',
      });
    }

    if (membership.role === 'coach') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update combine stats for a coach',
      });
    }

    const { stats: incoming, errors } = parseAthleteStatsPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid athlete stats payload',
        errors,
      });
    }

    if (Object.keys(incoming).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one measurable to update',
      });
    }

    const applied = await applyAthleteStatsUpdate(targetUserId, incoming);

    return res.json({
      success: true,
      message: 'Athlete stats updated',
      data: {
        bodyWeight: applied.bodyWeight,
        height: applied.height,
        squatMax: applied.squatMax,
        benchMax: applied.benchMax,
        deadliftMax: applied.deadliftMax,
        pushUpCount: applied.pushUpCount,
        sitUpCount: applied.sitUpCount,
        fortyYardDash: applied.fortyYardDash,
        performanceGrade: applied.performanceGrade,
        performanceBreakdown: applied.performanceBreakdown,
        statHistory: applied.statHistory,
        lastUpdatedAt: applied.lastUpdatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Athlete not found' });
    }
    console.error('Coach athlete stats update error:', error);
    res.status(500).json({ success: false, message: 'Error updating athlete stats' });
  }
});

// @route   GET /api/groups/:groupId/athletes/:userId
// @desc    Coach view — athlete combine stats, breakdown, and audit history
// @access  Private — group coach or SUPER_ADMIN
router.get('/:groupId/athletes/:userId', auth, async (req: any, res: any) => {
  try {
    const { groupId, userId: targetUserId } = req.params;
    const requesterId = req.user._id.toString();

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.groupType !== 'athletic_team') {
      return res.status(400).json({
        success: false,
        message: 'Athlete detail is only available for athletic teams',
      });
    }

    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isCoach = group.isCoach(requesterId);
    if (!isCoach && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only team coaches can view athlete performance details',
      });
    }

    const membership = group.getMembership(targetUserId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Athlete is not a member of this team',
      });
    }

    const athlete = await User.findById(targetUserId)
      .select('profile.firstName profile.lastName profile.avatar athleteStats groupMemberships')
      .lean();

    if (!athlete) {
      return res.status(404).json({ success: false, message: 'Athlete not found' });
    }

    const stats = athlete.athleteStats ?? {};
    const role = normalizeRoleForGroupType(group.groupType, membership.role as GroupMemberRole);
    const statHistory = [...(stats.statHistory ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return res.json({
      success: true,
      data: {
        athlete: {
          userId: athlete._id,
          firstName: athlete.profile?.firstName ?? '',
          lastName: athlete.profile?.lastName ?? '',
          avatar: athlete.profile?.avatar ?? null,
          role,
          roleLabel: contextualRoleLabel(group.groupType, membership.role as GroupMemberRole),
        },
        stats: {
          bodyWeight: stats.bodyWeight ?? null,
          height: stats.height ?? null,
          squatMax: stats.squatMax ?? null,
          benchMax: stats.benchMax ?? null,
          deadliftMax: stats.deadliftMax ?? null,
          pushUpCount: stats.pushUpCount ?? null,
          sitUpCount: stats.sitUpCount ?? null,
          fortyYardDash: stats.fortyYardDash ?? null,
          performanceGrade: stats.performanceGrade ?? membership.performanceGrade ?? 0,
          performanceBreakdown: stats.performanceBreakdown ?? membership.performanceBreakdown ?? null,
          lastUpdatedAt: stats.lastUpdatedAt ?? membership.lastGradedAt ?? null,
        },
        statHistory: statHistory.map((entry) => ({
          date: entry.date,
          metric: entry.metric,
          oldValue: entry.oldValue ?? null,
          newValue: entry.newValue,
        })),
        membership: {
          performanceGrade: membership.performanceGrade ?? 0,
          performanceBreakdown: membership.performanceBreakdown ?? null,
          lastGradedAt: membership.lastGradedAt ?? null,
          workoutsCompleted: membership.workoutsCompleted ?? 0,
          totalMinutes: membership.totalMinutes ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching athlete detail:', error);
    res.status(500).json({ success: false, message: 'Error fetching athlete detail' });
  }
});

// @route   GET /api/groups/:id
// @desc    Group detail — feed preview + leaderboard
// @access  Private (members only)
router.get('/:id', auth, async (req: any, res: any) => {
  try {
    const group = await Group.findById(req.params.id).populate(
      'memberships.user',
      'profile.firstName profile.lastName profile.avatar'
    );

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    if (!group.isMember(userId)) {
      return res.status(403).json({ success: false, message: 'You must be a member to view this group' });
    }

    const feed = [...group.posts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((post) => ({
        _id: post._id,
        content: post.content,
        authorId: post.author,
        createdAt: post.createdAt,
        likeCount: post.likes?.length ?? 0,
        commentCount: post.comments?.length ?? 0,
        workoutCompleted: post.workoutCompleted ?? null,
      }));

    const membership = group.getMembership(userId);
    const leaderboardMode =
      group.groupType === 'athletic_team' ? 'performance' : 'streak';

    let dailyWorkout: Record<string, unknown> | null = null;
    if (group.groupType === 'bootcamp' && group.bootcampWorkouts?.length) {
      const workoutDoc = await Workout.findById(group.bootcampWorkouts[0]).select(
        'title description duration type difficulty exercises'
      );
      if (workoutDoc) {
        dailyWorkout = {
          _id: workoutDoc._id,
          title: workoutDoc.title,
          description: workoutDoc.description,
          duration: workoutDoc.duration,
          type: workoutDoc.type,
          difficulty: workoutDoc.difficulty,
          exerciseCount: workoutDoc.exercises?.length ?? 0,
        };
      }
    }

    const isGroupCoach =
      group.isCoach(userId) || req.user.role === 'SUPER_ADMIN';

    res.json({
      success: true,
      data: {
        ...formatGroupSummary(group, userId),
        leaderboardMode,
        leaderboard: buildLeaderboard(group),
        myStreakCount: membership?.streakCount ?? 0,
        isGroupCoach,
        hasCheckInLocation: !!(
          group.location?.latitude != null && group.location?.longitude != null
        ),
        checkInRadiusMeters: group.location?.radiusMeters ?? null,
        address: group.address ?? null,
        dailyWorkout,
        feed,
        announcements: group.announcements?.slice(0, 5) ?? [],
      },
    });
  } catch (error) {
    console.error('Error fetching group detail:', error);
    res.status(500).json({ success: false, message: 'Error fetching group' });
  }
});

// @route   GET /api/groups
// @desc    Discover public communities (non-isolated)
// @access  Public
router.get('/', async (_req: any, res: any) => {
  try {
    const groups = await Group.findPublicGroups(20);
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching groups' });
  }
});

// @route   POST /api/groups
// @desc    Create team / bootcamp (coach only flow — stub)
// @access  Private
router.post('/', auth, async (req: any, res: any) => {
  try {
    const { name, description, groupType = 'athletic_team', address, location } = req.body;
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name and description are required',
      });
    }

    const typedGroupType = groupType as GroupType;
    let locationPayload: ReturnType<typeof parseGroupLocationPayload> = null;
    if (groupTypeNeedsLocation(typedGroupType)) {
      locationPayload = parseGroupLocationPayload({ address, location });
      if (!locationPayload) {
        return res.status(400).json({
          success: false,
          message: 'A valid address and geocoded location are required for communities and bootcamps',
        });
      }
    }

    const group = new Group({
      name,
      description,
      groupType: typedGroupType,
      type: 'private',
      bubbleIsolation: false,
      createdBy: req.user._id,
      ...(locationPayload ?? {}),
      memberships: [
        {
          user: req.user._id,
          role: 'coach',
          joinedAt: new Date(),
          workoutsCompleted: 0,
          totalMinutes: 0,
        },
      ],
      members: [req.user._id],
      settings: { joinApproval: false, membersCanPost: true, membersCanInvite: true },
    });
    group.generateInviteCode();
    await group.save();

    const user = await User.findById(req.user._id);
    if (user) {
      const gid = groupObjectId(group._id);
      user.groups.push(gid as never);
      user.groupMemberships = user.groupMemberships ?? [];
      user.groupMemberships.push({
        group: gid as never,
        role: 'coach',
        joinedAt: new Date(),
      });
      await user.save();
    }

    res.status(201).json({
      success: true,
      data: formatGroupSummary(group, req.user._id.toString()),
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ success: false, message: 'Error creating group' });
  }
});

// @route   POST /api/groups/:id/join
// @desc    Join by group id (legacy)
// @access  Private
router.post('/:id/join', auth, async (req: any, res: any) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const defaultRole = defaultRoleForGroupType(group.groupType as GroupType);

    await group.addMembership(userId, defaultRole);

    const user = await User.findById(req.user._id);
    const gid = groupObjectId(group._id);
    if (user && !user.groups.some((id) => id.toString() === gid.toString())) {
      user.groups.push(gid as never);
      await user.save();
    }

    res.json({
      success: true,
      data: formatGroupSummary(group, userId),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error joining group' });
  }
});

export default router;
