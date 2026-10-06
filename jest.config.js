module.exports = {
  preset: '@react-native/jest-preset',
  // `setupFiles` from a local config REPLACES the preset's own value rather
  // than merging with it, so the preset's RN-environment setup is included
  // explicitly here alongside react-native-gesture-handler's own
  // officially-documented Jest setup (mocks its native module before
  // anything imports it for real).
  setupFiles: [
    '<rootDir>/node_modules/@react-native/jest-preset/jest/setup.js',
    '<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js',
    '<rootDir>/node_modules/@shopify/react-native-skia/jestSetup.js',
  ],
  // The preset's own transformIgnorePatterns only allows react-native/@react-native
  // packages through Babel. These extra libraries ship untranspiled ESM and need
  // the same treatment, or importing them throws "Cannot use import statement
  // outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-image-picker|react-native-css-interop|nativewind|react-native-safe-area-context|react-native-mmkv|react-native-haptic-feedback|@op-engineering/op-sqlite|react-native-keychain|react-native-get-random-values|react-native-svg|lucide-react-native|react-native-vision-camera|@react-native-ml-kit/text-recognition|@gorhom/bottom-sheet|react-native-gesture-handler|@shopify/react-native-skia|@notifee/react-native|react-native-nfc-manager|react-native-html-to-pdf|react-native-share|react-native-fs|@react-native-documents/picker)/)',
  ],
  // Metro (via NativeWind) understands `import './global.css'`; Jest doesn't
  // run a bundler, so the raw Tailwind directives aren't valid JS to it. This
  // import is a side-effecting style registration with nothing to assert on
  // in a component test, so an empty stub is enough. Pre-existing gap, not
  // introduced by this change — tsc/eslint were also never exercising this.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
    // The preset's custom resolver prefers the package's "react-native"
    // export condition (to mirror Metro), which for this package points to
    // an untranspiled .mjs file — and babel-jest's `transform` patterns
    // don't match .mjs regardless of transformIgnorePatterns. Its "require"
    // condition points to a plain CJS build; force that one for Jest.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};
