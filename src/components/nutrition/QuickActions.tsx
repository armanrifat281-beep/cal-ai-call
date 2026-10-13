import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

interface Action {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** The one that gets the filled treatment. Exactly one, by convention. */
  primary?: boolean;
}

export interface QuickActionsProps {
  onScan: () => void;
  onSearch: () => void;
  onManual: () => void;
}

/**
 * The three ways to log a meal, in one fixed place.
 *
 * Before this, home offered exactly one way to add a meal and it moved: an
 * "Add" link beside the Meals heading when the day had entries, and a button
 * inside the empty state when it did not. Photographing a meal - the thing
 * the app is for - could not be started from home at all; it needed a trip
 * to another tab.
 *
 * Scan is filled and wider because it is the primary act, and because one
 * filled control among three removes the question of which to press.
 */
export function QuickActions({ onScan, onSearch, onManual }: QuickActionsProps) {
  const theme = useTheme();

  const actions: Action[] = [
    { key: 'scan', label: 'Scan', icon: 'camera', onPress: onScan, primary: true },
    { key: 'search', label: 'Search', icon: 'search', onPress: onSearch },
    { key: 'manual', label: 'By hand', icon: 'pencil', onPress: onManual },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          onPress={action.onPress}
          haptic
          accessibilityRole="button"
          accessibilityLabel={
            action.key === 'scan'
              ? 'Photograph a meal'
              : action.key === 'search'
                ? 'Search for a food'
                : 'Add a meal by hand'
          }
          style={{
            // Scan takes twice the share, so the row reads as one primary
            // action with two alternatives rather than three equal tiles.
            flex: action.primary === true ? 2 : 1,
            height: 78,
            borderRadius: theme.radius.surface,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            backgroundColor:
              action.primary === true ? theme.colors.primary : theme.colors.surface,
            borderWidth: action.primary === true ? 0 : theme.hairline,
            borderColor: theme.colors.separator,
          }}
        >
          <Icon
            name={action.icon}
            size={action.primary === true ? 22 : 21}
            color={action.primary === true ? theme.colors.background : 'textMuted'}
            strokeWidth={1.8}
          />
          <Text
            variant="caption"
            color={action.primary === true ? theme.colors.background : 'text'}
            style={{ fontWeight: action.primary === true ? '700' : '600' }}
          >
            {action.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}
