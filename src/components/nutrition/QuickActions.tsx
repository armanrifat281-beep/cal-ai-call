import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface QuickActionsProps {
  onScan: () => void;
  onSearch: () => void;
  onManual: () => void;
}

interface Action {
  key: string;
  label: string;
  icon: IconName;
  hint: string;
  /** The one the app is for, drawn in the accent. */
  lead?: boolean;
  onPress: () => void;
}

/**
 * The three ways to log a meal.
 *
 * Before this, home offered exactly one way to add a meal and it moved: an
 * "Add" link beside the Meals heading when the day had entries, and a button
 * inside the empty state when it did not. Photographing a meal - the thing
 * the app is for - could not be started from home at all.
 *
 * Three equal tiles, with the camera marked out by colour rather than by
 * size. The tab bar already carries a large camera button in its middle, so
 * a second full-width one here would be the same action twice on one
 * screenful; what this row is for is making the two quieter routes - looking
 * a food up, and writing one down - as easy to find as the loud one.
 */
export function QuickActions({ onScan, onSearch, onManual }: QuickActionsProps) {
  const theme = useTheme();

  const actions: Action[] = [
    {
      key: 'scan',
      label: 'Scan food',
      icon: 'camera',
      hint: 'Opens the camera to read the nutrition from a photo',
      lead: true,
      onPress: onScan,
    },
    {
      key: 'search',
      label: 'Search',
      icon: 'search',
      hint: 'Looks a food up in the nutrition database',
      onPress: onSearch,
    },
    {
      /*
        Where the designs show a microphone.

        This build has no speech recognition in it - adding one means a
        native module and a transcription service - so the tile does the
        thing the microphone was for, which is saying what you ate without
        photographing it, by typing instead. A mic that opens a keyboard
        would be a lie about the control.
      */
      key: 'manual',
      label: 'Describe',
      icon: 'pencil',
      hint: 'Write down what you ate',
      onPress: onManual,
    },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          onPress={action.onPress}
          haptic
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint={action.hint}
          style={{
            flex: 1,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            paddingVertical: theme.spacing.base,
            paddingHorizontal: theme.spacing.sm,
            // Centred, not left-aligned. Three equal tiles with labels of
            // different lengths read as ragged against the left edge, and
            // the glyph is the thing being pointed at.
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: action.lead
                ? theme.colors.primarySoft
                : theme.colors.surfaceAlt,
            }}
          >
            {/*
              22 in 44: the glyph fills half the tile's width rather than a
              third of it. At 19 in 38 it read as a small mark floating in a
              box, which is what made the row look unfinished.
            */}
            <Icon
              name={action.icon}
              size={22}
              color={action.lead ? 'primary' : 'text'}
              strokeWidth={1.8}
            />
          </View>

          <Text
            variant="caption"
            numberOfLines={1}
            style={{ fontWeight: '600', textAlign: 'center' }}
          >
            {action.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}
