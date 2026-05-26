/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.(ts|js)', '**/*.jest.test.(ts|js)'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Keep type-checking inside tests off — `tsc --noEmit` runs in CI.
        // Skipping isolated TS checks shaves ~3s off the suite.
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // We are bootstrapping coverage on the critical-logic modules only.
  // Threshold lifts the floor (so a future PR can't accidentally drop it)
  // without blocking work that doesn't touch these files.
  collectCoverageFrom: [
    'src/utils/performanceScoring.ts',
    'src/utils/geo.ts',
    'src/utils/leaderboard.ts',
  ],
  coverageThreshold: {
    'src/utils/performanceScoring.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/utils/geo.ts': {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/utils/leaderboard.ts': {
      branches: 75,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
