import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/ui';
import { ramps } from '@/theme';

/**
 * The way back out of an auth form.
 *
 * Passed as the hero's `leading`, which replaces the brand mark: these
 * screens have no navigation header, deliberately, so without this there is
 * no visible way back from sign-up to the welcome screen - only the Android
 * hardware button and the iOS edge swipe, neither of which is on screen.
 *
 * Drawn as a translucent disc rather than with `IconButton`, whose variants
 * all render a red gradient disc tuned for the page ground; over the hero's
 * forest gradient that reads as an alert rather than as navigation.
 */
export function AuthBackButton() {
  const router = useRouter();

  return (
    <View style={{ flexDirection: 'row' }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={10}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(247,247,248,0.14)',
        }}
      >
        <Icon
          name="chevronLeft"
          size={20}
          color={ramps.neutral[25]}
          strokeWidth={2.2}
        />
      </PressableScale>
    </View>
  );
}
