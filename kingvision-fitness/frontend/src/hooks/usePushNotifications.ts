import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../api/pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function resolveExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenResult.data;
  } catch (error) {
    console.warn('[push] Could not obtain Expo push token:', error);
    return null;
  }
}

/**
 * Registers the device push token with the backend when the user is authenticated.
 */
export function usePushNotifications(enabled: boolean): void {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      registeredRef.current = null;
      return;
    }

    let cancelled = false;

    void (async () => {
      const token = await resolveExpoPushToken();
      if (!token || cancelled) return;
      if (registeredRef.current === token) return;

      try {
        await registerPushToken(token);
        registeredRef.current = token;
      } catch (error) {
        console.warn('[push] Failed to register token with API:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
