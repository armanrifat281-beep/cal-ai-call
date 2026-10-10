import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export function Divider({ inset = 0, style }: { inset?: number; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={[
        { height: 1, backgroundColor: theme.colors.border, marginLeft: inset },
        style,
      ]}
    />
  );
}
