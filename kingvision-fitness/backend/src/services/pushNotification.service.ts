import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { format } from 'date-fns';
import User from '../models/User';

const expo = new Expo();

/**
 * Send a single Expo push notification. Invalid tokens are logged and skipped
 * so a bad admin device registration never breaks client-facing flows.
 */
export async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn('[push] Skipping invalid Expo push token');
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('[push] Ticket error:', ticket.message, ticket.details);
      }
    }
  }
}

/**
 * Alert the platform SUPER_ADMIN when a client cancels a session.
 * No-ops silently when no admin account or push token is registered.
 */
export async function notifySuperAdminSessionCancelled(params: {
  clientFirstName: string;
  sessionStart: Date;
}): Promise<void> {
  const admin = await User.findOne({ role: 'SUPER_ADMIN' })
    .select('expoPushToken')
    .lean();

  if (!admin?.expoPushToken) {
    return;
  }

  const dateLabel = format(params.sessionStart, 'MMM d, yyyy');
  const timeLabel = format(params.sessionStart, 'h:mm a');
  const firstName = params.clientFirstName.trim() || 'A client';

  await sendExpoPushNotification(
    admin.expoPushToken,
    'Session Cancelled ❌',
    `${firstName} has cancelled their session scheduled for ${dateLabel} at ${timeLabel}.`,
    { type: 'session_cancelled' }
  );
}
