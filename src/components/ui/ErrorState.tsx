import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  title?: string;
  /** Plain language. Never a stack trace. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
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

        {onRetry ? (
          <Button
            label={retryLabel}
            variant="ghost"
            size="sm"
            onPress={onRetry}
            style={{ marginTop: theme.spacing.xxs, marginLeft: -theme.spacing.sm }}
          />
        ) : null}
      </View>
    </View>
  );
}
