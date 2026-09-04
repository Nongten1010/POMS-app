/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // The self-hosted deploy runner preserves node_modules between jobs, while its temp
  // directory is cleared. Keep Jest's transform cache alongside the preserved install.
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  // Windows runners can need more than Jest's 500 ms default to close child processes.
  workerGracefulExitTimeout: 2_000,
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@db/(.*)$': '<rootDir>/src/db/$1',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
};
