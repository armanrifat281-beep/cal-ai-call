import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  /** One or two sentences on what to do next. */
  body?: string;
  /** A decorative glyph. Kept small: it is not the point of the screen. */
  illustration?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  testID?: string;
}

/**
 * An empty list or screen.
 *
 * Left-aligned, not centred. A centred block with a large icon reads as a
 * marketing slot; aligning it with the rest of the screen's text makes it
 * read as part of the content, which is what it is.
 */
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
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
      }}
    >
      {illustration ? <View style={{ opacity: 0.75 }}>{illustration}</View> : null}

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="title2">{title}</Text>
        {body ? (
          <Text variant="callout" color="textMuted">
            {body}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Button label={actionLabel} variant="tonal" onPress={onAction} />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              label={secondaryActionLabel}
              variant="ghost"
              onPress={onSecondaryAction}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
