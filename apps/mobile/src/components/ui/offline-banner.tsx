/** Offline banner — shows connection status at the top of the screen. */
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff, Wifi } from "lucide-react-native";

import { useNetworkStatus } from "../../hooks/use-network-status";
import { colors, fontSize, spacing } from "../../theme";

type BannerState = "offline" | "back-online" | "hidden";

/**
 * Displays a banner when the device loses internet connectivity.
 *
 * - Red banner while offline: "No internet connection"
 * - Green banner when reconnecting: "Back online" (auto-hides after 2 s)
 * - Hidden when connected normally
 */
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      setBannerState("offline");
      return;
    }

    // Connected — if we were previously offline, show "back online" briefly
    if (wasOffline.current) {
      wasOffline.current = false;
      setBannerState("back-online");

      const timer = setTimeout(() => {
        setBannerState("hidden");
      }, 2000);

      return () => clearTimeout(timer);
    }

    // Connected on first mount — stay hidden
    setBannerState("hidden");
  }, [isConnected]);

  if (bannerState === "hidden") {
    return null;
  }

  const isOffline = bannerState === "offline";
  const backgroundColor = isOffline ? colors.error : colors.success;
  const message = isOffline ? "No internet connection" : "Back online";
  const Icon = isOffline ? WifiOff : Wifi;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      style={[
        styles.container,
        { backgroundColor, paddingTop: insets.top + spacing.xs },
      ]}
    >
      <Icon size={14} color={colors.white} style={styles.icon} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.sm,
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
