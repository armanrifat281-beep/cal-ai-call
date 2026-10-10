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

import { useTheme } from '@/theme';

import { Text } from './Text';

export interface ScreenProps {
  children: React.ReactNode;
  /**
   * A large title rendered at the top of the content, iOS-style.
   *
   * Preferred over a navigator header for the tab screens: it scrolls away
   * with the content, which gives the screen its full height back.
   */
  title?: string;
  /** One supporting line under the title. */
  subtitle?: string;
  /** A control sitting opposite the title, e.g. an icon button. */
  titleAction?: React.ReactNode;
  /** Wrap content in a ScrollView. Off for full-bleed screens. */
  scroll?: boolean;
  /** Horizontal inset. Set to 'none' to run content to the edges. */
  inset?: 'gutter' | 'none';
  edges?: { top?: boolean; bottom?: boolean };
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sticky footer outside the scroll area. */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The standard screen shell.
 *
 * Owns the things that must not vary between screens: the page colour, the
 * safe-area handling, the horizontal inset, the vertical rhythm between
 * blocks, keyboard avoidance, and the footer treatment. Screens that
 * hand-rolled these drifted apart, which is a large part of why the app did
 * not feel like one product.
 */
export function Screen({
  children,
  title,
  subtitle,
  titleAction,
  scroll = true,
  inset = 'gutter',
  edges,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const horizontal = inset === 'gutter' ? theme.gutter : 0;
  const paddingTop = edges?.top ? insets.top : 0;
  const paddingBottom = edges?.bottom ? insets.bottom : 0;

  const header = title ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: horizontal,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
      }}
    >
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text variant="display">{title}</Text>
        {subtitle ? (
          <Text variant="callout" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {titleAction}
    </View>
  ) : null;

  const body = (
    <View
      style={[
        {
          paddingHorizontal: horizontal,
          paddingTop: title ? theme.spacing.base : theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.blockGap,
          flexGrow: 1,
        },
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
            // iOS momentum feels wrong without this on a long content page.
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing ?? false}
                  onRefresh={onRefresh}
                  // `tintColor` is the iOS spinner; Android reads `colors`
                  // and the disc behind it, and ignored the theme entirely
                  // without them.
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                />
              ) : undefined
            }
          >
            {header}
            {body}
          </ScrollView>
        ) : (
          <>
            {header}
            {body}
          </>
        )}

        {footer ? (
          <View
            style={{
              paddingHorizontal: horizontal === 0 ? theme.gutter : horizontal,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.md + paddingBottom,
              gap: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              borderTopWidth: theme.hairline,
              borderTopColor: theme.colors.separator,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
