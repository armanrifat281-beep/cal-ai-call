import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { useIsOffline } from '@/lib/useIsOffline';
import { useTheme } from '@/theme';

import { Text } from './Text';

export interface OfflineNoticeProps {
  /** What stops working offline, e.g. "Creating recipes needs a connection." */
  message: string;
}

/**
 * A quiet line shown only while the device is offline.
 *
 * Deliberately narrow in scope: most of this app is local-first and keeps
 * working with no connection, so a blanket "you are offline" banner on every
 * screen would be noise. This is placed on the screens whose primary action
 * genuinely requires the network, and it says which action is affected
 * rather than just announcing the state.
 */
export function OfflineNotice({ message }: OfflineNoticeProps) {
  const theme = useTheme();
  const isOffline = useIsOffline();

  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      accessibilityLiveRegion="polite"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.control,
          backgroundColor: theme.colors.warningSoft,
        }}
      >
        <Icon name="warning" size={16} color="warningOnSoft" strokeWidth={1.8} />
        <Text variant="footnote" color="warningOnSoft" style={{ flex: 1 }}>
          No connection. {message}
        </Text>
      </View>
    </Animated.View>
  );
}
