import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  /** One or two sentences on what to do next. */
  body?: string;
  /** A large decorative glyph or illustration. */
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
}

export function EmptyState({
  title,
  body,
  illustration,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.base,
      }}
    >
      {illustration ? (
        <View style={{ marginBottom: theme.spacing.sm }}>{illustration}</View>
      ) : null}

      <Text variant="heading" align="center">
        {title}
      </Text>

      {body ? (
        <Text variant="bodySm" color="textMuted" align="center">
          {body}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: theme.spacing.md }}
        />
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <Button
          label={secondaryActionLabel}
          variant="ghost"
          size="sm"
          onPress={onSecondaryAction}
        />
      ) : null}
    </View>
  );
}
