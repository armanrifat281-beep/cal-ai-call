import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type SpacingKey } from '@/theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Turn off for full-bleed screens (camera). */
  scroll?: boolean;
  padding?: SpacingKey;
  /** Adds bottom inset padding. Off inside tab screens, which already inset. */
  edges?: { top?: boolean; bottom?: boolean };
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sticky footer outside the scroll area, e.g. a primary action. */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Standard screen shell: themed background, safe-area handling, optional
 * scrolling, pull-to-refresh, keyboard avoidance, and a sticky footer slot.
 */
export function Screen({
  children,
  scroll = true,
  padding = 'base',
  edges,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const paddingTop = edges?.top ? insets.top : 0;
  const paddingBottom = edges?.bottom ? insets.bottom : 0;

  const inner = (
    <View
      style={[
        { padding: theme.spacing[padding], gap: theme.spacing.base, flexGrow: 1 },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing ?? false}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary}
                />
              ) : undefined
            }
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}

        {footer ? (
          <View
            style={{
              paddingHorizontal: theme.spacing[padding],
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.md + paddingBottom,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              gap: theme.spacing.sm,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
