import { View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { BrandGradient, Text } from '@/components/ui';
import { ramps, useTheme } from '@/theme';

export interface AuthHeroProps {
  /** Two or three words per line; the line breaks are the caller's. */
  title: string;
  /** One sentence. Omitted on the shorter screens. */
  subtitle?: string;
  /** How tall the gradient runs. The form card overlaps its lower edge. */
  height?: number;
  /** Shown above the title, e.g. a back button. */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The top of an auth screen.
 *
 * An auth screen that opens with a 44px mark on a plain ground is a form,
 * not a product - every element on it carries the same weight, so nothing
 * tells the eye where to start. This gives the screen one thing worth
 * looking at before anything is typed, and the form card below overlaps its
 * lower edge so the two read as one surface rather than two stacked panels.
 *
 * Deep forest rather than the brand red: red is this app's warning colour,
 * and a sign-in page washed in it reads as an error state. The red appears
 * only as a faint bloom, and in the mark itself.
 */
const DEFAULT_HEIGHT = 356;

export function AuthHero({
  title,
  subtitle,
  height = DEFAULT_HEIGHT,
  leading,
  style,
}: AuthHeroProps) {
  const theme = useTheme();

  return (
    <BrandGradient extent="band" style={[{ height }, style]}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.gutter + 8,
          paddingTop: theme.spacing.huge,
          gap: theme.spacing.xl,
        }}
      >
        {leading ?? <BrandMark size={52} />}

        <View style={{ gap: theme.spacing.md }}>
          <Text
            variant="display"
            color={ramps.neutral[25]}
            style={{ fontSize: 42, lineHeight: 44, letterSpacing: -1.6 }}
          >
            {title}
          </Text>
          {subtitle === undefined ? null : (
            <Text
              variant="body"
              // Not `textMuted`: that token is tuned for the page ground, and
              // over the gradient it loses contrast.
              color="rgba(247,247,248,0.68)"
              style={{ maxWidth: 272 }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </BrandGradient>
  );
}
