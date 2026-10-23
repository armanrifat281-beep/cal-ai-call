import { Platform } from 'react-native';

/**
 * How tall the tab bar is, given the system's bottom inset.
 *
 * Android is drawn edge to edge, so the window runs underneath the gesture
 * bar. A fixed height here is a height that *includes* that strip: the bar
 * had `height: 64`, and on every phone with gesture navigation the labels
 * sat behind the system's own handle, cramped against the bottom of the
 * screen. The inset belongs under the labels, not over them.
 *
 * Its own height is smaller on iOS because the home indicator's inset is
 * larger there; the visible bar ends up about the same on both.
 */
const OWN_HEIGHT = Platform.OS === 'ios' ? 52 : 60;

export interface TabBarMetrics {
  height: number;
  paddingBottom: number;
}

export function tabBarMetrics(bottomInset: number): TabBarMetrics {
  return {
    height: OWN_HEIGHT + bottomInset,
    paddingBottom: bottomInset,
  };
}

/** The bar's height before the system's strip is added. Tests read this. */
export const TAB_BAR_OWN_HEIGHT = OWN_HEIGHT;
