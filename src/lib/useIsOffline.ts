import { useNetworkState } from 'expo-network';

/**
 * Whether the device currently has no usable internet connection.
 *
 * Both fields are optional and start undefined while the platform works it
 * out, so this treats unknown as ONLINE. Flashing an offline banner on every
 * cold start, before the first check resolves, would be worse than being a
 * second late to notice a real outage.
 *
 * `isInternetReachable` is preferred over `isConnected` where the platform
 * provides it: being attached to a captive-portal wifi counts as connected
 * and is not usable.
 */
export function useIsOffline(): boolean {
  const state = useNetworkState();

  if (state.isInternetReachable === false) return true;
  if (state.isInternetReachable === undefined && state.isConnected === false) {
    return true;
  }
  return false;
}
