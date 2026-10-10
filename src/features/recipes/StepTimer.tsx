import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { formatCountdown, useCountdown } from './useCountdown';

export interface StepTimerProps {
  /** The step's stated duration. */
  minutes: number;
}

/**
 * A timer for the step you are on.
 *
 * The recipe already said "simmer for twelve minutes", and the app then
 * left the user to find their phone's clock app with wet hands. This runs
 * the twelve minutes where the instruction is.
 *
 * It stays quiet: a haptic tap when the time is up and a change of state on
 * screen, with no notification and no sound. A cooking timer that demands
 * attention from the lock screen is the sort of thing this app is meant not
 * to do.
 */
export function StepTimer({ minutes }: StepTimerProps) {
  const theme = useTheme();

  const handleFinish = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {
        // A device without haptics still shows the finished state.
      },
    );
  }, []);

  const timer = useCountdown(minutes * 60, handleFinish);
  const isFinished = timer.status === 'finished';
  const isIdle = timer.status === 'idle';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.control,
        backgroundColor: isFinished ? theme.colors.successSoft : theme.colors.surfaceAlt,
      }}
    >
      <Icon
        name={isFinished ? 'check' : 'timer'}
        size={17}
        color={isFinished ? 'successOnSoft' : 'textMuted'}
        strokeWidth={1.7}
      />

      <Text
        variant="metricM"
        color={isFinished ? 'successOnSoft' : 'text'}
        accessibilityLiveRegion={isFinished ? 'polite' : 'none'}
        accessibilityLabel={
          isFinished
            ? 'Time is up'
            : `${timer.remainingSeconds} seconds left of ${minutes} minutes`
        }
        style={{ flex: 1 }}
      >
        {isFinished ? 'Time is up' : formatCountdown(timer.remainingSeconds)}
      </Text>

      {isIdle ? (
        <Button label="Start" variant="secondary" size="sm" onPress={timer.start} haptic />
      ) : isFinished ? (
        <Button label="Reset" variant="ghost" size="sm" onPress={timer.reset} />
      ) : (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <Button
            label={timer.status === 'running' ? 'Pause' : 'Resume'}
            variant="secondary"
            size="sm"
            onPress={timer.status === 'running' ? timer.pause : timer.resume}
          />
          <Button label="Reset" variant="ghost" size="sm" onPress={timer.reset} />
        </View>
      )}
    </View>
  );
}
