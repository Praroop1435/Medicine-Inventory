module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // Rules tests need the Firestore emulator; they run via `npm run test:rules`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/firebase/'],
};
