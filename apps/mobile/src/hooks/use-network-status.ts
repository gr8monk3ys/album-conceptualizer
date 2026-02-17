/** Hook to track network connectivity status using NetInfo. */
import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

/**
 * Returns real-time network connectivity status.
 *
 * - `isConnected` — whether a network interface is available (Wi-Fi, cellular, etc.)
 * - `isInternetReachable` — whether the device can actually reach the internet
 *   (null while still determining)
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    // Fetch current state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      setStatus({
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
    });

    return unsubscribe;
  }, []);

  return status;
}
