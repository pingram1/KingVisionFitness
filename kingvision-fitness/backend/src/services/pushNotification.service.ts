import { format } from 'date-fns';
import User from '../models/User';

type ExpoPushMessage = {
  to: string;
  sound?: 'default' | null;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type ExpoClient = {
  chunkPushNotifications: (messages: ExpoPushMessage[]) => ExpoPushMessage[][];
  sendPushNotificationsAsync: (
    messages: ExpoPushMessage[]
  ) => Promise<Array<{ status: string; message?: string; details?: unknown }>>;
};

type ExpoNamespace = {
  Expo: {
    new (): ExpoClient;
    isExpoPushToken: (token: string) => boolean;
  };
};

let expoModulePromise: Promise<ExpoNamespace> | null = null;
let expoClient: ExpoClient | null = null;

async function loadExpo(): Promise<ExpoNamespace> {
  if (!expoModulePromise) {
    expoModulePromise = import('expo-server-sdk') as Promise<ExpoNamespace>;
  }
  return expoModulePromise;
}

async function getExpoClient(): Promise<ExpoClient> {
  if (!expoClient) {
    const { Expo } = await loadExpo();
    expoClient = new Expo();
  }
  return expoClient;
}

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
  const { Expo } = await loadExpo();
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

  const expo = await getExpoClient();
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
