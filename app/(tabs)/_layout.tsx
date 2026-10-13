import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/theme';

/**
 * The five main tabs.
 *
 * Insights is not a tab: it is reached from a card on Home and a row in
 * Profile. Five tabs is already the practical limit on a phone, and Scan and
 * Recipes are both things people reach for many times a day, where Insights
 * is something they read occasionally.
 */
const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  scan: 'scan',
  recipes: 'recipes',
  discover: 'search',
  journal: 'journal',
  // A person, not a gear. Labelled and drawn as settings, the destination
  // holding the account, the name and the email read as a utility screen,
  // and the Profile the app is supposed to have looked missing.
  profile: 'profile',
};

export default function TabsLayout() {
  const theme = useTheme();

  /*
    No session guard here, deliberately.

    This layout used to redirect to the welcome screen whenever the session
    read as signed out. It was meant to stop a sign-out leaving someone
    standing inside the app, and it did - but a layout guard fires on every
    render, so any momentary gap in the session threw the user out of
    whatever they were doing. That is a far worse fault than the one it
    fixed, and it is impossible to tell apart from a crash.

    Leaving is now driven by the action that causes it: signing out and
    deleting an account both navigate on success, in `(tabs)/profile.tsx`.
    A session that dies on its own surfaces as a 401 with "your session
    expired, sign in again", which the services already produce.
  */

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
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      {/*
        Named for what it holds - the account, preferences, privacy and the
        way out - rather than for the word "settings", which described the
        bottom half of the screen and hid the top half.
      */}
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/*
        Insights and Journal live here so they keep the tab bar while open,
        but neither is itself a tab: href null hides the button.

        Journal is off the bar at the user's request, NOT deleted. It is the
        only screen that can reach a day other than today - Home is fixed to
        `todayKey()` - so removing the file would take past days, and editing
        or deleting any meal logged before today, with it. Home and Discover
        both link to it.
      */}
      <Tabs.Screen name="insights" options={{ title: 'Insights', href: null }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', href: null }} />
    </Tabs>
  );
}
