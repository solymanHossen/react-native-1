import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, type PhotoFile } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { Image as ImageIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LargeTextButton } from '../ui';
import { useTheme } from '../../theme/useTheme';

export interface PrescriptionCameraViewProps {
  /** Called with the captured photo's filesystem path once the shutter completes. */
  onCapture: (photo: PhotoFile) => void;
  /** Called with the picked image's URI (typically a content:// URI on Android, not a file path) when selected from the gallery. */
  onSelectImage?: (uri: string) => void;
  /** Caller-controlled pause (e.g. while OCR is running on the previous capture) — in addition to this view's own focus/background handling. */
  paused?: boolean;
}

/**
 * Live camera viewfinder with a document-alignment reticle. Deliberately does
 * NOT run ML Kit as a VisionCamera frame processor: `@react-native-ml-kit/text-recognition`'s
 * API is a Promise-based native module call over an image file path, not a
 * frame-processor plugin, so there is nothing synchronous-per-frame to hook
 * up — OCR runs once on the still photo taken by the shutter button, in
 * PrescriptionScanScreen. This also means `react-native-worklets-core` and
 * `@shopify/react-native-skia` (VisionCamera's frame-processor peer deps)
 * aren't installed; VisionCamera degrades to "Frame Processors disabled"
 * with a log line, which is fine since none are used.
 *
 * Lifecycle / leak prevention: `isActive` is turned off (a) on unmount via
 * the effect cleanup, running before the Camera is torn out of the tree, and
 * (b) whenever the app backgrounds, via AppState — a camera session left
 * running while the app is backgrounded both wastes battery and can be
 * killed uncleanly by the OS.
 */
export function PrescriptionCameraView({ onCapture, onSelectImage, paused = false }: PrescriptionCameraViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [isMounted, setIsMounted] = useState(true);
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsForeground(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
      onCapture(photo);
    } catch (captureError) {
      console.warn('[PrescriptionCameraView] takePhoto failed', captureError);
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture]);

  const handlePickImage = useCallback(async () => {
    if (capturing || paused) return;
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });

      if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) {
        return;
      }

      // Pass the URI through as-is: on Android this is typically a
      // content:// URI (from the system Photo Picker / MediaStore), not a
      // file:// path, and ML Kit's InputImage.fromFilePath resolves either
      // scheme itself via Uri.parse. Stripping or rewriting the scheme here
      // produces a URI that resolves to nothing.
      onSelectImage?.(result.assets[0].uri);
    } catch (pickError) {
      console.warn('[PrescriptionCameraView] launchImageLibrary failed', pickError);
    }
  }, [capturing, paused, onSelectImage]);

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center gap-5 p-8" style={{ backgroundColor: theme.colors.canvas }}>
        <Text className="text-center text-body-lg" style={{ color: theme.colors.inkSecondary }}>
          Camera access is needed to scan a prescription or blister pack.
        </Text>
        <LargeTextButton label="Allow Camera Access" onPress={requestPermission} />
        {onSelectImage ? (
          <Pressable
            onPress={handlePickImage}
            className="flex-row items-center gap-2 rounded-2xl border px-5 py-3"
            style={{ borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
          >
            <ImageIcon color={theme.colors.ink} size={20} />
            <Text className="text-body-md font-semibold" style={{ color: theme.colors.ink }}>
              Upload Prescription Image
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center gap-5 p-8" style={{ backgroundColor: theme.colors.canvas }}>
        <Text className="text-center text-body-lg" style={{ color: theme.colors.inkSecondary }}>
          No camera device was found on this device.
        </Text>
        {onSelectImage ? (
          <Pressable
            onPress={handlePickImage}
            className="flex-row items-center gap-2 rounded-2xl border px-5 py-3"
            style={{ borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
          >
            <ImageIcon color={theme.colors.ink} size={20} />
            <Text className="text-body-md font-semibold" style={{ color: theme.colors.ink }}>
              Upload Prescription Image
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const isActive = isMounted && isForeground && !paused;

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive={isActive} photo={true} photoQualityBalance="quality" />

      {/* Reticle: plain Views, static alignment guide */}
      <View pointerEvents="none" className="flex-1 items-center justify-center">
        <View
          className="rounded-3xl"
          style={{
            width: '82%',
            aspectRatio: 1.4,
            borderWidth: 3,
            borderColor: theme.action.base,
            borderStyle: 'dashed',
          }}
        />
        <Text className="mt-5 text-body-lg" style={{ color: '#FFFFFF' }}>
          Align prescription or upload an image file
        </Text>
      </View>

      {/* Bottom control bar with live shutter button & file upload button */}
      <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-around px-8" style={{ paddingBottom: insets.bottom + 44 }}>
        <View style={{ width: 48 }} />

        <Pressable
          onPress={handleCapture}
          disabled={capturing || paused}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
          className="min-h-hit min-w-hit items-center justify-center rounded-full"
          style={{
            width: 76,
            height: 76,
            backgroundColor: '#FFFFFF',
            opacity: capturing || paused ? 0.6 : 1,
          }}
        >
          {capturing ? (
            <ActivityIndicator color={theme.action.base} />
          ) : (
            <View className="rounded-full" style={{ width: 60, height: 60, backgroundColor: theme.action.base }} />
          )}
        </Pressable>

        <Pressable
          onPress={handlePickImage}
          disabled={capturing || paused}
          accessibilityRole="button"
          accessibilityLabel="Upload prescription file"
          className="items-center justify-center rounded-full border border-white/20 p-3"
          style={{
            width: 48,
            height: 48,
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            opacity: capturing || paused ? 0.5 : 1,
          }}
        >
          <ImageIcon color="#FFFFFF" size={24} />
        </Pressable>
      </View>
    </View>
  );
}
