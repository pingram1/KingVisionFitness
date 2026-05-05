/** @type {import('jest').Config} */
/**
 * CI-friendly smoke suite: Node env + babel-jest for TS modules under test.
 * Add `preset: 'jest-expo'` (or RN integration tests) when you want full render tests locally.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/__tests__/node-smoke/**/*.test.js',
    '<rootDir>/src/**/*.flow.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)',
  ],
};
