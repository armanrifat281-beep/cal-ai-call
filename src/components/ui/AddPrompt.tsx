import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface AddPromptProps {
  /** What pressing it adds, e.g. "Add dinner". */
  label: string;
  onPress: () => void;
}

/**
 * A slot waiting to be filled.
 *
 * It replaced the line "Nothing here yet." under each empty meal. That line
 * was a status report on a screen the user opened in order to *do* something,
 * and it left the only way forward in a small "Add" link up in the section
 * heading.
 *
 * Dashed rather than solid, and tonal rather than filled: it has to read as
 * an opening in the list, not as another meal already in it.
 */
export function AddPrompt({ label, onPress }: AddPromptProps) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.99}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.base,
        borderRadius: theme.radius.surface,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.separator,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="plus" size={17} color="textMuted" strokeWidth={2} />
      </View>
      <Text variant="footnote" color="textMuted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </PressableScale>
  );
}
