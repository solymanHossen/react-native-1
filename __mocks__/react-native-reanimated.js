// Manual Jest mock for react-native-reanimated.
//
// The library's own `/mock` entry point still transitively requires its real
// native/initialization code path (react-native-reanimated/src/index.ts ->
// initializers.native.ts), which throws in the Jest/Node environment for
// this reanimated+worklets release (no native TurboModule, and the JS
// fallback's CSS-animation init isn't fully implemented either). This
// minimal mock covers only what this app's components actually use.
const React = require('react');

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

const Animated = {
  createAnimatedComponent: (Component) => Component,
  View: require('react-native').View,
  Text: require('react-native').Text,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
};
