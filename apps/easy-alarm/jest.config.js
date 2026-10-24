/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!utils/alarmNotifications.ts',
    '!utils/alarmSound.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|mjs)'],
  modulePathIgnorePatterns: ['<rootDir>/android/', '<rootDir>/ios/'],
};
