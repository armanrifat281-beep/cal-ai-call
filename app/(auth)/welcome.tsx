import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import {
  AUTH_INK,
  AUTH_ORANGE,
  AUTH_SHEET,
  AuthSpark,
} from '@/features/auth/AuthSheet';
import { AuthButton } from '@/features/auth/AuthSheetControls';

/**
 * The first screen anyone sees.
 *
 * One mark, one sentence, two doors. Nothing else: this screen's whole job
 * is to say what the app is called and let the user in, and every feature
 * it tried to describe before was a sentence read by someone who had not yet
 * decided to care.
 *
 * Orange at the top washing into cream at the bottom, so the buttons sit on
 * paper while the mark sits in colour. It is the same orange the account
 * sheets are drawn on, which makes signing in feel like a continuation of
 * this screen rather than a jump to a different product.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: AUTH_ORANGE }}>
      <LinearGradient
        // Held solid through the top half so the mark sits in colour, then
        // opened out over the bottom third. A ramp that starts at the top
        // leaves the wordmark on a dirty half-tint.
        colors={[AUTH_ORANGE, AUTH_ORANGE, '#FFC4A8', AUTH_SHEET]}
        locations={[0, 0.34, 0.72, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
        }}
      >
        {/*
          The mark sits above centre rather than on it. Dead centre puts it
          exactly between two equal voids, which reads as unplaced; a third
          of the way down is where the eye expects the subject of a poster.
        */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: 18, marginBottom: 80 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AuthSpark size={58} color={AUTH_ORANGE} />
            </View>

            <Text
              variant="display"
              color="#FFFFFF"
              style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.4 }}
            >
              FoodLens AI
            </Text>
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Text
            variant="body"
            color={AUTH_INK}
            align="center"
            style={{ marginBottom: 6 }}
          >
            From fridge to fork, let AI do the thinking.
          </Text>

          <AuthButton label="Sign In" onPress={() => router.push('/(auth)/sign-in')} />

          {/*
            A quieter second door. Two filled buttons side by side is how a
            screen ends up with no answer to "what do I press" - and the one
            to press first is the one a returning user needs.
          */}
          <AuthButton
            label="Create Account"
            variant="outline"
            labelColor={AUTH_ORANGE}
            onPress={() => router.push('/(auth)/sign-up')}
          />
        </View>
      </View>
    </View>
  );
}
