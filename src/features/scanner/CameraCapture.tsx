import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Button, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export interface CameraCaptureProps {
  /** A file URI for the frame just captured. */
  onCaptured: (uri: string) => void;
  /** Open the photo library instead. */
  onPickFromLibrary: () => void;
  /** Leave the camera without taking anything. */
  onClose: () => void;
  /** Skip the photo and type the meal in. */
  onAddByHand: () => void;
  /** Read a packet's barcode instead of photographing the food. */
  onScanBarcode: () => void;
  /** True while the captured frame is being validated and resized. */
  busy?: boolean;
  /**
   * A line of status set between the close and torch buttons, e.g.
   * "Preparing your photo".
   *
   * In the viewfinder rather than on a screen after it, because what it
   * reports happens while the user is still holding the phone up at the
   * plate. A spinner alone there reads as the camera having frozen.
   */
  status?: string | null;
}

/**
 * The camera, in the app.
 *
 * This replaced a square placeholder panel with a "Take a photo" button that
 * handed off to the operating system's camera app. That worked, but it meant
 * the one thing this app exists to do happened somewhere else: no framing
 * guides while you aimed, no way to say what makes a readable photo at the
 * moment it matters, and a jarring trip out of the app and back.
 *
 * The controls sit on their own darkened ground at the bottom rather than
 * floating over the middle of the frame, so nothing the user is trying to
 * photograph is ever covered by a button.
 *
 * Deliberately absent: a remaining-scans counter. The allowance is checked
 * on the server inside `analyze-meal` and the app has no endpoint for
 * reading it, so a number here would be invented.
 */
const SHUTTER = 78;
const GUIDE = 38;

export function CameraCapture({
  onCaptured,
  onPickFromLibrary,
  onClose,
  onAddByHand,
  onScanBarcode,
  busy = false,
  status = null,
}: CameraCaptureProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const camera = useRef<CameraView>(null);

  const capture = async () => {
    // The module's own guidance: a capture before the preview is ready can
    // come back empty.
    if (!ready || busy) return;
    const photo = await camera.current?.takePictureAsync({ skipProcessing: false });
    if (photo?.uri !== undefined) onCaptured(photo.uri);
  };

  // A nullish check, not `=== null`: the hook is typed `PermissionResponse |
  // null` but reports undefined until the native module has answered, and
  // reading `.granted` off that crashed the screen.
  if (permission === null || permission === undefined) {
    // Still being read. A spinner would flash on most launches, so the
    // frame simply stays black until the answer arrives.
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          paddingHorizontal: theme.gutter,
          gap: theme.spacing.lg,
        }}
      >
        <Icon name="camera" size={40} color="textMuted" strokeWidth={1.4} />
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title2">Let FoodLens use the camera</Text>
          <Text variant="body" color="textMuted">
            Photos are resized on this device and sent only for analysis. You can
            type meals in by hand instead, and you can change this later in your
            phone&apos;s settings.
          </Text>
        </View>
        <Button
          label="Allow the camera"
          onPress={() => void requestPermission()}
          size="lg"
          fullWidth
          haptic
        />
        <Button label="Add a meal by hand" variant="ghost" onPress={onAddByHand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView
        ref={camera}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        facing="back"
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      <FramingGuides />

      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.spacing.md,
          left: theme.gutter,
          right: theme.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <GlassButton label="Close the camera" icon="close" onPress={onClose} />

        {status ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={status}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text variant="caption" color="#FFFFFF" style={{ fontWeight: '600' }}>
              {status}
            </Text>
          </View>
        ) : null}

        <GlassButton
          label={torch ? 'Turn the light off' : 'Turn the light on'}
          icon="flame"
          active={torch}
          onPress={() => setTorch((on) => !on)}
        />
      </View>

      {/* The one instruction that most affects whether a photo can be read,
          in the place the user is actually looking. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 196 + insets.bottom,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <Text variant="body" color="rgba(255,255,255,0.72)">
          Fit the whole plate in the frame
        </Text>
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.spacing.xxl,
          paddingBottom: insets.bottom + theme.spacing.xl,
          paddingTop: theme.spacing.xxl,
          backgroundColor: 'rgba(0,0,0,0.72)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        {/*
          Three parts, and the outer two carry equal weight, so the shutter
          sits on the screen's centre line however many buttons flank it.
          Spread across four children it was the third of four and sat right
          of centre, which on a camera screen reads as the one control being
          in the wrong place.
        */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          <PressableScale
            onPress={onScanBarcode}
            accessibilityRole="button"
            accessibilityLabel="Scan a packet's barcode"
            style={{
              width: 50,
              height: 50,
              borderRadius: theme.radius.control,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/*
              Packaged food is the case a photograph is worst at: a model
              guessing at a wrapper is strictly worse than the figures the
              manufacturer already published against its barcode.
            */}
            <Icon name="database" size={21} color="#FFFFFF" strokeWidth={1.7} />
          </PressableScale>

          <PressableScale
            onPress={onPickFromLibrary}
            accessibilityRole="button"
            accessibilityLabel="Choose from your photos"
            style={{
              width: 50,
              height: 50,
              borderRadius: theme.radius.control,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="gallery" size={21} color="#FFFFFF" strokeWidth={1.7} />
          </PressableScale>
        </View>

        <PressableScale
          onPress={() => void capture()}
          haptic
          disabled={!ready || busy}
          accessibilityRole="button"
          accessibilityLabel="Take the photo"
          accessibilityState={{ disabled: !ready || busy }}
          style={{
            width: SHUTTER,
            height: SHUTTER,
            borderRadius: SHUTTER / 2,
            backgroundColor: 'rgba(255,255,255,0.24)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ready && !busy ? 1 : 0.5,
          }}
        >
          <View
            style={{
              width: SHUTTER - 14,
              height: SHUTTER - 14,
              borderRadius: (SHUTTER - 14) / 2,
              backgroundColor: '#FFFFFF',
            }}
          />
        </PressableScale>

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.md,
          }}
        >
          <PressableScale
            onPress={onAddByHand}
          accessibilityRole="button"
          accessibilityLabel="Add a meal by hand"
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
            <Icon name="pencil" size={20} color="#FFFFFF" strokeWidth={1.7} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

/** A translucent round control, legible over whatever the lens is seeing. */
function GlassButton({
  label,
  icon,
  onPress,
  active = false,
}: {
  label: string;
  icon: 'close' | 'flame';
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: active ? '#FFFFFF' : 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={icon}
        size={17}
        color={active ? '#0F0F12' : '#FFFFFF'}
        strokeWidth={2}
      />
    </Pressable>
  );
}

/**
 * Brackets at the corners of a square in the middle of the frame.
 *
 * Drawn over the preview rather than as a box, so they say "put the plate
 * inside this" without masking any of what the lens can see.
 */
function FramingGuides() {
  const line = 'rgba(255,255,255,0.75)';
  const weight = 2.5;

  const corners = [
    { top: '28%', left: '14%', borderTopWidth: weight, borderLeftWidth: weight, borderTopLeftRadius: 12 },
    { top: '28%', right: '14%', borderTopWidth: weight, borderRightWidth: weight, borderTopRightRadius: 12 },
    { bottom: '34%', left: '14%', borderBottomWidth: weight, borderLeftWidth: weight, borderBottomLeftRadius: 12 },
    { bottom: '34%', right: '14%', borderBottomWidth: weight, borderRightWidth: weight, borderBottomRightRadius: 12 },
  ] as const;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {corners.map((corner, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: GUIDE,
            height: GUIDE,
            borderColor: line,
            ...corner,
          }}
        />
      ))}
    </View>
  );
}
