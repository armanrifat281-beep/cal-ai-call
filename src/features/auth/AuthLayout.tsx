import { View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Disclosure, ErrorState, OfflineNotice, Screen, Text } from '@/components/ui';
import type { AppError } from '@/lib/result';
import { useTheme } from '@/theme';

import { useAuth } from './AuthProvider';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  /** The fields. */
  children: React.ReactNode;
  /** The buttons, pinned to the bottom. */
  footer: React.ReactNode;
  /** Shown above the fields when a request failed. */
  error?: AppError | null;
  onRetry?: () => void;
  /** What needs a connection, in a few words. */
  offlineMessage: string;
  /** Explains what cannot work yet when no backend is configured. */
  unavailableDetail: string;
}

/**
 * The frame every auth screen shares.
 *
 * The form is always rendered, including when no backend is configured.
 * An earlier version replaced the whole screen with a notice in that case,
 * which was over-cautious to the point of being wrong: it meant the app
 * had no login page at all to look at, set up or hand to a designer, and
 * the brief was to build the integration-ready interface rather than hide
 * it until credentials arrive.
 *
 * Nothing pretends to work. The notice sits above the fields, before
 * anything is typed, and submitting returns the same plain
 * "not configured" the service already produces rather than a fake
 * success.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  error,
  onRetry,
  offlineMessage,
  unavailableDetail,
}: AuthLayoutProps) {
  const theme = useTheme();
  const { status } = useAuth();
  const unavailable = status === 'unavailable';

  return (
    <Screen
      edges={{ bottom: true }}
      // Centred rather than stacked from the top. These are short forms, and
      // left at the top they sit above a large empty area with the buttons
      // stranded at the bottom of it.
      contentStyle={{ gap: theme.spacing.xl, justifyContent: 'center' }}
      footer={footer}
    >
      <View style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <BrandMark size={44} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text
            variant="display"
            style={{ fontSize: 34, lineHeight: 39, letterSpacing: -0.9 }}
          >
            {title}
          </Text>
          <Text variant="body" color="textMuted">
            {subtitle}
          </Text>
        </View>
      </View>

      {unavailable ? (
        <Disclosure
          summary="Accounts are not set up in this build"
          detail={unavailableDetail}
          tone="caution"
        />
      ) : null}

      <OfflineNotice message={offlineMessage} />

      {error ? (
        <ErrorState message={error.message} detail={error.detail} onRetry={onRetry} />
      ) : null}

      <View style={{ gap: theme.spacing.base }}>{children}</View>
    </Screen>
  );
}
