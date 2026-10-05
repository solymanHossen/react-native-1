// Manual Jest mock for react-native-reanimated.
//
// The library's own `/mock` entry point still transitively requires its real
// native/initialization code path (react-native-reanimated/src/index.ts ->
// initializers.native.ts), which throws in the Jest/Node environment for
// this reanimated+worklets release (no native TurboModule, and the JS
// fallback's CSS-animation init isn't fully implemented either). This
// minimal mock covers only what this app's components actually use.
const React = require('react');

// @gorhom/bottom-sheet calls `Easing.out(Easing.exp)` at module scope (to
// build a constant), so this needs to exist and be chainable even though
// nothing here ever actually runs an easing curve. A Proxy means any method
// name bottom-sheet (or anything else) reaches for returns another no-op
// easing function, without having to enumerate reanimated's real Easing API.
const easingFn = (t) => t;
const Easing = new Proxy(easingFn, {
  get: () => new Proxy(easingFn, { get: () => easingFn, apply: () => easingFn }),
  apply: () => easingFn,
});

function useSharedValue(initialValue) {
  return React.useRef({ value: initialValue }).current;
}

function useAnimatedStyle(styleFactory) {
  return styleFactory();
}

function withSpring(toValue) {
  return toValue;
}

function withTiming(toValue) {
  return toValue;
}

const knownAnimated = {
  createAnimatedComponent: (Component) => Component,
  View: require('react-native').View,
  Text: require('react-native').Text,
};

// @gorhom/bottom-sheet calls assorted `Animated.*` setup functions (e.g.
// `addWhitelistedUIProps`) at module scope to register itself with
// Reanimated's native UI-prop whitelist — meaningless without the real
// native runtime, but it still needs to exist and not throw. Rather than
// enumerating every such call this library (or a future one) might make,
// fall through to a no-op function for anything not explicitly mocked above.
const Animated = new Proxy(knownAnimated, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => undefined;
  },
});

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
};
