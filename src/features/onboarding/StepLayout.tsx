import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface StepLayoutProps {
  /** 1-based position of this step. */
  step: number;
  totalSteps: number;
  title: string;
  /** One or two sentences on what this step is for. */
  subtitle?: string;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  /** Shown as a quiet text button. Every optional step has one. */
  skipLabel?: string;
  onSkip?: () => void;
}

/** Shared frame for onboarding steps: progress, heading, content, actions. */
export function StepLayout({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  skipLabel,
  onSkip,
}: StepLayoutProps) {
  const theme = useTheme();

  return (
    <Screen
      edges={{ top: true, bottom: true }}
      footer={
        <>
          <Button
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            size="lg"
            fullWidth
            haptic
          />
          {/*
            Same colour as the primary action, because every button in the
            app is, but smaller and not full width. With both stretched to
            the edges they read as two equal choices, and skipping is not
            equal to continuing.
          */}
          {skipLabel && onSkip ? (
            <Button
              label={skipLabel}
              variant="ghost"
              size="sm"
              onPress={onSkip}
              style={{ alignSelf: 'center' }}
            />
          ) : null}
        </>
      }
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${totalSteps}`}
        accessibilityValue={{ min: 1, max: totalSteps, now: step }}
        style={{ flexDirection: 'row', gap: theme.spacing.xs }}
      >
        {Array.from({ length: totalSteps }, (_unused, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                index < step ? theme.colors.primary : theme.colors.surfaceAlt,
            }}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" color="textMuted">
          STEP {step} OF {totalSteps}
        </Text>
        <Text variant="title1">{title}</Text>
        {subtitle ? (
          <Text variant="body" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.base, flex: 1 }}>{children}</View>
    </Screen>
  );
}
