import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';

import { PressableScale, Text } from '@/components/ui';
import { AuthSpark } from '@/features/auth/AuthSheet';

/**
 * The first screen inside the app.
 *
 * It sits between creating an account and being asked four questions about
 * your body, and it exists because that jump was too abrupt: the app went
 * from a password field straight to "how tall are you" without ever saying
 * what it was going to do with the answer.
 *
 * Deliberately outside the theme, like the account screens are. The app
 * proper is a black page with a lime accent; this one moment is pale and
 * green, because it is a photograph of food with two sentences on it and a
 * photograph of food needs light around it. Hard-coded values are the honest
 * way to say that - a token meaning "mint even in dark mode" would be a lie
 * to every screen that read it.
 */
const PAPER = '#EFF6F1';
const INK = '#13201A';
const GREEN = '#17803D';
const MUTED = '#5B6B62';

export default function OnboardingIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: PAPER,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 268,
              height: 268,
              borderRadius: 134,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Image
              source={require('../../assets/welcome-meal.jpg')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              // Held in memory and on disk: this is the first thing drawn
              // after signing up, and a blank circle while it decodes is a
              // poor first frame.
              cachePolicy="memory-disk"
              transition={240}
              accessibilityLabel="A plated meal"
            />
          </View>

          {/*
            Two labels pointing into the plate.

            They are the claim the app is making, drawn rather than written:
            that it can tell you what is on a plate rather than only how many
            calories were in it. Non-interactive and hidden from a screen
            reader, which gets the same claim from the sentences below.
          */}
          <Callout
            label="Grilled chicken"
            style={{ top: 44, left: -4 }}
            leaderTo={{ x: 88, y: 26 }}
          />
          <Callout
            label="Fresh avocado"
            style={{ bottom: 46, left: 6 }}
            leaderTo={{ x: 82, y: -18 }}
          />
        </View>
      </View>

      <View style={{ gap: 14, paddingBottom: 8 }}>
        <Text
          variant="display"
          color={INK}
          style={{ fontSize: 40, lineHeight: 45, letterSpacing: -1.3 }}
        >
          Eat smart,{'\n'}
          <Text
            variant="display"
            color={GREEN}
            style={{ fontSize: 40, lineHeight: 45, letterSpacing: -1.3 }}
          >
            live better.
          </Text>
        </Text>

        <Text variant="body" color={MUTED} style={{ maxWidth: 320 }}>
          Photograph a meal and get its nutrition broken down — with every
          figure saying whether it was measured or estimated.
        </Text>

        <PressableScale
          onPress={() => router.push('/(onboarding)/basics')}
          haptic
          accessibilityRole="button"
          accessibilityLabel="Set up your profile"
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 18,
            borderRadius: 999,
            backgroundColor: GREEN,
          }}
        >
          <AuthSpark size={17} color="#FFFFFF" />
          <Text variant="headline" color="#FFFFFF" style={{ fontWeight: '700' }}>
            Set up my profile
          </Text>
        </PressableScale>

        {/*
          A way past it. Four questions before the app opens is already a
          lot to ask of someone who has not seen it work yet, and every
          answer can be given later in Profile.
        */}
        <Text
          variant="footnote"
          color={MUTED}
          align="center"
          style={{ fontWeight: '600' }}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Skip setup and open the app"
        >
          Skip for now
        </Text>
      </View>
    </View>
  );
}

/** A white pill with a dotted leader running into the photograph. */
function Callout({
  label,
  style,
  leaderTo,
}: {
  label: string;
  style: { top?: number; bottom?: number; left?: number; right?: number };
  leaderTo: { x: number; y: number };
}) {
  return (
    <View
      style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', ...style }}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          shadowColor: '#13201A',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <Text variant="caption" color={INK} style={{ fontWeight: '600' }}>
          {label}
        </Text>
      </View>

      <Svg
        width={Math.abs(leaderTo.x) + 10}
        height={Math.abs(leaderTo.y) + 10}
        style={{ marginLeft: 2 }}
      >
        <Line
          x1={2}
          y1={leaderTo.y < 0 ? Math.abs(leaderTo.y) : 4}
          x2={leaderTo.x}
          y2={leaderTo.y < 0 ? 4 : leaderTo.y}
          stroke={GREEN}
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
        <Circle
          cx={leaderTo.x}
          cy={leaderTo.y < 0 ? 4 : leaderTo.y}
          r={3.5}
          fill={GREEN}
        />
      </Svg>
    </View>
  );
}
