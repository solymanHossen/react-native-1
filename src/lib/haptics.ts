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
