import express, { Router } from 'express';
import mongoose from 'mongoose';
import Booking, { BOOKING_STATUSES, type BookingStatus } from '../models/Booking';
import Availability from '../models/Availability';
import User from '../models/User';
import Workout from '../models/Workout';
import { auth, authorizeRoles, requireSubscriptionTier } from '../middleware/auth';
import { notifySuperAdminSessionCancelled } from '../services/pushNotification.service';

const router: Router = express.Router();

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type AvailabilitySlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

function defaultWeeklyTemplate(): AvailabilitySlotInput[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));
}

function validateAvailabilitySlot(slot: AvailabilitySlotInput, index: number): string | null {
  if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
    return `schedule[${index}].dayOfWeek must be 0–6`;
  }
  if (!TIME_PATTERN.test(slot.startTime)) {
    return `schedule[${index}].startTime must be HH:MM`;
  }
  if (!TIME_PATTERN.test(slot.endTime)) {
    return `schedule[${index}].endTime must be HH:MM`;
  }
  if (slot.isAvailable && slot.startTime >= slot.endTime) {
    return `schedule[${index}]: endTime must be after startTime when available`;
  }
  return null;
}

function bookingScopeFilter(user: any): Record<string, unknown> {
  if (user.role === 'SUPER_ADMIN') {
    return {};
  }
  return { trainerId: user._id };
}

function canManageBooking(user: any, booking: { trainerId: unknown }): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  return String(booking.trainerId) === String(user._id);
}

async function resolvePlatformTrainerId(): Promise<mongoose.Types.ObjectId | null> {
  const admin = await User.findOne({ role: 'SUPER_ADMIN' }).select('_id').lean();
  if (admin?._id) return admin._id as mongoose.Types.ObjectId;

  const trainer = await User.findOne({ role: 'TRAINER' }).select('_id').lean();
  return trainer?._id ? (trainer._id as mongoose.Types.ObjectId) : null;
}

/** Prefer the trainer who assigned this client's custom workouts, else platform default. */
async function resolveTrainerForClient(
  clientId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId | null> {
  const customWorkout = await Workout.findOne({
    isCustom: true,
    isActive: true,
    assignedTo: clientId,
  })
    .sort({ updatedAt: -1 })
    .select('createdBy')
    .lean();

  if (customWorkout?.createdBy) {
    return new mongoose.Types.ObjectId(String(customWorkout.createdBy));
  }

  return resolvePlatformTrainerId();
}

async function fetchTrainerAvailabilityTemplate(trainerId: mongoose.Types.ObjectId) {
  const slots = await Availability.find({ trainerId }).sort({ dayOfWeek: 1 }).lean();

  if (slots.length === 0) {
    return defaultWeeklyTemplate();
  }

  if (slots.length < 7) {
    const byDay = new Map(slots.map((s) => [s.dayOfWeek, s]));
    return defaultWeeklyTemplate().map((defaults) => {
      const existing = byDay.get(defaults.dayOfWeek);
      if (existing) {
        return {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          isAvailable: existing.isAvailable,
        };
      }
      return defaults;
    });
  }

  return slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    isAvailable: s.isAvailable,
  }));
}

function isWithinAvailabilityWindow(
  slot: AvailabilitySlotInput,
  startTime: string,
  endTime: string
): boolean {
  if (!slot.isAvailable) return false;
  return startTime >= slot.startTime && endTime <= slot.endTime;
}

// ─── Admin routes (SUPER_ADMIN | TRAINER) ───────────────────────────────────

// @route   GET /api/schedule/admin/bookings
// @desc    Fetch bookings for admin schedule (populated with client name)
// @access  Private — SUPER_ADMIN | TRAINER
router.get(
  '/admin/bookings',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const bookings = await Booking.find(bookingScopeFilter(req.user))
        .sort({ startTime: 1 })
        .populate('clientId', 'email profile.firstName profile.lastName')
        .populate('trainerId', 'email profile.firstName profile.lastName')
        .lean();

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      console.error('Admin bookings fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching bookings',
      });
    }
  }
);

// @route   PATCH /api/schedule/admin/bookings/:id
// @desc    Update booking status (confirm / cancel / complete)
// @access  Private — SUPER_ADMIN | TRAINER
router.patch(
  '/admin/bookings/:id',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: BookingStatus };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid booking ID' });
      }

      if (!status || !BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${BOOKING_STATUSES.join(', ')}`,
        });
      }

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (!canManageBooking(req.user, booking)) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this booking' });
      }

      booking.status = status;
      await booking.save();

      const populated = await Booking.findById(booking._id)
        .populate('clientId', 'email profile.firstName profile.lastName')
        .populate('trainerId', 'email profile.firstName profile.lastName');

      res.json({
        success: true,
        message: `Booking ${status}`,
        data: populated,
      });
    } catch (error) {
      console.error('Admin booking update error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating booking',
      });
    }
  }
);

// @route   GET /api/schedule/admin/availability
// @desc    Fetch trainer weekly availability template
// @access  Private — SUPER_ADMIN | TRAINER
router.get(
  '/admin/availability',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const trainerId = req.user._id;
      const slots = await fetchTrainerAvailabilityTemplate(trainerId);

      res.json({
        success: true,
        data: slots,
        meta: { dayLabels: DAY_LABELS },
      });
    } catch (error) {
      console.error('Admin availability fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching availability',
      });
    }
  }
);

// @route   PUT /api/schedule/admin/availability
// @desc    Replace trainer weekly availability template
// @access  Private — SUPER_ADMIN | TRAINER
router.put(
  '/admin/availability',
  auth,
  authorizeRoles('SUPER_ADMIN', 'TRAINER'),
  async (req: any, res: any) => {
    try {
      const { schedule } = req.body as { schedule?: AvailabilitySlotInput[] };

      if (!Array.isArray(schedule) || schedule.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'schedule must be a non-empty array',
        });
      }

      for (let i = 0; i < schedule.length; i += 1) {
        const error = validateAvailabilitySlot(schedule[i], i);
        if (error) {
          return res.status(400).json({ success: false, message: error });
        }
      }

      const trainerId = req.user._id;
      const ops = schedule.map((slot) => ({
        updateOne: {
          filter: { trainerId, dayOfWeek: slot.dayOfWeek },
          update: {
            $set: {
              trainerId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isAvailable: Boolean(slot.isAvailable),
            },
          },
          upsert: true,
        },
      }));

      await Availability.bulkWrite(ops);

      const updated = await Availability.find({ trainerId }).sort({ dayOfWeek: 1 }).lean();

      res.json({
        success: true,
        message: 'Availability updated',
        data: updated,
        meta: { dayLabels: DAY_LABELS },
      });
    } catch (error) {
      console.error('Admin availability update error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating availability',
      });
    }
  }
);

// ─── Client routes (ACTIVE_CLIENT tier) ─────────────────────────────────────

// @route   GET /api/schedule/available-slots
// @desc    Platform trainer weekly availability template for booking UI
// @access  Private — ACTIVE_CLIENT subscriptionTier
router.get(
  '/available-slots',
  auth,
  requireSubscriptionTier('ACTIVE_CLIENT'),
  async (req: any, res: any) => {
    try {
      const trainerId = await resolveTrainerForClient(req.user._id);
      if (!trainerId) {
        return res.status(503).json({
          success: false,
          message: 'No trainer availability configured yet',
        });
      }

      const slots = await fetchTrainerAvailabilityTemplate(trainerId);
      const availableDays = slots.filter((s) => s.isAvailable);

      res.json({
        success: true,
        data: slots,
        meta: {
          trainerId: trainerId.toString(),
          dayLabels: DAY_LABELS,
          availableDayCount: availableDays.length,
        },
      });
    } catch (error) {
      console.error('Available slots fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching available slots',
      });
    }
  }
);

// @route   POST /api/schedule/book
// @desc    Request a 1-on-1 session (always created as pending)
// @access  Private — ACTIVE_CLIENT subscriptionTier
router.post(
  '/book',
  auth,
  requireSubscriptionTier('ACTIVE_CLIENT'),
  async (req: any, res: any) => {
    try {
      const { startTime, endTime, notes, date, time } = req.body as {
        startTime?: string;
        endTime?: string;
        notes?: string;
        date?: string;
        time?: string;
      };

      let sessionStart: Date;
      let sessionEnd: Date;

      if (date && time) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
        }
        if (!TIME_PATTERN.test(time)) {
          return res.status(400).json({ success: false, message: 'time must be HH:MM (24-hour)' });
        }
        sessionStart = new Date(`${date}T${time}:00`);
        if (Number.isNaN(sessionStart.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid date/time combination' });
        }
      } else if (startTime) {
        sessionStart = new Date(startTime);
        if (Number.isNaN(sessionStart.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid startTime' });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Provide startTime (ISO) or date + time (YYYY-MM-DD & HH:MM)',
        });
      }

      if (endTime) {
        sessionEnd = new Date(endTime);
        if (Number.isNaN(sessionEnd.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid endTime' });
        }
      } else {
        sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);
      }

      if (sessionEnd <= sessionStart) {
        return res.status(400).json({
          success: false,
          message: 'End time must be after start time',
        });
      }

      if (sessionStart.getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'Session must be scheduled in the future',
        });
      }

      const trainerId = await resolveTrainerForClient(req.user._id);
      if (!trainerId) {
        return res.status(503).json({
          success: false,
          message: 'No trainer available for bookings',
        });
      }

      const availability = await fetchTrainerAvailabilityTemplate(trainerId);
      const dayOfWeek = sessionStart.getDay();
      const daySlot = availability.find((s) => s.dayOfWeek === dayOfWeek);
      const startHHMM = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`;
      const endHHMM = `${String(sessionEnd.getHours()).padStart(2, '0')}:${String(sessionEnd.getMinutes()).padStart(2, '0')}`;

      if (!daySlot || !isWithinAvailabilityWindow(daySlot, startHHMM, endHHMM)) {
        return res.status(400).json({
          success: false,
          message: 'Selected time is outside trainer availability for that day',
        });
      }

      const booking = await Booking.create({
        clientId: req.user._id,
        trainerId,
        startTime: sessionStart,
        endTime: sessionEnd,
        status: 'pending',
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : '',
      });

      const populated = await Booking.findById(booking._id)
        .populate('clientId', 'email profile.firstName profile.lastName')
        .populate('trainerId', 'email profile.firstName profile.lastName');

      res.status(201).json({
        success: true,
        message: 'Session request submitted — pending trainer review',
        data: populated,
      });
    } catch (error) {
      console.error('Book session error:', error);
      res.status(500).json({
        success: false,
        message: 'Error booking session',
      });
    }
  }
);

// @route   GET /api/schedule/my-bookings
// @desc    Client's own session list (pending, confirmed, past)
// @access  Private — ACTIVE_CLIENT subscriptionTier
router.get(
  '/my-bookings',
  auth,
  requireSubscriptionTier('ACTIVE_CLIENT'),
  async (req: any, res: any) => {
    try {
      const bookings = await Booking.find({ clientId: req.user._id })
        .sort({ startTime: 1 })
        .populate('trainerId', 'email profile.firstName profile.lastName')
        .lean();

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      console.error('My bookings fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching your sessions',
      });
    }
  }
);

// @route   PATCH /api/schedule/my-bookings/:id/cancel
// @desc    Client cancels their own pending or confirmed session
// @access  Private — ACTIVE_CLIENT subscriptionTier
router.patch(
  '/my-bookings/:id/cancel',
  auth,
  requireSubscriptionTier('ACTIVE_CLIENT'),
  async (req: any, res: any) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid booking ID' });
      }

      const booking = await Booking.findOne({ _id: id, clientId: req.user._id });
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: 'Only pending or confirmed sessions can be cancelled',
        });
      }

      const sessionStart = new Date(booking.startTime);
      const clientFirstName = req.user.profile?.firstName ?? 'A client';

      booking.status = 'cancelled';
      await booking.save();

      // Fire-and-forget — never delay the client's cancellation response.
      void notifySuperAdminSessionCancelled({ clientFirstName, sessionStart }).catch(
        (pushError) => console.error('[schedule] Admin push notification failed:', pushError)
      );

      const populated = await Booking.findById(booking._id)
        .populate('trainerId', 'email profile.firstName profile.lastName');

      res.json({
        success: true,
        message: 'Session cancelled',
        data: populated,
      });
    } catch (error) {
      console.error('Client cancel booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling session',
      });
    }
  }
);

// @route   GET /api/schedule/sessions
// @desc    Get user's scheduled sessions
// @access  Private
router.get('/sessions', auth, async (req: any, res: any) => {
  try {
    const filter =
      req.user.role === 'SUPER_ADMIN' || req.user.role === 'TRAINER'
        ? { trainerId: req.user._id }
        : { clientId: req.user._id };

    const sessions = await Booking.find(filter)
      .sort({ startTime: 1 })
      .populate('clientId', 'email profile.firstName profile.lastName')
      .populate('trainerId', 'email profile.firstName profile.lastName')
      .lean();

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions',
    });
  }
});

export default router;
