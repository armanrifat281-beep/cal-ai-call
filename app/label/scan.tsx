import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Button, PressableScale, Text } from '@/components/ui';
import { isPlausibleBarcode } from '@/features/labels';
import { ramps, useTheme } from '@/theme';

/**
 * The barcode types printed on food packaging.
 *
 * Deliberately not every format the module can read: QR codes and the
 * industrial formats are not on groceries, and leaving them on means the
 * scanner fires on a poster behind the shelf.
 */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Point the camera at a packet.
 *
 * The lookup itself belongs to the next screen, which takes the code from
 * the route: a scan that fails can then be retried, shared or opened again
 * without re-scanning, and this screen stays about the camera.
 *
 * A barcode in frame fires continuously, several times a second. The ref
 * guard is what stops the first hit from pushing the same screen nine times
 * before the navigation animation has finished.
 */
export default function BarcodeScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  const onScanned = (code: string) => {
    if (handled.current) return;
    if (!isPlausibleBarcode(code)) return;

    handled.current = true;
    router.push(`/label/${code}`);
  };

  // `undefined` while the native module is still answering, despite the
  // type saying otherwise. Treating it as "denied" flashes the explanation
  // on every open.
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.gutter + 4,
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        <Icon name="scan" size={40} color="primary" strokeWidth={1.5} />
        <Text variant="title1">Let FoodLens use the camera</Text>
        <Text variant="body" color="textMuted">
          {permission.canAskAgain
            ? 'Scanning a barcode reads the product from a public food database. The photo itself never leaves your phone.'
            : 'Camera access is off for FoodLens. Turn it on in your phone’s settings to scan barcodes.'}
        </Text>

        {permission.canAskAgain ? (
          <Button
            label="Allow camera"
            onPress={() => void requestPermission()}
            fullWidth
            haptic
          />
        ) : null}

        <Button label="Go back" variant="secondary" onPress={() => router.back()} fullWidth />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={(result) => onScanned(result.data)}
      />

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: insets.top + theme.spacing.base,
          paddingBottom: insets.bottom + theme.spacing.xl,
          paddingHorizontal: theme.gutter,
          justifyContent: 'space-between',
        }}
        pointerEvents="box-none"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <RoundButton label="Close" icon="close" onPress={() => router.back()} />
          <RoundButton
            label={torch ? 'Turn the light off' : 'Turn the light on'}
            icon="sparkle"
            onPress={() => setTorch((on) => !on)}
            active={torch}
          />
        </View>

        {/* A window rather than a full-frame reticle: a barcode is wide and
            short, and a square target makes people hold the packet wrong. */}
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <View
            style={{
              width: '82%',
              aspectRatio: 2.6,
              borderRadius: theme.radius.media,
              borderWidth: 2,
              borderColor: 'rgba(247,247,248,0.9)',
            }}
          />
          <Text variant="footnote" color="rgba(247,247,248,0.86)">
            Line up the barcode on the packet
          </Text>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text variant="caption" color="rgba(247,247,248,0.72)">
            Products come from Open Food Facts, an open database
          </Text>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  label,
  icon,
  onPress,
  active = false,
}: {
  label: string;
  icon: 'close' | 'sparkle';
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active
          ? 'rgba(247,247,248,0.92)'
          : 'rgba(18,17,16,0.55)',
      }}
    >
      <Icon
        name={icon}
        size={20}
        color={active ? ramps.neutral[900] : ramps.neutral[25]}
        strokeWidth={2}
      />
    </PressableScale>
  );
}
