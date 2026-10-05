import { trigger, HapticFeedbackTypes } from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export type HapticType = keyof typeof HapticFeedbackTypes;

/**
 * Thin, swappable wrapper around the haptics library — every call site in the
 * app goes through this one function, so the underlying library can be
 * replaced without touching UI primitives.
 */
export function triggerHaptic(type: HapticType = 'impactMedium'): void {
  trigger(type, options);
}

const CASCADE_STEPS: Array<{ type: HapticType; delay: number }> = [
  { type: 'impactLight', delay: 0 },
  { type: 'impactMedium', delay: 90 },
  { type: 'notificationSuccess', delay: 190 },
];

/**
 * A short escalating burst rather than a single pulse — reserved for
 * milestone moments (e.g. 100% daily adherence) where a single haptic reads
 * as just another button tap rather than something worth celebrating.
 */
export function triggerHapticCascade(): void {
  for (const step of CASCADE_STEPS) {
    setTimeout(() => trigger(step.type, options), step.delay);
  }
}
