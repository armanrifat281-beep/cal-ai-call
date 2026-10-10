import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  journal: 'journal',
  insights: 'insights',
  profile: 'profile',
};

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          // Android draws its own elevation shadow, which clashes with the
          // hairline border we use on both platforms.
          elevation: 0,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: theme.spacing.sm,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.caption.fontSize,
          fontWeight: '600',
        },
        // The navigator hands back an opaque ColorValue, so we resolve the
        // tint from the theme ourselves and keep the Icon API to real strings.
        tabBarIcon: ({ focused }) => (
          <Icon
            name={TAB_ICONS[route.name] ?? 'home'}
            color={focused ? theme.colors.primary : theme.colors.textMuted}
            size={24}
            filled={focused}
            strokeWidth={focused ? 2 : 1.7}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
