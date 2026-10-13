import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/features/auth';
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
  const { status } = useAuth();

  /*
    Signing out used to leave the user standing in the app.

    The boot gate only runs when the app launches, so a session that ended
    while someone was inside it - by signing out, or by the session expiring
    - left them on the Profile tab, still looking at tabs full of an account
    they no longer had. This sends them back to the welcome screen the moment
    the session goes, and covers expiry as well as sign-out, because neither
    should leave a signed-out person inside the app.

    `signed_out` specifically, never `loading`: the stored session is read
    asynchronously on launch, and treating "not yet known" as "signed out"
    would throw a signed-in user out of their own app for the first frame.
  */
  if (status === 'signed_out') return <Redirect href="/(auth)/welcome" />;

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
