// Rules tests need the Firestore emulator (Java 11+); run via `npm run test:rules`, not `npm test`.
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firebase/**/*.test.ts'],
  transform: { '\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  testTimeout: 20000,
};
