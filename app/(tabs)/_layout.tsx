import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { PressableScale } from '@/components/ui';
import { tabBarMetrics, useTheme } from '@/theme';

/**
 * The five main tabs, with the camera in the middle.
 *
 * Home and Meals are the two screens people open; Progress and Profile are
 * the two they visit. Between them, raised out of the bar, is the thing the
 * app is actually for - photographing a plate - as a filled circle rather
 * than a fifth identical glyph. It is the only control in the app that is
 * reachable from every screen, which is right: the moment someone wants to
 * log a meal is never a moment they planned.
 *
 * Discover, Recipes, Insights and the journal all live in this group so they
 * keep the bar while open, but none of them is a tab: `href: null` hides the
 * button. Five is already the practical limit on a phone.
 */
const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  meals: 'meals',
  progress: 'insights',
  profile: 'profile',
};

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
  */

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          // No hairline above the bar. On a black page the bar is already a
          // step lighter than the content behind it, and a border on top of
          // that reads as a seam.
          borderTopWidth: 0,
          elevation: 0,
          // Room for the gesture bar under the labels, rather than behind
          // them. A fixed height would take that strip out of the bar.
          ...tabBarMetrics(insets.bottom),
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
            color={focused ? theme.colors.primary : theme.colors.textSubtle}
            size={23}
            filled={focused}
            strokeWidth={focused ? 2 : 1.7}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals' }} />

      {/*
        The camera. A button, not a tab: it has no label, it does not take
        the active tint, and it sits above the bar rather than in it.
      */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarLabel: () => null,
          tabBarButton: (props) => <CameraButton {...props} />,
        }}
      />

      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/*
        Reachable, but not from the bar.

        Journal is off the bar at the user's request, NOT deleted. It is the
        only screen that can reach a day more than one step from today, so
        removing the file would take past weeks - and editing or deleting any
        meal logged in them - with it.
      */}
      <Tabs.Screen name="discover" options={{ title: 'Discover', href: null }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes', href: null }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', href: null }} />
      <Tabs.Screen name="journal" options={{ title: 'History', href: null }} />
    </Tabs>
  );
}

/**
 * The raised camera button in the middle of the bar.
 *
 * It takes the navigator's own press handler rather than routing itself, so
 * it behaves exactly like a tab - including going back to the scanner's
 * first screen when it is already open.
 */
function CameraButton({
  onPress,
  accessibilityState,
}: {
  onPress?: (event: never) => void;
  accessibilityState?: { selected?: boolean };
}) {
  const theme = useTheme();
  const selected = accessibilityState?.selected ?? false;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
      <PressableScale
        onPress={() => onPress?.(undefined as never)}
        haptic
        accessibilityRole="button"
        accessibilityLabel="Scan a meal"
        accessibilityHint="Opens the camera to read the nutrition from a photo"
        accessibilityState={{ selected }}
        scaleTo={0.9}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          // Lifted out of the bar. The bar's own top edge runs underneath,
          // which is what makes the circle read as sitting on top of it.
          marginTop: -20,
          // A ring in the page colour, so the circle is cleanly separated
          // from the bar rather than merging with it at the overlap.
          borderWidth: 4,
          borderColor: theme.colors.background,
          ...theme.elevation(2),
        }}
      >
        <Icon
          name="camera"
          size={25}
          color={theme.colors.textOnPrimary}
          strokeWidth={1.9}
        />
      </PressableScale>
    </View>
  );
}
