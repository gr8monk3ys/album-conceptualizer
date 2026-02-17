import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { api } from "../api/client";
import { useAuthStore } from "../stores/auth-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export function usePushNotifications(): void {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const registered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || registered.current) return;

    (async () => {
      const token = await registerForPushNotifications();
      if (!token) return;

      try {
        await api.post("/api/auth/push-token", {
          token,
          platform: Platform.OS,
        });
        registered.current = true;
      } catch {
        // Silently fail -- will retry next launch
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data;
        if (data?.url && typeof data.url === "string") {
          router.push(data.url as never);
        }
      });

    return () => subscription.remove();
  }, [router]);
}
