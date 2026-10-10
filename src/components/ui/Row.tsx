import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface RowProps {
  title: string;
  /** Supporting line under the title. */
  subtitle?: string;
  /** Leading slot: an icon, a thumbnail, a checkbox. */
  leading?: React.ReactNode;
  /** Trailing slot: a value, a chevron, a switch. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Adds a hairline above this row. Set on every row except the first. */
  divided?: boolean;
  destructive?: boolean;
  haptic?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One row inside a `Surface variant="grouped"`.
 *
 * The separator is drawn by the row, inset past the leading slot, which is
 * how native list groups look. Drawing a full-width line under an icon is a
 * small thing that immediately reads as unconsidered.
 */
export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  divided = false,
  destructive = false,
  haptic = false,
  accessibilityHint,
  testID,
  style,
}: RowProps) {
  const theme = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchTarget + 6,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.base,
      }}
    >
      {leading ? <View style={{ width: 26, alignItems: 'center' }}>{leading}</View> : null}

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View>{trailing}</View> : null}
    </View>
  );

  const divider = divided ? (
    <View
      style={{
        height: theme.hairline,
        backgroundColor: theme.colors.separator,
        // Inset past the leading slot, as a native list group does.
        marginLeft: leading ? theme.spacing.base + 26 + theme.spacing.md : theme.spacing.base,
      }}
    />
  ) : null;

  if (!onPress) {
    return (
      <View testID={testID} style={style}>
        {divider}
        {body}
      </View>
    );
  }

  return (
    <View style={style}>
      {divider}
      <PressableScale
        testID={testID}
        onPress={onPress}
        haptic={haptic}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        accessibilityHint={accessibilityHint}
        // A row is wide; scaling it as much as a button looks wobbly.
        scaleTo={0.99}
      >
        {body}
      </PressableScale>
    </View>
  );
}
