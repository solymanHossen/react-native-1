module.exports = {
  preset: '@react-native/jest-preset',
  // The preset's own transformIgnorePatterns only allows react-native/@react-native
  // packages through Babel. These extra libraries ship untranspiled ESM and need
  // the same treatment, or importing them throws "Cannot use import statement
  // outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-css-interop|nativewind|react-native-safe-area-context|react-native-mmkv|react-native-haptic-feedback|@op-engineering/op-sqlite|react-native-keychain|react-native-get-random-values)/)',
  ],
  // Metro (via NativeWind) understands `import './global.css'`; Jest doesn't
  // run a bundler, so the raw Tailwind directives aren't valid JS to it. This
  // import is a side-effecting style registration with nothing to assert on
  // in a component test, so an empty stub is enough. Pre-existing gap, not
  // introduced by this change — tsc/eslint were also never exercising this.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
  },
};
