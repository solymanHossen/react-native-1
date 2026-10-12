import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { AlertTriangle, Clock } from 'lucide-react-native';
import { triggerHaptic, triggerHapticCascade } from '../../lib/haptics';
import { useTranslation } from '../../i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SCALE = 0.97;
const SPRING_CONFIG = { damping: 15, stiffness: 220, mass: 0.5 };
const PROGRESS_TICK_MS = 50;

export interface EmergencyHoldButtonProps {
  /** Called when the button has been held for the required duration. */
  onComplete: () => void;
  /** Hold duration in milliseconds (default: 10,000ms / 10s). */
  holdDurationMs?: number;
  /** Optional custom title; falls back to i18n alarmRinging.overrideTitle. */
  title?: string;
  /** Optional custom subtitle; falls back to i18n alarmRinging.overrideSubtitle. */
  subtitle?: string;
  /** Button geometry: 'rounded' (rounded-2xl) or 'pill' (rounded-full). Default: 'rounded'. */
  shape?: 'rounded' | 'pill';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Modern Emergency Silence / Override Hold Button.
 *
 * Designed specifically for safety-critical alarm silences:
 * - Prevents accidental dismissals by requiring a continuous 10-second hold.
 * - Glassmorphism aesthetics with dark crimson obsidian tones and glowing red neon rim.
 * - Dynamic 2-tier typography (Action Title + Context Subtitle) preventing text clipping.
 * - Real-time countdown timer badge and dual progress indicators (ambient flood + bottom track).
 * - Rhythmic haptic pulses on every second elapsed during hold, with a milestone cascade upon completion.
 */
export function EmergencyHoldButton({
  onComplete,
  holdDurationMs = 10000,
  title,
  subtitle,
  shape = 'rounded',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: EmergencyHoldButtonProps) {
  const { t } = useTranslation();
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.ceil(holdDurationMs / 1000));

  const scale = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSecondTickedRef = useRef<number>(-1);
  const completedRef = useRef(false);

  const animatedScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const stopHoldTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePressIn = useCallback(() => {
    stopHoldTimer();
    completedRef.current = false;
    lastSecondTickedRef.current = -1;

    scale.value = withSpring(PRESS_SCALE, SPRING_CONFIG);
    setIsHolding(true);
    setProgress(0);
    setRemainingSeconds(Math.ceil(holdDurationMs / 1000));
    triggerHaptic('impactLight');

    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const currentProgress = Math.min(1, elapsed / holdDurationMs);
      const secondsLeft = Math.max(0, Math.ceil((holdDurationMs - elapsed) / 1000));

      setProgress(currentProgress);
      setRemainingSeconds(secondsLeft);

      // Provide rhythmic tactile feedback on every full second elapsed
      const fullSecondsElapsed = Math.floor(elapsed / 1000);
      if (fullSecondsElapsed > lastSecondTickedRef.current && fullSecondsElapsed > 0) {
        lastSecondTickedRef.current = fullSecondsElapsed;
        triggerHaptic('impactLight');
      }

      if (currentProgress >= 1 && !completedRef.current) {
        completedRef.current = true;
        stopHoldTimer();
        setIsHolding(false);
        scale.value = withSpring(1, SPRING_CONFIG);
        triggerHaptic('notificationWarning');
        triggerHapticCascade();
        onComplete();
      }
    }, PROGRESS_TICK_MS);
  }, [holdDurationMs, onComplete, scale, stopHoldTimer]);

  const handlePressOut = useCallback(() => {
    if (completedRef.current) return;
    stopHoldTimer();
    scale.value = withSpring(1, SPRING_CONFIG);
    setIsHolding(false);
    setProgress(0);
    setRemainingSeconds(Math.ceil(holdDurationMs / 1000));
  }, [holdDurationMs, scale, stopHoldTimer]);

  useEffect(() => {
    return () => {
      stopHoldTimer();
    };
  }, [stopHoldTimer]);

  const displayTitle = title ?? t('alarmRinging.overrideTitle');
  const displaySubtitle = subtitle ?? t('alarmRinging.overrideSubtitle');
  const totalSeconds = Math.ceil(holdDurationMs / 1000);

  const containerRadiusClass = shape === 'pill' ? 'rounded-full px-7 py-4' : 'rounded-2xl px-5 py-3.5';

  return (
    <AnimatedPressable
      testID={testID}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('alarmRinging.overrideAccessibility')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: isHolding }}
      className={`relative min-h-hit min-w-hit overflow-hidden border ${containerRadiusClass}`}
      style={[
        {
          backgroundColor: isHolding ? 'rgba(48, 16, 22, 0.92)' : 'rgba(32, 14, 18, 0.78)',
          borderColor: isHolding ? 'rgba(239, 68, 68, 0.85)' : 'rgba(239, 68, 68, 0.35)',
          shadowColor: '#EF4444',
          shadowOffset: { width: 0, height: isHolding ? 6 : 3 },
          shadowOpacity: isHolding ? 0.55 : 0.22,
          shadowRadius: isHolding ? 18 : 10,
          elevation: isHolding ? 8 : 4,
        },
        animatedScaleStyle,
      ]}
    >
      {/* Frosted glass top specular highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 16,
          right: 16,
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
        }}
      />

      {/* Layer 1: Ambient background progress fill */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          backgroundColor: isHolding ? 'rgba(239, 68, 68, 0.28)' : 'transparent',
        }}
      />

      {/* Layer 2: Glowing leading edge */}
      {isHolding && progress > 0 && progress < 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: '#FF8A8A',
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6,
          }}
        />
      ) : null}

      {/* Interactive content with clear visual hierarchy */}
      <View className="items-center justify-center gap-1">
        {/* Tier 1: Action Header Row (Icon + Title + Countdown Badge) */}
        <View className="w-full flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <AlertTriangle
              color={isHolding ? '#FF4D4D' : '#F87171'}
              size={18}
              strokeWidth={2.4}
            />
            <Text
              className="text-body-md font-semibold tracking-wide"
              style={{ color: isHolding ? '#FFFFFF' : '#FCA5A5' }}
            >
              {displayTitle}
            </Text>
          </View>

          {/* Dynamic Countdown / Time Badge */}
          <View
            className="flex-row items-center gap-1 rounded-full border px-2.5 py-0.5"
            style={{
              backgroundColor: isHolding ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.14)',
              borderColor: isHolding ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.25)',
            }}
          >
            <Clock color="#FCA5A5" size={11} strokeWidth={2.2} />
            <Text
              style={{
                color: isHolding ? '#FFFFFF' : '#FCA5A5',
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {isHolding
                ? `${remainingSeconds}s`
                : t('alarmRinging.overrideBadge', { seconds: totalSeconds })}
            </Text>
          </View>
        </View>

        {/* Tier 2: Context Subtitle / Warning Note */}
        <Text
          className="text-caption text-center"
          style={{
            color: isHolding ? '#FECACA' : '#F87171',
            opacity: isHolding ? 0.95 : 0.8,
            fontWeight: isHolding ? '500' : '400',
          }}
          numberOfLines={2}
        >
          {isHolding
            ? t('alarmRinging.overrideHolding', { seconds: remainingSeconds })
            : displaySubtitle}
        </Text>
      </View>

      {/* Layer 3: Bottom micro-progress bar track */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: isHolding ? '#EF4444' : 'transparent',
          }}
        />
      </View>
    </AnimatedPressable>
  );
}
