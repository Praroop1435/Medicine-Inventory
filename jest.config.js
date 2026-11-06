module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide's react-native export is ESM (.mjs), which jest does not transform.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // standard-navigation (expo-router dependency) ships untranspiled ESM.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation))',
  ],
  // Rules tests need the Firestore emulator; they run via `npm run test:rules`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/firebase/'],
};
