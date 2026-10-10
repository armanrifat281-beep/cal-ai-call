import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  destructive?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A tappable settings/list row with consistent padding and hit target. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityHint,
  destructive = false,
  testID,
  style,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </>
  );

  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.minTouchTarget + 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
  };

  if (!onPress) {
    return <View testID={testID} style={[baseStyle, style]}>{content}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        baseStyle,
        { backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent' },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
