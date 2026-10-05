// Manual Jest mock for react-native-haptic-feedback — the real module calls
// TurboModuleRegistry.getEnforcing() at import time, which throws outside a
// native runtime. Mirrors the shape of the package's own (TS-only, not
// auto-discovered by Jest) src/__mocks__/react-native-haptic-feedback.ts.
const trigger = jest.fn();
const stop = jest.fn();
const isSupported = jest.fn().mockReturnValue(true);
const triggerPattern = jest.fn();
const impact = jest.fn();
const setEnabled = jest.fn();
const isEnabled = jest.fn().mockReturnValue(true);

const RNHapticFeedback = {
  trigger,
  stop,
  isSupported,
  triggerPattern,
  impact,
  setEnabled,
  isEnabled,
};

module.exports = {
  __esModule: true,
  default: RNHapticFeedback,
  trigger,
  stop,
  isSupported,
  triggerPattern,
  impact,
  setEnabled,
  isEnabled,
};
