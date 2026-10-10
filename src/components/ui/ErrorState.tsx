import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  title?: string;
  /** Plain-language explanation. Never show a raw stack trace to the user. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra technical detail, collapsed by default. Dev builds only. */
  detail?: string;
  testID?: string;
}

export function ErrorState({
  title = 'Something went wrong',
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
        gap: theme.spacing.sm,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.dangerSoft,
        borderWidth: 1,
        borderColor: theme.colors.danger,
      }}
    >
      <Text variant="subheading" color="dangerOnSoft">
        {title}
      </Text>
      <Text variant="bodySm" color="dangerOnSoft">
        {message}
      </Text>

      {detail && __DEV__ ? (
        <Text variant="caption" color="dangerOnSoft" style={{ opacity: 0.8 }}>
          {detail}
        </Text>
      ) : null}

      {onRetry ? (
        <Button
          label={retryLabel}
          variant="secondary"
          size="sm"
          onPress={onRetry}
          style={{ marginTop: theme.spacing.xs }}
        />
      ) : null}
    </View>
  );
}
