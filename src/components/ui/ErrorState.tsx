import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  title?: string;
  /** Plain language. Never a stack trace. */
  message: string;
  /** Try the same thing again. For a failure that might not repeat. */
  onRetry?: () => void;
  retryLabel?: string;
  /**
   * A different way forward, for a failure that retrying cannot fix.
   *
   * Signing in with details that match no account is the case this exists
   * for: the useful next step is to create one, and without it the user is
   * left pressing the same button against the same answer.
   */
  action?: { label: string; onPress: () => void };
  /** Technical detail, shown in development builds only. */
  detail?: string;
  testID?: string;
}

/**
 * An inline failure.
 *
 * A tinted surface with no outline, and the icon carrying the signal rather
 * than a red border. The developer detail is rendered only in a development
 * build, so a release build never shows a user a SQLSTATE.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
  detail,
  testID,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.base,
        borderRadius: theme.radius.control,
        backgroundColor: theme.colors.dangerSoft,
      }}
    >
      <Icon name="warning" size={19} color="dangerOnSoft" strokeWidth={1.8} />

      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        {title ? (
          <Text variant="headline" color="dangerOnSoft">
            {title}
          </Text>
        ) : null}
        <Text variant="callout" color="dangerOnSoft">
          {message}
        </Text>

        {detail && __DEV__ ? (
          <Text variant="caption" color="dangerOnSoft" style={{ opacity: 0.75 }}>
            {detail}
          </Text>
        ) : null}

        {onRetry || action ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: theme.spacing.xxs,
              marginLeft: -theme.spacing.sm,
            }}
          >
            {onRetry ? (
              <Button label={retryLabel} variant="ghost" size="sm" onPress={onRetry} />
            ) : null}
            {action ? (
              <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
