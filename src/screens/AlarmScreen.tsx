import notifee from '@notifee/react-native';
import { AlertTriangle, Camera as CameraIcon, CheckCircle2, Nfc } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LargeTextButton } from '../components/ui';
import {
  OVERRIDE_HOLD_MS,
  canSnooze,
  confirmIntake,
  escalateToCaregiver,
  formatCountdown,
  isNfcAvailable,
  isPastEscalationDeadline,
  listenForTag,
  logManualOverride,
  msUntilEscalation,
  remainingSnoozes,
  scanPackForMedication,
  scheduleSnoozeAlarm,
  useActiveAlarmStore,
  VISION_CONFIDENCE_THRESHOLD,
  type ActiveAlarm,
} from '../alarms';
import { useTheme } from '../theme/useTheme';
import { triggerHapticCascade, triggerHaptic } from '../lib/haptics';

const VISION_CAPTURE_INTERVAL_MS = 2500;

type VerificationMode = 'nfc' | 'vision';
type Resolution = 'pending' | 'verified' | 'overridden' | 'escalated';

function usePulse() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse]);
  return pulse;
}

interface AlarmScreenProps {
  alarm: ActiveAlarm;
}

/**
 * Takes over the entire screen whenever an alarm is active (see App.tsx) —
 * there is deliberately no back button, no tab bar, no way to navigate away
 * from it except the three resolution paths below: NFC match, vision match,
 * or the hold-to-override safety valve.
 */
export default function AlarmScreen({ alarm }: AlarmScreenProps) {
  const theme = useTheme();
  const { payload, firedAtMs, snoozeCount } = alarm;
  const clearActiveAlarm = useActiveAlarmStore((state) => state.clearActiveAlarm);
  const incrementSnooze = useActiveAlarmStore((state) => state.incrementSnooze);

  const [mode, setMode] = useState<VerificationMode>('nfc');
  const [nfcReady, setNfcReady] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>('pending');
  const [remainingMs, setRemainingMs] = useState(() => msUntilEscalation(firedAtMs, Date.now()));
  const [overrideProgress, setOverrideProgress] = useState(0);
  const resolvedRef = useRef(false);
  const pulse = usePulse();

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const resolveAndClose = useCallback(
    async (next: Resolution, action: () => Promise<void>) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setResolution(next);
      try {
        await action();
      } finally {
        await notifee.cancelNotification(alarm.notificationId).catch(() => {});
        setTimeout(() => clearActiveAlarm(), next === 'verified' ? 1100 : 0);
      }
    },
    [alarm.notificationId, clearActiveAlarm],
  );

  // NFC: starts listening the moment the screen mounts (or the moment the
  // user switches back to NFC mode after trying the camera) and keeps
  // listening until a match resolves the alarm or the screen unmounts.
  useEffect(() => {
    if (mode !== 'nfc') return;
    let active = true;

    isNfcAvailable().then((available) => {
      if (active) setNfcReady(available);
    });

    const stopListening = listenForTag((uid) => {
      if (!active) return;
      if (payload.nfcTagUid && uid === payload.nfcTagUid) {
        runOnJS(triggerHapticCascade)();
        resolveAndClose('verified', () => confirmIntake(payload, 'NFC'));
      } else {
        setStatusMessage('That tag doesn’t match this medication — try the correct bottle.');
        triggerHaptic('notificationError');
      }
    });

    return () => {
      active = false;
      stopListening();
    };
  }, [mode, payload, resolveAndClose]);

  // Vision fallback: auto-captures and scores a frame on a fixed interval
  // rather than a manual shutter — the person using this may be groggy or
  // fumbling with a blister pack, and shouldn't also have to time a photo.
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanning, setScanning] = useState(false);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'vision') return;
    if (!hasPermission) {
      requestPermission();
      return;
    }
    const interval = setInterval(async () => {
      if (!cameraRef.current || scanning || resolvedRef.current) return;
      setScanning(true);
      try {
        const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
        const result = await scanPackForMedication(photo.path, payload.medicationName);
        setLastConfidence(result.confidence);
        if (result.verified) {
          triggerHapticCascade();
          resolveAndClose('verified', () => confirmIntake(payload, 'VISION'));
        }
      } catch (captureError) {
        console.warn('[AlarmScreen] vision capture failed', captureError);
      } finally {
        setScanning(false);
      }
    }, VISION_CAPTURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, hasPermission, requestPermission, scanning, payload, resolveAndClose]);

  // Escalation countdown — ticks every second; once 15 minutes pass with no
  // resolution, auto-marks the dose MISSED and alerts the configured
  // caregiver number, then closes the screen on its own.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemainingMs(msUntilEscalation(firedAtMs, now));
      if (isPastEscalationDeadline(firedAtMs, now)) {
        resolveAndClose('escalated', () => escalateToCaregiver(payload));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [firedAtMs, payload, resolveAndClose]);

  const handleSnooze = useCallback(async () => {
    if (!canSnooze(snoozeCount)) return;
    triggerHaptic('impactMedium');
    await scheduleSnoozeAlarm(alarm.notificationId, payload);
    incrementSnooze();
    await notifee.cancelNotification(alarm.notificationId).catch(() => {});
    clearActiveAlarm();
  }, [alarm.notificationId, clearActiveAlarm, incrementSnooze, payload, snoozeCount]);

  // Hold-to-override: a sustained press for OVERRIDE_HOLD_MS silences the
  // alarm without verification — logged as a manual override, never as a
  // confirmed dose. Exists so a hardware failure (no tag, dead camera)
  // or a genuine emergency can't trap someone in an un-silenceable screen.
  const overrideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleOverridePressIn = useCallback(() => {
    const startedAt = Date.now();
    overrideTimer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / OVERRIDE_HOLD_MS);
      setOverrideProgress(progress);
      if (progress >= 1) {
        if (overrideTimer.current) clearInterval(overrideTimer.current);
        triggerHaptic('notificationWarning');
        resolveAndClose('overridden', () => logManualOverride(payload));
      }
    }, 100);
  }, [payload, resolveAndClose]);

  const handleOverridePressOut = useCallback(() => {
    if (overrideTimer.current) clearInterval(overrideTimer.current);
    setOverrideProgress(0);
  }, []);

  if (resolution === 'verified') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-6" style={{ backgroundColor: theme.colors.canvas }}>
        <CheckCircle2 color={theme.status.taken.base} size={96} strokeWidth={1.5} />
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {payload.medicationName} confirmed
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#0B0E14' }}>
      <View className="flex-1 items-center justify-center gap-5 px-8">
        <Text className="text-caption uppercase tracking-wider" style={{ color: '#8891A7' }}>
          Medication Alarm
        </Text>
        <Text className="text-center text-display-lg" style={{ color: '#FFFFFF' }}>
          {payload.medicationName}
        </Text>
        <Text className="text-center text-body-lg" style={{ color: '#AEB8CC' }}>
          {payload.dosageLabel}
        </Text>

        {mode === 'nfc' ? (
          <View className="items-center gap-4">
            <Animated.View style={pulseStyle}>
              <View className="items-center justify-center rounded-full" style={{ width: 140, height: 140, backgroundColor: 'rgba(37,99,235,0.18)' }}>
                <Nfc color="#5B8DEF" size={64} strokeWidth={1.5} />
              </View>
            </Animated.View>
            <Text className="text-center text-body-lg" style={{ color: '#FFFFFF' }}>
              {nfcReady ? 'Hold the medication bottle’s tag near your phone' : 'NFC isn’t available on this device'}
            </Text>
          </View>
        ) : (
          <View className="w-full items-center gap-3">
            <View className="overflow-hidden rounded-3xl" style={{ width: 240, height: 320, backgroundColor: '#000000' }}>
              {device && hasPermission ? (
                <Camera ref={cameraRef} style={{ width: 240, height: 320 }} device={device} isActive photo />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <CameraIcon color="#8891A7" size={40} />
                </View>
              )}
            </View>
            <Text className="text-center text-body-lg" style={{ color: '#FFFFFF' }}>
              Show the blister pack or label to the camera
            </Text>
            {scanning ? <ActivityIndicator color="#FFFFFF" /> : null}
            {lastConfidence !== null ? (
              <Text className="text-caption" style={{ color: '#AEB8CC' }}>
                Last read: {lastConfidence}% match (need {VISION_CONFIDENCE_THRESHOLD}%)
              </Text>
            ) : null}
          </View>
        )}

        {statusMessage ? (
          <View className="flex-row items-center gap-2 rounded-2xl px-4 py-2" style={{ backgroundColor: 'rgba(255,107,107,0.15)' }}>
            <AlertTriangle color="#FF6B6B" size={18} />
            <Text className="text-caption" style={{ color: '#FF9B9B' }}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <Pressable onPress={() => setMode(mode === 'nfc' ? 'vision' : 'nfc')} accessibilityRole="button">
          <Text className="text-body-lg underline" style={{ color: '#5B8DEF' }}>
            {mode === 'nfc' ? 'Problem scanning? Use the camera instead' : 'Use NFC tag instead'}
          </Text>
        </Pressable>

        <Text className="text-caption" style={{ color: '#8891A7' }}>
          Auto-escalates to your caregiver in {formatCountdown(remainingMs)}
        </Text>
      </View>

      <View className="gap-4 px-8 pb-10">
        {canSnooze(snoozeCount) ? (
          <LargeTextButton
            label={`Snooze 5 min (${remainingSnoozes(snoozeCount)} left)`}
            variant="secondary"
            onPress={handleSnooze}
          />
        ) : (
          <View className="min-h-hit items-center justify-center rounded-full border px-8 py-5" style={{ borderColor: '#2A324B' }}>
            <Text className="text-body-lg" style={{ color: '#5B6476' }}>
              No snoozes left
            </Text>
          </View>
        )}

        <Pressable
          onPressIn={handleOverridePressIn}
          onPressOut={handleOverridePressOut}
          accessibilityRole="button"
          accessibilityLabel="Emergency silence, hold for 10 seconds"
          className="min-h-hit items-center justify-center overflow-hidden rounded-full border"
          style={{ borderColor: 'rgba(255,107,107,0.4)' }}
        >
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${overrideProgress * 100}%`, backgroundColor: 'rgba(255,107,107,0.25)' }}
          />
          <Text className="text-body-lg" style={{ color: '#FF9B9B' }}>
            Hold 10s: Emergency Silence (won&apos;t count as taken)
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
