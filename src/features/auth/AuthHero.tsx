import { View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface AuthHeroProps {
  /** Two or three words per line; the line breaks are the caller's. */
  title: string;
  /** One sentence. Omitted on the shorter screens. */
  subtitle?: string;
  /** How tall the hero runs. The form card sits directly below it. */
  height?: number;
  /** Shown above the title, e.g. a back button. */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The top of an auth screen.
 *
 * On the app's own paper, in the app's own type. It was a full-bleed forest
 * gradient with a card overlapping it, which had two faults: the screen did
 * not match the cream app waiting behind it, so creating an account looked
 * like a different product from using one, and a 356px wash of colour above
 * four fields made the decoration the loudest thing on a page whose job is
 * to be typed into.
 *
 * What it keeps is the reason the gradient existed: a plain mark over plain
 * fields gives the eye nowhere to start. The title still carries the screen,
 * at display size against the page, with a hairline rule under it instead of
 * a colour change to mark where the form begins.
 */
const DEFAULT_HEIGHT = 196;

export function AuthHero({
  title,
  subtitle,
  height = DEFAULT_HEIGHT,
  leading,
  style,
}: AuthHeroProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          minHeight: height,
          justifyContent: 'flex-end',
          paddingHorizontal: theme.gutter + 4,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.lg,
          backgroundColor: theme.colors.background,
        },
        style,
      ]}
    >
      {leading ?? <BrandMark size={40} />}

      <View style={{ gap: theme.spacing.sm }}>
        <Text
          variant="display"
          style={{ fontSize: 34, lineHeight: 38, letterSpacing: -1.1 }}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text variant="footnote" color="textMuted" style={{ maxWidth: 312 }}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}
