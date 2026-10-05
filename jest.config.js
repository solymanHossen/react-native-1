module.exports = {
  preset: '@react-native/jest-preset',
  // The preset's own transformIgnorePatterns only allows react-native/@react-native
  // packages through Babel. These extra libraries ship untranspiled ESM and need
  // the same treatment, or importing them throws "Cannot use import statement
  // outside a module".
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-css-interop|nativewind|react-native-safe-area-context|react-native-mmkv|react-native-haptic-feedback|@op-engineering/op-sqlite|react-native-keychain|react-native-get-random-values|react-native-svg|lucide-react-native)/)',
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
